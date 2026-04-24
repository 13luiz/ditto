use auto_launch::AutoLaunchBuilder;

pub fn set_auto_launch(enable: bool) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let auto = AutoLaunchBuilder::new()
        .set_app_name("Ditto")
        .set_app_path(&exe.to_string_lossy())
        .build()
        .map_err(|e| e.to_string())?;

    if enable {
        auto.enable().map_err(|e| e.to_string())
    } else {
        auto.disable().map_err(|e| e.to_string())
    }
}

pub fn is_auto_launch_enabled() -> Result<bool, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let auto = AutoLaunchBuilder::new()
        .set_app_name("Ditto")
        .set_app_path(&exe.to_string_lossy())
        .build()
        .map_err(|e| e.to_string())?;
    Ok(auto.is_enabled().unwrap_or(false))
}
