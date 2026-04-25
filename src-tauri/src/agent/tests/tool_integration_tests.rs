use super::super::tools::{
    ChangeStateArgs, ChangeStateTool, MoveToArgs, MoveToTool, RecallArgs, RecallTool, RememberArgs,
    RememberTool, ShowEmotionArgs, ShowEmotionTool, SpeakArgs, SpeakTool,
};
use rig::client::completion::CompletionClient;
use rig::providers::anthropic::Client as AnthropicClient;
use rig::providers::ollama::Client as OllamaClient;
use rig::providers::openai::client::CompletionsClient as OpenAIClient;
use rig::tool::Tool;

/// Test that all 6 tools can be registered to OpenAI agent
#[test]
fn test_all_tools_register_to_openai_agent() {
    let client = OpenAIClient::builder()
        .api_key("test-key")
        .build()
        .expect("Failed to build OpenAI client");

    // Build agent with all 6 tools
    let agent = client
        .agent("gpt-4")
        .tool(MoveToTool {})
        .tool(ChangeStateTool {})
        .tool(ShowEmotionTool {})
        .tool(SpeakTool)
        .tool(RememberTool {})
        .tool(RecallTool {})
        .build();

    // Verify agent builds successfully with all tools
    drop(agent);
}

/// Test that all 6 tools can be registered to Anthropic agent
#[test]
fn test_all_tools_register_to_anthropic_agent() {
    let client = AnthropicClient::builder()
        .api_key("test-key")
        .build()
        .expect("Failed to build Anthropic client");

    let agent = client
        .agent("claude-3-opus")
        .tool(MoveToTool {})
        .tool(ChangeStateTool {})
        .tool(ShowEmotionTool {})
        .tool(SpeakTool)
        .tool(RememberTool {})
        .tool(RecallTool {})
        .build();

    drop(agent);
}

/// Test that all 6 tools can be registered to Ollama agent
#[test]
fn test_all_tools_register_to_ollama_agent() {
    let client = OllamaClient::builder()
        .api_key(rig::client::Nothing)
        .base_url("http://localhost:11434")
        .build()
        .expect("Failed to build Ollama client");

    let agent = client
        .agent("llama2")
        .tool(MoveToTool {})
        .tool(ChangeStateTool {})
        .tool(ShowEmotionTool {})
        .tool(SpeakTool)
        .tool(RememberTool {})
        .tool(RecallTool {})
        .build();

    drop(agent);
}

/// Test MoveToTool call with valid coordinates
#[tokio::test]
async fn test_move_to_tool_call_success() {
    let tool = MoveToTool {};
    let args = MoveToArgs { x: 100.0, y: 200.0 };
    let result = tool.call(args).await;

    assert!(
        result.is_ok(),
        "MoveToTool should succeed with valid coords"
    );
    let response = result.unwrap();
    assert!(response.contains("100"));
    assert!(response.contains("200"));
}

/// Test MoveToTool call with negative coordinates (should fail)
#[tokio::test]
async fn test_move_to_tool_call_negative_coords() {
    let tool = MoveToTool {};
    let args = MoveToArgs { x: -10.0, y: 50.0 };
    let result = tool.call(args).await;

    assert!(result.is_err(), "MoveToTool should reject negative coords");
}

/// Test ChangeStateTool call with valid state
#[tokio::test]
async fn test_change_state_tool_call_success() {
    let tool = ChangeStateTool {};
    let args = ChangeStateArgs {
        state: "idle".to_string(),
    };
    let result = tool.call(args).await;

    assert!(
        result.is_ok(),
        "ChangeStateTool should succeed with valid state"
    );
}

/// Test ChangeStateTool call with invalid state (should fail)
#[tokio::test]
async fn test_change_state_tool_call_invalid_state() {
    let tool = ChangeStateTool {};
    let args = ChangeStateArgs {
        state: "invalid_state".to_string(),
    };
    let result = tool.call(args).await;

    assert!(
        result.is_err(),
        "ChangeStateTool should reject invalid state"
    );
}

/// Test ShowEmotionTool call with valid emotion
#[tokio::test]
async fn test_show_emotion_tool_call_success() {
    let tool = ShowEmotionTool {};
    let args = ShowEmotionArgs {
        emotion: "happy".to_string(),
    };
    let result = tool.call(args).await;

    assert!(
        result.is_ok(),
        "ShowEmotionTool should succeed with valid emotion"
    );
}

/// Test SpeakTool call with valid text
#[tokio::test]
async fn test_speak_tool_call_success() {
    let tool = SpeakTool;
    let args = SpeakArgs {
        text: "Hello!".to_string(),
    };
    let result = tool.call(args).await;

    assert!(result.is_ok(), "SpeakTool should succeed with valid text");
}

/// Test SpeakTool call with empty text (should fail)
#[tokio::test]
async fn test_speak_tool_call_empty_text() {
    let tool = SpeakTool;
    let args = SpeakArgs {
        text: "".to_string(),
    };
    let result = tool.call(args).await;

    assert!(result.is_err(), "SpeakTool should reject empty text");
}

/// Test RememberTool call with valid key and value
#[tokio::test]
async fn test_remember_tool_call_success() {
    let tool = RememberTool {};
    let args = RememberArgs {
        key: "user_name".to_string(),
        value: "Alice".to_string(),
    };
    let result = tool.call(args).await;

    // In test environment, database is None, so tool returns success message
    assert!(result.is_ok(), "RememberTool should succeed with valid key");
    let response = result.unwrap();
    assert!(response.contains("Remembered"));
    assert!(response.contains("user_name"));
    assert!(response.contains("Alice"));
}

/// Test RecallTool call with valid key
#[tokio::test]
async fn test_recall_tool_call_success() {
    let tool = RecallTool {};
    let args = RecallArgs {
        key: "user_name".to_string(),
    };
    let result = tool.call(args).await;

    // In test environment, database is None, so tool returns "No memory found" message
    assert!(result.is_ok(), "RecallTool should succeed with valid key");
    let response = result.unwrap();
    assert!(response.contains("user_name"));
}
