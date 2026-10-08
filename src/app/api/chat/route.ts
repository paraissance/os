import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { getSession } from "@/lib/auth/current-user";
import { addMessage, createConversation, getConversation, getMessages } from "@/lib/chat";
import { AiProviderError, getChatProvider } from "@/lib/ai";
import { buildSystemPrompt, toTranscript } from "@/lib/ai/system-prompt";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { getSettings } from "@/lib/settings";
import type { ChatEvent } from "@/lib/chat-events";

// Long answers stream for a while; give the function room (Vercel caps by plan).
export const maxDuration = 300;

const bodySchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(20_000),
});

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers)) return json(403, "Cross-origin request refused.");

  const session = await getSession();
  if (!session) return json(401, "Sign in again to continue.");
  const { user } = session;

  const limit = await consumeRateLimit(`chat:user:${user.id}`, 20, 60_000);
  if (!limit.allowed) return json(429, "Slow down: 20 messages a minute at most.");

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return json(400, "Message must be 1 to 20,000 characters.");
  }

  const provider = getChatProvider();
  if (!provider.isConfigured()) {
    return json(503, "Jody Core is offline: ANTHROPIC_API_KEY isn't set on the server.");
  }

  let conversationId = body.conversationId;
  if (conversationId) {
    if (!(await getConversation(user.id, conversationId))) return json(404, "Conversation not found.");
  } else {
    conversationId = await createConversation(user.id, body.message);
  }
  await addMessage(conversationId, { role: "user", content: body.message });

  const [history, settings] = await Promise.all([getMessages(user.id, conversationId), getSettings()]);
  const turns = toTranscript((history ?? []).map((m) => ({ role: m.role, content: m.content })));
  const system = buildSystemPrompt({
    userName: user.name,
    timezone: settings.timezone,
    instructions: settings.aiInstructions,
    now: new Date(),
  });

  const encoder = new TextEncoder();
  const convId = conversationId;
  const started = Date.now();

  let clientGone = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      clientGone = true;
    },
    async start(controller) {
      // Writing to a stream the client has abandoned throws; the work still finishes and is saved.
      const send = (event: ChatEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          clientGone = true;
        }
      };
      send({ type: "meta", conversationId: convId });

      let text = "";
      let done: { model: string; stopReason: string | null; inputTokens: number | null; outputTokens: number | null } | null =
        null;
      try {
        for await (const event of provider.streamChat({
          model: settings.aiModel,
          effort: settings.aiEffort,
          system,
          turns,
          signal: request.signal,
        })) {
          if (event.type === "text") {
            text += event.text;
            send({ type: "text", text: event.text });
          } else {
            done = event;
          }
        }

        const refused = done?.stopReason === "refusal";
        if (refused && !text) {
          text = "_Jody Core declined to answer this request._";
          send({ type: "text", text });
        }
        await addMessage(convId, {
          role: "assistant",
          content: text,
          model: done?.model ?? settings.aiModel,
          stopReason: done?.stopReason ?? null,
          inputTokens: done?.inputTokens ?? null,
          outputTokens: done?.outputTokens ?? null,
        });
        await logActivity({
          action: "ai.chat",
          status: refused ? "failure" : "success",
          actor: "ai",
          userId: user.id,
          request: body.message,
          decision: "Answered in chat (no tools in Phase 1)",
          result: text.slice(0, 300),
          error: refused ? "Model declined the request" : null,
          metadata: {
            conversationId: convId,
            model: done?.model,
            stopReason: done?.stopReason,
            inputTokens: done?.inputTokens,
            outputTokens: done?.outputTokens,
            ms: Date.now() - started,
          },
        });
        send({ type: "done", stopReason: done?.stopReason ?? null, model: done?.model ?? settings.aiModel });
      } catch (err) {
        const error = err instanceof AiProviderError ? err : new AiProviderError("unknown", "The AI request failed unexpectedly.");
        // Keep whatever streamed before the failure, so the transcript matches what was shown.
        if (text) {
          await addMessage(convId, { role: "assistant", content: text, model: settings.aiModel, stopReason: error.code });
        }
        await logActivity({
          action: "ai.chat",
          status: error.code === "aborted" ? "info" : "failure",
          actor: "ai",
          userId: user.id,
          request: body.message,
          error: error.message,
          metadata: { conversationId: convId, code: error.code, ms: Date.now() - started },
        });
        if (error.code !== "aborted") send({ type: "error", message: error.message });
      } finally {
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
