use rig::completion::ToolDefinition;
use rig::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ToolName {
    MoveTo,
    ChangeState,
    ShowEmotion,
    Speak,
    Remember,
    Recall,
}

impl fmt::Display for ToolName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ToolName::MoveTo => write!(f, "move_to"),
            ToolName::ChangeState => write!(f, "change_state"),
            ToolName::ShowEmotion => write!(f, "show_emotion"),
            ToolName::Speak => write!(f, "speak"),
            ToolName::Remember => write!(f, "remember"),
            ToolName::Recall => write!(f, "recall"),
        }
    }
}

impl ToolName {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "move_to" => Some(ToolName::MoveTo),
            "change_state" => Some(ToolName::ChangeState),
            "show_emotion" => Some(ToolName::ShowEmotion),
            "speak" => Some(ToolName::Speak),
            "remember" => Some(ToolName::Remember),
            "recall" => Some(ToolName::Recall),
            _ => None,
        }
    }

    pub fn all() -> Vec<ToolName> {
        vec![
            ToolName::MoveTo,
            ToolName::ChangeState,
            ToolName::ShowEmotion,
            ToolName::Speak,
            ToolName::Remember,
            ToolName::Recall,
        ]
    }

    pub fn description(&self) -> &str {
        match self {
            ToolName::MoveTo => "Move pet to a screen position",
            ToolName::ChangeState => "Change the pet's animation state",
            ToolName::ShowEmotion => "Display an emotion (happy, sad, curious, etc.)",
            ToolName::Speak => "Show text in the chat bubble",
            ToolName::Remember => "Store a long-term memory",
            ToolName::Recall => "Retrieve a long-term memory",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "tool")]
pub enum ToolCall {
    MoveTo { x: f64, y: f64 },
    ChangeState { state: String },
    ShowEmotion { emotion: String },
    Speak { text: String },
    Remember { key: String, value: String },
    Recall { key: String },
}

impl ToolCall {
    pub fn tool_name(&self) -> ToolName {
        match self {
            ToolCall::MoveTo { .. } => ToolName::MoveTo,
            ToolCall::ChangeState { .. } => ToolName::ChangeState,
            ToolCall::ShowEmotion { .. } => ToolName::ShowEmotion,
            ToolCall::Speak { .. } => ToolName::Speak,
            ToolCall::Remember { .. } => ToolName::Remember,
            ToolCall::Recall { .. } => ToolName::Recall,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolResult {
    Success(String),
    Error(String),
}

#[derive(Debug, thiserror::Error)]
pub enum ToolDispatchError {
    #[error("unknown tool: {0}")]
    UnknownTool(String),

    #[error("invalid parameters for {tool}: {reason}")]
    InvalidParams { tool: String, reason: String },
}

pub fn dispatch_tool(call: &ToolCall) -> ToolResult {
    match call {
        ToolCall::MoveTo { x, y } => {
            if *x < 0.0 || *y < 0.0 {
                return ToolResult::Error("coordinates must be non-negative".to_string());
            }
            ToolResult::Success(format!("Moved to ({:.0}, {:.0})", x, y))
        }
        ToolCall::ChangeState { state } => {
            let valid = [
                "idle", "walk_left", "walk_right", "run_left", "run_right",
                "fall", "drag", "sleep", "sit", "talk", "happy", "sad",
                "curious", "eat", "play", "climb",
            ];
            if valid.contains(&state.as_str()) {
                ToolResult::Success(format!("State changed to {}", state))
            } else {
                ToolResult::Error(format!("Invalid state: {}", state))
            }
        }
        ToolCall::ShowEmotion { emotion } => {
            ToolResult::Success(format!("Showing emotion: {}", emotion))
        }
        ToolCall::Speak { text } => {
            if text.is_empty() {
                return ToolResult::Error("speak text cannot be empty".to_string());
            }
            ToolResult::Success(format!("Spoke: {}", text))
        }
        ToolCall::Remember { key, value } => {
            if key.is_empty() {
                return ToolResult::Error("memory key cannot be empty".to_string());
            }
            ToolResult::Success(format!("Remembered: {} = {}", key, value))
        }
        ToolCall::Recall { key } => {
            if key.is_empty() {
                return ToolResult::Error("recall key cannot be empty".to_string());
            }
            ToolResult::Success(format!("Recalled: {}", key))
        }
    }
}

// rig-core Tool implementations

#[derive(Debug, thiserror::Error)]
#[error("tool execution error")]
pub struct ToolExecError;

#[derive(Deserialize)]
pub struct MoveToArgs {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize)]
pub struct MoveToTool;

impl Tool for MoveToTool {
    const NAME: &'static str = "move_to";
    type Error = ToolExecError;
    type Args = MoveToArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "move_to".to_string(),
            description: "Move the pet to a specific screen position".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "x": { "type": "number", "description": "Target X coordinate" },
                    "y": { "type": "number", "description": "Target Y coordinate" }
                },
                "required": ["x", "y"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = dispatch_tool(&ToolCall::MoveTo { x: args.x, y: args.y });
        match result {
            ToolResult::Success(msg) => Ok(msg),
            ToolResult::Error(_) => Err(ToolExecError),
        }
    }
}

#[derive(Deserialize)]
pub struct ChangeStateArgs {
    pub state: String,
}

#[derive(Serialize)]
pub struct ChangeStateTool;

impl Tool for ChangeStateTool {
    const NAME: &'static str = "change_state";
    type Error = ToolExecError;
    type Args = ChangeStateArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "change_state".to_string(),
            description: "Change the pet's animation state. Valid states: idle, walk_left, walk_right, sleep, sit, talk, happy, sad, curious".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "state": { "type": "string", "description": "The target animation state" }
                },
                "required": ["state"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = dispatch_tool(&ToolCall::ChangeState { state: args.state });
        match result {
            ToolResult::Success(msg) => Ok(msg),
            ToolResult::Error(_) => Err(ToolExecError),
        }
    }
}

