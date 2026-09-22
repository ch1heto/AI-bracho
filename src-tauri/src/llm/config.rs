use std::{env, time::Duration};

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8080";
const DEFAULT_MODEL_ID: &str = "local-model";
const DEFAULT_TEMPERATURE: f32 = 0.9;
const DEFAULT_TOP_P: f32 = 0.95;
const DEFAULT_MAX_TOKENS: u32 = 700;

#[derive(Clone)]
pub struct LlmConfig {
    pub base_url: String,
    pub model_id: String,
    pub temperature: f32,
    pub top_p: f32,
    pub max_tokens: u32,
    pub connect_timeout: Duration,
    pub response_timeout: Duration,
    pub stream_idle_timeout: Duration,
}

impl LlmConfig {
    pub fn from_environment() -> Self {
        Self {
            base_url: env::var("AI_BRACHO_LLM_URL")
                .unwrap_or_else(|_| DEFAULT_BASE_URL.to_owned())
                .trim_end_matches('/')
                .to_owned(),
            model_id: env::var("AI_BRACHO_LLM_MODEL_ID")
                .unwrap_or_else(|_| DEFAULT_MODEL_ID.to_owned()),
            temperature: DEFAULT_TEMPERATURE,
            top_p: DEFAULT_TOP_P,
            max_tokens: DEFAULT_MAX_TOKENS,
            connect_timeout: Duration::from_secs(3),
            response_timeout: Duration::from_secs(30),
            stream_idle_timeout: Duration::from_secs(45),
        }
    }

    pub fn health_url(&self) -> String {
        format!("{}/health", self.base_url)
    }

    pub fn chat_completions_url(&self) -> String {
        format!("{}/v1/chat/completions", self.base_url)
    }
}
