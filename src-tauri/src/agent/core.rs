use rig::client::completion::CompletionClient;
use rig::completion::{Chat, Message, Prompt};
use rig::providers;
use rig::providers::openai::client::CompletionsClient as OpenAIClient;
use serde::{Deserialize, Serialize};

use super::tools::{
    ChangeStateTool, MoveToTool, RecallTool, RememberTool, ShowEmotionTool, SpeakTool,
};
use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum ProviderConfig {
    #[serde(rename = "openai")]
    OpenAI {
        api_key: String,
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        base_url: Option<String>,
    },
    #[serde(rename = "anthropic")]
    Anthropic {
        api_key: String,
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        base_url: Option<String>,
    },
    #[serde(rename = "ollama")]
    Ollama {
        model: String,
        #[serde(default = "default_ollama_url")]
        base_url: String,
    },
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

impl ProviderConfig {
    pub fn provider_name(&self) -> &str {
        match self {
            ProviderConfig::OpenAI { .. } => "openai",
            ProviderConfig::Anthropic { .. } => "anthropic",
            ProviderConfig::Ollama { .. } => "ollama",
        }
    }

    pub fn model(&self) -> &str {
        match self {
            ProviderConfig::OpenAI { model, .. } => model,
            ProviderConfig::Anthropic { model, .. } => model,
            ProviderConfig::Ollama { model, .. } => model,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("provider unavailable: {0}")]
    ProviderUnavailable(String),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("config error: {0}")]
    ConfigError(String),

    #[error("no provider available")]
    NoProviderAvailable,

    #[error("rate limited")]
    RateLimited,

    #[error("tool error: {0}")]
    ToolError(String),

    #[error("database error: {0}")]
    DatabaseError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderChain {
    pub primary: ProviderConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback: Option<Box<ProviderConfig>>,
}

pub struct RateLimiter {
    last_proactive_call: Option<std::time::Instant>,
    min_interval: std::time::Duration,
}

impl RateLimiter {
    pub fn new(min_interval_secs: u64) -> Self {
        Self {
            last_proactive_call: None,
            min_interval: std::time::Duration::from_secs(min_interval_secs),
        }
    }

    pub fn can_call_proactive(&self) -> bool {
        match self.last_proactive_call {
            Some(last) => last.elapsed() >= self.min_interval,
            None => true,
        }
    }

    pub fn record_proactive_call(&mut self) {
        self.last_proactive_call = Some(std::time::Instant::now());
    }
}

pub struct FallbackChain {
    pub providers: Vec<ProviderConfig>,
}

impl FallbackChain {
    pub fn new(chain: &ProviderChain) -> Self {
        let mut providers = vec![chain.primary.clone()];
        if let Some(fallback) = &chain.fallback {
            providers.push((**fallback).clone());
        }
        Self { providers }
    }

    pub fn providers(&self) -> &[ProviderConfig] {
        &self.providers
    }
}

pub fn rule_based_response(input: &str) -> String {
    let lower = input.to_lowercase();
    if lower.contains("hello") || lower.contains("hi") || lower.contains("hey") {
        "Hey there! Nice to see you!".to_string()
    } else if lower.contains("how are you") {
        "I'm doing great! Thanks for asking!".to_string()
    } else if lower.contains("goodnight") || lower.contains("bye") {
        "Goodnight! See you later!".to_string()
    } else if lower.contains("hungry") {
        "I could use a snack... hint hint!".to_string()
    } else {
        "I'm here! What's on your mind?".to_string()
    }
}

pub enum DittoAgent {
    OpenAI(rig::agent::Agent<providers::openai::completion::CompletionModel>),
    Anthropic(rig::agent::Agent<providers::anthropic::completion::CompletionModel>),
    Ollama(rig::agent::Agent<providers::ollama::CompletionModel>),
}

impl DittoAgent {
    pub fn new(
        config: &ProviderConfig,
        preamble: &str,
        app: tauri::AppHandle,
        db: std::sync::Arc<std::sync::Mutex<Database>>,
    ) -> Result<Self, AgentError> {
        match config {
            ProviderConfig::OpenAI {
                api_key,
                model,
                base_url,
            } => {
                let mut builder = OpenAIClient::builder().api_key(api_key);
                if let Some(url) = base_url {
                    builder = builder.base_url(url);
                }
                let client = builder
                    .build()
                    .map_err(|e| AgentError::ConfigError(e.to_string()))?;
                let agent = client
                    .agent(model)
                    .preamble(preamble)
                    .tool(MoveToTool {
                        app: Some(app.clone()),
                    })
                    .tool(ChangeStateTool {
                        app: Some(app.clone()),
                    })
                    .tool(ShowEmotionTool {
                        app: Some(app.clone()),
                    })
                    .tool(SpeakTool)
                    .tool(RememberTool {
                        db: Some(db.clone()),
                    })
                    .tool(RecallTool {
                        db: Some(db.clone()),
                    })
                    .build();
                Ok(DittoAgent::OpenAI(agent))
            }
            ProviderConfig::Anthropic {
                api_key,
                model,
                base_url,
            } => {
                let mut builder = providers::anthropic::Client::builder().api_key(api_key);
                if let Some(url) = base_url {
                    builder = builder.base_url(url);
                }
                let client = builder
                    .build()
                    .map_err(|e| AgentError::ConfigError(e.to_string()))?;
                let agent = client
                    .agent(model)
                    .preamble(preamble)
                    .max_tokens(1024)
                    .tool(MoveToTool {
                        app: Some(app.clone()),
                    })
                    .tool(ChangeStateTool {
                        app: Some(app.clone()),
                    })
                    .tool(ShowEmotionTool {
                        app: Some(app.clone()),
                    })
                    .tool(SpeakTool)
                    .tool(RememberTool {
                        db: Some(db.clone()),
                    })
                    .tool(RecallTool {
                        db: Some(db.clone()),
                    })
                    .build();
                Ok(DittoAgent::Anthropic(agent))
            }
            ProviderConfig::Ollama { model, base_url } => {
                let client = providers::ollama::Client::builder()
                    .api_key(rig::client::Nothing)
                    .base_url(base_url)
                    .build()
                    .map_err(|e| AgentError::ConfigError(e.to_string()))?;
                let agent = client
                    .agent(model)
                    .preamble(preamble)
                    .tool(MoveToTool {
                        app: Some(app.clone()),
                    })
                    .tool(ChangeStateTool {
                        app: Some(app.clone()),
                    })
                    .tool(ShowEmotionTool {
                        app: Some(app.clone()),
                    })
                    .tool(SpeakTool)
                    .tool(RememberTool {
                        db: Some(db.clone()),
                    })
                    .tool(RecallTool {
                        db: Some(db.clone()),
                    })
                    .build();
                Ok(DittoAgent::Ollama(agent))
            }
        }
    }

    pub async fn prompt(&self, message: &str) -> Result<String, AgentError> {
        match self {
            DittoAgent::OpenAI(agent) => agent
                .prompt(message)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
            DittoAgent::Anthropic(agent) => agent
                .prompt(message)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
            DittoAgent::Ollama(agent) => agent
                .prompt(message)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
        }
    }

    pub async fn chat(&self, message: &str, history: Vec<Message>) -> Result<String, AgentError> {
        match self {
            DittoAgent::OpenAI(agent) => agent
                .chat(message, history)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
            DittoAgent::Anthropic(agent) => agent
                .chat(message, history)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
            DittoAgent::Ollama(agent) => agent
                .chat(message, history)
                .await
                .map_err(|e| AgentError::ApiError(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openai_config_deserialization() {
        let json = r#"{
            "type": "openai",
            "api_key": "sk-test123",
            "model": "gpt-4o"
        }"#;
        let config: ProviderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.provider_name(), "openai");
        assert_eq!(config.model(), "gpt-4o");
        if let ProviderConfig::OpenAI { api_key, .. } = &config {
            assert_eq!(api_key, "sk-test123");
        } else {
            panic!("Expected OpenAI variant");
        }
    }

    #[test]
    fn test_anthropic_config_deserialization() {
        let json = r#"{
            "type": "anthropic",
            "api_key": "sk-ant-test",
            "model": "claude-sonnet-4-20250514"
        }"#;
        let config: ProviderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.provider_name(), "anthropic");
        assert_eq!(config.model(), "claude-sonnet-4-20250514");
    }

    #[test]
    fn test_ollama_config_deserialization() {
        let json = r#"{
            "type": "ollama",
            "model": "llama3.2"
        }"#;
        let config: ProviderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.provider_name(), "ollama");
        if let ProviderConfig::Ollama { base_url, .. } = &config {
            assert_eq!(base_url, "http://localhost:11434");
        } else {
            panic!("Expected Ollama variant");
        }
    }

    #[test]
    fn test_ollama_custom_url() {
        let json = r#"{
            "type": "ollama",
            "model": "llama3.2",
            "base_url": "http://192.168.1.100:11434"
        }"#;
        let config: ProviderConfig = serde_json::from_str(json).unwrap();
        if let ProviderConfig::Ollama { base_url, .. } = &config {
            assert_eq!(base_url, "http://192.168.1.100:11434");
        } else {
            panic!("Expected Ollama variant");
        }
    }

    #[test]
    fn test_provider_chain_deserialization() {
        let json = r#"{
            "primary": {
                "type": "openai",
                "api_key": "sk-test",
                "model": "gpt-4o"
            },
            "fallback": {
                "type": "ollama",
                "model": "llama3.2"
            }
        }"#;
        let chain: ProviderChain = serde_json::from_str(json).unwrap();
        assert_eq!(chain.primary.provider_name(), "openai");
        assert!(chain.fallback.is_some());
        assert_eq!(chain.fallback.unwrap().provider_name(), "ollama");
    }

    #[test]
    fn test_agent_error_display() {
        let err = AgentError::ProviderUnavailable("OpenAI down".to_string());
        assert_eq!(format!("{}", err), "provider unavailable: OpenAI down");

        let err = AgentError::ApiError("rate limited".to_string());
        assert_eq!(format!("{}", err), "API error: rate limited");

        let err = AgentError::NoProviderAvailable;
        assert_eq!(format!("{}", err), "no provider available");
    }

    #[test]
    fn test_invalid_provider_type() {
        let json = r#"{
            "type": "invalid",
            "api_key": "test",
            "model": "test"
        }"#;
        let result: Result<ProviderConfig, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_openai_config_builds_client() {
        let config = ProviderConfig::OpenAI {
            api_key: "sk-test-key".to_string(),
            model: "gpt-4o".to_string(),
            base_url: None,
        };
        let mut builder = OpenAIClient::builder().api_key("sk-test-key");
        let client = builder.build();
        assert!(client.is_ok());
    }

    #[test]
    fn test_anthropic_config_builds_client() {
        let client = providers::anthropic::Client::builder()
            .api_key("sk-ant-test-key")
            .build();
        assert!(client.is_ok());
    }

    #[test]
    fn test_ollama_config_builds_client() {
        let client = providers::ollama::Client::builder()
            .api_key(rig::client::Nothing)
            .base_url("http://localhost:11434")
            .build();
        assert!(client.is_ok());
    }

    #[test]
    fn test_fallback_chain_from_provider_chain() {
        let chain = ProviderChain {
            primary: ProviderConfig::OpenAI {
                api_key: "sk-test".to_string(),
                model: "gpt-4o".to_string(),
                base_url: None,
            },
            fallback: Some(Box::new(ProviderConfig::Ollama {
                model: "llama3.2".to_string(),
                base_url: "http://localhost:11434".to_string(),
            })),
        };
        let fb = FallbackChain::new(&chain);
        assert_eq!(fb.providers().len(), 2);
        assert_eq!(fb.providers()[0].provider_name(), "openai");
        assert_eq!(fb.providers()[1].provider_name(), "ollama");
    }

    #[test]
    fn test_fallback_chain_no_fallback() {
        let chain = ProviderChain {
            primary: ProviderConfig::OpenAI {
                api_key: "sk-test".to_string(),
                model: "gpt-4o".to_string(),
                base_url: None,
            },
            fallback: None,
        };
        let fb = FallbackChain::new(&chain);
        assert_eq!(fb.providers().len(), 1);
    }

    #[test]
    fn test_rule_based_responses() {
        let resp = rule_based_response("Hello there!");
        assert!(resp.contains("Hey there"));

        let resp = rule_based_response("How are you doing?");
        assert!(resp.contains("great"));

        let resp = rule_based_response("Goodnight!");
        assert!(resp.contains("Goodnight"));

        let resp = rule_based_response("Tell me something random");
        assert!(resp.contains("here"));
    }

    #[test]
    fn test_rate_limiter_allows_first_call() {
        let limiter = RateLimiter::new(30);
        assert!(limiter.can_call_proactive());
    }

    #[test]
    fn test_rate_limiter_blocks_rapid_calls() {
        let mut limiter = RateLimiter::new(30);
        limiter.record_proactive_call();
        assert!(!limiter.can_call_proactive());
    }

    #[test]
    fn test_rate_limiter_allows_after_interval() {
        let mut limiter = RateLimiter::new(0);
        limiter.record_proactive_call();
        assert!(limiter.can_call_proactive());
    }
}
