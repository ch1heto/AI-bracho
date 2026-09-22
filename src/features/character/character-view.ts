import type { CharacterSnapshot } from "../../core/character-state";
import type { CharacterState } from "../../core/character-state";
import type { LlmConnectionState } from "../../services/llm/types";

interface StatusPresentation {
  label: string;
  connectionLabel: string;
}

const statusPresentations: Record<LlmConnectionState, StatusPresentation> = {
  offline: { label: "Сервер недоступен", connectionLabel: "OFFLINE" },
  connecting: { label: "Проверяю соединение", connectionLabel: "CONNECTING" },
  online: { label: "Готова к разговору", connectionLabel: "ONLINE" },
  thinking: { label: "Думаю", connectionLabel: "THINKING" },
  talking: { label: "Отвечаю", connectionLabel: "TALKING" },
  error: { label: "Ошибка соединения", connectionLabel: "ERROR" },
};

export interface CharacterViewController {
  element: HTMLElement;
  setState(character: CharacterState, connection: LlmConnectionState): void;
}

export function createCharacterView(
  snapshot: CharacterSnapshot,
): CharacterViewController {
  const section = document.createElement("section");
  section.className = "character-panel";
  section.setAttribute("aria-labelledby", "character-title");
  section.innerHTML = `
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">B</span>
      <div>
        <p class="eyebrow">LOCAL COMPANION</p>
        <h1 id="character-title">AI Bracho</h1>
      </div>
    </div>

    <div class="character-stage" aria-label="Placeholder будущего 2D-персонажа">
      <div class="ambient ambient-one"></div>
      <div class="ambient ambient-two"></div>
      <div class="avatar" aria-hidden="true">
        <div class="avatar-halo"></div>
        <div class="avatar-face">
          <span class="avatar-eye avatar-eye-left"></span>
          <span class="avatar-eye avatar-eye-right"></span>
          <span class="avatar-smile"></span>
        </div>
        <div class="avatar-body"></div>
      </div>
      <span class="placeholder-label">2D character placeholder</span>
    </div>

    <div class="character-status" data-character-state="${snapshot.state}">
      <span class="status-pulse" aria-hidden="true"></span>
      <div>
        <span class="status-caption">Состояние</span>
        <strong>${snapshot.label}</strong>
      </div>
      <span class="connection-pill" data-connection-state="offline">OFFLINE</span>
    </div>
  `;

  const status = section.querySelector<HTMLElement>(".character-status");
  const statusLabel = section.querySelector<HTMLElement>(".character-status strong");
  const connection = section.querySelector<HTMLElement>(".connection-pill");

  if (!status || !statusLabel || !connection) {
    throw new Error("Character view could not be initialized");
  }

  return {
    element: section,
    setState(character, connectionState) {
      const presentation = statusPresentations[connectionState];
      status.dataset.characterState = character;
      section.dataset.characterState = character;
      connection.dataset.connectionState = connectionState;
      statusLabel.textContent = presentation.label;
      connection.textContent = presentation.connectionLabel;
    },
  };
}
