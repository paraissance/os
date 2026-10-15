import type { NextRequest } from "next/server";
import { answer, cleanTurns } from "@/lib/agent-engine";
import { getAgentBySlug } from "@/lib/agents";
import { answerOnce } from "@/lib/ai/anthropic";
import { envStatus } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/security";
import { getSettings } from "@/lib/settings";

/*
 * Public on purpose: visitors on the businesses' websites chat here. Each
 * visitor gets 20 messages per agent per 10 minutes, and each agent at most
 * 300 AI answers a day; past that it still answers from its starter and
 * keyword answers. Visitor messages are not stored.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PER_VISITOR = { limit: 20, windowMs: 10 * 60_000 };
const AI_PER_DAY = 300;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[slug]/ask">) {
  const { slug } = await ctx.params;
  const raw = await req.text();
  if (raw.length > 20_000) return reply({ answer: "That message is too long.", actions: [] }, 413);
  let body: { message?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return reply({ answer: "I didn't catch that. Please try again.", actions: [] }, 400);
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1500) : "";

  const agent = await getAgentBySlug(slug);
  if (!agent) return reply({ answer: "This assistant isn't available.", actions: [] }, 404);
  if (!message) return reply({ answer: agent.language.startsWith("es") ? "¿En qué te ayudo?" : "What would you like to know?", actions: [] });

  const visitor = await consumeRateLimit(`agent:${slug}:${clientIp(req.headers)}`, PER_VISITOR.limit, PER_VISITOR.windowMs);
  if (!visitor.allowed) {
    return reply({ answer: "You've sent a lot of messages in a short time. Please give it a few minutes.", actions: [] }, 429);
  }

  const settings = await getSettings();
  const ai = envStatus().anthropic
    ? async (system: string, turns: { role: "user" | "assistant"; content: string }[]) => {
        // Only spend from the daily allowance when the AI is actually asked.
        const today = await consumeRateLimit(`agent-ai:${slug}`, AI_PER_DAY, 24 * 60 * 60_000);
        if (!today.allowed) return null;
        return answerOnce({ model: settings.aiModel, system, turns, signal: req.signal });
      }
    : null;

  const result = await answer(agent, message, cleanTurns(body.history), ai);
  return reply(result);
}
