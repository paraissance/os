import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { activityLogs, conversations, messages, settings, users } from "@/lib/db/schema";
import type { ChatProvider, ChatRequest, ChatStreamEvent } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";
import type { ValidSession } from "@/lib/auth/sessions";
import { useTestDatabase } from "./helpers/db";

// --- Test doubles: the signed-in session and the AI provider. Everything else is real. ---
let currentSession: ValidSession | null = null;
vi.mock("@/lib/auth/current-user", () => ({
  getSession: async () => currentSession,
}));

let configured = true;
let script: (req: ChatRequest) => AsyncIterable<ChatStreamEvent>;
const calls: ChatRequest[] = [];
const fakeProvider: ChatProvider = {
  id: "fake",
  label: "Fake",
  isConfigured: () => configured,
  streamChat: (req) => {
    calls.push(req);
    return script(req);
  },
};
vi.mock("@/lib/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai")>()),
  getChatProvider: () => fakeProvider,
}));

const { POST } = await import("@/app/api/chat/route");

function chatRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://os.test/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://os.test", "x-forwarded-host": "os.test", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readEvents(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { type: string; [k: string]: unknown });
}

async function* reply(parts: string[], stopReason = "end_turn"): AsyncIterable<ChatStreamEvent> {
  for (const text of parts) yield { type: "text", text };
  yield { type: "done", model: "claude-opus-5-5", stopReason, inputTokens: 12, outputTokens: 34 };
}

describe("POST /api/chat", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let owner: ValidSession;
  let other: ValidSession;

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const [a, b] = await ctx.db
      .insert(users)
      .values([
        { email: "jody@os.test", name: "Jody", passwordHash: "x" },
        { email: "other@os.test", name: "Other", passwordHash: "x" },
      ])
      .returning();
    const s = (u: typeof a): ValidSession => ({
      sessionId: `s-${u.id}`,
      expiresAt: new Date(Date.now() + 1e9),
      user: { id: u.id, email: u.email, name: u.name, role: "owner" },
    });
    owner = s(a);
    other = s(b);
    await ctx.db.insert(settings).values({
      key: "app",
      value: { timezone: "Europe/Madrid", aiModel: "claude-sonnet-5-5", aiEffort: "high", aiInstructions: "Answer in Spanish." },
    });
  });
  afterAll(() => ctx.close());

  beforeEach(() => {
    currentSession = owner;
    configured = true;
    calls.length = 0;
    script = () => reply(["Hola", " Jody"]);
  });

  it("refuses cross-origin requests", async () => {
    const res = await POST(chatRequest({ message: "hi" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("requires a session", async () => {
    currentSession = null;
    const res = await POST(chatRequest({ message: "hi" }));
    expect(res.status).toBe(401);
  });

  it("validates the body", async () => {
    for (const body of ["not json", { message: "" }, { message: "x".repeat(20_001) }, { message: "hi", conversationId: "nope" }]) {
      expect((await POST(chatRequest(body))).status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });

  it("says plainly when the AI isn't configured", async () => {
    configured = false;
    const res = await POST(chatRequest({ message: "hi" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("streams a reply, then saves both turns and an audit entry", async () => {
    const res = await POST(chatRequest({ message: "  What should I do today?  " }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const events = await readEvents(res);
    expect(events.map((e) => e.type)).toEqual(["meta", "text", "text", "done"]);
    const conversationId = events[0].conversationId as string;

    const [conv] = await ctx.db.select().from(conversations).where(eq(conversations.id, conversationId));
    expect(conv).toMatchObject({ userId: owner.user.id, title: "What should I do today?" });
    const saved = await ctx.db.select().from(messages).where(eq(messages.conversationId, conversationId));
    expect(saved.map((m) => [m.role, m.content])).toEqual([
      ["user", "What should I do today?"],
      ["assistant", "Hola Jody"],
    ]);
    expect(saved[1]).toMatchObject({ model: "claude-opus-5-5", stopReason: "end_turn", inputTokens: 12, outputTokens: 34 });

    // Settings flow into the request: model, effort, time zone and standing instructions.
    expect(calls[0]).toMatchObject({ model: "claude-sonnet-5-5", effort: "high" });
    expect(calls[0].system).toContain("Standing instructions from Jody:\nAnswer in Spanish.");
    expect(calls[0].system).toContain("(Europe/Madrid)");
    expect(calls[0].turns).toEqual([{ role: "user", content: "What should I do today?" }]);

    const logs = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, "ai.chat"));
    expect(logs.at(-1)).toMatchObject({ status: "success", actor: "ai", userId: owner.user.id });
  });

  it("continues a conversation with its full history", async () => {
    const first = await readEvents(await POST(chatRequest({ message: "First question" })));
    const conversationId = first[0].conversationId as string;
    await readEvents(await POST(chatRequest({ message: "Follow-up", conversationId })));
    expect(calls[1].turns).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "Hola Jody" },
      { role: "user", content: "Follow-up" },
    ]);
  });

  it("won't touch another user's conversation", async () => {
    const first = await readEvents(await POST(chatRequest({ message: "Private" })));
    currentSession = other;
    const res = await POST(chatRequest({ message: "Let me in", conversationId: first[0].conversationId }));
    expect(res.status).toBe(404);
    const saved = await ctx.db.select().from(messages).where(eq(messages.content, "Let me in"));
    expect(saved).toHaveLength(0);
  });

  it("keeps the partial answer and reports a provider failure", async () => {
    script = async function* () {
      yield { type: "text", text: "Partial" };
      throw new AiProviderError("overloaded", "Anthropic is overloaded right now. Try again shortly.");
    };
    const events = await readEvents(await POST(chatRequest({ message: "Will fail" })));
    expect(events.map((e) => e.type)).toEqual(["meta", "text", "error"]);
    expect(events[2].message).toMatch(/overloaded/);
    const saved = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, events[0].conversationId as string));
    expect(saved.map((m) => [m.role, m.content, m.stopReason])).toEqual([
      ["user", "Will fail", null],
      ["assistant", "Partial", "overloaded"],
    ]);
    const logs = await ctx.db.select().from(activityLogs).where(eq(activityLogs.status, "failure"));
    expect(logs.some((l) => l.action === "ai.chat" && /overloaded/.test(l.error ?? ""))).toBe(true);
  });

  it("marks a declined request instead of showing an empty answer", async () => {
    script = () => reply([], "refusal");
    const events = await readEvents(await POST(chatRequest({ message: "Something declined" })));
    expect(events.map((e) => e.type)).toEqual(["meta", "text", "done"]);
    expect(events[1].text).toMatch(/declined/);
    expect(events[2].stopReason).toBe("refusal");
  });

  it("rate-limits each user to 20 messages a minute", async () => {
    currentSession = other;
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await POST(chatRequest({ message: `m${i}` }));
      statuses.push(res.status);
      await res.text();
    }
    // `other` already used 1 request in the ownership test above.
    expect(statuses.filter((s) => s === 200)).toHaveLength(19);
    expect(statuses.at(-1)).toBe(429);
  });
});
