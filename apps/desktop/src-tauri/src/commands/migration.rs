use std::path::Path;

use crate::storage::migration::{self, VersionStatus};

#[tauri::command]
pub async fn check_collection_version(collection_path: String) -> Result<VersionStatus, String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || migration::check_version(Path::new(&path)))
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

#[tauri::command]
pub async fn migrate_collection(collection_path: String) -> Result<u32, String> {
    let path = collection_path.clone();
    tokio::task::spawn_blocking(move || {
        let status = migration::check_version(Path::new(&path))?;
        if !status.needs_migration {
            return Ok(0);
        }
        migration::migrate_collection(Path::new(&path), status.collection_version)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}
