use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PersonalityTraits {
    pub cheerfulness: u8,
    pub curiosity: u8,
    pub mischievousness: u8,
    pub clinginess: u8,
}

impl Default for PersonalityTraits {
    fn default() -> Self {
        Self {
            cheerfulness: 70,
            curiosity: 60,
            mischievousness: 40,
            clinginess: 50,
        }
    }
}

impl PersonalityTraits {
    pub fn shift(&mut self, trait_name: &str, delta: i8) {
        let target = match trait_name {
            "cheerfulness" => &mut self.cheerfulness,
            "curiosity" => &mut self.curiosity,
            "mischievousness" => &mut self.mischievousness,
            "clinginess" => &mut self.clinginess,
            _ => return,
        };
        *target = (*target as i16 + delta as i16).clamp(0, 100) as u8;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_traits() {
        let traits = PersonalityTraits::default();
        assert_eq!(traits.cheerfulness, 70);
        assert_eq!(traits.curiosity, 60);
        assert!(traits.mischievousness < traits.cheerfulness);
    }

    #[test]
    fn test_shift_trait_up() {
        let mut traits = PersonalityTraits::default();
        traits.shift("cheerfulness", 10);
        assert_eq!(traits.cheerfulness, 80);
    }

    #[test]
    fn test_shift_trait_down() {
        let mut traits = PersonalityTraits::default();
        traits.shift("curiosity", -20);
        assert_eq!(traits.curiosity, 40);
    }

    #[test]
    fn test_shift_clamps_at_max() {
        let mut traits = PersonalityTraits {
            cheerfulness: 95,
            ..Default::default()
        };
        traits.shift("cheerfulness", 20);
        assert_eq!(traits.cheerfulness, 100);
    }

    #[test]
    fn test_shift_clamps_at_min() {
        let mut traits = PersonalityTraits {
            curiosity: 5,
            ..Default::default()
        };
        traits.shift("curiosity", -20);
        assert_eq!(traits.curiosity, 0);
    }

    #[test]
    fn test_shift_unknown_trait_ignored() {
        let mut traits = PersonalityTraits::default();
        traits.shift("nonexistent", 50);
        assert_eq!(traits, PersonalityTraits::default());
    }

    #[test]
    fn test_traits_serialization_roundtrip() {
        let traits = PersonalityTraits {
            cheerfulness: 80,
            curiosity: 90,
            mischievousness: 30,
            clinginess: 60,
        };
        let json = serde_json::to_string(&traits).unwrap();
        let restored: PersonalityTraits = serde_json::from_str(&json).unwrap();
        assert_eq!(traits, restored);
    }
}
