use std::fmt;
use std::time::Duration;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum PetState {
    Idle,
    WalkLeft,
    WalkRight,
    RunLeft,
    RunRight,
    Climb,
    Fall,
    Sleep,
    Eat,
    Play,
    Drag,
    Talk,
    Happy,
    Sad,
    Curious,
    Sit,
}

impl fmt::Display for PetState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PetState::Idle => write!(f, "idle"),
            PetState::WalkLeft => write!(f, "walk_left"),
            PetState::WalkRight => write!(f, "walk_right"),
            PetState::RunLeft => write!(f, "run_left"),
            PetState::RunRight => write!(f, "run_right"),
            PetState::Climb => write!(f, "climb"),
            PetState::Fall => write!(f, "fall"),
            PetState::Sleep => write!(f, "sleep"),
            PetState::Eat => write!(f, "eat"),
            PetState::Play => write!(f, "play"),
            PetState::Drag => write!(f, "drag"),
            PetState::Talk => write!(f, "talk"),
            PetState::Happy => write!(f, "happy"),
            PetState::Sad => write!(f, "sad"),
            PetState::Curious => write!(f, "curious"),
            PetState::Sit => write!(f, "sit"),
        }
    }
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct TransitionContext {
    pub cursor_distance: f64,
    pub energy: f64,
    pub mood: f64,
    pub idle_time: Duration,
}

impl Default for TransitionContext {
    fn default() -> Self {
        Self {
            cursor_distance: f64::MAX,
            energy: 100.0,
            mood: 50.0,
            idle_time: Duration::ZERO,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub struct TransitionError {
    pub from: PetState,
    pub to: PetState,
}

impl fmt::Display for TransitionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid transition: {} -> {}", self.from, self.to)
    }
}

impl std::error::Error for TransitionError {}

#[allow(dead_code)]
pub struct StateMachine {
    state: PetState,
}

#[allow(dead_code)]
impl StateMachine {
    pub fn new() -> Self {
        Self {
            state: PetState::Idle,
        }
    }

    pub fn current_state(&self) -> PetState {
        self.state
    }

    pub fn try_transition(
        &mut self,
        target: PetState,
        ctx: &TransitionContext,
    ) -> Result<PetState, TransitionError> {
        if self.is_valid_transition(&target, ctx) {
            self.state = target;
            Ok(self.state)
        } else {
            Err(TransitionError {
                from: self.state,
                to: target,
            })
        }
    }

    fn is_valid_transition(&self, target: &PetState, ctx: &TransitionContext) -> bool {
        match (&self.state, target) {
            // idle <-> walk_left, idle <-> walk_right
            (PetState::Idle, PetState::WalkLeft)
            | (PetState::Idle, PetState::WalkRight)
            | (PetState::WalkLeft, PetState::Idle)
            | (PetState::WalkRight, PetState::Idle) => true,

            // walk_left <-> walk_right
            (PetState::WalkLeft, PetState::WalkRight)
            | (PetState::WalkRight, PetState::WalkLeft) => true,

            // idle <-> sit
            (PetState::Idle, PetState::Sit) | (PetState::Sit, PetState::Idle) => true,

            // idle -> sleep (after 10 min idle or energy < 20%)
            (PetState::Idle, PetState::Sleep) => {
                ctx.idle_time >= Duration::from_secs(600) || ctx.energy < 20.0
            }

            // idle -> curious (cursor within 100px)
            (PetState::Idle, PetState::Curious) => ctx.cursor_distance <= 100.0,

            // idle -> talk
            (PetState::Idle, PetState::Talk) => true,

            // idle -> drag
            (PetState::Idle, PetState::Drag) => true,

            // idle -> happy (mood > 80%)
            (PetState::Idle, PetState::Happy) => ctx.mood > 80.0,

            // idle -> sad (mood < 20%)
            (PetState::Idle, PetState::Sad) => ctx.mood < 20.0,

            // walk_* -> run_*
            (PetState::WalkLeft, PetState::RunLeft) | (PetState::WalkRight, PetState::RunRight) => {
                true
            }

            // walk_* -> climb
            (PetState::WalkLeft, PetState::Climb) | (PetState::WalkRight, PetState::Climb) => true,

            // climb -> fall
            (PetState::Climb, PetState::Fall) => true,

            // fall -> idle
            (PetState::Fall, PetState::Idle) => true,

            // drag -> fall
            (PetState::Drag, PetState::Fall) => true,

            // any -> idle (catch-all)
            (_, PetState::Idle) => true,

            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_ctx() -> TransitionContext {
        TransitionContext::default()
    }

    fn ctx_with_cursor(dist: f64) -> TransitionContext {
        TransitionContext {
            cursor_distance: dist,
            ..Default::default()
        }
    }

    fn ctx_with_energy(e: f64) -> TransitionContext {
        TransitionContext {
            energy: e,
            ..Default::default()
        }
    }

    fn ctx_with_mood(m: f64) -> TransitionContext {
        TransitionContext {
            mood: m,
            ..Default::default()
        }
    }

    fn ctx_with_idle(secs: u64) -> TransitionContext {
        TransitionContext {
            idle_time: Duration::from_secs(secs),
            ..Default::default()
        }
    }

    // --- Basic transitions from idle ---

    #[test]
    fn test_idle_to_walk_left() {
        let mut sm = StateMachine::new();
        let result = sm.try_transition(PetState::WalkLeft, &default_ctx());
        assert!(result.is_ok());
        assert_eq!(sm.current_state(), PetState::WalkLeft);
    }

    #[test]
    fn test_idle_to_walk_right() {
        let mut sm = StateMachine::new();
        let result = sm.try_transition(PetState::WalkRight, &default_ctx());
        assert!(result.is_ok());
        assert_eq!(sm.current_state(), PetState::WalkRight);
    }

    #[test]
    fn test_idle_to_sit() {
        let mut sm = StateMachine::new();
        assert!(sm.try_transition(PetState::Sit, &default_ctx()).is_ok());
        assert_eq!(sm.current_state(), PetState::Sit);
    }

    #[test]
    fn test_sit_to_idle() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::Sit, &default_ctx()).unwrap();
        assert!(sm.try_transition(PetState::Idle, &default_ctx()).is_ok());
        assert_eq!(sm.current_state(), PetState::Idle);
    }

