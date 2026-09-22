import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  ConversationMessage,
  LlmClient,
  LlmStreamEvent,
} from "./types";

export class TauriLlmClient implements LlmClient {
  async checkStatus(): Promise<void> {
    await invoke("check_llm_status");
  }

  async streamChat(
    messages: ConversationMessage[],
    onEvent: (event: LlmStreamEvent) => void,
  ): Promise<void> {
    const channel = new Channel<LlmStreamEvent>();
    channel.onmessage = onEvent;
    await invoke("stream_chat", { messages, onEvent: channel });
  }
}
