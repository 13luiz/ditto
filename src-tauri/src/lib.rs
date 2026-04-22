#[cfg(not(test))]
mod commands;

#[cfg(not(test))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::set_ignore_cursor_events,
            commands::get_cursor_position
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use serde_json::Value;
    use std::fs;

    fn load_tauri_config() -> Value {
        let config_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
        let content = fs::read_to_string(&config_path).expect("Failed to read tauri.conf.json");
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
        assert!(
            content.contains("set_ignore_cursor_events"),
            "set_ignore_cursor_events command should exist"
        );
        assert!(
            content.contains("#[tauri::command]"),
            "function should be a Tauri command"
        );
    }

    #[test]
    fn test_command_registered_in_run() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("lib.rs");
        let content = fs::read_to_string(&src).unwrap();
        assert!(
            content.contains("set_ignore_cursor_events"),
            "command should be registered in generate_handler"
        );
    }

    fn load_animations_config() -> Value {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("assets")
            .join("pets")
            .join("default")
            .join("animations.json");
        let content = fs::read_to_string(&path).expect("Failed to read animations.json");
        serde_json::from_str(&content).expect("Failed to parse animations.json")
    }

    #[test]
    fn test_animation_config_has_idle() {
        let config = load_animations_config();
        assert!(
            config["animations"]["idle"].is_object(),
            "idle animation must exist"
        );
    }

    #[test]
    fn test_animation_idle_has_valid_frames() {
        let config = load_animations_config();
        let idle = &config["animations"]["idle"];
        let frames = idle["frames"].as_array().expect("frames must be an array");
        assert!(!frames.is_empty(), "idle animation must have frames");
        assert!(
            idle["fps"].as_u64().unwrap_or(0) >= 4,
            "idle FPS must be >= 4"
        );
        assert!(
            idle["loop"].as_bool().unwrap_or(false),
            "idle animation must loop"
        );
    }

    #[test]
    fn test_animation_meta_valid() {
        let config = load_animations_config();
        let meta = &config["meta"];
        assert!(
            meta["frame_width"].as_u64().unwrap_or(0) > 0,
            "frame_width must be > 0"
        );
        assert!(
            meta["frame_height"].as_u64().unwrap_or(0) > 0,
            "frame_height must be > 0"
        );
        assert!(
            meta["columns"].as_u64().unwrap_or(0) > 0,
            "columns must be > 0"
        );
    }

    #[test]
    fn test_animation_fps_target_achievable() {
        let config = load_animations_config();
        let fps = config["animations"]["idle"]["fps"].as_u64().unwrap();
        assert!(
            fps <= 60,
            "target FPS must be <= 60 for requestAnimationFrame"
        );
        assert!(fps >= 4, "target FPS must be >= 4 for visible animation");
    }
}
