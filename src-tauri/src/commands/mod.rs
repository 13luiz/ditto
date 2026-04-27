use crate::agent::core::{parse_provider_chain, rule_based_response, DittoAgent, ProviderConfig};
use crate::agent::memory::MemorySystem;
use crate::agent::personality::PersonalityTraits;
use crate::agent::prompt::{PetContext, SystemPromptBuilder};
use crate::behavior::scheduler::BehaviorScheduler;
use crate::behavior::state_machine::{PetState, StateMachine, TransitionContext};
use crate::care::{BondAction, BondEngine, CareAction, CareSystem};
use crate::db::models::MessageRole;
use crate::db::Database;
use chrono::Timelike;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub scheduler: Arc<Mutex<BehaviorScheduler>>,
    pub state_machine: Arc<Mutex<StateMachine>>,
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
    let (conv_id, preamble, agent_config) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;

        let conv_id = match db.get_latest_conversation_id().map_err(|e| e.to_string())? {
            Some(id) => id,
            None => db.create_conversation().map_err(|e| e.to_string())?,
        };

        db.save_message(conv_id, &MessageRole::User, &message)
            .map_err(|e| e.to_string())?;

        let traits = PersonalityTraits::load(&db).unwrap_or_default();
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

        (conv_id, preamble, config_json)
    }; // db lock dropped here

    // Phase 2: LLM call with fallback chain
    let response = {
        let providers = agent_config
            .as_deref()
            .and_then(|json| parse_provider_chain(json).ok())
            .unwrap_or_default();

        let mut resp = None;
        for provider in &providers {
            let config_str = serde_json::to_string(&provider).unwrap_or_default();
            match try_streaming_response(
                &app,
                db_arc.clone(),
                &Some(config_str),
                &preamble,
                &message,
            )
            .await
            {
                Ok(r) => {
                    resp = Some(r);
                    break;
                }
                Err(e) => eprintln!(
                    "[ditto] Provider {} failed: {}",
                    provider.provider_name(),
                    e
                ),
            }
        }

        match resp {
            Some(r) => {
                let _ = app.emit(
                    "chat-stream-done",
                    serde_json::json!({ "full_response": &r }),
                );
                r
            }
            None => {
                eprintln!("[ditto] All providers failed, using rule-based fallback");
                let fallback = rule_based_response(&message);
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
    let care = CareSystem::load_with_decay(&db)?;
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

#[tauri::command]
pub fn check_scheduled_triggers(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    let now = chrono::Local::now();
    let hour = now.hour();
    let mut scheduler = state.scheduler.lock().map_err(|e| e.to_string())?;
    scheduler.update_activity();
    let fired = scheduler.check_and_fire_triggers(hour);
    Ok(fired.iter().map(|t| format!("{:?}", t)).collect())
}

#[tauri::command]
pub fn record_user_activity(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut scheduler = state.scheduler.lock().map_err(|e| e.to_string())?;
    scheduler.record_activity();
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let provider_config = db
        .load_setting("provider_config")
        .map_err(|e| e.to_string())?;
    let pet_name = db.load_setting("pet_name").map_err(|e| e.to_string())?;
    let auto_launch = db.load_setting("auto_launch").map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "provider_config": provider_config,
        "pet_name": pet_name,
        "auto_launch": auto_launch,
    }))
}

#[tauri::command]
pub fn save_settings(
    state: tauri::State<'_, AppState>,
    settings: serde_json::Value,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(v) = settings.get("provider_config").and_then(|v| v.as_str()) {
        db.save_setting("provider_config", v)
            .map_err(|e| e.to_string())?;
    }
    if let Some(v) = settings.get("pet_name").and_then(|v| v.as_str()) {
        db.save_setting("pet_name", v).map_err(|e| e.to_string())?;
    }
    if let Some(v) = settings.get("auto_launch").and_then(|v| v.as_str()) {
        db.save_setting("auto_launch", v)
            .map_err(|e| e.to_string())?;
        let _ = crate::system::autolaunch::set_auto_launch(v == "true");
    }
    Ok(())
}

#[tauri::command]
pub fn list_skins() -> Result<Vec<String>, String> {
    Ok(crate::system::skins::list_skins())
}

#[tauri::command]
pub fn list_skins_catalog() -> Result<Vec<serde_json::Value>, String> {
    let catalog = crate::system::skins::list_skins_catalog();
    Ok(catalog
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "id": e.id,
                "name": e.name,
                "renderer": e.renderer,
                "source": format!("{:?}", e.source).to_lowercase(),
                "path": e.path,
            })
        })
        .collect())
}

#[tauri::command]
pub fn import_skin_zip(path: String) -> Result<serde_json::Value, String> {
    let dest = crate::system::skins::skins_dir();
    let result = crate::system::skins::import_skin_zip(&path, &dest)?;
    Ok(serde_json::json!({
        "id": result.id,
        "path": result.path.to_string_lossy(),
    }))
}

