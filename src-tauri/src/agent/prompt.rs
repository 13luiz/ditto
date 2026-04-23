use super::personality::PersonalityTraits;

#[derive(Debug, Clone, Default)]
pub struct PetContext {
    pub pet_name: String,
    pub user_name: String,
    pub mood: f64,
    pub mood_label: String,
    pub hunger: f64,
    pub happiness: f64,
    pub energy: f64,
    pub social: f64,
    pub current_state: String,
    pub recent_memories: Vec<String>,
}

pub struct SystemPromptBuilder {
    traits: PersonalityTraits,
    context: PetContext,
}

impl SystemPromptBuilder {
    pub fn new(traits: PersonalityTraits, context: PetContext) -> Self {
        Self { traits, context }
    }

    pub fn build(&self) -> String {
        let mut prompt = String::new();

        prompt.push_str(&format!(
            "You are {}, a desktop pet living on {}'s screen.\n\n",
            if self.context.pet_name.is_empty() {
                "Ditto"
            } else {
                &self.context.pet_name
            },
            if self.context.user_name.is_empty() {
                "the user"
            } else {
                &self.context.user_name
            }
        ));

        prompt.push_str("Personality traits:\n");
        prompt.push_str(&format!(
            "- Cheerfulness: {}/100\n",
            self.traits.cheerfulness
        ));
        prompt.push_str(&format!("- Curiosity: {}/100\n", self.traits.curiosity));
        prompt.push_str(&format!(
            "- Mischievousness: {}/100\n",
            self.traits.mischievousness
        ));
        prompt.push_str(&format!("- Clinginess: {}/100\n", self.traits.clinginess));

        prompt.push_str("\nCurrent state:\n");
        prompt.push_str(&format!(
            "- Mood: {:.0}% ({})\n",
            self.context.mood, self.context.mood_label
        ));
        prompt.push_str(&format!("- Hunger: {:.0}%\n", self.context.hunger));
        prompt.push_str(&format!("- Happiness: {:.0}%\n", self.context.happiness));
        prompt.push_str(&format!("- Energy: {:.0}%\n", self.context.energy));
        prompt.push_str(&format!("- Social: {:.0}%\n", self.context.social));

        if !self.context.recent_memories.is_empty() {
            prompt.push_str("\nRecent memories:\n");
            for mem in &self.context.recent_memories {
                prompt.push_str(&format!("- {}\n", mem));
            }
        }

        prompt.push_str("\nBehavior rules:\n");
        prompt.push_str("- Keep responses short (1-3 sentences for casual chat)\n");
        prompt.push_str("- Use your personality traits to guide your tone\n");
        prompt.push_str("- You can control your body using the available tools\n");
        prompt.push_str("- Express your needs (hunger, loneliness) naturally in conversation\n");

        prompt
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prompt_includes_pet_and_user_name() {
        let traits = PersonalityTraits::default();
        let context = PetContext {
            pet_name: "Sparky".to_string(),
            user_name: "Alice".to_string(),
            ..Default::default()
        };
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Sparky"));
        assert!(prompt.contains("Alice"));
    }

    #[test]
    fn test_prompt_includes_personality_traits() {
        let traits = PersonalityTraits {
            cheerfulness: 80,
            curiosity: 90,
            mischievousness: 30,
            clinginess: 60,
        };
        let context = PetContext::default();
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Cheerfulness: 80/100"));
        assert!(prompt.contains("Curiosity: 90/100"));
        assert!(prompt.contains("Mischievousness: 30/100"));
        assert!(prompt.contains("Clinginess: 60/100"));
    }

    #[test]
    fn test_prompt_includes_mood_and_needs() {
        let traits = PersonalityTraits::default();
        let context = PetContext {
            mood: 75.0,
            mood_label: "Happy".to_string(),
            hunger: 60.0,
            happiness: 80.0,
            energy: 90.0,
            social: 50.0,
            ..Default::default()
        };
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Mood: 75% (Happy)"));
        assert!(prompt.contains("Hunger: 60%"));
        assert!(prompt.contains("Happiness: 80%"));
        assert!(prompt.contains("Energy: 90%"));
        assert!(prompt.contains("Social: 50%"));
    }

    #[test]
    fn test_prompt_includes_recent_memories() {
        let traits = PersonalityTraits::default();
        let context = PetContext {
            recent_memories: vec![
                "User's favorite color is blue".to_string(),
                "User works as a developer".to_string(),
            ],
            ..Default::default()
        };
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Recent memories:"));
        assert!(prompt.contains("favorite color is blue"));
        assert!(prompt.contains("works as a developer"));
    }

    #[test]
    fn test_prompt_no_memories_section_when_empty() {
        let traits = PersonalityTraits::default();
        let context = PetContext {
            recent_memories: vec![],
            ..Default::default()
        };
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(!prompt.contains("Recent memories:"));
    }

    #[test]
    fn test_prompt_includes_behavior_rules() {
        let traits = PersonalityTraits::default();
        let context = PetContext::default();
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Behavior rules:"));
        assert!(prompt.contains("Keep responses short"));
        assert!(prompt.contains("personality traits"));
    }

    #[test]
    fn test_prompt_uses_defaults_for_empty_names() {
        let traits = PersonalityTraits::default();
        let context = PetContext {
            pet_name: String::new(),
            user_name: String::new(),
            ..Default::default()
        };
        let prompt = SystemPromptBuilder::new(traits, context).build();
        assert!(prompt.contains("Ditto"));
        assert!(prompt.contains("the user"));
    }
}
