use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;
#[derive(Serialize, Deserialize)]
pub struct Entry {
    id: String,
    name: String,
    size: u64,
}
fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let p = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("library");
    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}
fn entry_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.len() != 36 || !id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Invalid library ID".into());
    }
    Ok(root(app)?.join(id))
}
#[tauri::command]
pub fn library_list(app: tauri::AppHandle) -> Result<Vec<Entry>, String> {
    let mut entries = Vec::new();
    for item in fs::read_dir(root(&app)?).map_err(|e| e.to_string())? {
        let p = item.map_err(|e| e.to_string())?.path().join("entry.json");
        if p.is_file() {
            entries.push(
                serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?)
                    .map_err(|e| format!("Cannot read library entry: {e}"))?,
            );
        }
    }
    Ok(entries)
}
#[tauri::command]
pub async fn library_add(
    app: tauri::AppHandle,
    id: String,
    name: String,
    source: Option<String>,
    bytes: Option<Vec<u8>>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if name.trim().is_empty() || name.len() > 255 {
            return Err("Provide a filename up to 255 characters".into());
        }
        let dest = entry_path(&app, &id)?;
        fs::create_dir(&dest).map_err(|e| e.to_string())?;
        let result = (|| {
            let data = dest.join("content");
            if let Some(source) = source {
                if !fs::metadata(&source).map_err(|e| e.to_string())?.is_file() {
                    return Err("Select a file".into());
                }
                fs::copy(source, &data).map_err(|e| e.to_string())?;
            } else {
                fs::write(&data, bytes.ok_or("No file content")?).map_err(|e| e.to_string())?;
            }
            let entry = Entry {
                id,
                name,
                size: fs::metadata(data).map_err(|e| e.to_string())?.len(),
            };
            fs::write(
                dest.join("entry.json"),
                serde_json::to_vec(&entry).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())
        })();
        if result.is_err() {
            let _ = fs::remove_dir_all(dest);
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn library_read(app: tauri::AppHandle, id: String) -> Result<Vec<u8>, String> {
    let p = entry_path(&app, &id)?.join("content");
    tauri::async_runtime::spawn_blocking(move || {
        if fs::metadata(&p).map_err(|e| e.to_string())?.len() > 10 * 1024 * 1024 {
            return Err("Preview is limited to 10 MB. Export a copy to view this file.".into());
        }
        fs::read(p).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn library_export(
    app: tauri::AppHandle,
    id: String,
    destination: String,
) -> Result<(), String> {
    let p = entry_path(&app, &id)?.join("content");
    tauri::async_runtime::spawn_blocking(move || {
        fs::copy(p, destination)
            .map(|_| ())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn library_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    fs::remove_dir_all(entry_path(&app, &id)?).map_err(|e| e.to_string())
}
