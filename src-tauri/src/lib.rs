mod app;
mod commands;
mod companion;
mod llm;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::build()
        .run(tauri::generate_context!())
        .expect("failed to run AI Bracho");
}
