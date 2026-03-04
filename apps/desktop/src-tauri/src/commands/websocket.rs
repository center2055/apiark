use tauri::{AppHandle, State};

use crate::websocket::manager::WsManager;
use crate::websocket::WsConnectParams;

#[tauri::command]
pub async fn ws_connect(
    app: AppHandle,
    state: State<'_, WsManager>,
    connection_id: String,
    params: WsConnectParams,
) -> Result<(), String> {
    state.connect(app, connection_id, params)
}

#[tauri::command]
pub async fn ws_send(
    state: State<'_, WsManager>,
    connection_id: String,
    message: String,
) -> Result<(), String> {
    state.send(&connection_id, message)
}

#[tauri::command]
pub async fn ws_disconnect(
    state: State<'_, WsManager>,
    connection_id: String,
) -> Result<(), String> {
    state.disconnect(&connection_id)
}
