/**
 * Models offered in Settings. Client-safe (no secrets). Claude Opus 5.5 is
 * the default; AI_MODEL in the environment can change the default.
 */
export const AI_MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    note: "Most capable, the default",
    serverFallback: true,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "Faster, lower cost",
    serverFallback: true,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    note: "Fastest, lowest cost",
    serverFallback: false,
  },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_MODEL: AiModelId = "claude-opus-5-5";

export const AI_EFFORTS = ["low", "medium", "high"] as const;
export type AiEffort = (typeof AI_EFFORTS)[number];

export function isKnownModel(id: string): id is AiModelId {
  return AI_MODELS.some((m) => m.id === id);
}

export function modelInfo(id: string) {
  return AI_MODELS.find((m) => m.id === id);
}
