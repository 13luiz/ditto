use std::time::Duration;

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct NeedValue(f64);

impl NeedValue {
    pub fn new(value: f64) -> Self {
        Self(value.clamp(0.0, 100.0))
    }
    pub fn get(&self) -> f64 {
        self.0
    }
    pub fn set(&mut self, value: f64) {
        self.0 = value.clamp(0.0, 100.0);
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NeedType {
    Hunger,
    Happiness,
    Energy,
    Social,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct Needs {
    pub hunger: NeedValue,
    pub happiness: NeedValue,
    pub energy: NeedValue,
    pub social: NeedValue,
}

impl Needs {
    pub fn full() -> Self {
        Self {
            hunger: NeedValue::new(100.0),
            happiness: NeedValue::new(100.0),
            energy: NeedValue::new(100.0),
            social: NeedValue::new(100.0),
        }
    }

    fn decay_rate(need: NeedType) -> f64 {
        match need {
            NeedType::Hunger => 1.0 / 3600.0,
            NeedType::Happiness => 0.5 / 3600.0,
            NeedType::Energy => 0.3 / 3600.0,
            NeedType::Social => 0.2 / 3600.0,
        }
    }

    pub fn decay(&mut self, elapsed: Duration) {
        let secs = elapsed.as_secs_f64();
        self.hunger
            .set(self.hunger.get() - Self::decay_rate(NeedType::Hunger) * secs);
        self.happiness
            .set(self.happiness.get() - Self::decay_rate(NeedType::Happiness) * secs);
        self.energy
            .set(self.energy.get() - Self::decay_rate(NeedType::Energy) * secs);
        self.social
            .set(self.social.get() - Self::decay_rate(NeedType::Social) * secs);
    }

    pub fn get(&self, need: NeedType) -> f64 {
        match need {
            NeedType::Hunger => self.hunger.get(),
            NeedType::Happiness => self.happiness.get(),
            NeedType::Energy => self.energy.get(),
            NeedType::Social => self.social.get(),
        }
    }

    pub fn set(&mut self, need: NeedType, value: f64) {
        match need {
            NeedType::Hunger => self.hunger.set(value),
            NeedType::Happiness => self.happiness.set(value),
            NeedType::Energy => self.energy.set(value),
            NeedType::Social => self.social.set(value),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MoodLabel {
    Ecstatic,
    Happy,
    Neutral,
    Sad,
    Miserable,
}

impl MoodLabel {
    pub fn from_score(score: f64) -> Self {
        if score >= 80.0 {
            MoodLabel::Ecstatic
        } else if score >= 60.0 {
            MoodLabel::Happy
        } else if score >= 40.0 {
            MoodLabel::Neutral
        } else if score >= 20.0 {
            MoodLabel::Sad
        } else {
            MoodLabel::Miserable
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Mood {
    pub score: f64,
    pub label: MoodLabel,
}

impl Mood {
    pub fn from_needs(needs: &Needs) -> Self {
        let score = needs.hunger.get() * 0.3
            + needs.happiness.get() * 0.3
            + needs.energy.get() * 0.2
            + needs.social.get() * 0.2;
        Self {
            score,
            label: MoodLabel::from_score(score),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CareAction {
    Feed,
    Pet,
    Chat,
    Sleep,
}

#[derive(Debug, Clone)]
pub struct CareSystem {
    pub needs: Needs,
}

impl CareSystem {
    pub fn new() -> Self {
        Self {
            needs: Needs::full(),
        }
    }
    pub fn with_needs(needs: Needs) -> Self {
        Self { needs }
    }
    pub fn decay(&mut self, elapsed: Duration) {
        self.needs.decay(elapsed);
    }
    pub fn mood(&self) -> Mood {
        Mood::from_needs(&self.needs)
    }

    pub fn apply_action(&mut self, action: CareAction) -> f64 {
        let (need, amount): (NeedType, f64) = match action {
            CareAction::Feed => (NeedType::Hunger, 30.0),
            CareAction::Pet => (NeedType::Happiness, 20.0),
            CareAction::Chat => (NeedType::Social, 25.0),
            CareAction::Sleep => (NeedType::Energy, 40.0),
        };
        let current = self.needs.get(need);
        self.needs.set(need, current + amount);
        self.needs.get(need)
    }

    pub fn save(&self, db: &crate::db::Database) -> Result<(), String> {
        let json = serde_json::to_string(&self.needs).map_err(|e| e.to_string())?;
        db.save_setting("care_state", &json)
            .map_err(|e| e.to_string())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        db.save_setting("care_last_updated", &now.to_string())
            .map_err(|e| e.to_string())
    }

    pub fn load(db: &crate::db::Database) -> Result<Self, String> {
        match db.load_setting("care_state").map_err(|e| e.to_string())? {
            Some(json) => {
                let needs: Needs = serde_json::from_str(&json).map_err(|e| e.to_string())?;
                Ok(Self { needs })
            }
            None => Ok(Self::new()),
        }
    }

    pub fn load_with_decay(db: &crate::db::Database) -> Result<Self, String> {
        let mut care = Self::load(db)?;
        let last_updated = db
            .load_setting("care_last_updated")
            .map_err(|e| e.to_string())?
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        if last_updated > 0 && now > last_updated {
            let elapsed = std::time::Duration::from_secs(now - last_updated);
            care.decay(elapsed);
            care.save(db)?;
        }

        Ok(care)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn needs(a: f64, b: f64, c: f64, d: f64) -> Needs {
        Needs {
            hunger: NeedValue::new(a),
            happiness: NeedValue::new(b),
            energy: NeedValue::new(c),
            social: NeedValue::new(d),
        }
    }

    #[test]
    fn test_needs_start_full() {
        let n = Needs::full();
        assert_eq!(n.hunger.get(), 100.0);
    }

    #[test]
    fn test_need_value_clamped() {
        assert_eq!(NeedValue::new(150.0).get(), 100.0);
        assert_eq!(NeedValue::new(-10.0).get(), 0.0);
    }

    #[test]
    fn test_decay_reduces_needs() {
        let mut n = Needs::full();
        n.decay(Duration::from_secs(3600));
        assert!(n.hunger.get() < 100.0);
    }

    #[test]
    fn test_decay_rates_correct() {
        let mut n = Needs::full();
        n.decay(Duration::from_secs(3600));
        assert!((n.hunger.get() - 99.0).abs() < 0.01);
        assert!((n.happiness.get() - 99.5).abs() < 0.01);
        assert!((n.energy.get() - 99.7).abs() < 0.01);
        assert!((n.social.get() - 99.8).abs() < 0.01);
    }

    #[test]
    fn test_decay_clamps_to_zero() {
        let mut n = Needs::full();
        n.hunger.set(0.1);
        n.decay(Duration::from_secs(3600));
        assert_eq!(n.hunger.get(), 0.0);
    }

    #[test]
    fn test_mood_all_full() {
        let m = CareSystem::new().mood();
        assert!((m.score - 100.0).abs() < 0.01);
        assert_eq!(m.label, MoodLabel::Ecstatic);
    }

    #[test]
    fn test_mood_all_zero() {
        let m = CareSystem::with_needs(needs(0.0, 0.0, 0.0, 0.0)).mood();
        assert!(m.score.abs() < 0.01);
        assert_eq!(m.label, MoodLabel::Miserable);
    }

    #[test]
    fn test_mood_weighted() {
        let m = CareSystem::with_needs(needs(80.0, 60.0, 40.0, 20.0)).mood();
        assert!((m.score - 54.0).abs() < 0.01);
        assert_eq!(m.label, MoodLabel::Neutral);
    }

    #[test]
    fn test_mood_labels() {
        assert_eq!(MoodLabel::from_score(90.0), MoodLabel::Ecstatic);
        assert_eq!(MoodLabel::from_score(70.0), MoodLabel::Happy);
        assert_eq!(MoodLabel::from_score(50.0), MoodLabel::Neutral);
        assert_eq!(MoodLabel::from_score(30.0), MoodLabel::Sad);
        assert_eq!(MoodLabel::from_score(10.0), MoodLabel::Miserable);
    }

    #[test]
    fn test_feed() {
        let mut c = CareSystem::with_needs(needs(30.0, 50.0, 50.0, 50.0));
        assert!((c.apply_action(CareAction::Feed) - 60.0).abs() < 0.01);
    }

    #[test]
    fn test_pet() {
        let mut c = CareSystem::with_needs(needs(50.0, 30.0, 50.0, 50.0));
        assert!((c.apply_action(CareAction::Pet) - 50.0).abs() < 0.01);
    }

    #[test]
    fn test_chat() {
        let mut c = CareSystem::with_needs(needs(50.0, 50.0, 50.0, 30.0));
        assert!((c.apply_action(CareAction::Chat) - 55.0).abs() < 0.01);
    }

    #[test]
    fn test_sleep() {
        let mut c = CareSystem::with_needs(needs(50.0, 50.0, 20.0, 50.0));
        assert!((c.apply_action(CareAction::Sleep) - 60.0).abs() < 0.01);
    }

    #[test]
    fn test_action_clamps() {
        let mut c = CareSystem::with_needs(needs(90.0, 50.0, 50.0, 50.0));
        assert_eq!(c.apply_action(CareAction::Feed), 100.0);
    }

    #[test]
    fn test_mood_sad() {
        let m = Mood::from_needs(&needs(10.0, 10.0, 10.0, 10.0));
        assert!(matches!(m.label, MoodLabel::Sad | MoodLabel::Miserable));
    }

    #[test]
    fn test_mood_happy() {
        let m = Mood::from_needs(&needs(90.0, 90.0, 90.0, 90.0));
        assert!(matches!(m.label, MoodLabel::Happy | MoodLabel::Ecstatic));
    }

    #[test]
    fn test_care_save_and_load() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let care = CareSystem::with_needs(needs(30.0, 50.0, 70.0, 20.0));
        care.save(&db).unwrap();

        let loaded = CareSystem::load(&db).unwrap();
        assert!((loaded.needs.hunger.get() - 30.0).abs() < 0.01);
        assert!((loaded.needs.happiness.get() - 50.0).abs() < 0.01);
        assert!((loaded.needs.energy.get() - 70.0).abs() < 0.01);
        assert!((loaded.needs.social.get() - 20.0).abs() < 0.01);
    }

    #[test]
    fn test_care_load_default_when_empty() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let care = CareSystem::load(&db).unwrap();
        assert_eq!(care.needs.hunger.get(), 100.0);
    }

    #[test]
    fn test_care_save_overwrites() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let care = CareSystem::with_needs(needs(10.0, 20.0, 30.0, 40.0));
        care.save(&db).unwrap();

        let care2 = CareSystem::with_needs(needs(80.0, 90.0, 70.0, 60.0));
        care2.save(&db).unwrap();

        let loaded = CareSystem::load(&db).unwrap();
        assert!((loaded.needs.hunger.get() - 80.0).abs() < 0.01);
    }

    #[test]
    fn test_load_with_decay_applies_elapsed_decay() {
        let db = crate::db::Database::open_in_memory().unwrap();
        let care = CareSystem::with_needs(needs(80.0, 80.0, 80.0, 80.0));
        care.save(&db).unwrap();

        // Overwrite timestamp to 1 hour ago
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let one_hour_ago = now - 3600;
        db.save_setting("care_last_updated", &one_hour_ago.to_string())
            .unwrap();

        let loaded = CareSystem::load_with_decay(&db).unwrap();
        assert!(loaded.needs.hunger.get() < 80.0, "hunger should have decayed");
        assert!(
            (loaded.needs.hunger.get() - 79.0).abs() < 0.1,
            "hunger should decay ~1.0/hr, got {}",
            loaded.needs.hunger.get()
        );
    }

    #[test]
    fn test_load_with_decay_no_timestamp() {
        let db = crate::db::Database::open_in_memory().unwrap();
        // No care state saved — should return defaults
        let loaded = CareSystem::load_with_decay(&db).unwrap();
        assert_eq!(loaded.needs.hunger.get(), 100.0);
    }
}
