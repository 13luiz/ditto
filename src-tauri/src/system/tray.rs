use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem},
    tray::TrayIconBuilder,
    App, Emitter, Manager,
};

pub fn setup_tray(app: &App) {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>).unwrap();
    let pet_manager =
        MenuItem::with_id(app, "pet_manager", "Pet Manager", true, None::<&str>).unwrap();
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&pet_manager)
        .separator()
        .item(&quit)
        .build()
        .unwrap();

    let icon = Image::from_bytes(include_bytes!("../../icons/32x32.png"))
        .expect("Failed to load tray icon");

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Ditto")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }
            "pet_manager" => {
                let _ = app.emit("open_pet_manager", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)
        .expect("Failed to build tray icon");
}
