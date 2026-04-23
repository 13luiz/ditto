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

    pub fn record_positive_interaction(&mut self) {
        self.shift("cheerfulness", 1);
        self.shift("clinginess", 1);
    }

    pub fn record_neglect(&mut self) {
        self.shift("clinginess", -1);
        self.shift("cheerfulness", -1);
    }

    pub fn save(&self, db: &crate::db::Database) -> Result<(), String> {
        let json = serde_json::to_string(self).map_err(|e| e.to_string())?;
        db.save_setting("personality_traits", &json).map_err(|e| e.to_string())
    }

    pub fn load(db: &crate::db::Database) -> Result<Self, String> {
        match db.load_setting("personality_traits").map_err(|e| e.to_string())? {
            Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
            None => Ok(Self::default()),
        }
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

    #[test]
    fn test_positive_interaction_evolution() {
        let mut traits = PersonalityTraits::default();
        let initial_cheer = traits.cheerfulness;
        let initial_cling = traits.clinginess;
        traits.record_positive_interaction();
        assert_eq!(traits.cheerfulness, initial_cheer + 1);
        assert_eq!(traits.clinginess, initial_cling + 1);
    }

    #[test]
    fn test_neglect_evolution() {
        let mut traits = PersonalityTraits::default();
        let initial_cheer = traits.cheerfulness;
        let initial_cling = traits.clinginess;
        traits.record_neglect();
        assert_eq!(traits.cheerfulness, initial_cheer - 1);
        assert_eq!(traits.clinginess, initial_cling - 1);
    }

    #[test]
    fn test_evolution_clamps() {
        let mut traits = PersonalityTraits {
            cheerfulness: 100,
            ..Default::default()
        };
        traits.record_positive_interaction();
        assert_eq!(traits.cheerfulness, 100);
    }

    #[test]
    fn test_traits_persistence() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let mut traits = PersonalityTraits {
            cheerfulness: 85,
            curiosity: 95,
            mischievousness: 20,
            clinginess: 55,
        };
        traits.save(&db).unwrap();

        let loaded = PersonalityTraits::load(&db).unwrap();
        assert_eq!(loaded.cheerfulness, 85);
        assert_eq!(loaded.curiosity, 95);
        assert_eq!(loaded.mischievousness, 20);
        assert_eq!(loaded.clinginess, 55);
    }

    #[test]
    fn test_traits_load_default_when_empty() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let traits = PersonalityTraits::load(&db).unwrap();
        assert_eq!(traits, PersonalityTraits::default());
    }
}