#[tauri::command]
pub fn import_skin_url(url: String) -> Result<serde_json::Value, String> {
    let dest = crate::system::skins::skins_dir();
    let result = crate::system::skins::import_skin_url(&url, &dest)?;
    Ok(serde_json::json!({
        "id": result.id,
        "path": result.path.to_string_lossy(),
    }))
}

#[tauri::command]
pub fn delete_skin(skin_id: String) -> Result<(), String> {
    let user_dir = crate::system::skins::skins_dir();
    crate::system::skins::delete_skin(&skin_id, &user_dir)
}

#[tauri::command]
pub fn get_active_skin(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let skin = db.load_setting("active_skin").map_err(|e| e.to_string())?;
    Ok(skin.unwrap_or_else(|| "default".to_string()))
}

#[tauri::command]
pub fn set_active_skin(state: tauri::State<'_, AppState>, skin_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.save_setting("active_skin", &skin_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transition_pet_state(
    state: tauri::State<'_, AppState>,
    target: String,
    cursor_distance: f64,
    idle_time_secs: f64,
) -> Result<String, String> {
    let target_state =
        PetState::try_from_str(&target).ok_or_else(|| format!("unknown state: {}", target))?;

    // Physical transitions bypass FSM validation
    if matches!(
        target_state,
        PetState::Drag | PetState::Fall | PetState::Idle
    ) {
        let mut sm = state.state_machine.lock().map_err(|e| e.to_string())?;
        sm.force_state(target_state);
        return Ok(sm.current_state().to_string());
    }

    // Behavioral transitions require context validation
    let (energy, mood) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let care = CareSystem::load_with_decay(&db)?;
        let m = care.mood();
        (care.needs.energy.get(), m.score)
    };

    let ctx = TransitionContext {
        cursor_distance,
        energy,
        mood,
        idle_time: std::time::Duration::from_secs_f64(idle_time_secs),
        bond_level: {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db.load_bond_state().map(|(l, _)| l).unwrap_or(1)
        },
    };

    let mut sm = state.state_machine.lock().map_err(|e| e.to_string())?;
    sm.try_transition(target_state, &ctx)
        .map(|s| s.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_bond_state(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (level, total_points) = db.load_bond_state().map_err(|e| e.to_string())?;
    let engine = BondEngine::with_state(level, total_points);
    let bond_state = engine.state();
    Ok(serde_json::json!({
        "level": bond_state.level,
        "total_points": bond_state.total_points,
        "level_title": bond_state.level_title,
        "points_to_next": bond_state.points_to_next,
        "next_level": bond_state.next_level,
    }))
}

#[tauri::command]
pub fn award_bond_points(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    action: String,
) -> Result<serde_json::Value, String> {
    let bond_action = match action.as_str() {
        "chat_message" => BondAction::ChatMessage,
        "chat_reply" => BondAction::ChatReply,
        "feed" => BondAction::Feed,
        "pet" => BondAction::Pet,
        "play" => BondAction::Play,
        "emote_exchange" => BondAction::EmoteExchange,
        "daily_login" => BondAction::DailyLogin,
        _ => return Err(format!("unknown bond action: {}", action)),
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let result = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let (level, total_points) = db.load_bond_state().map_err(|e| e.to_string())?;
        let mut engine = BondEngine::with_state(level, total_points);
        let result = engine.award(bond_action, &today);
        if result.points_awarded > 0 {
            db.save_bond_state(engine.level(), engine.total_points())
                .map_err(|e| e.to_string())?;
        }
        result
    };

    if result.leveled_up {
        let _ = app.emit(
            "bond-level-up",
            serde_json::json!({
                "old_level": result.old_level,
                "new_level": result.new_level,
            }),
        );
    }

    Ok(serde_json::json!({
        "points_awarded": result.points_awarded,
        "daily_capped": result.daily_capped,
        "total_points": result.total_points,
        "old_level": result.old_level,
        "new_level": result.new_level,
        "leveled_up": result.leveled_up,
    }))
}

// --- Phase 8: Letter, Journal, Mini-Game, Dream Nail IPC commands ---

#[tauri::command]
pub fn get_pending_letters(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let letters = db.get_pending_letters().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "letters": letters }))
}

#[tauri::command]
pub fn mark_letter_read(state: tauri::State<'_, AppState>, letter_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.mark_letter_read(letter_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn send_letter_reply(
    state: tauri::State<'_, AppState>,
    letter_id: i64,
    content: String,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let reply_id = db
        .insert_letter_reply(letter_id, &content)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "reply_id": reply_id }))
}

#[tauri::command]
pub fn get_letter_archive(
    state: tauri::State<'_, AppState>,
    page: i32,
    limit: i32,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let offset = page * limit;
    let letters = db
        .get_letter_archive(limit as i64, offset as i64)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "letters": letters }))
}

