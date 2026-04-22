#[cfg(not(test))]
mod commands;

#[cfg(not(test))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::set_ignore_cursor_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use serde_json::Value;
    use std::fs;

    fn load_tauri_config() -> Value {
        let config_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tauri.conf.json");
        let content = fs::read_to_string(&config_path)
            .expect("Failed to read tauri.conf.json");
        serde_json::from_str(&content).expect("Failed to parse tauri.conf.json")
    }

    fn get_main_window_config(config: &Value) -> &Value {
        &config["app"]["windows"][0]
    }

    #[test]
    fn test_window_is_transparent() {
        let config = load_tauri_config();
        let win = get_main_window_config(&config);
        assert_eq!(win["transparent"].as_bool(), Some(true));
    }

    #[test]
    fn test_window_has_no_decorations() {
        let config = load_tauri_config();
        let win = get_main_window_config(&config);
        assert_eq!(win["decorations"].as_bool(), Some(false));
    }

    #[test]
    fn test_window_is_always_on_top() {
        let config = load_tauri_config();
        let win = get_main_window_config(&config);
        assert_eq!(win["alwaysOnTop"].as_bool(), Some(true));
    }

    #[test]
    fn test_window_is_not_resizable() {
        let config = load_tauri_config();
        let win = get_main_window_config(&config);
        assert_eq!(win["resizable"].as_bool(), Some(false));
    }

    #[test]
    fn test_window_skip_taskbar() {
        let config = load_tauri_config();
        let win = get_main_window_config(&config);
        assert_eq!(win["skipTaskbar"].as_bool(), Some(true));
    }

    #[test]
    fn test_commands_module_exists() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("commands")
            .join("mod.rs");
        assert!(src.exists(), "commands/mod.rs should exist");
        let content = fs::read_to_string(&src).unwrap();
        assert!(content.contains("set_ignore_cursor_events"), "set_ignore_cursor_events command should exist");
        assert!(content.contains("#[tauri::command]"), "function should be a Tauri command");
    }

    #[test]
    fn test_command_registered_in_run() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("lib.rs");
        let content = fs::read_to_string(&src).unwrap();
        assert!(content.contains("set_ignore_cursor_events"), "command should be registered in generate_handler");
    }
}
