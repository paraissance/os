import type { AgentCrisis, AgentKeyword, AgentLink, AgentStarter } from "@/lib/db/schema";

/*
 * How a website agent answers one message, step by step:
 *   1. a message about a crisis gets the agent's crisis answer (no AI);
 *   2. one of its starter questions gets the saved answer at once;
 *   3. anything else goes to the AI, with the agent's instructions and knowledge;
 *   4. if the AI can't answer, a keyword answer; failing that, its links.
 * The AI call is passed in, so this file has no network or database code.
 */

export type AgentBrain = {
  name: string;
  language: string;
  instructions: string | null;
  knowledge: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  starters: AgentStarter[];
  keywords: AgentKeyword[];
  fallbackLinks: AgentLink[];
  crisis: AgentCrisis | null;
};

export type AgentTurn = { role: "user" | "assistant"; content: string };
export type AgentReply = { answer: string; actions: AgentLink[]; source: "safety" | "starter" | "ai" | "keyword" | "links" };

const CRISIS_TERMS = [
  "suicide",
  "suicidal",
  "kill myself",
  "killing myself",
  "end my life",
  "want to die",
  "take my own life",
  "self harm",
  "self-harm",
  "hurt myself",
  "overdose",
  "suicidio",
  "matarme",
  "quitarme la vida",
];

const DEFAULT_CRISIS: AgentCrisis = {
  answer:
    "It sounds like you may be going through something serious, and I'm not the right kind of help for this.\n\nIn the US, call or text 988 (Suicide & Crisis Lifeline) any time, free and confidential. If you're in immediate danger, call 911.",
  actions: [
    { label: "Call or text 988", url: "tel:988" },
    { label: "Call 911", url: "tel:911" },
  ],
};

/** Lower case, plain letters, single spaces: "Who is Jody?" → "who is jody". */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCrisis(message: string) {
  const m = ` ${message.toLowerCase().replace(/[’`]/g, "'")} `;
  return CRISIS_TERMS.some((t) => m.includes(t));
}

/** The words of a message, for keyword matching on whole words ("leads" doesn't match "pleads"). */
function words(message: string) {
  return new Set(normalize(message).split(" "));
}

/** What the AI is told: the agent's own instructions, then its knowledge as the only source of truth. */
export function systemPrompt(agent: AgentBrain) {
  const instructions =
    agent.instructions?.trim() ||
    [
      `You are the ${agent.name}, the website assistant for this business. You help visitors with information and guide them to the right next step. You are not a licensed professional.`,
      "Never invent prices, dates, guarantees or contact details that aren't in the knowledge base. Don't ask for sensitive personal data.",
      "Reply in the visitor's language. Warm and clear, 5 to 6 short lines at most, no markdown headers, asterisks or bullet symbols.",
      agent.ctaLabel && agent.ctaUrl ? `End with a clear next step. Primary call to action: ${agent.ctaLabel} - ${agent.ctaUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  return `${instructions}\n\nKNOWLEDGE BASE - your ONLY source of truth:\n${agent.knowledge}`;
}

/**
 * The answer to one visitor message. `ai` returns the AI's text, or null when
 * it isn't available or declined; it may also throw, which counts as null.
 */
export async function answer(
  agent: AgentBrain,
  message: string,
  history: AgentTurn[],
  ai: ((system: string, turns: AgentTurn[]) => Promise<string | null>) | null,
): Promise<AgentReply> {
  if (isCrisis(message)) {
    const crisis = agent.crisis ?? DEFAULT_CRISIS;
    return { answer: crisis.answer, actions: crisis.actions, source: "safety" };
  }

  const asked = normalize(message);
  const starter = agent.starters.find((s) => normalize(s.question) === asked);
  if (starter) return { answer: starter.answer, actions: starter.link ? [starter.link] : [], source: "starter" };

  if (ai) {
    let text: string | null = null;
    try {
      text = await ai(systemPrompt(agent), [...history.slice(-6), { role: "user", content: message }]);
    } catch {
      text = null;
    }
    if (text) {
      return { answer: text, actions: agent.ctaUrl && agent.ctaLabel ? [{ label: agent.ctaLabel, url: agent.ctaUrl }] : [], source: "ai" };
    }
  }

  const said = words(message);
  const keyword = agent.keywords.find((k) => k.words.some((w) => normalize(w).split(" ").every((part) => said.has(part))));
  if (keyword) return { answer: keyword.answer, actions: keyword.link ? [keyword.link] : [], source: "keyword" };

  const spanish = agent.language.startsWith("es");
  return {
    answer: spanish ? "No estoy seguro de tener esa respuesta. Esto es en lo que sí te puedo ayudar:" : "I'm not sure I have that one to hand. Here's where I can point you:",
    actions: agent.fallbackLinks,
    source: "links",
  };
}

/** Checks a visitor's message and short history; anything odd is dropped rather than refused. */
export function cleanTurns(raw: unknown): AgentTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-6)
    .flatMap((t): AgentTurn[] => {
      if (!t || typeof t !== "object") return [];
      const { role, content } = t as { role?: unknown; content?: unknown };
      if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return [];
      return [{ role, content: content.slice(0, 1500) }];
    });
}
