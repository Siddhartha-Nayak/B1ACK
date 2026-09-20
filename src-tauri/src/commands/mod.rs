use crate::{
    system::{Metrics, Monitor},
    terminal::{Config, Manager, Packet},
};
use std::sync::Arc;
use tauri::State;
#[tauri::command]
pub async fn terminal_start(
    manager: State<'_, Arc<Manager>>,
    config: Config,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.start(config, cols, rows))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn terminal_write(
    manager: State<'_, Arc<Manager>>,
    id: String,
    data: String,
) -> Result<(), String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.write(&id, &data))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn terminal_resize(
    manager: State<'_, Arc<Manager>>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.resize(&id, cols, rows))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn terminal_close(manager: State<'_, Arc<Manager>>, id: String) -> Result<(), String> {
    let manager = manager.inner().clone();
    tauri::async_runtime::spawn_blocking(move || manager.close(&id))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn terminal_drain(manager: State<'_, Arc<Manager>>) -> Result<Vec<Packet>, String> {
    manager.drain()
}
#[tauri::command]
pub async fn project_validate(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::terminal::validate_folder(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn system_status(monitor: State<'_, Monitor>) -> Result<Metrics, String> {
    monitor.sample()
}

#[tauri::command]
pub async fn command_detect(
    commands: Vec<String>,
) -> Result<std::collections::BTreeMap<String, Option<String>>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        commands
            .into_iter()
            .map(|command| {
                let path = which::which(&command)
                    .ok()
                    .map(|p| p.to_string_lossy().into_owned());
                (command, path)
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn project_open(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = crate::terminal::validate_folder(&path)?;
        #[cfg(windows)]
        let program = "explorer.exe";
        #[cfg(target_os = "macos")]
        let program = "open";
        #[cfg(all(unix, not(target_os = "macos")))]
        let program = "xdg-open";
        std::process::Command::new(program)
            .arg(folder)
            .spawn()
            .map_err(|e| format!("Could not open project folder: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn terminal_inspect(
    manager: State<'_, Arc<Manager>>,
) -> Result<Vec<crate::terminal::SessionInfo>, String> {
    manager.inspect()
}
