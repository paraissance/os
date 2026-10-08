import "server-only";
import { anthropicProvider } from "./anthropic";
import type { ChatProvider } from "./types";

/** Phase 1: a single provider. Phase 2 resolves the provider per model here. */
export function getChatProvider(): ChatProvider {
  return anthropicProvider;
}

export * from "./types";
