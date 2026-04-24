use crate::agent::core::{rule_based_response, DittoAgent, ProviderConfig};
use crate::agent::memory::MemorySystem;
use crate::agent::personality::PersonalityTraits;
use crate::agent::prompt::{PetContext, SystemPromptBuilder};
use crate::care::{CareAction, CareSystem};
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
    let (conv_id, preamble, agent_config, _chat_history) = {
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

    // Phase 2: LLM call with streaming
    let response = match try_streaming_response(
        &app,
        db_arc.clone(),
        &agent_config,
        &preamble,
        &message,
    )
    .await
    {
        Ok(resp) => {
            let _ = app.emit(
                "chat-stream-done",
                serde_json::json!({ "full_response": &resp }),
            );
            resp
        }
        Err(e) => {
            eprintln!("[ditto] LLM streaming error, falling back: {}", e);
            let fallback = format!("[LLM error: {}]\n{}", e, rule_based_response(&message));
            let _ = app.emit(
                "chat-stream-token",
                serde_json::json!({ "token": &fallback }),
            );
            let _ = app.emit(
                "chat-stream-done",
                serde_json::json!({ "full_response": &fallback }),
            );
            fallback
        }
    };

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.save_message(conv_id, &MessageRole::Assistant, &response)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn try_streaming_response(
    app: &tauri::AppHandle,
    db: Arc<Mutex<Database>>,
    config_json: &Option<String>,
    preamble: &str,
    message: &str,
) -> Result<String, String> {
    let config_json = match config_json {
        Some(json) => json,
        None => return Err("no provider configured".to_string()),
    };

    let config: ProviderConfig = serde_json::from_str(config_json).map_err(|e| e.to_string())?;
    let agent = DittoAgent::new(&config, preamble, app.clone(), db).map_err(|e| e.to_string())?;

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let app = app.clone();
    let msg = message.to_string();

    let stream_task = tokio::spawn(async move { agent.stream_chat(&msg, tx).await });

    while let Some(token) = rx.recv().await {
        let _ = app.emit("chat-stream-token", serde_json::json!({ "token": token }));
    }

    stream_task
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[allow(dead_code)]
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

#[tauri::command]
pub fn get_care_state(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let care = CareSystem::load(&db)?;
    let mood = care.mood();
    Ok(serde_json::json!({
        "hunger": care.needs.hunger.get(),
        "happiness": care.needs.happiness.get(),
        "energy": care.needs.energy.get(),
        "social": care.needs.social.get(),
        "mood_score": mood.score,
        "mood_label": format!("{:?}", mood.label).to_lowercase(),
    }))
}

#[tauri::command]
pub fn apply_care_action(
    state: tauri::State<'_, AppState>,
    action: String,
) -> Result<serde_json::Value, String> {
    let care_action = match action.as_str() {
        "feed" => CareAction::Feed,
        "pet" => CareAction::Pet,
        "chat" => CareAction::Chat,
        "sleep" => CareAction::Sleep,
        _ => return Err(format!("unknown action: {}", action)),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut care = CareSystem::load(&db)?;
    care.apply_action(care_action);
    care.save(&db)?;

    let mood = care.mood();
    Ok(serde_json::json!({
        "hunger": care.needs.hunger.get(),
        "happiness": care.needs.happiness.get(),
        "energy": care.needs.energy.get(),
        "social": care.needs.social.get(),
        "mood_score": mood.score,
        "mood_label": format!("{:?}", mood.label).to_lowercase(),
    }))
}
