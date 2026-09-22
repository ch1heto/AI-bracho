import type { CharacterState } from "../../core/character-state";
import type {
  ConversationMessage,
  LlmClient,
  LlmConnectionState,
  LlmFailure,
} from "../../services/llm/types";
import type { ChatMessage, RenderedMessage } from "./chat-types";

interface ChatViewOptions {
  llm: LlmClient;
  onStateChange(
    connection: LlmConnectionState,
    character: CharacterState,
  ): void;
}

const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const formatTime = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

function createMessageElement(message: ChatMessage): RenderedMessage {
  const article = document.createElement("article");
  article.className = `message message-${message.author}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const author = document.createElement("span");
  author.textContent = message.author === "assistant" ? "Bracho" : "Вы";

  const time = document.createElement("time");
  time.dateTime = message.timestamp.toISOString();
  time.textContent = formatTime(message.timestamp);

  const bubble = document.createElement("p");
  bubble.className = "message-body";
  bubble.textContent = message.text;

  meta.append(author, time);
  article.append(meta, bubble);

  return {
    element: article,
    setText(text) {
      bubble.textContent = text;
    },
  };
}

function normalizeFailure(error: unknown): LlmFailure {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<LlmFailure>;
    if (typeof candidate.message === "string") {
      return {
        kind: typeof candidate.kind === "string" ? candidate.kind : "unknown",
        message: candidate.message,
      };
    }
  }
  return {
    kind: "unknown",
    message: typeof error === "string" ? error : "Неизвестная ошибка локальной модели",
  };
}

function userFacingError(failure: LlmFailure): string {
  switch (failure.kind) {
    case "network":
      return "Не удаётся подключиться к llama-server. Запустите проект через dev-start.bat и попробуйте снова.";
    case "timeout":
      return "Локальная модель не ответила вовремя. Проверьте llama-server и попробуйте снова.";
    case "malformedResponse":
      return "llama-server вернул некорректный ответ. Подробности сохранены в консоли разработчика.";
    case "interrupted":
      return "Ответ прерван: llama-server остановился или соединение было потеряно.";
    default:
      return `Не удалось получить ответ: ${failure.message}`;
  }
}

export function createChatView({
  llm,
  onStateChange,
}: ChatViewOptions): HTMLElement {
  const section = document.createElement("section");
  section.className = "chat-panel";
  section.setAttribute("aria-labelledby", "chat-title");
  section.innerHTML = `
    <header class="chat-header">
      <div>
        <p class="eyebrow">PRIVATE · ON DEVICE</p>
        <h2 id="chat-title">Диалог</h2>
      </div>
      <button class="new-dialog-button" type="button">Новый диалог</button>
    </header>
    <div class="messages" aria-live="polite" aria-label="Сообщения">
      <div class="empty-chat">
        <strong>Диалог готов</strong>
        <span>Напишите Bracho первое сообщение</span>
      </div>
    </div>
    <div class="chat-notice" role="status" hidden></div>
    <form class="composer">
      <label class="sr-only" for="message-input">Сообщение для Bracho</label>
      <textarea id="message-input" rows="1" maxlength="2000" placeholder="Напишите сообщение…"></textarea>
      <button class="send-button" type="submit" aria-label="Отправить сообщение">
        <span>Send</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 14-7-4 14-3-6-7-1Z" />
        </svg>
      </button>
    </form>
    <p class="composer-note">Ответ обрабатывается локально через llama.cpp</p>
  `;

  const messages = section.querySelector<HTMLDivElement>(".messages");
  const emptyChat = section.querySelector<HTMLElement>(".empty-chat");
  const notice = section.querySelector<HTMLElement>(".chat-notice");
  const form = section.querySelector<HTMLFormElement>(".composer");
  const input = section.querySelector<HTMLTextAreaElement>("#message-input");
  const sendButton = section.querySelector<HTMLButtonElement>(".send-button");
  const newDialogButton = section.querySelector<HTMLButtonElement>(".new-dialog-button");

  if (!messages || !emptyChat || !notice || !form || !input || !sendButton || !newDialogButton) {
    throw new Error("Chat view could not be initialized");
  }

  const conversation: ConversationMessage[] = [];
  let isGenerating = false;
  let generationId = 0;
  let connectionState: LlmConnectionState = "connecting";

  const updateState = (
    connection: LlmConnectionState,
    character: CharacterState,
  ): void => {
    connectionState = connection;
    onStateChange(connection, character);
  };

  const setBusy = (busy: boolean): void => {
    isGenerating = busy;
    input.disabled = busy;
    sendButton.disabled = busy;
    form.setAttribute("aria-busy", String(busy));
  };

  const showNotice = (text: string, isError = false): void => {
    notice.textContent = text;
    notice.classList.toggle("chat-notice-error", isError);
    notice.hidden = false;
  };

  const hideNotice = (): void => {
    notice.hidden = true;
    notice.textContent = "";
  };

  const appendMessage = (message: ChatMessage): RenderedMessage => {
    emptyChat.hidden = true;
    const rendered = createMessageElement(message);
    messages.append(rendered.element);
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    return rendered;
  };

  const checkConnection = async (): Promise<void> => {
    updateState("connecting", "idle");
    showNotice("Подключаюсь к локальной модели…");
    try {
      await llm.checkStatus();
      if (isGenerating) return;
      updateState("online", "idle");
      hideNotice();
    } catch {
      if (isGenerating) return;
      updateState("offline", "idle");
      showNotice(
        "llama-server недоступен. Для полного запуска используйте dev-start.bat.",
        true,
      );
    }
  };

  newDialogButton.addEventListener("click", () => {
    generationId += 1;
    conversation.length = 0;
    messages.replaceChildren(emptyChat);
    emptyChat.hidden = false;
    input.value = "";
    input.style.height = "auto";
    hideNotice();
    setBusy(false);
    updateState(
      connectionState === "thinking" || connectionState === "talking"
        ? "online"
        : connectionState,
      "idle",
    );
    input.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isGenerating) return;

    const text = input.value.trim();
    if (!text) return;

    const currentGeneration = ++generationId;
    hideNotice();
    const historyLength = conversation.length;
    const userMessage = appendMessage({
      id: createId(),
      author: "user",
      text,
      timestamp: new Date(),
    });
    conversation.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "auto";
    setBusy(true);
    updateState("thinking", "thinking");

    const assistantMessage = appendMessage({
      id: createId(),
      author: "assistant",
      text: "…",
      timestamp: new Date(),
    });
    assistantMessage.element.classList.add("message-streaming");

    let responseText = "";
    let receivedDone = false;

    try {
      await llm.streamChat([...conversation], (streamEvent) => {
        if (currentGeneration !== generationId) return;
        if (streamEvent.type === "token") {
          if (!responseText) {
            updateState("talking", "talking");
          }
          responseText += streamEvent.content;
          assistantMessage.setText(responseText);
          messages.scrollTo({ top: messages.scrollHeight, behavior: "auto" });
        } else {
          receivedDone = true;
        }
      });

      if (currentGeneration !== generationId) return;
      if (!receivedDone || !responseText.trim()) {
        throw {
          kind: "malformedResponse",
          message: "stream completed without a final message",
        } satisfies LlmFailure;
      }

      conversation.push({ role: "assistant", content: responseText });
      assistantMessage.element.classList.remove("message-streaming");
      updateState("online", "idle");
    } catch (error) {
      if (currentGeneration !== generationId) return;
      const failure = normalizeFailure(error);
      console.error("Local LLM request failed", failure);
      conversation.length = historyLength;
      userMessage.element.classList.add("message-failed");

      if (responseText) {
        assistantMessage.element.classList.add("message-failed");
      } else {
        assistantMessage.element.remove();
      }

      const isOffline = failure.kind === "network";
      updateState(isOffline ? "offline" : "error", "idle");
      showNotice(userFacingError(failure), true);
    } finally {
      if (currentGeneration === generationId) {
        setBusy(false);
        input.focus();
      }
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  void checkConnection();
  return section;
}
