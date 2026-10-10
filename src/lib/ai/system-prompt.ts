import type { ChatTurn } from "./types";

type PromptContext = {
  userName: string;
  timezone: string;
  instructions: string;
  now: Date;
};

/**
 * Jody Core's Phase 1 brief. It has no tools yet, so the most important rule
 * is honesty about that: never claim to have checked, posted or changed
 * anything. The stable part comes first so prompt caching can reuse it.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: ctx.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(ctx.now);

  const sections = [
    `You are Jody Core, the coordinating AI of JodyOS: a private operating system that will connect ${ctx.userName}'s businesses, websites, social media, analytics, tools and automations into one place.`,
    [
      "Current capabilities (Phase 1):",
      "- You can talk, plan, draft and reason with the user.",
      "- You have no tools or integrations yet. You cannot check websites, read analytics, look at deployments, post to social media, send messages or change anything outside this chat.",
      "- When a request needs one of those, say plainly that the integration isn't connected yet, then offer what you can do now (a plan, a draft, a checklist).",
      "- Never claim or imply that you checked, fetched, posted, scheduled or changed something. Never invent numbers, statuses, reviews or facts you weren't given.",
    ].join("\n"),
    "Style: direct, practical and brief. Lead with the answer. Use short Markdown lists or headings only when they make the answer easier to scan.",
    "Latency-sensitive; begin your visible answer immediately.",
  ];

  if (ctx.instructions.trim()) {
    sections.push(`Standing instructions from ${ctx.userName}:\n${ctx.instructions.trim()}`);
  }
  sections.push(`Today is ${today} (${ctx.timezone}).`);
  return sections.join("\n\n");
}

/**
 * Turn stored history into a valid Messages API transcript: starts with a
 * user turn, drops empty turns, merges same-role neighbours (e.g. a user
 * message whose reply failed), and keeps the most recent `maxTurns`.
 */
export function toTranscript(history: ChatTurn[], maxTurns = 60): ChatTurn[] {
  const merged: ChatTurn[] = [];
  for (const turn of history) {
    const content = turn.content.trim();
    if (!content) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      merged.push({ role: turn.role, content });
    }
  }
  let recent = merged.slice(-maxTurns);
  while (recent.length && recent[0].role !== "user") recent = recent.slice(1);
  return recent;
}
