use tauri::Emitter;

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
pub fn send_chat_message(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    message: String,
) -> Result<(), String> {
    let response = format!("You said: {}. (LLM not yet connected)", message);

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

    let _ = window;
    Ok(())
}

#[tauri::command]
pub fn load_chat_history() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![])
}
