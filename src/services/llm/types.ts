export type ChatRole = "user" | "assistant";

export interface ConversationMessage {
  role: ChatRole;
  content: string;
}

export type LlmConnectionState =
  | "offline"
  | "connecting"
  | "online"
  | "thinking"
  | "talking"
  | "error";

export type LlmStreamEvent =
  | { type: "token"; content: string }
  | { type: "done" };

export interface LlmFailure {
  kind: string;
  message: string;
}

export interface LlmClient {
  checkStatus(): Promise<void>;
  streamChat(
    messages: ConversationMessage[],
    onEvent: (event: LlmStreamEvent) => void,
  ): Promise<void>;
}
