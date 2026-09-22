export type MessageAuthor = "assistant" | "user";

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  timestamp: Date;
}

export interface RenderedMessage {
  element: HTMLElement;
  setText(text: string): void;
}
