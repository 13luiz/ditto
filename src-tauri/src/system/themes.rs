use std::fs;
use std::path::PathBuf;

pub fn themes_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ditto")
        .join("themes")
}

pub fn list_themes() -> Vec<String> {
    let mut themes = vec!["default".to_string()];
    if let Ok(entries) = fs::read_dir(themes_dir()) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                let path = entry.path();
                if path.is_dir()
                    && path.join("spritesheet.png").exists()
                    && path.join("animations.json").exists()
                {
                    themes.push(name.to_string());
                }
            }
        }
    }
    themes.sort();
    themes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_theme_always_listed() {
        let themes = list_themes();
        assert!(themes.contains(&"default".to_string()));
    }

    #[test]
    fn test_themes_dir_is_under_data_local() {
        let dir = themes_dir();
        assert!(dir.to_string_lossy().contains("ditto"));
        assert!(dir.to_string_lossy().contains("themes"));
    }
}
