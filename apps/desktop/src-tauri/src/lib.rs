mod commands;
mod http;
mod models;
mod runner;
mod scripting;
mod sse;
mod storage;
mod websocket;

use std::sync::{Arc, Mutex};

use commands::collection::{
    create_folder, create_request, delete_item, open_collection, read_request_file, rename_item,
    save_request_file,
};
use commands::environment::{get_resolved_variables, load_environments, save_environment};
use commands::greet;
use commands::history::{clear_history, delete_history_entry, get_history, search_history, AppState};
use commands::http::{send_request, send_request_with_scripts};
use commands::curl::{export_curl_command, parse_curl_command};
use commands::runner::run_collection_command;
use commands::sse::{sse_connect, sse_disconnect, SseManager};
use commands::websocket::{ws_connect, ws_disconnect, ws_send};
use websocket::manager::WsManager;
use commands::settings::{get_settings, update_settings, SettingsState};
use commands::state::{load_persisted_state, save_persisted_state};
use storage::history::HistoryDb;
use storage::settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "apiark=info".into()),
        )
        .init();

    // Initialize history database
    let apiark_dir = dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".apiark");

    let db_path = apiark_dir.join("data.db");

    let history_db = match HistoryDb::open(&db_path) {
        Ok(db) => Arc::new(db),
        Err(e) => {
            tracing::error!("Failed to open history database: {e}");
            // Try to recover: rename corrupt DB and create fresh
            if db_path.exists() {
                let backup = db_path.with_extension(format!(
                    "db.corrupt.{}",
                    chrono::Utc::now().format("%Y%m%d_%H%M%S")
                ));
                let _ = std::fs::rename(&db_path, &backup);
                tracing::info!("Renamed corrupt DB to {}", backup.display());
            }
            Arc::new(HistoryDb::open(&db_path).expect("Failed to create fresh history database"))
        }
    };

    // Load settings
    let settings_path = apiark_dir.join("settings.json");
    let app_settings = settings::load_settings(&settings_path);
    tracing::info!("Settings loaded (theme: {})", app_settings.theme);

    let app_state = AppState { history_db };
    let settings_state = SettingsState {
        settings: Mutex::new(app_settings),
        settings_path,
    };

    tauri::Builder::default()
        .manage(app_state)
        .manage(settings_state)
        .manage(WsManager::new())
        .manage(SseManager::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            send_request,
            send_request_with_scripts,
            // Collection commands
            open_collection,
            read_request_file,
            save_request_file,
            create_request,
            create_folder,
            delete_item,
            rename_item,
            // Environment commands
            load_environments,
            save_environment,
            get_resolved_variables,
            // History commands
            get_history,
            search_history,
            clear_history,
            delete_history_entry,
            // cURL commands
            parse_curl_command,
            export_curl_command,
            // State persistence commands
            load_persisted_state,
            save_persisted_state,
            // Runner commands
            run_collection_command,
            // WebSocket commands
            ws_connect,
            ws_send,
            ws_disconnect,
            // SSE commands
            sse_connect,
            sse_disconnect,
            // Settings commands
            get_settings,
            update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
