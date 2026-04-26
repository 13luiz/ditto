use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RpsChoice {
    Rock,
    Paper,
    Scissors,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RpsResult {
    Win,
    Lose,
    Draw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpsRound {
    pub player_choice: RpsChoice,
    pub pet_choice: RpsChoice,
    pub result: RpsResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpsGame {
    pub rounds: Vec<RpsRound>,
    pub current_round: usize,
    pub max_rounds: usize,
    pub player_score: u32,
    pub pet_score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatchItem {
    pub x: f64,
    pub y: f64,
    pub item_type: String,
    pub speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatchGameState {
    pub items: Vec<CatchItem>,
    pub player_x: f64,
    pub score: u32,
    pub time_remaining_secs: f64,
    pub width: f64,
    pub caught_count: u32,
    pub missed_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CareEffect {
    pub need: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct PetAi;

impl RpsGame {
    pub fn new() -> Self {
        Self {
            rounds: Vec::new(),
            current_round: 0,
            max_rounds: 5,
            player_score: 0,
            pet_score: 0,
        }
    }

    pub fn with_rounds(max_rounds: usize) -> Self {
        Self {
            rounds: Vec::new(),
            current_round: 0,
            max_rounds,
            player_score: 0,
            pet_score: 0,
        }
    }

    pub fn play_round(&mut self, player: RpsChoice) -> RpsRound {
        let pet = PetAi::choose_rps();
        let result = judge_rps(player, pet);
        let round = RpsRound {
            player_choice: player,
            pet_choice: pet,
            result,
        };

        match result {
            RpsResult::Win => self.player_score += 1,
            RpsResult::Lose => self.pet_score += 1,
            RpsResult::Draw => {}
        }
        self.rounds.push(round.clone());
        self.current_round += 1;
        round
    }

    pub fn is_finished(&self) -> bool {
        self.current_round >= self.max_rounds
    }

    pub fn final_result(&self) -> Option<RpsResult> {
        if !self.is_finished() {
            return None;
        }
        Some(if self.player_score > self.pet_score {
            RpsResult::Win
        } else if self.pet_score > self.player_score {
            RpsResult::Lose
        } else {
            RpsResult::Draw
        })
    }
}

impl PetAi {
    pub fn choose_rps() -> RpsChoice {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();

        let mut hasher = DefaultHasher::new();
        now.hash(&mut hasher);
        let val = hasher.finish() % 3;

        match val {
            0 => RpsChoice::Rock,
            1 => RpsChoice::Paper,
            _ => RpsChoice::Scissors,
        }
    }
}

pub fn judge_rps(player: RpsChoice, pet: RpsChoice) -> RpsResult {
    if player == pet {
        return RpsResult::Draw;
    }
    match (player, pet) {
        (RpsChoice::Rock, RpsChoice::Scissors)
        | (RpsChoice::Paper, RpsChoice::Rock)
        | (RpsChoice::Scissors, RpsChoice::Paper) => RpsResult::Win,
        _ => RpsResult::Lose,
    }
}

impl CatchGameState {
    pub fn new(width: f64) -> Self {
        Self {
            items: Vec::new(),
            player_x: width / 2.0,
            score: 0,
            time_remaining_secs: 30.0,
            width,
            caught_count: 0,
            missed_count: 0,
        }
    }

    pub fn spawn_item(&mut self, item_type: &str, x: f64, speed: f64) {
        self.items.push(CatchItem {
            x,
            y: 0.0,
            item_type: item_type.to_string(),
            speed,
        });
    }

    pub fn tick(&mut self, dt: f64) {
        self.time_remaining_secs -= dt;
        if self.time_remaining_secs < 0.0 {
            self.time_remaining_secs = 0.0;
        }

        for item in &mut self.items {
            item.y += item.speed * dt;
        }

        // Check catches (items that reached player y-level ~90% of screen)
        let catch_y = 400.0;
        let catch_radius = 40.0;
        let mut caught = Vec::new();
        let mut missed = Vec::new();

        for (i, item) in self.items.iter().enumerate() {
            if item.y >= catch_y {
                let dist = (item.x - self.player_x).abs();
                if dist <= catch_radius {
                    caught.push(i);
                } else if item.y > catch_y + 50.0 {
                    missed.push(i);
                }
            }
        }

        // Remove in reverse order to preserve indices
        for &i in caught.iter().rev() {
            self.items.remove(i);
            self.caught_count += 1;
            self.score += 10;
        }
        for &i in missed.iter().rev() {
            self.items.remove(i);
            self.missed_count += 1;
        }
    }

    pub fn move_player(&mut self, direction: f64) {
        self.player_x += direction;
        self.player_x = self.player_x.clamp(0.0, self.width);
    }

    pub fn is_finished(&self) -> bool {
        self.time_remaining_secs <= 0.0
    }
}

pub fn mini_game_care_effects(game_type: &str, won: bool, score: i32) -> Vec<CareEffect> {
    let win_bonus = if won { 1.5 } else { 1.0 };
    match game_type {
        "rps" => {
            let happiness = 15.0 * win_bonus;
            vec![CareEffect {
                need: "happiness".to_string(),
                amount: happiness,
            }]
        }
        "catch" => {
            let happiness = (score as f64 / 5.0).min(25.0) * win_bonus;
            let hunger = (score as f64 / 10.0).min(10.0);
            vec![
                CareEffect {
                    need: "happiness".to_string(),
                    amount: happiness,
                },
                CareEffect {
                    need: "hunger".to_string(),
                    amount: hunger,
                },
            ]
        }
        _ => vec![],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rps_rock_beats_scissors() {
        assert_eq!(
            judge_rps(RpsChoice::Rock, RpsChoice::Scissors),
            RpsResult::Win
        );
    }

    #[test]
    fn test_rps_scissors_beats_paper() {
        assert_eq!(
            judge_rps(RpsChoice::Scissors, RpsChoice::Paper),
            RpsResult::Win
        );
    }

    #[test]
    fn test_rps_paper_beats_rock() {
        assert_eq!(judge_rps(RpsChoice::Paper, RpsChoice::Rock), RpsResult::Win);
    }

    #[test]
    fn test_rps_same_is_draw() {
        assert_eq!(judge_rps(RpsChoice::Rock, RpsChoice::Rock), RpsResult::Draw);
        assert_eq!(
            judge_rps(RpsChoice::Paper, RpsChoice::Paper),
            RpsResult::Draw
        );
        assert_eq!(
            judge_rps(RpsChoice::Scissors, RpsChoice::Scissors),
            RpsResult::Draw
        );
    }

    #[test]
    fn test_rps_reverse_loses() {
        assert_eq!(
            judge_rps(RpsChoice::Scissors, RpsChoice::Rock),
            RpsResult::Lose
        );
        assert_eq!(
            judge_rps(RpsChoice::Rock, RpsChoice::Paper),
            RpsResult::Lose
        );
        assert_eq!(
            judge_rps(RpsChoice::Paper, RpsChoice::Scissors),
            RpsResult::Lose
        );
    }

    #[test]
    fn test_rps_game_five_rounds() {
        let mut game = RpsGame::new();
        assert_eq!(game.max_rounds, 5);

        for _ in 0..5 {
            let round = game.play_round(RpsChoice::Rock);
            assert!(
                round.result == RpsResult::Win
                    || round.result == RpsResult::Lose
                    || round.result == RpsResult::Draw
            );
        }

        assert!(game.is_finished());
        assert_eq!(game.rounds.len(), 5);
        assert!(game.final_result().is_some());
    }

    #[test]
    fn test_rps_game_custom_rounds() {
        let mut game = RpsGame::with_rounds(3);
        assert_eq!(game.max_rounds, 3);

        game.play_round(RpsChoice::Rock);
        game.play_round(RpsChoice::Paper);
        game.play_round(RpsChoice::Scissors);

        assert!(game.is_finished());
    }

    #[test]
    fn test_rps_score_tracking() {
        let mut game = RpsGame::with_rounds(3);

        // Force wins by knowing pet choice doesn't matter for score tracking
        let r1 = game.play_round(RpsChoice::Rock);
        let expected_p1 = if r1.result == RpsResult::Win { 1 } else { 0 };
        assert_eq!(game.player_score, expected_p1);

        let r2 = game.play_round(RpsChoice::Rock);
        let r3 = game.play_round(RpsChoice::Rock);

        let total_player: u32 = [&r1, &r2, &r3]
            .iter()
            .filter(|r| r.result == RpsResult::Win)
            .count() as u32;
        let total_pet: u32 = [&r1, &r2, &r3]
            .iter()
            .filter(|r| r.result == RpsResult::Lose)
            .count() as u32;

        assert_eq!(game.player_score, total_player);
        assert_eq!(game.pet_score, total_pet);
    }

    #[test]
    fn test_rps_final_result_win() {
        let mut game = RpsGame::with_rounds(3);
        // We can't force pet choice, but we can check the invariant:
        // final_result matches score comparison
        for _ in 0..3 {
            game.play_round(RpsChoice::Rock);
        }

        let result = game.final_result().unwrap();
        match (game.player_score.cmp(&game.pet_score), result) {
            (std::cmp::Ordering::Greater, RpsResult::Win) => {}
            (std::cmp::Ordering::Less, RpsResult::Lose) => {}
            (std::cmp::Ordering::Equal, RpsResult::Draw) => {}
            other => panic!("Mismatch between scores and result: {:?}", other),
        }
    }

    #[test]
    fn test_rps_not_finished_early() {
        let mut game = RpsGame::new();
        assert!(!game.is_finished());
        assert!(game.final_result().is_none());

        game.play_round(RpsChoice::Rock);
        assert!(!game.is_finished());
        assert!(game.final_result().is_none());
    }

    #[test]
    fn test_pet_ai_returns_valid_choice() {
        let choice = PetAi::choose_rps();
        assert!(matches!(
            choice,
            RpsChoice::Rock | RpsChoice::Paper | RpsChoice::Scissors
        ));
    }

    // --- CatchTheFood tests ---

    #[test]
    fn test_catch_game_new() {
        let game = CatchGameState::new(800.0);
        assert_eq!(game.player_x, 400.0);
        assert_eq!(game.width, 800.0);
        assert_eq!(game.score, 0);
        assert_eq!(game.time_remaining_secs, 30.0);
        assert!(!game.is_finished());
    }

    #[test]
    fn test_catch_spawn_item() {
        let mut game = CatchGameState::new(800.0);
        game.spawn_item("apple", 200.0, 100.0);
        assert_eq!(game.items.len(), 1);
        assert_eq!(game.items[0].x, 200.0);
        assert_eq!(game.items[0].y, 0.0);
        assert_eq!(game.items[0].speed, 100.0);
    }

    #[test]
    fn test_catch_tick_advances_items() {
        let mut game = CatchGameState::new(800.0);
        game.spawn_item("apple", 200.0, 100.0);
        game.tick(1.0);
        assert!((game.items[0].y - 100.0).abs() < 0.01);
        assert!((game.time_remaining_secs - 29.0).abs() < 0.01);
    }

    #[test]
    fn test_catch_catch_item_near_player() {
        let mut game = CatchGameState::new(800.0);
        game.player_x = 200.0;
        // Spawn item directly above player, give it enough speed to reach catch zone
        game.spawn_item("apple", 200.0, 500.0);
        // Tick enough for item to reach catch_y (400)
        game.tick(1.0);
        assert!(game.caught_count >= 1);
        assert!(game.score >= 10);
        assert!(game.items.is_empty());
    }

    #[test]
    fn test_catch_miss_item_far_from_player() {
        let mut game = CatchGameState::new(800.0);
        game.player_x = 100.0;
        // Spawn item far from player
        game.spawn_item("apple", 600.0, 500.0);
        // Tick enough to pass catch zone + miss threshold
        game.tick(1.0);
        // Item should eventually be missed after passing far enough
        assert!(game.missed_count >= 1 || game.items.is_empty());
    }

    #[test]
    fn test_catch_move_player() {
        let mut game = CatchGameState::new(800.0);
        game.move_player(100.0);
        assert!((game.player_x - 500.0).abs() < 0.01);

        game.move_player(-200.0);
        assert!((game.player_x - 300.0).abs() < 0.01);
    }

    #[test]
    fn test_catch_player_clamped_to_bounds() {
        let mut game = CatchGameState::new(800.0);
        game.move_player(-500.0);
        assert_eq!(game.player_x, 0.0);

        game.move_player(1000.0);
        assert_eq!(game.player_x, 800.0);
    }

    #[test]
    fn test_catch_timer_reaches_zero() {
        let mut game = CatchGameState::new(800.0);
        game.tick(30.0);
        assert!(game.is_finished());
        assert_eq!(game.time_remaining_secs, 0.0);
    }

    #[test]
    fn test_catch_timer_clamps_negative() {
        let mut game = CatchGameState::new(800.0);
        game.tick(100.0);
        assert_eq!(game.time_remaining_secs, 0.0);
    }

    #[test]
    fn test_catch_multiple_items() {
        let mut game = CatchGameState::new(800.0);
        game.spawn_item("apple", 100.0, 300.0);
        game.spawn_item("cake", 400.0, 300.0);
        game.spawn_item("fish", 700.0, 300.0);
        assert_eq!(game.items.len(), 3);
    }

    // --- Care effects tests ---

    #[test]
    fn test_rps_care_effects_win() {
        let effects = mini_game_care_effects("rps", true, 3);
        assert_eq!(effects.len(), 1);
        assert_eq!(effects[0].need, "happiness");
        assert!((effects[0].amount - 22.5).abs() < 0.01); // 15 * 1.5
    }

    #[test]
    fn test_rps_care_effects_lose() {
        let effects = mini_game_care_effects("rps", false, 1);
        assert_eq!(effects.len(), 1);
        assert_eq!(effects[0].need, "happiness");
        assert!((effects[0].amount - 15.0).abs() < 0.01); // 15 * 1.0
    }

    #[test]
    fn test_catch_care_effects_win() {
        let effects = mini_game_care_effects("catch", true, 50);
        assert_eq!(effects.len(), 2);
        assert_eq!(effects[0].need, "happiness");
        assert_eq!(effects[1].need, "hunger");
        // Win bonus applied
        assert!(effects[0].amount > 0.0);
        assert!(effects[1].amount > 0.0);
    }

    #[test]
    fn test_catch_care_effects_capped() {
        let effects = mini_game_care_effects("catch", true, 99999);
        // Happiness capped at 25 * 1.5 = 37.5
        assert!(effects[0].amount <= 37.5);
        // Hunger capped at 10
        assert!(effects[1].amount <= 10.0);
    }

    #[test]
    fn test_unknown_game_no_effects() {
        let effects = mini_game_care_effects("unknown", true, 100);
        assert!(effects.is_empty());
    }

    // --- Serialization tests ---

    #[test]
    fn test_rps_round_serializes() {
        let round = RpsRound {
            player_choice: RpsChoice::Rock,
            pet_choice: RpsChoice::Scissors,
            result: RpsResult::Win,
        };
        let json = serde_json::to_string(&round).unwrap();
        assert!(json.contains("Rock"));
        assert!(json.contains("Win"));
    }

    #[test]
    fn test_catch_game_state_serializes() {
        let state = CatchGameState::new(800.0);
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("player_x"));
        assert!(json.contains("time_remaining_secs"));
    }

    #[test]
    fn test_rps_game_full_serialization() {
        let mut game = RpsGame::new();
        game.play_round(RpsChoice::Rock);
        let json = serde_json::to_string(&game).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["current_round"], 1);
        assert_eq!(parsed["max_rounds"], 5);
    }
}
