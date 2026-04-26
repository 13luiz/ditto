use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BondAction {
    ChatMessage,
    ChatReply,
    Feed,
    Pet,
    Play,
    EmoteExchange,
    DailyLogin,
}

struct BondActionConfig {
    points: i64,
    daily_cap: i64,
    key: &'static str,
}

fn action_config(action: BondAction) -> BondActionConfig {
    match action {
        BondAction::ChatMessage => BondActionConfig {
            points: 2,
            daily_cap: 100,
            key: "chat_message",
        },
        BondAction::ChatReply => BondActionConfig {
            points: 1,
            daily_cap: 100,
            key: "chat_reply",
        },
        BondAction::Feed => BondActionConfig {
            points: 5,
            daily_cap: 5,
            key: "feed",
        },
        BondAction::Pet => BondActionConfig {
            points: 3,
            daily_cap: 10,
            key: "pet",
        },
        BondAction::Play => BondActionConfig {
            points: 8,
            daily_cap: 3,
            key: "play",
        },
        BondAction::EmoteExchange => BondActionConfig {
            points: 2,
            daily_cap: 10,
            key: "emote",
        },
        BondAction::DailyLogin => BondActionConfig {
            points: 10,
            daily_cap: 1,
            key: "daily_login",
        },
    }
}

