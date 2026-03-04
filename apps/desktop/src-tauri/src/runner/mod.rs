pub mod collection_runner;
pub mod data_reader;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunConfig {
    pub collection_path: String,
    pub folder_path: Option<String>,
    pub environment_name: Option<String>,
    pub delay_ms: u64,
    pub iterations: u32,
    pub data_file: Option<String>,
    pub stop_on_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestRunResult {
    pub name: String,
    pub method: String,
    pub url: String,
    pub status: Option<u16>,
    pub time_ms: Option<u64>,
    pub passed: bool,
    pub test_count: usize,
    pub test_passed: usize,
    pub assertion_count: usize,
    pub assertion_passed: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IterationResult {
    pub iteration: u32,
    pub results: Vec<RequestRunResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub total_requests: usize,
    pub total_passed: usize,
    pub total_failed: usize,
    pub total_time_ms: u64,
    pub iterations: Vec<IterationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunProgress {
    pub run_id: String,
    pub iteration: u32,
    pub request_index: usize,
    pub total_requests: usize,
    pub result: RequestRunResult,
}
