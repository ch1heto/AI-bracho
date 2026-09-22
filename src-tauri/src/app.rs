use crate::{commands, llm::LlmService};

pub fn build() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .manage(LlmService::from_environment())
        .invoke_handler(tauri::generate_handler![
            commands::check_llm_status,
            commands::stream_chat
        ])
}
