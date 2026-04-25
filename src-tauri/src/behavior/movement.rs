use crate::behavior::state_machine::PetState;

/// Gravity acceleration in pixels/s². Matches ~9.8 m/s² at 100px/m scale.
pub const GRAVITY: f64 = 980.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl Position {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Velocity {
    pub vx: f64,
    pub vy: f64,
}

impl Velocity {
    pub fn new(vx: f64, vy: f64) -> Self {
        Self { vx, vy }
    }

    pub fn zero() -> Self {
        Self { vx: 0.0, vy: 0.0 }
    }
}

pub struct ScreenBounds {
    pub width: f64,
    pub height: f64,
}

impl ScreenBounds {
    pub fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }
}

pub struct PetPhysics {
    pub position: Position,
    pub velocity: Velocity,
    pub state: PetState,
    pub pet_width: f64,
    pub pet_height: f64,
    pub screen: ScreenBounds,
}

impl PetPhysics {
    pub fn new(screen_width: f64, screen_height: f64, pet_width: f64, pet_height: f64) -> Self {
        Self {
            position: Position::new(0.0, screen_height - pet_height),
            velocity: Velocity::zero(),
            state: PetState::Idle,
            pet_width,
            pet_height,
            screen: ScreenBounds::new(screen_width, screen_height),
        }
    }

    pub fn clamp_to_screen(&mut self) {
        if self.position.x < 0.0 {
            self.position.x = 0.0;
        }
        let max_x = self.screen.width - self.pet_width;
        if self.position.x > max_x {
            self.position.x = max_x;
        }
        if self.position.y < 0.0 {
            self.position.y = 0.0;
        }
        let max_y = self.screen.height - self.pet_height;
        if self.position.y > max_y {
            self.position.y = max_y;
        }
    }

    pub fn is_at_horizontal_boundary(&self) -> bool {
        self.position.x <= 0.0 || self.position.x >= self.screen.width - self.pet_width
    }

    pub fn is_at_left_edge(&self) -> bool {
        self.position.x <= 0.0
    }

    pub fn is_at_right_edge(&self) -> bool {
        self.position.x >= self.screen.width - self.pet_width
    }

    pub fn is_on_ground(&self) -> bool {
        self.position.y >= self.screen.height - self.pet_height
    }

    pub fn update(&mut self, dt: f64) {
        self.position.x += self.velocity.vx * dt;
        self.position.y += self.velocity.vy * dt;
        self.clamp_to_screen();
    }

    /// Apply gravity to vertical velocity and update position.
    /// Returns true if the pet just landed (was falling, now on ground).
    pub fn apply_gravity(&mut self, dt: f64) -> bool {
        let was_falling =
            self.velocity.vy > 0.0 || self.position.y < self.screen.height - self.pet_height;
        self.velocity.vy += GRAVITY * dt;
        self.position.y += self.velocity.vy * dt;

        if self.position.y >= self.screen.height - self.pet_height {
            self.position.y = self.screen.height - self.pet_height;
            if was_falling && self.velocity.vy > 0.0 {
                self.velocity.vy = 0.0;
                return true;
            }
            self.velocity.vy = 0.0;
        }
        false
    }

