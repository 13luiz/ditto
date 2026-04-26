use std::fs;
use std::path::PathBuf;

pub fn skins_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ditto")
        .join("skins")
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
}
