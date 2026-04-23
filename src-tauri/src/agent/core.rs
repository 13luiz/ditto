use serde::{Deserialize, Serialize};

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
}
