mod app;
mod commands;
mod config;
mod domain;
mod errors;
mod infrastructure;
mod services;
mod utils;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::scan_agents,
            commands::open_agent_location,
            commands::save_agent,
            commands::create_agent,
            commands::delete_agent,
            commands::delete_config_file,
            commands::save_permission_profile,
            commands::create_config_file,
            commands::run_agent_chat,
            commands::check_opencode_installation,
            commands::list_opencode_models,
            commands::list_skills,
            commands::install_skill,
            commands::delete_skill
        ])
        .run(tauri::generate_context!())
        .expect("failed to run OpenCode Agent Manager");
}
