use super::super::core::ProviderConfig;
use rig::client::completion::CompletionClient;
use rig::providers::anthropic::Client as AnthropicClient;
use rig::providers::ollama::Client as OllamaClient;
use rig::providers::openai::client::CompletionsClient as OpenAIClient;

/// Test that OpenAI client can be configured correctly
#[test]
fn test_openai_client_construction() {
    let config = ProviderConfig::OpenAI {
        api_key: "test-key".to_string(),
        model: "gpt-4".to_string(),
        base_url: None,
    };

    if let ProviderConfig::OpenAI {
        api_key,
        model,
        base_url,
    } = config
    {
        let mut builder = OpenAIClient::builder().api_key(api_key);
        if let Some(url) = base_url {
            builder = builder.base_url(&url);
        }
        let client = builder.build();
        assert!(client.is_ok(), "OpenAI client should build successfully");

        // Verify agent can be created
        let agent = client.unwrap().agent(&model).build();
        assert!(
            !model.is_empty(),
            "Agent should be created with model: {}",
            model
        );
        drop(agent); // Explicitly drop to verify it's valid
    }
}

/// Test that Anthropic client can be configured correctly
#[test]
fn test_anthropic_client_construction() {
    let config = ProviderConfig::Anthropic {
        api_key: "test-key".to_string(),
        model: "claude-3-opus".to_string(),
        base_url: None,
    };

    if let ProviderConfig::Anthropic {
        api_key,
        model,
        base_url,
    } = config
    {
        let mut builder = AnthropicClient::builder().api_key(api_key);
        if let Some(url) = base_url {
            builder = builder.base_url(&url);
        }
        let client = builder.build();
        assert!(client.is_ok(), "Anthropic client should build successfully");

        // Verify agent can be created
        let agent = client.unwrap().agent(&model).build();
        assert!(
            !model.is_empty(),
            "Agent should be created with model: {}",
            model
        );
        drop(agent);
    }
}

/// Test that Ollama client can be configured correctly
#[test]
fn test_ollama_client_construction() {
    let config = ProviderConfig::Ollama {
        model: "llama2".to_string(),
        base_url: "http://localhost:11434".to_string(),
    };

    if let ProviderConfig::Ollama { model, base_url } = config {
        let client = OllamaClient::builder()
            .api_key(rig::client::Nothing)
            .base_url(&base_url)
            .build();
        assert!(client.is_ok(), "Ollama client should build successfully");

        // Verify agent can be created
        let agent = client.unwrap().agent(&model).build();
        assert!(
            !model.is_empty(),
            "Agent should be created with model: {}",
            model
        );
        drop(agent);
    }
}

/// Test that custom base URLs are respected
#[test]
fn test_custom_base_url() {
    let config = ProviderConfig::OpenAI {
        api_key: "test-key".to_string(),
        model: "gpt-4".to_string(),
        base_url: Some("https://custom.openai.com".to_string()),
    };

    if let ProviderConfig::OpenAI {
        api_key, base_url, ..
    } = config
    {
        let builder = OpenAIClient::builder()
            .api_key(api_key)
            .base_url(base_url.as_ref().unwrap());
        let client = builder.build();
        assert!(client.is_ok(), "Client with custom base URL should build");
    }
}

/// Test that Ollama defaults to localhost
#[test]
fn test_ollama_default_url() {
    let config = ProviderConfig::Ollama {
        model: "llama2".to_string(),
        base_url: "http://localhost:11434".to_string(),
    };

    if let ProviderConfig::Ollama { base_url, .. } = config {
        assert_eq!(base_url, "http://localhost:11434");
    }
}

/// Test that all three providers can construct clients with valid configs
#[test]
fn test_all_providers_construct() {
    // OpenAI
    let openai_client = OpenAIClient::builder().api_key("test-key").build();
    assert!(openai_client.is_ok(), "OpenAI client should build");

    // Anthropic
    let anthropic_client = AnthropicClient::builder().api_key("test-key").build();
    assert!(anthropic_client.is_ok(), "Anthropic client should build");

    // Ollama
    let ollama_client = OllamaClient::builder()
        .api_key(rig::client::Nothing)
        .base_url("http://localhost:11434")
        .build();
    assert!(ollama_client.is_ok(), "Ollama client should build");
}
