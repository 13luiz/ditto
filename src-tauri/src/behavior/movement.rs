use crate::behavior::state_machine::PetState;

#[derive(Clone, Copy, Debug, PartialEq)]
#[allow(dead_code)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[allow(dead_code)]
impl Position {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
#[allow(dead_code)]
pub struct Velocity {
    pub vx: f64,
    pub vy: f64,
}

#[allow(dead_code)]
impl Velocity {
    pub fn new(vx: f64, vy: f64) -> Self {
        Self { vx, vy }
    }

    pub fn zero() -> Self {
        Self { vx: 0.0, vy: 0.0 }
    }
}

#[allow(dead_code)]
pub struct ScreenBounds {
    pub width: f64,
    pub height: f64,
}

#[allow(dead_code)]
impl ScreenBounds {
    pub fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }
}

#[allow(dead_code)]
pub struct PetPhysics {
    pub position: Position,
    pub velocity: Velocity,
    pub state: PetState,
    pub pet_width: f64,
    pub pet_height: f64,
    pub screen: ScreenBounds,
}

#[allow(dead_code)]
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
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn test_clamp_negative_x() {
        let mut p = test_physics();
        p.position.x = -50.0;
        p.clamp_to_screen();
        assert_eq!(p.position.x, 0.0);
    }

    #[test]
    fn test_clamp_exceeds_right() {
        let mut p = test_physics();
        p.position.x = SCREEN_W - PET_W + 100.0;
        p.clamp_to_screen();
        assert_eq!(p.position.x, SCREEN_W - PET_W);
    }

    #[test]
    fn test_clamp_negative_y() {
        let mut p = test_physics();
        p.position.y = -30.0;
        p.clamp_to_screen();
        assert_eq!(p.position.y, 0.0);
    }

    #[test]
    fn test_clamp_exceeds_bottom() {
        let mut p = test_physics();
        p.position.y = SCREEN_H;
        p.clamp_to_screen();
        assert_eq!(p.position.y, SCREEN_H - PET_H);
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

    #[test]
    fn test_boundary_detection_left() {
        let mut p = test_physics();
        p.position.x = 0.0;
        assert!(p.is_at_left_edge());
        assert!(!p.is_at_right_edge());
        assert!(p.is_at_horizontal_boundary());
    }

    #[test]
    fn test_boundary_detection_right() {
        let mut p = test_physics();
        p.position.x = SCREEN_W - PET_W;
        assert!(p.is_at_right_edge());
        assert!(!p.is_at_left_edge());
        assert!(p.is_at_horizontal_boundary());
    }

    #[test]
    fn test_boundary_detection_middle() {
        let mut p = test_physics();
        p.position.x = 960.0;
        assert!(!p.is_at_horizontal_boundary());
    }

    #[test]
    fn test_ground_detection() {
        let mut p = test_physics();
        assert!(p.is_on_ground());
        p.position.y = 500.0;
        assert!(!p.is_on_ground());
    }
}
