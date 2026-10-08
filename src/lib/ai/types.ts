import type { AiEffort } from "./models";

/**
 * Provider-neutral chat contract. Phase 1 ships one implementation
 * (Anthropic); Phase 2 adds more providers plus tool calling behind the same
 * interface, so the rest of the app never imports a provider SDK directly.
 */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  model: string;
  effort: AiEffort;
  system: string;
  turns: ChatTurn[];
  signal?: AbortSignal;
};

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | {
      type: "done";
      /** The model that actually answered (can differ after a server-side fallback). */
      model: string;
      stopReason: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
    };

export interface ChatProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  streamChat(request: ChatRequest): AsyncIterable<ChatStreamEvent>;
}

export type AiErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "overloaded"
  | "bad_request"
  | "network"
  | "aborted"
  | "unknown";

/** Errors carry a message that is safe to show the user and to log. */
export class AiProviderError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
