use tauri::{ipc::Channel, State};

use crate::llm::{ChatMessage, LlmError, LlmService, StreamEvent};

#[tauri::command]
pub async fn check_llm_status(llm: State<'_, LlmService>) -> Result<(), LlmError> {
    llm.check_health().await
}

#[tauri::command]
pub async fn stream_chat(
    messages: Vec<ChatMessage>,
    on_event: Channel<StreamEvent>,
    llm: State<'_, LlmService>,
) -> Result<(), LlmError> {
    llm.stream_chat(messages, |event| {
        on_event
            .send(event)
            .map_err(|error| LlmError::interrupted(format!("UI channel closed: {error}")))
    })
    .await
}