#[tauri::command]
pub fn get_journal_entries(
    state: tauri::State<'_, AppState>,
    start_date: String,
    end_date: String,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let entries = db
        .get_journal_entries(&start_date, &end_date)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "entries": entries }))
}

#[tauri::command]
pub fn generate_journal_entry(
    state: tauri::State<'_, AppState>,
    entry_date: String,
    content: String,
    mood_summary: Option<String>,
    stats_json: Option<String>,
    milestone: Option<String>,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = db
        .insert_journal_entry(
            &entry_date,
            &content,
            mood_summary.as_deref(),
            stats_json.as_deref(),
            milestone.as_deref(),
        )
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub fn start_mini_game(
    _state: tauri::State<'_, AppState>,
    game_type: String,
) -> Result<serde_json::Value, String> {
    match game_type.as_str() {
        "rps" => {
            let game = crate::care::minigame::RpsGame::new();
            Ok(serde_json::json!({
                "game_type": "rps",
                "max_rounds": game.max_rounds,
                "status": "started"
            }))
        }
        "catch" => {
            let game = crate::care::minigame::CatchGameState::new(800.0);
            Ok(serde_json::json!({
                "game_type": "catch",
                "time_limit_secs": game.time_remaining_secs,
                "status": "started"
            }))
        }
        _ => Err(format!("Unknown game type: {}", game_type)),
    }
}

#[tauri::command]
pub fn submit_mini_game_result(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    game_type: String,
    score: i32,
    won: bool,
    care_effects_json: Option<String>,
) -> Result<serde_json::Value, String> {
    // Compute care effects from game result
    let effects = crate::care::mini_game_care_effects(&game_type, won, score);
    let effects_json =
        care_effects_json.unwrap_or_else(|| serde_json::to_string(&effects).unwrap());

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = db
        .insert_game_result(&game_type, score, won, Some(&effects_json))
        .map_err(|e| e.to_string())?;
    drop(db);

    // Award bond points for playing
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (level, total_points) = db.load_bond_state().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut engine = crate::care::BondEngine::with_state(level, total_points);
    let result = engine.award(crate::care::BondAction::Play, &today);
    if result.points_awarded > 0 {
        db.save_bond_state(engine.level(), engine.total_points())
            .map_err(|e| e.to_string())?;
    }
    drop(db);

    if result.leveled_up {
        let _ = app.emit(
            "bond-level-up",
            serde_json::json!({
                "old_level": result.old_level,
                "new_level": result.new_level,
            }),
        );
    }

    Ok(serde_json::json!({
        "id": id,
        "bond_points_awarded": result.points_awarded,
        "bond_leveled_up": result.leveled_up,
        "care_effects": effects,
    }))
}

#[tauri::command]
pub fn get_game_history(
    state: tauri::State<'_, AppState>,
    game_type: Option<String>,
    limit: u32,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let results = db
        .get_game_history(game_type.as_deref(), limit as i64)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "games": results }))
}

#[tauri::command]
pub fn generate_inner_thought(
    state: tauri::State<'_, AppState>,
    mood: String,
    hunger: f64,
    energy: f64,
    social: f64,
    _recent_context: String,
) -> Result<serde_json::Value, String> {
    // Rule-based fallback; LLM generation requires async agent call (future work)
    let pet_name = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.load_setting("pet_name")
            .map_err(|e| e.to_string())?
            .unwrap_or_else(|| "Ditto".to_string())
    };

    let thought = crate::agent::generation::rule_based_inner_thought(&mood, hunger, energy, social);

    // Store in memory for future recall
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let _ = db.save_memory(&format!("dream_nail:{}", today), &thought, "inner_thought");

    // Increment daily use counter
    let count_key = format!("dream_nail_count:{}", today);
    let current: i64 = db
        .load_setting(&count_key)
        .ok()
        .flatten()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let _ = db.save_setting(&count_key, &(current + 1).to_string());

    Ok(serde_json::json!({
        "thought": thought,
        "pet_name": pet_name,
    }))
}

#[tauri::command]
pub fn get_dream_nail_uses(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let count_key = format!("dream_nail_count:{}", today);
    let count: i64 = db
        .load_setting(&count_key)
        .map_err(|e| e.to_string())?
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    Ok(serde_json::json!({ "count": count }))
}

#[tauri::command]
pub fn list_memories(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let entries = db
        .load_memories_by_category("long_term")
        .map_err(|e| e.to_string())?;
    let items: Vec<serde_json::Value> = entries
        .into_iter()
        .map(|(k, v)| serde_json::json!({ "key": k, "value": v }))
        .collect();
    Ok(serde_json::json!({ "memories": items }))
}

#[tauri::command]
pub fn get_personality(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let traits = PersonalityTraits::load(&db).map_err(|e| e.to_string())?;
    let pet_name = db
        .load_setting("pet_name")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "Ditto".to_string());
    Ok(serde_json::json!({
        "traits": traits,
        "pet_name": pet_name,
    }))
}