    /// Simulate a free fall from a given height. Returns the time to reach ground.
    pub fn fall_time_from_height(height: f64) -> f64 {
        // h = 0.5 * g * t^2  =>  t = sqrt(2h/g)
        (2.0 * height / GRAVITY).sqrt()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    const SCREEN_W: f64 = 1920.0;
    const SCREEN_H: f64 = 1080.0;
    const PET_W: f64 = 64.0;
    const PET_H: f64 = 64.0;

    fn test_physics() -> PetPhysics {
        PetPhysics::new(SCREEN_W, SCREEN_H, PET_W, PET_H)
    }

    #[test]
    fn test_initial_position_on_ground() {
        let p = test_physics();
        assert_eq!(p.position.x, 0.0);
        assert_eq!(p.position.y, SCREEN_H - PET_H);
        assert!(p.is_on_ground());
    }

    #[rstest]
    #[case(-50.0, 0.0)]
    #[case(SCREEN_W - PET_W + 100.0, SCREEN_W - PET_W)]
    fn test_clamp_x_boundaries(#[case] input_x: f64, #[case] expected_x: f64) {
        let mut p = test_physics();
        p.position.x = input_x;
        p.clamp_to_screen();
        assert_eq!(p.position.x, expected_x);
    }

    #[rstest]
    #[case(-30.0, 0.0)]
    #[case(SCREEN_H, SCREEN_H - PET_H)]
    fn test_clamp_y_boundaries(#[case] input_y: f64, #[case] expected_y: f64) {
        let mut p = test_physics();
        p.position.y = input_y;
        p.clamp_to_screen();
        assert_eq!(p.position.y, expected_y);
    }

    #[test]
    fn test_clamp_no_change_within_bounds() {
        let mut p = test_physics();
        p.position = Position::new(500.0, 300.0);
        p.clamp_to_screen();
        assert_eq!(p.position.x, 500.0);
        assert_eq!(p.position.y, 300.0);
    }

    #[test]
    fn test_update_with_velocity_clamps() {
        let mut p = test_physics();
        p.position = Position::new(1900.0, 1000.0);
        p.velocity = Velocity::new(200.0, 200.0);
        p.update(1.0);
        assert_eq!(p.position.x, SCREEN_W - PET_W);
        assert_eq!(p.position.y, SCREEN_H - PET_H);
    }

    #[rstest]
    #[case(0.0, true, false, true)]
    #[case(SCREEN_W - PET_W, false, true, true)]
    #[case(960.0, false, false, false)]
    fn test_boundary_detection(
        #[case] x: f64,
        #[case] expect_left: bool,
        #[case] expect_right: bool,
        #[case] expect_horizontal: bool,
    ) {
        let mut p = test_physics();
        p.position.x = x;
        assert_eq!(p.is_at_left_edge(), expect_left);
        assert_eq!(p.is_at_right_edge(), expect_right);
        assert_eq!(p.is_at_horizontal_boundary(), expect_horizontal);
    }

    #[test]
    fn test_ground_detection() {
        let mut p = test_physics();
        assert!(p.is_on_ground());
        p.position.y = 500.0;
        assert!(!p.is_on_ground());
    }

    // --- Gravity tests ---

    #[test]
    fn test_gravity_constant_value() {
        assert_eq!(GRAVITY, 980.0);
    }

    #[test]
    fn test_fall_time_from_200px() {
        let t = PetPhysics::fall_time_from_height(200.0);
        let expected: f64 = (2.0_f64 * 200.0 / 980.0).sqrt();
        assert!(
            (t - expected).abs() < 0.001,
            "fall time should be ~{:.3}s, got {:.3}",
            expected,
            t
        );
        assert!(t > 0.6 && t < 0.65, "200px drop should take ~0.639s");
    }

    #[test]
    fn test_gravity_increases_velocity_linearly() {
        let mut p = test_physics();
        // Start at top of screen, no velocity
        p.position.y = 0.0;
        p.velocity.vy = 0.0;

        let dt = 1.0 / 60.0; // 60fps timestep
        let mut velocities: Vec<f64> = vec![];

        for _ in 0..3 {
            let _ = p.apply_gravity(dt);
            velocities.push(p.velocity.vy);
        }

        // Each step adds GRAVITY * dt to velocity
        let delta_v = GRAVITY * dt;
        assert!((velocities[1] - velocities[0] - delta_v).abs() < 0.01);
        assert!((velocities[2] - velocities[1] - delta_v).abs() < 0.01);
    }

    #[test]
    fn test_gravity_lands_on_ground() {
        let mut p = test_physics();
        // Start 200px above ground
        let ground = SCREEN_H - PET_H;
        p.position.y = ground - 200.0;
        p.velocity.vy = 0.0;

        let dt = 1.0 / 60.0;
        let mut landed = false;
        for _ in 0..120 {
            // max 2 seconds
            if p.apply_gravity(dt) {
                landed = true;
                break;
            }
        }
        assert!(landed, "pet should land within 2 seconds");
        assert!(p.is_on_ground());
        assert_eq!(p.velocity.vy, 0.0);
    }

    #[test]
    fn test_gravity_no_effect_on_ground() {
        let mut p = test_physics();
        assert!(p.is_on_ground());
        let landed = p.apply_gravity(1.0 / 60.0);
        assert!(!landed, "no landing event when already on ground");
        assert_eq!(p.velocity.vy, 0.0);
        assert!(p.is_on_ground());
    }
}
