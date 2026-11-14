use tauri::Manager;

#[tauri::command]
fn desktop_operation(app: tauri::AppHandle, op: String) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        return Ok(());
    };
    match op.as_str() {
        "min" => {
            let _ = win.minimize();
        }
        "max" => {
            if win.is_maximized().unwrap_or(false) {
                let _ = win.unmaximize();
            } else {
                let _ = win.maximize();
            }
        }
        "hidden" => {
            let _ = win.hide();
        }
        "exit" => {
            app.exit(0);
        }
        "login" => {
            let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 1150.0,
                height: 735.0,
            }));
            let _ = win.center();
        }
        "logout" => {
            let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 700.0,
                height: 415.0,
            }));
            let _ = win.center();
        }
        // P0 stub：newMsg / screencap 留空，P1 实现
        "newMsg" | "screencap" => {}
        _ => {}
    }
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<bool, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Ok(false);
    }
    open::that(&url).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn check_for_updates(silent: Option<bool>) -> Result<(), String> {
    let _ = silent;
    // P3 stub
    Ok(())
}

#[tauri::command]
fn quit_and_install() -> Result<(), String> {
    // P3 stub
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_operation,
            open_external_url,
            check_for_updates,
            quit_and_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
