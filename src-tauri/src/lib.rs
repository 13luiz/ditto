#[cfg(not(test))]
mod commands;

#[cfg(not(test))]
use commands::AppState;
mod behavior;

#[allow(dead_code)]
mod care;

#[allow(dead_code)]
mod db;

#[allow(dead_code)]
mod agent;

#[allow(dead_code)]
mod system;

#[cfg(not(test))]
fn load_env_provider_config(db: &db::Database) {
    let api_key = match std::env::var("DITTO_LLM_API_KEY") {
        Ok(k) => k,
        Err(_) => return,
    };
    let llm_type = std::env::var("DITTO_LLM_TYPE").unwrap_or_else(|_| "openai".to_string());
    let model = std::env::var("DITTO_LLM_MODEL").unwrap_or_else(|_| "gpt-4o".to_string());
    let base_url = std::env::var("DITTO_LLM_BASE_URL").ok();

    let mut config = serde_json::json!({
        "type": llm_type,
        "api_key": api_key,
        "model": model
    });
    if let Some(url) = base_url {
        config["base_url"] = serde_json::Value::String(url);
    }

    let config_str = serde_json::to_string(&config).unwrap();
    // Only write if not already set (avoids triggering dev watcher loop)
    if db
        .load_setting("provider_config")
        .unwrap_or(None)
        .as_deref()
        != Some(&config_str)
    {
        let _ = db.save_setting("provider_config", &config_str);
    }
}

