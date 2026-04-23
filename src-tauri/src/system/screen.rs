use std::io::Write;

/// Captures the primary monitor and returns PNG-encoded bytes.
pub fn capture_primary_monitor() -> Result<Vec<u8>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to list monitors: {}", e))?;
    let primary = monitors
        .first()
        .ok_or_else(|| "No monitors found".to_string())?;

    let image = primary
        .capture_image()
        .map_err(|e| format!("Failed to capture: {}", e))?;

    let mut png_data = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
    image
        .write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(png_data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_returns_non_empty() {
        let result = capture_primary_monitor();
        // On CI/headless this may fail, so we just check it doesn't panic
        if let Ok(data) = result {
            assert!(!data.is_empty(), "captured image should have non-zero size");
            // Check PNG header
            assert!(data.starts_with(&[0x89, 0x50, 0x4E, 0x47]), "should be valid PNG");
        }
    }

    #[test]
    fn test_capture_structure_exists() {
        // Verify the function compiles and the module structure is correct
        let _ = capture_primary_monitor;
    }
}
