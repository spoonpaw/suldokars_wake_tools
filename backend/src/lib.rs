// Suldokar's Wake Tools - shared entry. main.rs calls run() on desktop;
// the mobile entry point macro wires it for iOS / Android.

use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    os: String,
    arch: String,
    family: String,
}

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
    })
}

/// Roll a single die with N sides. Used as a fallback when the frontend
/// wants the OS-grade RNG instead of the JS one.
#[tauri::command]
async fn roll_die(sides: u32) -> Result<u32, String> {
    if sides < 2 {
        return Err("sides must be >= 2".into());
    }
    let mut rng = rand::thread_rng();
    Ok(rng.gen_range(1..=sides))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build());

    // Desktop-only plugins
    // Desktop-only plugins (mobile uses store-managed updates).
    // process plugin gives the frontend the ability to relaunch the app
    // after the updater swaps the binary.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![get_system_info, roll_die])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
