use crate::behavior::movement::Position;

/// Check if the cursor is within a given radius of the pet's center.
/// Uses Euclidean distance between pet center (position + half pet size) and cursor.
pub fn is_cursor_near(
    pet_pos: &Position,
    pet_width: f64,
    pet_height: f64,
    cursor_x: f64,
    cursor_y: f64,
    radius: f64,
) -> bool {
    let pet_center_x = pet_pos.x + pet_width / 2.0;
    let pet_center_y = pet_pos.y + pet_height / 2.0;
    let dx = cursor_x - pet_center_x;
    let dy = cursor_y - pet_center_y;
    let dist = (dx * dx + dy * dy).sqrt();
    dist <= radius
}

/// Calculate Euclidean distance between pet center and cursor position.
pub fn cursor_distance(
    pet_pos: &Position,
    pet_width: f64,
    pet_height: f64,
    cursor_x: f64,
    cursor_y: f64,
) -> f64 {
    let pet_center_x = pet_pos.x + pet_width / 2.0;
    let pet_center_y = pet_pos.y + pet_height / 2.0;
    let dx = cursor_x - pet_center_x;
    let dy = cursor_y - pet_center_y;
    (dx * dx + dy * dy).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    const PET_W: f64 = 64.0;
    const PET_H: f64 = 64.0;

    fn pet_at(x: f64, y: f64) -> Position {
        Position::new(x, y)
    }

    #[test]
    fn test_cursor_at_pet_center_is_zero_distance() {
        // Pet at (400, 500), center is (432, 532)
        let pos = pet_at(400.0, 500.0);
        let dist = cursor_distance(&pos, PET_W, PET_H, 432.0, 532.0);
        assert!((dist - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_cursor_50px_away() {
        let pos = pet_at(400.0, 500.0);
        // center at (432, 532), cursor at (482, 532) = 50px away
        let dist = cursor_distance(&pos, PET_W, PET_H, 482.0, 532.0);
        assert!((dist - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_cursor_diagonal_distance() {
        let pos = pet_at(400.0, 500.0);
        // center at (432, 532), cursor at (432 + 30.0, 532 + 40.0) = 50px away (3-4-5 triangle)
        let dist = cursor_distance(&pos, PET_W, PET_H, 462.0, 572.0);
        assert!((dist - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_is_cursor_near_within_radius() {
        let pos = pet_at(400.0, 500.0);
        assert!(is_cursor_near(&pos, PET_W, PET_H, 482.0, 532.0, 100.0));
    }

    #[test]
    fn test_is_cursor_near_at_exact_boundary() {
        let pos = pet_at(400.0, 500.0);
        // center at (432, 532), cursor 100px away exactly
        assert!(is_cursor_near(&pos, PET_W, PET_H, 532.0, 532.0, 100.0));
    }

    #[test]
    fn test_is_cursor_near_just_outside() {
        let pos = pet_at(400.0, 500.0);
        // center at (432, 532), cursor 101px away
        assert!(!is_cursor_near(&pos, PET_W, PET_H, 533.0, 532.0, 100.0));
    }

    #[test]
    fn test_is_cursor_near_with_step_feature_scenario() {
        // From P2-004 steps: pet at (400, 500), cursor at (450, 500)
        // Pet center = (432, 532), cursor at (450, 500)
        // dx = 18, dy = -32, dist = sqrt(324 + 1024) = sqrt(1348) ≈ 36.7
        let pos = pet_at(400.0, 500.0);
        let dist = cursor_distance(&pos, PET_W, PET_H, 450.0, 500.0);
        assert!(dist < 100.0, "distance should be < 100, got {}", dist);
        assert!(is_cursor_near(&pos, PET_W, PET_H, 450.0, 500.0, 100.0));
    }
}
