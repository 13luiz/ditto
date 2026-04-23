use crate::agent::core::{rule_based_response, DittoAgent, ProviderConfig};
use crate::agent::memory::MemorySystem;
use crate::agent::personality::PersonalityTraits;
use crate::agent::prompt::{PetContext, SystemPromptBuilder};
use crate::db::models::MessageRole;
use crate::db::Database;
use std::sync::Mutex;
use tauri::Emitter;

pub struct AppState {
    pub db: Mutex<Database>,
}

#[tauri::command]
pub fn set_ignore_cursor_events(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cursor_position(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let position = window.cursor_position().map_err(|e| e.to_string())?;
    Ok((position.x, position.y))
}

#[tauri::command]
pub fn set_window_position(window: tauri::WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(
            x as f64, y as f64,
        )))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_chat_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    message: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Get or create conversation
    let conv_id = match db.get_latest_conversation_id().map_err(|e| e.to_string())? {
        Some(id) => id,
        None => db.create_conversation().map_err(|e| e.to_string())?,
    };

    // Save user message
    db.save_message(conv_id, &MessageRole::User, &message)
        .map_err(|e| e.to_string())?;

    // Build system prompt
    let traits = PersonalityTraits::default();
    let mem = MemorySystem::new();
    let memories = mem.get_all_long_term(&db).unwrap_or_default();

    let context = PetContext {
        recent_memories: memories,
        ..Default::default()
    };
    let preamble = SystemPromptBuilder::new(traits, context).build();

    // Try to get response from LLM or fallback
    let response = match try_agent_response(&db, &preamble, &message) {
        Ok(resp) => resp,
        Err(_) => rule_based_response(&message),
    };

    // Stream tokens to frontend
    let tokens: Vec<&str> = response.split_whitespace().collect();
    for (i, token) in tokens.iter().enumerate() {
        let text = if i == 0 {
            token.to_string()
        } else {
            format!(" {}", token)
        };
        app.emit("chat-stream-token", serde_json::json!({ "token": text }))
            .map_err(|e: tauri::Error| e.to_string())?;
    }

    app.emit(
        "chat-stream-done",
        serde_json::json!({ "full_response": response }),
    )
    .map_err(|e: tauri::Error| e.to_string())?;

    // Save assistant response
    db.save_message(conv_id, &MessageRole::Assistant, &response)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn try_agent_response(db: &Database, preamble: &str, message: &str) -> Result<String, String> {
    let config_json = db
        .load_setting("provider_config")
        .map_err(|e| e.to_string())?;

    let config_json = match config_json {
        Some(json) => json,
        None => return Err("no provider configured".to_string()),
    };

    let config: ProviderConfig = serde_json::from_str(&config_json).map_err(|e| e.to_string())?;

    let agent = DittoAgent::new(&config, preamble).map_err(|e| e.to_string())?;

    // Use tokio runtime for async agent call
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(agent.prompt(message))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_chat_history(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let conv_id = match db.get_latest_conversation_id().map_err(|e| e.to_string())? {
        Some(id) => id,
        None => return Ok(vec![]),
    };

    let messages = db.load_messages(conv_id, 50).map_err(|e| e.to_string())?;

    Ok(messages
        .into_iter()
        .map(|msg| {
            serde_json::json!({
                "role": msg.role.as_str(),
                "content": msg.content,
                "timestamp": msg.created_at,
            })
        })
        .collect())
}
