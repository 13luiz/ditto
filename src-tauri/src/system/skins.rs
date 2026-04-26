use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SkinSource {
    Bundled,
    User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkinEntry {
    pub id: String,
    pub name: String,
    pub renderer: String,
    pub source: SkinSource,
    pub path: String,
}

pub fn skins_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ditto")
        .join("skins")
}

pub fn bundled_skins_dir() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("public")
        .join("skins")
}

fn scan_skin_dir(base: PathBuf, source: SkinSource) -> Vec<SkinEntry> {
    let mut entries = Vec::new();
    if let Ok(dir_entries) = fs::read_dir(&base) {
        for entry in dir_entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let manifest_path = path.join("skin.json");
            if !manifest_path.exists() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                    entries.push(SkinEntry {
                        id: id.clone(),
                        name: manifest["name"].as_str().unwrap_or(&id).to_string(),
                        renderer: manifest["renderer"]
                            .as_str()
                            .unwrap_or("sprite")
                            .to_string(),
                        source: source.clone(),
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    entries
}

pub fn list_skins_catalog() -> Vec<SkinEntry> {
    let mut catalog = Vec::new();

    // Scan bundled skins
    catalog.extend(scan_skin_dir(bundled_skins_dir(), SkinSource::Bundled));

    // Scan user-installed skins
    catalog.extend(scan_skin_dir(skins_dir(), SkinSource::User));

    // Deduplicate by id (bundled takes priority)
    let mut seen = std::collections::HashSet::new();
    catalog.retain(|e| seen.insert(e.id.clone()));

    catalog.sort_by(|a, b| a.id.cmp(&b.id));
    catalog
}

pub fn list_skins() -> Vec<String> {
    let mut skins = vec!["default".to_string()];
    if let Ok(entries) = fs::read_dir(skins_dir()) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                let path = entry.path();
                if path.is_dir() && path.join("skin.json").exists() {
                    skins.push(name.to_string());
                }
            }
        }
    }
    skins.sort();
    skins
}

#[derive(Debug)]
pub struct ImportResult {
    pub id: String,
    pub path: PathBuf,
}