#[derive(Deserialize)]
pub struct SpeakArgs {
    pub text: String,
}

#[derive(Serialize)]
pub struct SpeakTool;

impl Tool for SpeakTool {
    const NAME: &'static str = "speak";
    type Error = ToolExecError;
    type Args = SpeakArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "speak".to_string(),
            description: "Show text in the chat bubble".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "The text to display" }
                },
                "required": ["text"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = dispatch_tool(&ToolCall::Speak { text: args.text });
        match result {
            ToolResult::Success(msg) => Ok(msg),
            ToolResult::Error(_) => Err(ToolExecError),
        }
    }
}

#[derive(Deserialize)]
pub struct RememberArgs {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct RememberTool;

impl Tool for RememberTool {
    const NAME: &'static str = "remember";
    type Error = ToolExecError;
    type Args = RememberArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "remember".to_string(),
            description: "Store a long-term memory about the user or context".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "Memory key identifier" },
                    "value": { "type": "string", "description": "The value to remember" }
                },
                "required": ["key", "value"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = dispatch_tool(&ToolCall::Remember {
            key: args.key,
            value: args.value,
        });
        match result {
            ToolResult::Success(msg) => Ok(msg),
            ToolResult::Error(_) => Err(ToolExecError),
        }
    }
}

#[derive(Deserialize)]
pub struct RecallArgs {
    pub key: String,
}

#[derive(Serialize)]
pub struct RecallTool;