#[cfg(not(test))]
pub fn run() {
    let _ = dotenv::dotenv();

    let db_path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("ditto")
        .join("ditto.db");
    std::fs::create_dir_all(db_path.parent().unwrap()).ok();
    let db = db::Database::open_with_recovery(&db_path.to_string_lossy())
        .expect("failed to open database");
    load_env_provider_config(&db);
    let state = AppState {
        db: std::sync::Arc::new(std::sync::Mutex::new(db)),
        scheduler: std::sync::Arc::new(std::sync::Mutex::new(
            behavior::scheduler::BehaviorScheduler::new(),
        )),
        state_machine: std::sync::Arc::new(std::sync::Mutex::new(
            behavior::state_machine::StateMachine::new(),
        )),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            let _ = app
                .get_webview_window("main")
                .and_then(|w| w.set_focus().ok());
        }))
        .manage(state)
        .setup(|app| {
            system::tray::setup_tray(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_ignore_cursor_events,
            commands::get_cursor_position,
            commands::set_window_position,
            commands::send_chat_message,
            commands::load_chat_history,
            commands::get_care_state,
            commands::apply_care_action,
            commands::check_scheduled_triggers,
            commands::record_user_activity,
            commands::get_settings,
            commands::save_settings,
            commands::list_skins,
            commands::list_skins_catalog,
            commands::import_skin_zip,
            commands::import_skin_url,
            commands::delete_skin,
            commands::get_active_skin,
            commands::set_active_skin,
            commands::transition_pet_state,
            commands::get_bond_state,
            commands::award_bond_points,
            commands::get_pending_letters,
            commands::mark_letter_read,
            commands::send_letter_reply,
            commands::get_letter_archive,
            commands::get_journal_entries,
            commands::generate_journal_entry,
            commands::start_mini_game,
            commands::submit_mini_game_result,
            commands::get_game_history,
            commands::generate_inner_thought,
            commands::list_memories,
            commands::get_personality
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
    fn test_tray_module_exists() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("system")
            .join("tray.rs");
        assert!(src.exists(), "system/tray.rs should exist");
        let content = fs::read_to_string(&src).unwrap();
        assert!(
            content.contains("setup_tray"),
            "tray module should have setup_tray function"
        );
    }

    #[test]
    fn test_tray_setup_called_in_run() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("lib.rs");
        let content = fs::read_to_string(&src).unwrap();
        assert!(
            content.contains("system::tray::setup_tray"),
            "lib.rs should call system::tray::setup_tray"
        );
    }

    #[test]
    fn test_autolaunch_module_exists() {
        let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("system")
            .join("autolaunch.rs");
        assert!(src.exists(), "system/autolaunch.rs should exist");
        let content = fs::read_to_string(&src).unwrap();
        assert!(
            content.contains("set_auto_launch"),
            "autolaunch module should have set_auto_launch function"
        );
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
        for cmd in [
            "set_ignore_cursor_events",
            "get_cursor_position",
            "set_window_position",
            "send_chat_message",
            "load_chat_history",
            "get_care_state",
            "apply_care_action",
            "check_scheduled_triggers",
            "record_user_activity",
            "get_settings",
            "save_settings",
            "list_skins",
            "list_skins_catalog",
            "import_skin_zip",
            "import_skin_url",
            "delete_skin",
            "get_active_skin",
            "set_active_skin",
            "transition_pet_state",
            "get_bond_state",
            "award_bond_points",
            "get_pending_letters",
            "mark_letter_read",
            "send_letter_reply",
            "get_letter_archive",
            "get_journal_entries",
            "generate_journal_entry",
            "start_mini_game",
            "submit_mini_game_result",
            "get_game_history",
            "generate_inner_thought",
            "list_memories",
            "get_personality",
        ] {
            assert!(
                content.contains(cmd),
                "command {} should be registered in generate_handler",
                cmd
            );
        }
    }

    fn load_animations_config() -> Value {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("public")
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

    mod db_tests {
        use crate::db::models::MessageRole;
        use rusqlite::Connection;

        fn setup_db() -> Connection {
            let conn = Connection::open_in_memory().unwrap();
            crate::db::migrations::run(&conn).unwrap();
            conn
        }

        #[test]
        fn test_insert_and_retrieve_conversation() {
            let conn = setup_db();
            conn.execute(
                "INSERT INTO conversations (created_at, updated_at) VALUES ('2026-01-01T00:00:00', '2026-01-01T00:00:00')",
                [],
            ).unwrap();
            let id: i64 = conn
                .query_row("SELECT last_insert_rowid()", [], |row| row.get(0))
                .unwrap();
            assert!(id > 0);
        }

        #[test]
        fn test_insert_and_retrieve_messages() {
            let conn = setup_db();
            conn.execute(
                "INSERT INTO conversations (created_at, updated_at) VALUES ('2026-01-01T00:00:00', '2026-01-01T00:00:00')",
                [],
            ).unwrap();
            let conv_id: i64 = conn
                .query_row("SELECT last_insert_rowid()", [], |row| row.get(0))
                .unwrap();

            conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'user', 'Hello Ditto!')",
                [conv_id],
            ).unwrap();
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', 'Hi there!')",
                [conv_id],
            ).unwrap();

            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM messages WHERE conversation_id = ?1",
                    [conv_id],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 2);

            let user_msg: String = conn
                .query_row(
                    "SELECT content FROM messages WHERE role = 'user' AND conversation_id = ?1",
                    [conv_id],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(user_msg, "Hello Ditto!");
        }

        #[test]
        fn test_insert_and_query_memory() {
            let conn = setup_db();
            conn.execute(
                "INSERT INTO memory (key, value, category) VALUES ('user_name', 'Alice', 'preference')",
                [],
            ).unwrap();

            let value: String = conn
                .query_row(
                    "SELECT value FROM memory WHERE key = 'user_name'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(value, "Alice");

            let category: String = conn
                .query_row(
                    "SELECT category FROM memory WHERE key = 'user_name'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(category, "preference");
        }

        #[test]
        fn test_memory_key_uniqueness() {
            let conn = setup_db();
            conn.execute(
                "INSERT INTO memory (key, value) VALUES ('test_key', 'value1')",
                [],
            )
            .unwrap();
            let result = conn.execute(
                "INSERT INTO memory (key, value) VALUES ('test_key', 'value2')",
                [],
            );
            assert!(result.is_err(), "duplicate key should fail");
        }

        #[test]
        fn test_settings_crud() {
            let conn = setup_db();
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('llm_provider', 'openai')",
                [],
            )
            .unwrap();

            let value: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'llm_provider'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(value, "openai");

            conn.execute(
                "UPDATE settings SET value = 'ollama' WHERE key = 'llm_provider'",
                [],
            )
            .unwrap();

            let updated: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'llm_provider'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(updated, "ollama");
        }

        #[test]
        fn test_message_role_validation() {
            assert_eq!(MessageRole::User.as_str(), "user");
            assert_eq!(MessageRole::Assistant.as_str(), "assistant");
            assert_eq!(MessageRole::from_str("user"), Some(MessageRole::User));
            assert_eq!(MessageRole::from_str("invalid"), None);
        }

        #[test]
        fn test_database_open_in_memory() {
            let db = crate::db::Database::open_in_memory().unwrap();
            let count: i64 = db
                .conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 8);
        }
    }
}
