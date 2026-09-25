use tauri::command;

#[command]
pub async fn project_files_list(path: String) -> Result<Vec<crate::project_browser::ProjectFileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || crate::project_browser::list_files(path))
        .await.map_err(|e| e.to_string())?
}

#[command]
pub async fn project_file_read(path: String, relative: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::project_browser::read_file(path, relative))
        .await.map_err(|e| e.to_string())?
}

#[command]
pub async fn project_git_status(path: String) -> Result<crate::project_browser::ProjectGitStatus, String> {
    tauri::async_runtime::spawn_blocking(move || crate::project_browser::git_status(path))
        .await.map_err(|e| e.to_string())?
}

#[command]
pub async fn project_git_diff(path: String, relative: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::project_browser::git_diff(path, relative))
        .await.map_err(|e| e.to_string())?
}