impl Tool for RecallTool {
    const NAME: &'static str = "recall";
    type Error = ToolExecError;
    type Args = RecallArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "recall".to_string(),
            description: "Retrieve a long-term memory by key".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "key": { "type": "string", "description": "Memory key to look up" }
                },
                "required": ["key"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let result = dispatch_tool(&ToolCall::Recall { key: args.key });
        match result {
            ToolResult::Success(msg) => Ok(msg),
            ToolResult::Error(_) => Err(ToolExecError),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_tool_names_have_correct_display() {
        assert_eq!(ToolName::MoveTo.to_string(), "move_to");
        assert_eq!(ToolName::ChangeState.to_string(), "change_state");
        assert_eq!(ToolName::ShowEmotion.to_string(), "show_emotion");
        assert_eq!(ToolName::Speak.to_string(), "speak");
        assert_eq!(ToolName::Remember.to_string(), "remember");
        assert_eq!(ToolName::Recall.to_string(), "recall");
    }

    #[test]
    fn test_tool_name_from_str_roundtrip() {
        for tool in ToolName::all() {
            assert_eq!(ToolName::from_str(&tool.to_string()), Some(tool.clone()));
        }
    }

    #[test]
    fn test_unknown_tool_name_returns_none() {
        assert_eq!(ToolName::from_str("nonexistent"), None);
        assert_eq!(ToolName::from_str(""), None);
    }

    #[test]
    fn test_each_tool_has_description() {
        for tool in ToolName::all() {
            assert!(!tool.description().is_empty());
        }
    }

    #[test]
    fn test_dispatch_move_to() {
        let call = ToolCall::MoveTo { x: 100.0, y: 200.0 };
        let result = dispatch_tool(&call);
        match result {
            ToolResult::Success(msg) => assert!(msg.contains("100") && msg.contains("200")),
            ToolResult::Error(_) => panic!("expected success"),
        }
    }

    #[test]
    fn test_dispatch_move_to_negative_coords() {
        let call = ToolCall::MoveTo { x: -10.0, y: 50.0 };
        let result = dispatch_tool(&call);
        assert!(matches!(result, ToolResult::Error(_)));
    }

    #[test]
    fn test_dispatch_change_state_valid() {
        for state in &["idle", "walk_left", "sleep", "talk", "happy"] {
            let call = ToolCall::ChangeState {
                state: state.to_string(),
            };
            let result = dispatch_tool(&call);
            assert!(matches!(result, ToolResult::Success(_)));
        }
    }

    #[test]
    fn test_dispatch_change_state_invalid() {
        let call = ToolCall::ChangeState {
            state: "backflip".to_string(),
        };
        let result = dispatch_tool(&call);
        assert!(matches!(result, ToolResult::Error(_)));
    }

    #[test]
    fn test_dispatch_speak_empty_text() {
        let call = ToolCall::Speak {
            text: "".to_string(),
        };
        let result = dispatch_tool(&call);
        assert!(matches!(result, ToolResult::Error(_)));
    }

    #[test]
    fn test_dispatch_remember_empty_key() {
        let call = ToolCall::Remember {
            key: "".to_string(),
            value: "some value".to_string(),
        };
        let result = dispatch_tool(&call);
        assert!(matches!(result, ToolResult::Error(_)));
    }

    #[test]
    fn test_dispatch_recall() {
        let call = ToolCall::Recall {
            key: "user_name".to_string(),
        };
        let result = dispatch_tool(&call);
        match result {
            ToolResult::Success(msg) => assert!(msg.contains("user_name")),
            ToolResult::Error(_) => panic!("expected success"),
        }
    }

    #[test]
    fn test_tool_call_returns_correct_name() {
        assert_eq!(
            ToolCall::MoveTo { x: 0.0, y: 0.0 }.tool_name(),
            ToolName::MoveTo
        );
        assert_eq!(
            ToolCall::Speak {
                text: "hi".to_string()
            }
            .tool_name(),
            ToolName::Speak
        );
        assert_eq!(
            ToolCall::Remember {
                key: "k".to_string(),
                value: "v".to_string()
            }
            .tool_name(),
            ToolName::Remember
        );
    }

    #[tokio::test]
    async fn test_move_to_tool_definition() {
        let tool = MoveToTool;
        let def = tool.definition("test".to_string()).await;
        assert_eq!(def.name, "move_to");
        assert!(def.parameters["properties"]["x"].is_object());
        assert!(def.parameters["properties"]["y"].is_object());
    }

    #[tokio::test]
    async fn test_move_to_tool_execution() {
        let tool = MoveToTool;
        let result = tool.call(MoveToArgs { x: 100.0, y: 200.0 }).await;
        assert!(result.is_ok());
        assert!(result.unwrap().contains("100"));
    }

    #[tokio::test]
    async fn test_change_state_tool_execution() {
        let tool = ChangeStateTool;
        let result = tool
            .call(ChangeStateArgs {
                state: "idle".to_string(),
            })
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_speak_tool_execution() {
        let tool = SpeakTool;
        let result = tool
            .call(SpeakArgs {
                text: "Hello!".to_string(),
            })
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_remember_tool_execution() {
        let tool = RememberTool;
        let result = tool
            .call(RememberArgs {
                key: "user_name".to_string(),
                value: "Alice".to_string(),
            })
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_recall_tool_execution() {
        let tool = RecallTool;
        let result = tool
            .call(RecallArgs {
                key: "user_name".to_string(),
            })
            .await;
        assert!(result.is_ok());
    }
}
