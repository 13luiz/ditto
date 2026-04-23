use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TriggerType {
    MorningGreeting,
    BreakReminder,
    IdleComment,
}

#[derive(Debug)]
pub struct ScheduledTrigger {
    pub trigger_type: TriggerType,
    pub last_fired: Option<Instant>,
    pub cooldown: Duration,
}

impl ScheduledTrigger {
    pub fn new(trigger_type: TriggerType, cooldown: Duration) -> Self {
        Self { trigger_type, last_fired: None, cooldown }
    }

    pub fn should_fire(&self) -> bool {
        match self.last_fired {
            None => true,
            Some(t) => t.elapsed() >= self.cooldown,
        }
    }

    pub fn mark_fired(&mut self) {
        self.last_fired = Some(Instant::now());
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UserActivityState {
    Active,
    Idle,
}

#[derive(Debug)]
pub struct ActivityDetector {
    pub idle_threshold: Duration,
    pub last_activity: Instant,
    pub state: UserActivityState,
}

impl ActivityDetector {
    pub fn new(idle_threshold: Duration) -> Self {
        Self {
            idle_threshold,
            last_activity: Instant::now(),
            state: UserActivityState::Active,
        }
    }

    pub fn record_activity(&mut self) {
        self.last_activity = Instant::now();
        self.state = UserActivityState::Active;
    }

    pub fn update(&mut self) -> bool {
        let new_state = if self.last_activity.elapsed() >= self.idle_threshold {
            UserActivityState::Idle
        } else {
            UserActivityState::Active
        };
        let changed = new_state != self.state;
        self.state = new_state;
        changed
    }

    pub fn idle_duration(&self) -> Duration {
        self.last_activity.elapsed()
    }

    pub fn is_idle(&self) -> bool {
        self.state == UserActivityState::Idle
    }
}

pub struct BehaviorScheduler {
    pub morning_greeting: ScheduledTrigger,
    pub break_reminder: ScheduledTrigger,
    pub idle_comment: ScheduledTrigger,
    pub activity: ActivityDetector,
    break_work_duration: Duration,
}

impl BehaviorScheduler {
    pub fn new() -> Self {
        Self {
            morning_greeting: ScheduledTrigger::new(
                TriggerType::MorningGreeting, Duration::from_secs(3600 * 6),
            ),
            break_reminder: ScheduledTrigger::new(
                TriggerType::BreakReminder, Duration::from_secs(3600),
            ),
            idle_comment: ScheduledTrigger::new(
                TriggerType::IdleComment, Duration::from_secs(900),
            ),
            activity: ActivityDetector::new(Duration::from_secs(300)),
            break_work_duration: Duration::from_secs(3600),
        }
    }

    pub fn check_morning_greeting(&self, hour: u32) -> bool {
        (8..=9).contains(&hour) && self.morning_greeting.should_fire()
    }

    pub fn check_break_reminder(&self) -> bool {
        !self.activity.is_idle()
            && self.activity.idle_duration() == Duration::ZERO
            && self.break_reminder.should_fire()
    }

    pub fn check_idle_comment(&self) -> bool {
        self.activity.is_idle() && self.idle_comment.should_fire()
    }

    pub fn record_activity(&mut self) {
        self.activity.record_activity();
    }

    pub fn update_activity(&mut self) {
        self.activity.update();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trigger_fires_initially() {
        let trigger = ScheduledTrigger::new(TriggerType::MorningGreeting, Duration::from_secs(60));
        assert!(trigger.should_fire());
    }

    #[test]
    fn test_trigger_cooldown() {
        let mut trigger = ScheduledTrigger::new(TriggerType::MorningGreeting, Duration::from_secs(60));
        trigger.mark_fired();
        assert!(!trigger.should_fire());
    }

    #[test]
    fn test_morning_greeting_in_range() {
        let scheduler = BehaviorScheduler::new();
        assert!(scheduler.check_morning_greeting(8));
        assert!(scheduler.check_morning_greeting(9));
    }

    #[test]
    fn test_morning_greeting_out_of_range() {
        let scheduler = BehaviorScheduler::new();
        assert!(!scheduler.check_morning_greeting(7));
        assert!(!scheduler.check_morning_greeting(10));
        assert!(!scheduler.check_morning_greeting(14));
    }

    #[test]
    fn test_activity_detector_starts_active() {
        let detector = ActivityDetector::new(Duration::from_secs(300));
        assert_eq!(detector.state, UserActivityState::Active);
        assert!(!detector.is_idle());
    }

    #[test]
    fn test_activity_detector_idle_after_threshold() {
        let mut detector = ActivityDetector::new(Duration::from_millis(10));
        detector.last_activity = Instant::now() - Duration::from_millis(50);
        detector.update();
        assert!(detector.is_idle());
    }

    #[test]
    fn test_activity_detector_returns_after_input() {
        let mut detector = ActivityDetector::new(Duration::from_millis(10));
        detector.last_activity = Instant::now() - Duration::from_millis(50);
        detector.update();
        assert!(detector.is_idle());

        detector.record_activity();
        assert!(!detector.is_idle());
    }

    #[test]
    fn test_activity_state_change_detected() {
        let mut detector = ActivityDetector::new(Duration::from_millis(10));
        assert!(!detector.update()); // already active, no change

        detector.last_activity = Instant::now() - Duration::from_millis(50);
        assert!(detector.update()); // changed to idle
        assert!(!detector.update()); // still idle, no change
    }

    #[test]
    fn test_idle_duration() {
        let detector = ActivityDetector::new(Duration::from_secs(300));
        let dur = detector.idle_duration();
        assert!(dur < Duration::from_millis(100));
    }

    #[test]
    fn test_scheduler_record_activity() {
        let mut scheduler = BehaviorScheduler::new();
        scheduler.record_activity();
        assert!(!scheduler.activity.is_idle());
    }
}
