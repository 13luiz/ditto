use serde::{Deserialize, Serialize};
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
                "idle",
                "walk_left",
                "walk_right",
                "run_left",
                "run_right",
                "fall",
                "drag",
                "sleep",
                "sit",
                "talk",
                "happy",
                "sad",
                "curious",
                "eat",
                "play",
                "climb",
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
}
