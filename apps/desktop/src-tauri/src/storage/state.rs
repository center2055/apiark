use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedTab {
    pub file_path: String,
    pub collection_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100.0,
            y: 100.0,
            width: 1280.0,
            height: 800.0,
            maximized: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PersistedState {
    pub tabs: Vec<PersistedTab>,
    pub active_tab_index: Option<usize>,
    pub collection_paths: Vec<String>,
    #[serde(default)]
    pub window_state: Option<WindowState>,
}

pub fn load_persisted_state(path: &Path) -> PersistedState {
    match std::fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|e| {
            tracing::warn!("Failed to parse persisted state: {e}");
            PersistedState::default()
        }),
        Err(_) => PersistedState::default(),
    }
}

pub fn save_persisted_state(path: &Path, state: &PersistedState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create state directory: {e}"))?;
    }

    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize state: {e}"))?;

    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, &json).map_err(|e| format!("Failed to write state: {e}"))?;
    std::fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename state file: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn load_persisted_state_defaults_collection_paths_for_legacy_files() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("state.json");

        std::fs::write(
            &path,
            r#"{
  "tabs": [
    {
      "filePath": "/tmp/users.yaml",
      "collectionPath": "/tmp/apiark"
    }
  ],
  "activeTabIndex": 0
}"#,
        )
        .unwrap();

        let state = load_persisted_state(&path);

        assert_eq!(state.tabs.len(), 1);
        assert_eq!(state.tabs[0].file_path, "/tmp/users.yaml");
        assert_eq!(state.tabs[0].collection_path, "/tmp/apiark");
        assert_eq!(state.active_tab_index, Some(0));
        assert!(state.collection_paths.is_empty());
        assert!(state.window_state.is_none());
    }

    #[test]
    fn save_persisted_state_round_trips_collection_paths() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("state.json");

        let state = PersistedState {
            tabs: vec![],
            active_tab_index: None,
            collection_paths: vec!["/tmp/apiark".to_string(), "/tmp/other".to_string()],
            window_state: Some(WindowState::default()),
        };

        save_persisted_state(&path, &state).unwrap();
        let loaded = load_persisted_state(&path);

        assert_eq!(loaded.collection_paths, state.collection_paths);
        assert!(loaded.tabs.is_empty());
        assert_eq!(loaded.active_tab_index, None);
        assert!(loaded.window_state.is_some());
    }
}
