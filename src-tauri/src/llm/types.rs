use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmError {
    pub kind: &'static str,
    pub message: String,
}

impl LlmError {
    pub fn network(message: impl Into<String>) -> Self {
        Self {
            kind: "network",
            message: message.into(),
        }
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self {
            kind: "timeout",
            message: message.into(),
        }
    }

    pub fn malformed(message: impl Into<String>) -> Self {
        Self {
            kind: "malformedResponse",
            message: message.into(),
        }
    }

    pub fn interrupted(message: impl Into<String>) -> Self {
        Self {
            kind: "interrupted",
            message: message.into(),
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            kind: "invalidRequest",
            message: message.into(),
        }
    }

    pub fn server(message: impl Into<String>) -> Self {
        Self {
            kind: "server",
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    Token { content: String },
    Done,
}

#[derive(Serialize)]
pub struct ChatCompletionRequest<'a> {
    pub model: &'a str,
    pub messages: &'a [ChatMessage],
    pub stream: bool,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: u32,
}
