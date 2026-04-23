use crate::agent::core::{rule_based_response, DittoAgent, ProviderConfig};
use crate::agent::memory::MemorySystem;
use crate::agent::personality::PersonalityTraits;
use crate::agent::prompt::{PetContext, SystemPromptBuilder};
use crate::db::models::MessageRole;
use crate::db::Database;
use rig::completion::Message;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
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
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            x, y,
        )))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_chat_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    message: String,
) -> Result<(), String> {
    let db_arc = state.db.clone();

    // Phase 1: DB operations (synchronous, drop lock before await)
    let (conv_id, preamble, agent_config, chat_history) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        let conv_id = match db.get_latest_conversation_id().map_err(|e| e.to_string())? {
            Some(id) => id,
            None => db.create_conversation().map_err(|e| e.to_string())?,
        };

        db.save_message(conv_id, &MessageRole::User, &message)
            .map_err(|e| e.to_string())?;

        let traits = PersonalityTraits::default();
        let mem = MemorySystem::new();
        let memories = mem.get_all_long_term(&db).unwrap_or_default();

        let context = PetContext {
            recent_memories: memories,
            ..Default::default()
        };
        let preamble = SystemPromptBuilder::new(traits, context).build();

        let config_json = db
            .load_setting("provider_config")
            .map_err(|e| e.to_string())?;

        let history_msgs = db.load_messages(conv_id, 20).map_err(|e| e.to_string())?;
        let chat_history: Vec<Message> = history_msgs
            .into_iter()
            .rev()
            .map(|msg| match msg.role {
                MessageRole::User => Message::user(msg.content),
                MessageRole::Assistant => Message::assistant(msg.content),
                _ => Message::user(msg.content),
            })
            .collect();

        (conv_id, preamble, config_json, chat_history)
    }; // db lock dropped here

    // Phase 2: LLM call with tools + chat history (async, no DB lock held)
    let response = match try_agent_response(
        &app,
        db_arc,
        &agent_config,
        &preamble,
        &message,
        chat_history,
    )
    .await
    {
        Ok(resp) => resp,
        Err(_) => rule_based_response(&message),
    };

    // Phase 3: Stream tokens + save response
    let tokens: Vec<&str> = response.split_whitespace().collect();
    for (i, token) in tokens.iter().enumerate() {
        let text = if i == 0 {
            token.to_string()
        } else {
            format!(" {}", token)
        };
        let _ = app.emit("chat-stream-token", serde_json::json!({ "token": text }));
    }

    let _ = app.emit(
        "chat-stream-done",
        serde_json::json!({ "full_response": response }),
    );

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.save_message(conv_id, &MessageRole::Assistant, &response)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn try_agent_response(
    app: &tauri::AppHandle,
    db: Arc<Mutex<Database>>,
    config_json: &Option<String>,
    preamble: &str,
    message: &str,
    chat_history: Vec<Message>,
) -> Result<String, String> {
    let config_json = match config_json {
        Some(json) => json,
        None => return Err("no provider configured".to_string()),
    };

    let config: ProviderConfig = serde_json::from_str(config_json).map_err(|e| e.to_string())?;
    let agent = DittoAgent::new(&config, preamble, app.clone(), db).map_err(|e| e.to_string())?;
    agent
        .chat(message, chat_history)
        .await
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
