use std::sync::Arc;

use futures_util::StreamExt;
use reqwest::{Client, Response, StatusCode};
use serde_json::Value;
use tokio::time::timeout;

use crate::companion::personality::SYSTEM_PROMPT;

use super::{
    config::LlmConfig,
    types::{ChatCompletionRequest, ChatMessage, LlmError, StreamEvent},
};

const MAX_MESSAGES: usize = 64;
const MAX_MESSAGE_LENGTH: usize = 20_000;

#[derive(Clone)]
pub struct LlmService {
    client: Client,
    config: Arc<LlmConfig>,
}

impl LlmService {
    pub fn from_environment() -> Self {
        let config = LlmConfig::from_environment();
        let client = Client::builder()
            .connect_timeout(config.connect_timeout)
            .build()
            .expect("failed to build local LLM HTTP client");

        Self {
            client,
            config: Arc::new(config),
        }
    }

    pub async fn check_health(&self) -> Result<(), LlmError> {
        let request = self.client.get(self.config.health_url()).send();
        let response = timeout(self.config.connect_timeout, request)
            .await
            .map_err(|_| LlmError::timeout("llama-server did not respond in time"))?
            .map_err(map_request_error)?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(LlmError::server(format!(
                "llama-server health check returned HTTP {}",
                response.status()
            )))
        }
    }

    pub async fn stream_chat<F>(
        &self,
        messages: Vec<ChatMessage>,
        on_event: F,
    ) -> Result<(), LlmError>
    where
        F: FnMut(StreamEvent) -> Result<(), LlmError>,
    {
        validate_messages(&messages)?;

        let mut conversation = Vec::with_capacity(messages.len() + 1);
        conversation.push(ChatMessage {
            role: "system".to_owned(),
            content: SYSTEM_PROMPT.to_owned(),
        });
        conversation.extend(messages);

        let request = ChatCompletionRequest {
            model: &self.config.model_id,
            messages: &conversation,
            stream: true,
            temperature: self.config.temperature,
            top_p: self.config.top_p,
            max_tokens: self.config.max_tokens,
        };

        let response = timeout(
            self.config.response_timeout,
            self.client
                .post(self.config.chat_completions_url())
                .json(&request)
                .send(),
        )
        .await
        .map_err(|_| LlmError::timeout("the model did not start responding in time"))?
        .map_err(map_request_error)?;

        let response = ensure_success(response.status(), response).await?;
        self.consume_stream(response, on_event).await
    }

    async fn consume_stream<F>(
        &self,
        response: Response,
        mut on_event: F,
    ) -> Result<(), LlmError>
    where
        F: FnMut(StreamEvent) -> Result<(), LlmError>,
    {
        let mut stream = response.bytes_stream();
        let mut pending = Vec::<u8>::new();
        let mut emitted_content = false;

        loop {
            let next = timeout(self.config.stream_idle_timeout, stream.next())
                .await
                .map_err(|_| LlmError::timeout("the model response stream timed out"))?;

            match next {
                Some(Ok(chunk)) => {
                    pending.extend_from_slice(&chunk);
                    while let Some(newline) = pending.iter().position(|byte| *byte == b'\n') {
                        let line = pending.drain(..=newline).collect::<Vec<_>>();
                        if process_sse_line(&line, &mut on_event, &mut emitted_content)? {
                            return Ok(());
                        }
                    }
                }
                Some(Err(error)) => {
                    return Err(LlmError::interrupted(format!(
                        "llama-server stopped during generation: {error}"
                    )));
                }
                None => {
                    if !pending.is_empty()
                        && process_sse_line(&pending, &mut on_event, &mut emitted_content)?
                    {
                        return Ok(());
                    }
                    return Err(LlmError::interrupted(
                        "llama-server closed the response before the stream completed",
                    ));
                }
            }
        }
    }
}

async fn ensure_success(status: StatusCode, response: Response) -> Result<Response, LlmError> {
    if status.is_success() {
        return Ok(response);
    }

    let body = response.text().await.unwrap_or_default();
    let detail = if body.trim().is_empty() {
        status.to_string()
    } else {
        format!("{status}: {}", truncate(&body, 300))
    };
    Err(LlmError::server(format!(
        "llama-server rejected the request ({detail})"
    )))
}

fn process_sse_line<F>(
    raw_line: &[u8],
    on_event: &mut F,
    emitted_content: &mut bool,
) -> Result<bool, LlmError>
where
    F: FnMut(StreamEvent) -> Result<(), LlmError>,
{
    let line = std::str::from_utf8(raw_line)
        .map_err(|_| LlmError::malformed("llama-server returned invalid UTF-8"))?
        .trim();

    let Some(data) = line.strip_prefix("data:") else {
        return Ok(false);
    };
    let data = data.trim();

    if data == "[DONE]" {
        if !*emitted_content {
            return Err(LlmError::malformed(
                "llama-server completed without returning message text",
            ));
        }
        on_event(StreamEvent::Done)?;
        return Ok(true);
    }

    if data.is_empty() {
        return Ok(false);
    }

    let payload: Value = serde_json::from_str(data).map_err(|error| {
        LlmError::malformed(format!("llama-server returned malformed JSON: {error}"))
    })?;

    if let Some(content) = payload
        .pointer("/choices/0/delta/content")
        .and_then(Value::as_str)
    {
        if !content.is_empty() {
            *emitted_content = true;
            on_event(StreamEvent::Token {
                content: content.to_owned(),
            })?;
        }
    }

    Ok(false)
}

fn validate_messages(messages: &[ChatMessage]) -> Result<(), LlmError> {
    if messages.is_empty() {
        return Err(LlmError::invalid_request("the conversation is empty"));
    }
    if messages.len() > MAX_MESSAGES {
        return Err(LlmError::invalid_request("the conversation is too long"));
    }

    for message in messages {
        if !matches!(message.role.as_str(), "user" | "assistant") {
            return Err(LlmError::invalid_request("unsupported chat message role"));
        }
        if message.content.trim().is_empty() {
            return Err(LlmError::invalid_request("chat messages cannot be empty"));
        }
        if message.content.len() > MAX_MESSAGE_LENGTH {
            return Err(LlmError::invalid_request("a chat message is too long"));
        }
    }

    Ok(())
}

fn map_request_error(error: reqwest::Error) -> LlmError {
    if error.is_timeout() {
        LlmError::timeout("llama-server request timed out")
    } else {
        LlmError::network(format!("cannot reach llama-server: {error}"))
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}
