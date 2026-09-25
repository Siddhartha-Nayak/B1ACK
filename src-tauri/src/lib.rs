mod commands;
mod library;
mod project_browser;
mod system;
pub mod terminal;
use tauri::Manager as _;
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(std::sync::Arc::new(terminal::Manager::default()))
        .manage(system::Monitor::default())
        .invoke_handler(tauri::generate_handler![
            library::library_list,
            library::library_add,
            library::library_read,
            library::library_export,
            library::library_delete,
            commands::terminal_start,
            commands::terminal_write,
            commands::terminal_resize,
            commands::terminal_close,
            commands::terminal_drain,
            commands::project_validate,
            commands::command_detect,
            commands::agents_install_all,
            commands::project_open,
            commands::worktree_create,
            commands::terminal_inspect,
            commands::project_browser::project_files_list,
            commands::project_browser::project_file_read,
            commands::project_browser::project_git_status,
            commands::project_browser::project_git_diff,
            commands::system_status
        ])
        .build(tauri::generate_context!())
        .expect("Could not initialize ParallelADE")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<std::sync::Arc<terminal::Manager>>().shutdown();
            }
        });
}
