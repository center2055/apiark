pub mod collection;
pub mod cookies;
pub mod curl;
pub mod docs;
pub mod grpc;
pub mod environment;
pub mod history;
pub mod http;
pub mod import_export;
pub mod migration;
pub mod mock;
pub mod oauth;
pub mod runner;
pub mod scheduler;
pub mod settings;
pub mod sse;
pub mod state;
pub mod trash;
pub mod watcher;
pub mod websocket;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ApiArk.", name)
}