pub fn import_skin_zip(zip_path: &str, dest_dir: &std::path::Path) -> Result<ImportResult, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("cannot open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("invalid zip: {}", e))?;

    // Find skin.json to determine the skin ID
    let manifest_json = archive
        .by_name("skin.json")
        .map_err(|_| "zip missing skin.json".to_string())?;
    let manifest: serde_json::Value =
        serde_json::from_reader(manifest_json).map_err(|e| format!("invalid skin.json: {}", e))?;

    let name = manifest["name"]
        .as_str()
        .ok_or("skin.json missing 'name' field")?;
    let renderer = manifest["renderer"]
        .as_str()
        .ok_or("skin.json missing 'renderer' field")?;

    if !["sprite", "spine", "live2d", "lottie", "vrm"].contains(&renderer) {
        return Err(format!("unsupported renderer: {}", renderer));
    }

    let skin_id = name.to_lowercase().replace(' ', "-");
    let skin_dir = dest_dir.join(&skin_id);

    // Check for path traversal in all entries using raw names
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw_name = entry.name().to_string();
        if raw_name.starts_with('/') || raw_name.contains("..") {
            return Err(format!("path traversal detected: {}", raw_name));
        }
    }

    // Extract
    fs::create_dir_all(&skin_dir).map_err(|e| format!("cannot create skin dir: {}", e))?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_path = entry.mangled_name();
        let out_path = skin_dir.join(&entry_path);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| format!("cannot create dir: {}", e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("cannot create parent dir: {}", e))?;
            }
            let mut out_file =
                fs::File::create(&out_path).map_err(|e| format!("cannot create file: {}", e))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("cannot write file: {}", e))?;
        }
    }

    Ok(ImportResult {
        id: skin_id,
        path: skin_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn create_temp_skin_dir(base: &PathBuf, name: &str, renderer: &str) -> PathBuf {
        let skin_dir = base.join(name);
        fs::create_dir_all(&skin_dir).unwrap();
        let manifest = serde_json::json!({
            "schema_version": "1.0",
            "name": name,
            "author": "test",
            "version": "1.0.0",
            "renderer": renderer,
            "size": { "width": 64, "height": 64 },
            "state_map": {}
        });
        let mut f = fs::File::create(skin_dir.join("skin.json")).unwrap();
        f.write_all(serde_json::to_string(&manifest).unwrap().as_bytes())
            .unwrap();
        skin_dir
    }

    #[test]
    fn test_default_skin_always_listed() {
        let skins = list_skins();
        assert!(skins.contains(&"default".to_string()));
    }

    #[test]
    fn test_skins_dir_is_under_data_local() {
        let dir = skins_dir();
        assert!(dir.to_string_lossy().contains("ditto"));
        assert!(dir.to_string_lossy().contains("skins"));
    }

    #[test]
    fn test_list_skins_merged_catalog() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let bundled = tmp_dir.path().join("bundled");
        let user = tmp_dir.path().join("user");
        fs::create_dir_all(&bundled).unwrap();
        fs::create_dir_all(&user).unwrap();

        create_temp_skin_dir(&bundled, "pixel-cat", "sprite");
        create_temp_skin_dir(&bundled, "knight", "spine");
        create_temp_skin_dir(&user, "custom-pet", "sprite");

        let mut catalog = Vec::new();
        catalog.extend(scan_skin_dir(bundled.clone(), SkinSource::Bundled));
        catalog.extend(scan_skin_dir(user.clone(), SkinSource::User));
        catalog.sort_by(|a, b| a.id.cmp(&b.id));

        assert_eq!(catalog.len(), 3);

        assert_eq!(catalog[0].id, "custom-pet");
        assert_eq!(catalog[0].source, SkinSource::User);
        assert_eq!(catalog[0].renderer, "sprite");

        assert_eq!(catalog[1].id, "knight");
        assert_eq!(catalog[1].source, SkinSource::Bundled);
        assert_eq!(catalog[1].renderer, "spine");

        assert_eq!(catalog[2].id, "pixel-cat");
        assert_eq!(catalog[2].source, SkinSource::Bundled);
        assert_eq!(catalog[2].renderer, "sprite");
    }

    #[test]
    fn test_catalog_deduplication_bundled_priority() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let bundled = tmp_dir.path().join("bundled");
        let user = tmp_dir.path().join("user");
        fs::create_dir_all(&bundled).unwrap();
        fs::create_dir_all(&user).unwrap();

        // Same skin ID in both dirs
        create_temp_skin_dir(&bundled, "my-skin", "sprite");
        create_temp_skin_dir(&user, "my-skin", "sprite");

        let mut catalog = Vec::new();
        catalog.extend(scan_skin_dir(bundled, SkinSource::Bundled));
        catalog.extend(scan_skin_dir(user, SkinSource::User));

        let mut seen = std::collections::HashSet::new();
        catalog.retain(|e| seen.insert(e.id.clone()));

        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].source, SkinSource::Bundled);
    }

    #[test]
    fn test_scan_skips_dirs_without_manifest() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let base = tmp_dir.path().to_path_buf();
        fs::create_dir_all(base.join("no-manifest")).unwrap();
        create_temp_skin_dir(&base, "has-manifest", "sprite");

        let catalog = scan_skin_dir(base, SkinSource::Bundled);
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].id, "has-manifest");
    }

    fn create_skin_zip(tmp_dir: &std::path::Path, skin_name: &str, renderer: &str) -> PathBuf {
        let zip_path = tmp_dir.join("test-skin.zip");
        let file = fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();

        let manifest = serde_json::json!({
            "schema_version": "1.0",
            "name": skin_name,
            "author": "test",
            "version": "1.0.0",
            "renderer": renderer,
            "size": { "width": 64, "height": 64 },
            "state_map": {}
        });
        zip.start_file("skin.json", options).unwrap();
        zip.write_all(serde_json::to_string(&manifest).unwrap().as_bytes())
            .unwrap();

        zip.start_file("spritesheet.png", options).unwrap();
        zip.write_all(b"fake-png-data").unwrap();

        zip.finish().unwrap();
        zip_path
    }

    #[test]
    fn test_import_skin_zip_roundtrip() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let zip_path = create_skin_zip(tmp_dir.path(), "Test Pet", "sprite");
        let dest = tmp_dir.path().join("installed");

        let result = import_skin_zip(zip_path.to_str().unwrap(), &dest).unwrap();

        assert_eq!(result.id, "test-pet");
        assert!(dest.join("test-pet").exists());
        assert!(dest.join("test-pet/skin.json").exists());
        assert!(dest.join("test-pet/spritesheet.png").exists());

        // Verify the installed skin appears in catalog
        let catalog = scan_skin_dir(dest, SkinSource::User);
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].id, "test-pet");
        assert_eq!(catalog[0].renderer, "sprite");
    }

    #[test]
    fn test_import_rejects_missing_manifest() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let zip_path = tmp_dir.path().join("bad.zip");
        let file = fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file("spritesheet.png", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"data").unwrap();
        zip.finish().unwrap();

        let result = import_skin_zip(zip_path.to_str().unwrap(), &tmp_dir.path().join("dest"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing skin.json"));
    }

    #[test]
    fn test_import_rejects_path_traversal() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let zip_path = tmp_dir.path().join("evil.zip");
        let file = fs::File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();

        let manifest = serde_json::json!({
            "schema_version": "1.0",
            "name": "Evil",
            "author": "hacker",
            "version": "1.0.0",
            "renderer": "sprite",
            "size": { "width": 64, "height": 64 },
            "state_map": {}
        });
        zip.start_file("skin.json", options).unwrap();
        zip.write_all(serde_json::to_string(&manifest).unwrap().as_bytes())
            .unwrap();

        zip.start_file("../etc/passwd", options).unwrap();
        zip.write_all(b"evil").unwrap();

        zip.finish().unwrap();

        let result = import_skin_zip(zip_path.to_str().unwrap(), &tmp_dir.path().join("dest"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("path traversal"));
    }
}
