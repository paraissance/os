import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { scrubText } from "@/lib/redact";
import { modelInfo } from "./models";
import { AiProviderError, type ChatProvider, type ChatRequest, type ChatStreamEvent } from "./types";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;
function getClient() {
  const apiKey = env().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiProviderError("not_configured", "ANTHROPIC_API_KEY is not set, so the AI is offline.");
  }
  client ??= new Anthropic({ apiKey });
  return client;
}

export function toProviderError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;
  if (err instanceof Anthropic.APIUserAbortError) {
    return new AiProviderError("aborted", "The request was cancelled.");
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError("auth", "Anthropic rejected the API key. Check ANTHROPIC_API_KEY.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiProviderError("rate_limited", "Anthropic rate limit reached. Try again in a moment.");
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    return new AiProviderError("bad_request", `Anthropic refused the request: ${scrubText(err.message)}`);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiProviderError("network", "Couldn't reach Anthropic. Check the network and try again.");
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529 || err.status === 503) {
      return new AiProviderError("overloaded", "Anthropic is overloaded right now. Try again shortly.");
    }
    return new AiProviderError("unknown", `Anthropic error ${err.status ?? ""}`.trim());
  }
  return new AiProviderError("unknown", "The AI request failed unexpectedly.");
}

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  label: "Anthropic Claude",

  isConfigured() {
    return Boolean(env().ANTHROPIC_API_KEY);
  },

  async *streamChat(request: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const anthropic = getClient();
    // Server-side fallback re-runs a safety-declined request on Anthropic's
    // recommended fallback model instead of failing. Haiku has no fallback.
    const fallback = modelInfo(request.model)?.serverFallback ?? false;

    try {
      const stream = anthropic.beta.messages.stream(
        {
          model: request.model,
          max_tokens: 64000,
          output_config: { effort: request.effort },
          cache_control: { type: "ephemeral" },
          system: request.system,
          messages: request.turns.map((t) => ({ role: t.role, content: t.content })),
          ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
        },
        { signal: request.signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      yield {
        type: "done",
        model: final.model,
        stopReason: final.stop_reason ?? null,
        inputTokens: final.usage?.input_tokens ?? null,
        outputTokens: final.usage?.output_tokens ?? null,
      };
    } catch (err) {
      throw toProviderError(err);
    }
  },
};