const BOND_THRESHOLDS: [i64; 11] = [0, 0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500];

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BondAwardResult {
    pub points_awarded: i64,
    pub daily_capped: bool,
    pub total_points: i64,
    pub old_level: u32,
    pub new_level: u32,
    pub leveled_up: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BondState {
    pub level: u32,
    pub total_points: i64,
    pub level_title: String,
    pub points_to_next: i64,
    pub next_level: Option<u32>,
}

pub struct BondEngine {
    level: u32,
    total_points: i64,
    daily_points: HashMap<String, i64>,
    last_award_date: String,
}

impl BondEngine {
    pub fn new() -> Self {
        Self {
            level: 1,
            total_points: 0,
            daily_points: HashMap::new(),
            last_award_date: String::new(),
        }
    }

    pub fn with_state(level: u32, total_points: i64) -> Self {
        Self {
            level,
            total_points,
            daily_points: HashMap::new(),
            last_award_date: String::new(),
        }
    }

    pub fn award(&mut self, action: BondAction, today: &str) -> BondAwardResult {
        let cfg = action_config(action);
        self.reset_daily_if_needed(today);

        let count = self.daily_points.get(cfg.key).copied().unwrap_or(0);
        if count >= cfg.daily_cap {
            return BondAwardResult {
                points_awarded: 0,
                daily_capped: true,
                total_points: self.total_points,
                old_level: self.level,
                new_level: self.level,
                leveled_up: false,
            };
        }

        let old_level = self.level;
        self.total_points += cfg.points;
        *self.daily_points.entry(cfg.key.to_string()).or_insert(0) += 1;
        self.last_award_date = today.to_string();

        let new_level = Self::level_for_points(self.total_points);
        let leveled_up = new_level > old_level;
        if leveled_up {
            self.level = new_level;
        }

        BondAwardResult {
            points_awarded: cfg.points,
            daily_capped: false,
            total_points: self.total_points,
            old_level,
            new_level,
            leveled_up,
        }
    }

    pub fn level_for_points(points: i64) -> u32 {
        for lvl in (1..=10).rev() {
            if points >= BOND_THRESHOLDS[lvl as usize] {
                return lvl;
            }
        }
        1
    }

    pub fn level(&self) -> u32 {
        self.level
    }

    pub fn total_points(&self) -> i64 {
        self.total_points
    }

    pub fn state(&self) -> BondState {
        let next_level = if self.level < 10 {
            Some(self.level + 1)
        } else {
            None
        };
        let next_threshold = next_level
            .map(|l| BOND_THRESHOLDS[l as usize])
            .unwrap_or(i64::MAX);
        let points_to_next = if self.level >= 10 {
            0
        } else {
            next_threshold - self.total_points
        };

        BondState {
            level: self.level,
            total_points: self.total_points,
            level_title: Self::title_for_level(self.level),
            points_to_next: points_to_next.max(0),
            next_level,
        }
    }

    pub fn title_for_level(level: u32) -> String {
        match level {
            1 => "Stranger".into(),
            2 => "Acquaintance".into(),
            3 => "Friend".into(),
            4 => "Good Friend".into(),
            5 => "Close Friend".into(),
            6 => "Best Friend".into(),
            7 => "Family".into(),
            8 => "Soulmate".into(),
            9 => "Inseparable".into(),
            10 => "Bonded".into(),
            _ => "Unknown".into(),
        }
    }

    fn reset_daily_if_needed(&mut self, today: &str) {
        if self.last_award_date != today {
            self.daily_points.clear();
            self.last_award_date = today.to_string();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_starts_at_level_1() {
        let engine = BondEngine::new();
        assert_eq!(engine.level(), 1);
        assert_eq!(engine.total_points(), 0);
    }

    #[test]
    fn test_award_chat_message() {
        let mut engine = BondEngine::new();
        let result = engine.award(BondAction::ChatMessage, "2026-04-26");
        assert_eq!(result.points_awarded, 2);
        assert_eq!(result.total_points, 2);
        assert!(!result.leveled_up);
    }

    #[test]
    fn test_accumulation_reaches_level_2() {
        let mut engine = BondEngine::new();
        // 24 awards * 2 pts = 48, still level 1
        for _ in 0..24 {
            engine.award(BondAction::ChatMessage, "2026-04-26");
        }
        assert_eq!(engine.total_points(), 48);
        assert_eq!(engine.level(), 1);
        // 25th award: 48 + 2 = 50, crosses threshold to level 2
        let result = engine.award(BondAction::ChatMessage, "2026-04-26");
        assert_eq!(result.new_level, 2);
        assert!(result.leveled_up);
        assert_eq!(result.old_level, 1);
    }

    #[test]
    fn test_daily_cap_enforced() {
        let mut engine = BondEngine::new();
        // Feed: 5 pts, cap 5 times/day. Award 5 times to fill cap.
        for _ in 0..5 {
            engine.award(BondAction::Feed, "2026-04-26");
        }
        assert_eq!(engine.total_points(), 25);
        // 6th award is capped.
        let result = engine.award(BondAction::Feed, "2026-04-26");
        assert_eq!(result.points_awarded, 0);
        assert!(result.daily_capped);
        assert_eq!(engine.total_points(), 25);
    }

    #[test]
    fn test_daily_cap_resets_on_new_day() {
        let mut engine = BondEngine::new();
        // Day 1: 5 feeds fills cap (25 pts)
        for _ in 0..5 {
            engine.award(BondAction::Feed, "2026-04-26");
        }
        assert_eq!(engine.total_points(), 25);
        // Day 2: cap resets, can award again
        let result = engine.award(BondAction::Feed, "2026-04-27");
        assert_eq!(result.points_awarded, 5);
        assert!(!result.daily_capped);
        assert_eq!(engine.total_points(), 30);
    }

    #[test]
    fn test_level_for_points_thresholds() {
        assert_eq!(BondEngine::level_for_points(0), 1);
        assert_eq!(BondEngine::level_for_points(49), 1);
        assert_eq!(BondEngine::level_for_points(50), 2);
        assert_eq!(BondEngine::level_for_points(149), 2);
        assert_eq!(BondEngine::level_for_points(150), 3);
        assert_eq!(BondEngine::level_for_points(300), 4);
        assert_eq!(BondEngine::level_for_points(500), 5);
        assert_eq!(BondEngine::level_for_points(800), 6);
        assert_eq!(BondEngine::level_for_points(1200), 7);
        assert_eq!(BondEngine::level_for_points(1800), 8);
        assert_eq!(BondEngine::level_for_points(2500), 9);
        assert_eq!(BondEngine::level_for_points(3500), 10);
        assert_eq!(BondEngine::level_for_points(9999), 10);
    }

    #[test]
    fn test_state_report() {
        let engine = BondEngine::with_state(3, 200);
        let state = engine.state();
        assert_eq!(state.level, 3);
        assert_eq!(state.total_points, 200);
        assert_eq!(state.level_title, "Friend");
        assert_eq!(state.next_level, Some(4));
        assert_eq!(state.points_to_next, 100);
    }

    #[test]
    fn test_max_level_state() {
        let engine = BondEngine::with_state(10, 4000);
        let state = engine.state();
        assert_eq!(state.next_level, None);
        assert_eq!(state.points_to_next, 0);
    }

    #[test]
    fn test_multiple_action_types_share_daily_tracking() {
        let mut engine = BondEngine::new();
        engine.award(BondAction::ChatMessage, "2026-04-26");
        engine.award(BondAction::Feed, "2026-04-26");
        assert_eq!(engine.total_points(), 7);
    }

    #[test]
    fn test_play_action_high_points() {
        let mut engine = BondEngine::new();
        let result = engine.award(BondAction::Play, "2026-04-26");
        assert_eq!(result.points_awarded, 8);
    }

    #[test]
    fn test_title_for_all_levels() {
        assert_eq!(BondEngine::title_for_level(1), "Stranger");
        assert_eq!(BondEngine::title_for_level(5), "Close Friend");
        assert_eq!(BondEngine::title_for_level(10), "Bonded");
    }

    #[test]
    fn test_rapid_level_up_from_large_award() {
        let mut engine = BondEngine::new();
        engine.total_points = 49;
        engine.level = 1;
        let result = engine.award(BondAction::DailyLogin, "2026-04-26");
        assert_eq!(result.new_level, 2);
        assert!(result.leveled_up);
    }

    #[test]
    fn test_level_gated_from_bond_state() {
        let state = BondEngine::with_state(4, 300).state();
        assert_eq!(state.level, 4);
        assert_eq!(state.level_title, "Good Friend");
    }
}
