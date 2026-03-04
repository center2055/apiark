pub mod manager;

use serde::{Deserialize, Serialize};

use crate::models::request::KeyValuePair;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsConnectParams {
    pub url: String,
    pub headers: Vec<KeyValuePair>,
    pub protocols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsMessage {
    pub connection_id: String,
    pub direction: String, // "sent" | "received"
    pub content: String,
    pub message_type: String, // "text" | "binary"
    pub timestamp: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsStatus {
    pub connection_id: String,
    pub state: String, // "connecting" | "connected" | "disconnected"
    pub error: Option<String>,
}
