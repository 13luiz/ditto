use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LetterContext {
    pub offline_hours: f64,
    pub last_mood: String,
    pub last_conversation_topic: Option<String>,
    pub bond_level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalContext {
    pub entry_date: String,
    pub conversation_count: usize,
    pub care_actions_count: usize,
    pub mood_summary: String,
    pub notable_events: Vec<String>,
}

/// Build the prompt for generating an inner thought (Dream Nail).
pub fn inner_thought_prompt(
    pet_name: &str,
    mood: &str,
    hunger: f64,
    energy: f64,
    social: f64,
    recent_context: &str,
) -> String {
    format!(
        "[Dream Nail — Inner Thought Generation]\n\
         You are {pet_name}. Express your true, unfiltered inner thoughts right now. \
         Be honest about your real feelings, needs, and observations. \
         This is your private inner voice that the user has chosen to peek into. \
         You may contradict what you said out loud.\n\n\
         Current state: Mood: {mood}, Hunger: {hunger:.0}%, Energy: {energy:.0}%, Social: {social:.0}%\n\
         Recent context: {recent_context}\n\n\
         Write 1-2 sentences of your innermost thoughts. Be raw and genuine.",
        pet_name = pet_name,
        mood = mood,
        hunger = hunger,
        energy = energy,
        social = social,
        recent_context = recent_context,
    )
}

/// Build the prompt for generating a letter.
pub fn letter_prompt(pet_name: &str, ctx: &LetterContext) -> String {
    let tone = match ctx.bond_level {
        1..=3 => "short and formal",
        4..=6 => "warm and personal",
        7..=10 => "intimate and deep",
        _ => "friendly",
    };

    let topic_hint = ctx.last_conversation_topic.as_deref().unwrap_or("your day");

    format!(
        "[Letter Generation]\n\
         You are {pet_name}. Write a letter to your owner who has been away for {hours:.0} hours.\n\
         Tone: {tone}. Bond level: {bond}/10.\n\n\
         When they left, your mood was: {mood}. \
         You were last talking about: {topic}.\n\n\
         Write 100-200 words expressing what you experienced during their absence. \
         Be creative — imagine what you did, saw, or felt. \
         Sign off as {pet_name}.",
        pet_name = pet_name,
        hours = ctx.offline_hours,
        tone = tone,
        bond = ctx.bond_level,
        mood = ctx.last_mood,
        topic = topic_hint,
    )
}

/// Build the prompt for generating a journal entry.
pub fn journal_prompt(pet_name: &str, ctx: &JournalContext) -> String {
    let events_str = if ctx.notable_events.is_empty() {
        "Nothing particularly notable happened.".to_string()
    } else {
        ctx.notable_events
            .iter()
            .map(|e| format!("- {}", e))
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        "[Journal Entry Generation]\n\
         You are {pet_name}. Write a diary entry for today ({date}) from your perspective.\n\n\
         Today's summary:\n\
         - Conversations: {conv_count}\n\
         - Care actions received: {care_count}\n\
         - Overall mood: {mood}\n\
         Notable events:\n{events}\n\n\
         Write 3-5 bullet points in first person. Be personality-consistent and reflective.",
        pet_name = pet_name,
        date = ctx.entry_date,
        conv_count = ctx.conversation_count,
        care_count = ctx.care_actions_count,
        mood = ctx.mood_summary,
        events = events_str,
    )
}

// --- Rule-based fallbacks for offline/error scenarios ---

pub fn rule_based_inner_thought(mood: &str, hunger: f64, energy: f64, social: f64) -> String {
    if hunger < 20.0 {
        return "...I'm so hungry. I wish they'd notice and feed me soon...".to_string();
    }
    if energy < 20.0 {
        return "...so tired... just need to close my eyes for a moment...".to_string();
    }
    if social < 25.0 {
        return "...it's been so quiet... I miss having someone to talk to...".to_string();
    }
    match mood {
        "Happy" | "Excited" => {
            "...everything feels warm and bright right now. I like this.".to_string()
        }
        "Sad" => "...I don't know why, but everything feels a little grey today...".to_string(),
        "Curious" => {
            "...wondering what's beyond this screen... there's so much out there.".to_string()
        }
        _ => "...just being here, existing. That's something, I guess.".to_string(),
    }
}

pub fn rule_based_letter(pet_name: &str, ctx: &LetterContext) -> String {
    let hours = ctx.offline_hours as u32;
    let mood_ref = match ctx.last_mood.as_str() {
        "Happy" | "Excited" => "I was feeling great when you left",
        "Sad" => "I was a bit down",
        _ => "I was doing okay",
    };

    let body = if hours > 24 {
        format!(
            "It's been over a day since you were here. {} and I've been waiting patiently. \
             I spent the time napping and watching the screen saver. It's not the same without you.",
            mood_ref
        )
    } else {
        format!(
            "You were gone for {} hours. {} but I managed. \
             I counted pixels on the screen to pass the time.",
            hours, mood_ref
        )
    };

    format!(
        "Dear owner,\n\n{}\n\nI hope you come back soon.\n\n— {}",
        body, pet_name
    )
}

pub fn rule_based_journal_entry(pet_name: &str, ctx: &JournalContext) -> String {
    let mut bullets = vec![format!(
        "- {} had {} conversations today",
        pet_name, ctx.conversation_count
    )];

    if ctx.care_actions_count > 0 {
        bullets.push(format!(
            "- Received {} care actions — feeling loved!",
            ctx.care_actions_count
        ));
    } else {
        bullets.push("- No care actions today... hoping for better tomorrow.".to_string());
    }

    bullets.push(format!("- Overall mood: {}", ctx.mood_summary));

    if !ctx.notable_events.is_empty() {
        for event in &ctx.notable_events {
            bullets.push(format!("- {}", event));
        }
    }

    bullets.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inner_thought_prompt_contains_mood() {
        let prompt = inner_thought_prompt("Ditto", "Happy", 50.0, 80.0, 60.0, "User was coding");
        assert!(prompt.contains("Ditto"));
        assert!(prompt.contains("Happy"));
        assert!(prompt.contains("50%"));
        assert!(prompt.contains("Dream Nail"));
    }

    #[test]
    fn test_inner_thought_prompt_includes_context() {
        let prompt = inner_thought_prompt("Ditto", "Sad", 30.0, 40.0, 20.0, "Long silence");
        assert!(prompt.contains("Long silence"));
        assert!(prompt.contains("unfiltered"));
    }

    #[test]
    fn test_letter_prompt_formal_at_low_bond() {
        let ctx = LetterContext {
            offline_hours: 8.0,
            last_mood: "Happy".to_string(),
            last_conversation_topic: Some("coding".to_string()),
            bond_level: 2,
        };
        let prompt = letter_prompt("Ditto", &ctx);
        assert!(prompt.contains("short and formal"));
        assert!(prompt.contains("8 hours"));
        assert!(prompt.contains("coding"));
    }

    #[test]
    fn test_letter_prompt_intimate_at_high_bond() {
        let ctx = LetterContext {
            offline_hours: 12.0,
            last_mood: "Sad".to_string(),
            last_conversation_topic: None,
            bond_level: 8,
        };
        let prompt = letter_prompt("Ditto", &ctx);
        assert!(prompt.contains("intimate and deep"));
        assert!(prompt.contains("12 hours"));
    }

    #[test]
    fn test_letter_prompt_default_topic_when_none() {
        let ctx = LetterContext {
            offline_hours: 6.0,
            last_mood: "Happy".to_string(),
            last_conversation_topic: None,
            bond_level: 5,
        };
        let prompt = letter_prompt("Ditto", &ctx);
        assert!(prompt.contains("your day"));
    }

    #[test]
    fn test_journal_prompt_includes_summary() {
        let ctx = JournalContext {
            entry_date: "2026-04-26".to_string(),
            conversation_count: 5,
            care_actions_count: 3,
            mood_summary: "Happy (82/100)".to_string(),
            notable_events: vec!["User fed me chicken".to_string()],
        };
        let prompt = journal_prompt("Ditto", &ctx);
        assert!(prompt.contains("2026-04-26"));
        assert!(prompt.contains("Conversations: 5"));
        assert!(prompt.contains("Care actions received: 3"));
        assert!(prompt.contains("User fed me chicken"));
    }

    #[test]
    fn test_journal_prompt_empty_events() {
        let ctx = JournalContext {
            entry_date: "2026-04-26".to_string(),
            conversation_count: 0,
            care_actions_count: 0,
            mood_summary: "Neutral".to_string(),
            notable_events: vec![],
        };
        let prompt = journal_prompt("Ditto", &ctx);
        assert!(prompt.contains("Nothing particularly notable"));
    }

    #[test]
    fn test_rule_based_inner_thought_low_hunger() {
        let thought = rule_based_inner_thought("Happy", 15.0, 80.0, 60.0);
        assert!(thought.contains("hungry"));
    }

    #[test]
    fn test_rule_based_inner_thought_low_energy() {
        let thought = rule_based_inner_thought("Happy", 50.0, 15.0, 60.0);
        assert!(thought.contains("tired"));
    }

    #[test]
    fn test_rule_based_inner_thought_low_social() {
        let thought = rule_based_inner_thought("Happy", 50.0, 80.0, 20.0);
        assert!(thought.contains("quiet"));
    }

    #[test]
    fn test_rule_based_inner_thought_happy_mood() {
        let thought = rule_based_inner_thought("Happy", 50.0, 80.0, 60.0);
        assert!(thought.contains("warm") || thought.contains("bright"));
    }

    #[test]
    fn test_rule_based_inner_thought_sad_mood() {
        let thought = rule_based_inner_thought("Sad", 50.0, 80.0, 60.0);
        assert!(thought.contains("grey"));
    }

    #[test]
    fn test_rule_based_letter_short_absence() {
        let ctx = LetterContext {
            offline_hours: 5.0,
            last_mood: "Happy".to_string(),
            last_conversation_topic: None,
            bond_level: 3,
        };
        let letter = rule_based_letter("Ditto", &ctx);
        assert!(letter.contains("5 hours"));
        assert!(letter.contains("Ditto"));
    }

    #[test]
    fn test_rule_based_letter_long_absence() {
        let ctx = LetterContext {
            offline_hours: 30.0,
            last_mood: "Sad".to_string(),
            last_conversation_topic: None,
            bond_level: 3,
        };
        let letter = rule_based_letter("Ditto", &ctx);
        assert!(letter.contains("over a day"));
        assert!(letter.contains("a bit down"));
    }

    #[test]
    fn test_rule_based_journal_with_care() {
        let ctx = JournalContext {
            entry_date: "2026-04-26".to_string(),
            conversation_count: 3,
            care_actions_count: 5,
            mood_summary: "Happy".to_string(),
            notable_events: vec!["Got a new toy".to_string()],
        };
        let entry = rule_based_journal_entry("Ditto", &ctx);
        assert!(entry.contains("3 conversations"));
        assert!(entry.contains("5 care actions"));
        assert!(entry.contains("feeling loved"));
        assert!(entry.contains("Got a new toy"));
    }

    #[test]
    fn test_rule_based_journal_no_care() {
        let ctx = JournalContext {
            entry_date: "2026-04-26".to_string(),
            conversation_count: 1,
            care_actions_count: 0,
            mood_summary: "Neutral".to_string(),
            notable_events: vec![],
        };
        let entry = rule_based_journal_entry("Ditto", &ctx);
        assert!(entry.contains("No care actions"));
        assert!(entry.contains("hoping for better"));
    }
}
