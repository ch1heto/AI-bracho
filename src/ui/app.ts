import { initialCharacterState } from "../core/character-state";
import { createCharacterView } from "../features/character/character-view";
import { createChatView } from "../features/chat/chat-view";
import { TauriLlmClient } from "../services/llm/tauri-llm-client";

export function createApp(root: HTMLElement): void {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  const character = createCharacterView(initialCharacterState);
  const llm = new TauriLlmClient();
  shell.append(
    character.element,
    createChatView({
      llm,
      onStateChange(connection, characterState) {
        character.setState(characterState, connection);
      },
    }),
  );
  root.replaceChildren(shell);
}
