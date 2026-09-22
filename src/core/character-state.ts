export const characterStates = [
  "idle",
  "thinking",
  "talking",
] as const;

export type CharacterState = (typeof characterStates)[number];

export interface CharacterSnapshot {
  state: CharacterState;
  label: string;
}

export const initialCharacterState: CharacterSnapshot = {
  state: "idle",
  label: "Отдыхаю рядом",
};
