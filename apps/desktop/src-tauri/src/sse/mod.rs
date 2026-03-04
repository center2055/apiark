pub mod client;

use serde::{Deserialize, Serialize};

use crate::models::request::KeyValuePair;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseConnectParams {
    pub url: String,
    pub headers: Vec<KeyValuePair>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseEvent {
    pub connection_id: String,
    pub event_type: String,
    pub data: String,
    pub id: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseStatus {
    pub connection_id: String,
    pub state: String, // "connecting" | "connected" | "disconnected"
    pub error: Option<String>,
}
