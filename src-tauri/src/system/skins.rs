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
}
