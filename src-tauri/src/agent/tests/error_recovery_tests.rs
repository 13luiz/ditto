use super::super::core::{rule_based_response, FallbackChain, ProviderChain, ProviderConfig};

/// Test that rule_based_response handles common inputs correctly
#[test]
fn test_rule_based_response_coverage() {
    // Test greeting patterns
    assert!(rule_based_response("hello").contains("Hey there"));
    assert!(rule_based_response("hi").contains("Hey there"));
    assert!(rule_based_response("hey").contains("Hey there"));

    // Test time-based greetings
    assert!(rule_based_response("good morning").contains("Good morning"));
    assert!(rule_based_response("good afternoon").contains("Good afternoon"));
    assert!(rule_based_response("good evening").contains("Good evening"));

    // Test status checks
    assert!(rule_based_response("how are you").contains("doing great"));
    assert!(rule_based_response("what's up").contains("hanging out"));

    // Test goodbye patterns
    assert!(rule_based_response("goodnight").contains("Goodnight"));
    assert!(rule_based_response("bye").contains("See you later"));
    assert!(rule_based_response("goodbye").contains("See you later"));

    // Test needs and activities
    assert!(rule_based_response("hungry").contains("snack"));
    assert!(rule_based_response("tired").contains("rest"));
    assert!(rule_based_response("play").contains("fun"));
    assert!(rule_based_response("work").contains("break"));

    // Test emotions
    assert!(rule_based_response("happy").contains("happy"));
    assert!(rule_based_response("sad").contains("here for you"));
    assert!(rule_based_response("bored").contains("interesting"));

    // Test questions
    assert!(rule_based_response("what are you doing").contains("being here"));
    assert!(rule_based_response("who are you").contains("companion"));
    assert!(rule_based_response("help").contains("help"));

    // Test compliments
    assert!(rule_based_response("cute").contains("thank you"));
    assert!(rule_based_response("thank you").contains("welcome"));

    // Test default fallback (should be non-empty)
    let default_response = rule_based_response("random unknown input xyz123");
    assert!(!default_response.is_empty());
    assert!(default_response.len() > 5);
}

/// Test that rule_based_response is case-insensitive
#[test]
fn test_rule_based_response_case_insensitive() {
    assert_eq!(rule_based_response("HELLO"), rule_based_response("hello"));
    assert_eq!(
        rule_based_response("HoW aRe YoU"),
        rule_based_response("how are you")
    );
}

/// Test that rule_based_response never returns empty string
#[test]
fn test_rule_based_response_never_empty() {
    let long_input = "a".repeat(1000);
    let test_inputs = vec!["", "   ", "xyz123", "🎉", long_input.as_str()];

    for input in test_inputs {
        let response = rule_based_response(input);
        assert!(
            !response.is_empty(),
            "rule_based_response should never return empty string for input: '{}'",
            input
        );
    }
}

/// Test FallbackChain construction and provider ordering
#[test]
fn test_fallback_chain_construction() {
    let chain = ProviderChain {
        primary: ProviderConfig::OpenAI {
            api_key: "key1".to_string(),
            model: "gpt-4".to_string(),
            base_url: None,
        },
        fallback: Some(Box::new(ProviderConfig::Anthropic {
            api_key: "key2".to_string(),
            model: "claude-3-opus".to_string(),
            base_url: None,
        })),
    };

    let fallback_chain = FallbackChain::new(&chain);

    // Verify chain preserves provider order
    assert_eq!(fallback_chain.providers().len(), 2);
    assert!(matches!(
        fallback_chain.providers()[0],
        ProviderConfig::OpenAI { .. }
    ));
    assert!(matches!(
        fallback_chain.providers()[1],
        ProviderConfig::Anthropic { .. }
    ));
}

/// Test FallbackChain with empty provider list
#[test]
fn test_fallback_chain_empty() {
    let chain = ProviderChain {
        primary: ProviderConfig::Ollama {
            model: "llama2".to_string(),
            base_url: "http://localhost:11434".to_string(),
        },
        fallback: None,
    };
    let fallback_chain = FallbackChain::new(&chain);
    assert_eq!(fallback_chain.providers().len(), 1);
}

/// Test FallbackChain with single provider
#[test]
fn test_fallback_chain_single_provider() {
    let chain = ProviderChain {
        primary: ProviderConfig::Ollama {
            model: "llama2".to_string(),
            base_url: "http://localhost:11434".to_string(),
        },
        fallback: None,
    };

    let fallback_chain = FallbackChain::new(&chain);
    assert_eq!(fallback_chain.providers().len(), 1);
}

/// Test that offline mode (rule-based) works without any network dependencies
#[test]
fn test_offline_mode_no_network() {
    // This test verifies that rule_based_response can work completely offline
    // by not requiring any external dependencies

    let responses = vec![
        rule_based_response("hello"),
        rule_based_response("how are you"),
        rule_based_response("bye"),
        rule_based_response("hungry"),
        rule_based_response("random"),
    ];

    // All responses should be non-empty and valid
    for response in responses {
        assert!(!response.is_empty());
        assert!(response.len() > 5); // Reasonable minimum length
    }
}

/// Test that default responses have variety (deterministic based on input)
#[test]
fn test_default_response_variety() {
    // Different inputs should produce different default responses
    let inputs = vec![
        "xyz123", "abc456", "test789", "random1", "random2", "random3", "random4", "random5",
    ];

    let mut responses = std::collections::HashSet::new();
    for input in inputs {
        let response = rule_based_response(input);
        assert!(!response.is_empty());
        responses.insert(response);
    }

    // Should have at least 2 different default responses
    assert!(
        responses.len() >= 2,
        "Expected variety in default responses, got {} unique responses",
        responses.len()
    );
}

/// Test that same input produces same response (deterministic)
#[test]
fn test_response_deterministic() {
    let input = "some random text";
    let response1 = rule_based_response(input);
    let response2 = rule_based_response(input);
    assert_eq!(
        response1, response2,
        "Same input should produce same response"
    );
}