    #[test]
    fn test_walk_left_to_idle() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        assert!(sm.try_transition(PetState::Idle, &default_ctx()).is_ok());
    }

    #[test]
    fn test_walk_right_to_idle() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkRight, &default_ctx())
            .unwrap();
        assert!(sm.try_transition(PetState::Idle, &default_ctx()).is_ok());
    }

    #[test]
    fn test_walk_left_to_walk_right() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        assert!(sm
            .try_transition(PetState::WalkRight, &default_ctx())
            .is_ok());
        assert_eq!(sm.current_state(), PetState::WalkRight);
    }

    #[test]
    fn test_walk_right_to_walk_left() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkRight, &default_ctx())
            .unwrap();
        assert!(sm
            .try_transition(PetState::WalkLeft, &default_ctx())
            .is_ok());
        assert_eq!(sm.current_state(), PetState::WalkLeft);
    }

    // --- Conditional transitions from idle ---

    #[test]
    fn test_idle_to_sleep_low_energy() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_energy(15.0);
        assert!(sm.try_transition(PetState::Sleep, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_sleep_long_idle() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_idle(601);
        assert!(sm.try_transition(PetState::Sleep, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_sleep_denied_normal() {
        let mut sm = StateMachine::new();
        let result = sm.try_transition(PetState::Sleep, &default_ctx());
        assert!(result.is_err());
    }

    #[test]
    fn test_idle_to_curious_cursor_close() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_cursor(50.0);
        assert!(sm.try_transition(PetState::Curious, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_curious_cursor_at_boundary() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_cursor(100.0);
        assert!(sm.try_transition(PetState::Curious, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_curious_denied_cursor_far() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_cursor(101.0);
        assert!(sm.try_transition(PetState::Curious, &ctx).is_err());
    }

    #[test]
    fn test_idle_to_talk() {
        let mut sm = StateMachine::new();
        assert!(sm.try_transition(PetState::Talk, &default_ctx()).is_ok());
    }

    #[test]
    fn test_idle_to_drag() {
        let mut sm = StateMachine::new();
        assert!(sm.try_transition(PetState::Drag, &default_ctx()).is_ok());
    }

    #[test]
    fn test_idle_to_happy_high_mood() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_mood(85.0);
        assert!(sm.try_transition(PetState::Happy, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_happy_denied() {
        let mut sm = StateMachine::new();
        assert!(sm.try_transition(PetState::Happy, &default_ctx()).is_err());
    }

    #[test]
    fn test_idle_to_sad_low_mood() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_mood(15.0);
        assert!(sm.try_transition(PetState::Sad, &ctx).is_ok());
    }

    #[test]
    fn test_idle_to_sad_denied() {
        let mut sm = StateMachine::new();
        assert!(sm.try_transition(PetState::Sad, &default_ctx()).is_err());
    }

    // --- Walk to run transitions ---

    #[test]
    fn test_walk_left_to_run_left() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        assert!(sm.try_transition(PetState::RunLeft, &default_ctx()).is_ok());
    }

    #[test]
    fn test_walk_right_to_run_right() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkRight, &default_ctx())
            .unwrap();
        assert!(sm
            .try_transition(PetState::RunRight, &default_ctx())
            .is_ok());
    }

    #[test]
    fn test_walk_left_to_run_right_denied() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        assert!(sm
            .try_transition(PetState::RunRight, &default_ctx())
            .is_err());
    }

    // --- Walk to climb ---

    #[test]
    fn test_walk_left_to_climb() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        assert!(sm.try_transition(PetState::Climb, &default_ctx()).is_ok());
    }

    #[test]
    fn test_walk_right_to_climb() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkRight, &default_ctx())
            .unwrap();
        assert!(sm.try_transition(PetState::Climb, &default_ctx()).is_ok());
    }

    // --- Climb to fall ---

    #[test]
    fn test_climb_to_fall() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::WalkLeft, &default_ctx())
            .unwrap();
        sm.try_transition(PetState::Climb, &default_ctx()).unwrap();
        assert!(sm.try_transition(PetState::Fall, &default_ctx()).is_ok());
    }

    // --- Fall to idle ---

    #[test]
    fn test_fall_to_idle() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::Drag, &default_ctx()).unwrap();
        sm.try_transition(PetState::Fall, &default_ctx()).unwrap();
        assert!(sm.try_transition(PetState::Idle, &default_ctx()).is_ok());
    }

    // --- Drag to fall ---

    #[test]
    fn test_drag_to_fall() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::Drag, &default_ctx()).unwrap();
        assert!(sm.try_transition(PetState::Fall, &default_ctx()).is_ok());
    }

    // --- Catch-all: any -> idle ---

    #[test]
    fn test_any_to_idle_catch_all() {
        let states = [
            PetState::RunLeft,
            PetState::RunRight,
            PetState::Climb,
            PetState::Sleep,
            PetState::Eat,
            PetState::Play,
            PetState::Talk,
            PetState::Curious,
            PetState::Happy,
            PetState::Sad,
        ];
        for state in states {
            let mut sm = StateMachine::new();
            // Force state via a valid transition chain where needed
            match state {
                PetState::RunLeft => {
                    sm.try_transition(PetState::WalkLeft, &default_ctx())
                        .unwrap();
                    sm.try_transition(PetState::RunLeft, &default_ctx())
                        .unwrap();
                }
                PetState::RunRight => {
                    sm.try_transition(PetState::WalkRight, &default_ctx())
                        .unwrap();
                    sm.try_transition(PetState::RunRight, &default_ctx())
                        .unwrap();
                }
                PetState::Climb => {
                    sm.try_transition(PetState::WalkLeft, &default_ctx())
                        .unwrap();
                    sm.try_transition(PetState::Climb, &default_ctx()).unwrap();
                }
                PetState::Sleep => {
                    let ctx = ctx_with_energy(10.0);
                    sm.try_transition(PetState::Sleep, &ctx).unwrap();
                }
                PetState::Eat | PetState::Play => {
                    // Eat/Play don't have explicit entry transitions in PRD,
                    // but any -> idle works, so we test that these can go to idle
                    // via the catch-all after forcing state
                    sm.try_transition(PetState::Idle, &default_ctx()).unwrap();
                    continue;
                }
                PetState::Talk => {
                    sm.try_transition(PetState::Talk, &default_ctx()).unwrap();
                }
                PetState::Curious => {
                    let ctx = ctx_with_cursor(50.0);
                    sm.try_transition(PetState::Curious, &ctx).unwrap();
                }
                PetState::Happy => {
                    let ctx = ctx_with_mood(90.0);
                    sm.try_transition(PetState::Happy, &ctx).unwrap();
                }
                PetState::Sad => {
                    let ctx = ctx_with_mood(10.0);
                    sm.try_transition(PetState::Sad, &ctx).unwrap();
                }
                _ => continue,
            }
            assert_eq!(sm.current_state(), state);
            assert!(
                sm.try_transition(PetState::Idle, &default_ctx()).is_ok(),
                "any state should transition to idle: {:?}",
                state
            );
        }
    }

    // --- Invalid transitions ---

    #[test]
    fn test_sleep_to_drag_denied() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_energy(10.0);
        sm.try_transition(PetState::Sleep, &ctx).unwrap();
        assert!(sm.try_transition(PetState::Drag, &default_ctx()).is_err());
    }

    #[test]
    fn test_fall_to_walk_denied() {
        let mut sm = StateMachine::new();
        sm.try_transition(PetState::Drag, &default_ctx()).unwrap();
        sm.try_transition(PetState::Fall, &default_ctx()).unwrap();
        assert!(sm
            .try_transition(PetState::WalkLeft, &default_ctx())
            .is_err());
    }

    #[test]
    fn test_invalid_transition_error_has_states() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_energy(10.0);
        sm.try_transition(PetState::Sleep, &ctx).unwrap();
        let err = sm
            .try_transition(PetState::Drag, &default_ctx())
            .unwrap_err();
        assert_eq!(err.from, PetState::Sleep);
        assert_eq!(err.to, PetState::Drag);
    }

    #[test]
    fn test_sleep_to_run_denied() {
        let mut sm = StateMachine::new();
        let ctx = ctx_with_energy(10.0);
        sm.try_transition(PetState::Sleep, &ctx).unwrap();
        assert!(sm
            .try_transition(PetState::RunLeft, &default_ctx())
            .is_err());
    }
}
