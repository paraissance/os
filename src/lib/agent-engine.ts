import type { AgentCrisis, AgentKeyword, AgentLink, AgentStarter } from "@/lib/db/schema";

/*
 * How a website agent answers one message, step by step:
 *   1. a message about a crisis gets the agent's crisis answer (no AI);
 *   2. one of its starter questions gets the saved answer at once;
 *   3. anything else goes to the AI, with the agent's instructions and knowledge;
 *   4. if the AI can't answer: a hello back, a keyword answer, the best
 *      matching lines of its knowledge; failing all that, its links.
 * The AI call is passed in, so this file has no network or database code.
 */

export type AgentBrain = {
  name: string;
  language: string;
  greeting: string;
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
export type AgentReply = { answer: string; actions: AgentLink[]; source: "safety" | "starter" | "ai" | "greeting" | "keyword" | "knowledge" | "links" };

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

const HELLO = /^(hi+|hello|hey|hiya|howdy|yo|hola|buenas|buenos dias|buenas tardes|good (morning|afternoon|evening|day))( there)?$/;
const THANKS = /^(thanks?( you)?( so much)?|thank u|thx|ty|gracias|ok(ay)? thanks?|great thanks?)$/;

// Small words that don't say what the question is about.
const FILLER = new Set(
  "the and you your for are was were what whats how who does did can could with about this that have has from they them will would there their tell any get want need know please more like just some much many when where which why also into than then its it's i'm".split(" "),
);

/**
 * The knowledge lines that share the most words with the question (up to two).
 * shortcut: plain word overlap, not meaning; the AI is the real answer once ANTHROPIC_API_KEY is set.
 */
export function searchKnowledge(knowledge: string, message: string): string[] {
  const asked = [...words(message)].filter((w) => w.length > 2 && !FILLER.has(w));
  if (!asked.length) return [];
  const scored = knowledge
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const has = words(line);
      return { line, score: asked.filter((w) => has.has(w) || has.has(w.replace(/s$/, "")) || has.has(`${w}s`)).length };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score === scored[0]?.score).slice(0, 2).map((s) => s.line);
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

  const spanish = agent.language.startsWith("es");
  const cta = agent.ctaUrl && agent.ctaLabel ? [{ label: agent.ctaLabel, url: agent.ctaUrl }] : [];
  if (HELLO.test(asked)) return { answer: agent.greeting, actions: [], source: "greeting" };
  if (THANKS.test(asked)) {
    return { answer: spanish ? "¡Con gusto! ¿Algo más en lo que te pueda ayudar?" : "You're welcome! Anything else I can help with?", actions: [], source: "greeting" };
  }

  const said = words(message);
  const keyword = agent.keywords.find((k) => k.words.some((w) => normalize(w).split(" ").every((part) => said.has(part))));
  if (keyword) return { answer: keyword.answer, actions: keyword.link ? [keyword.link] : [], source: "keyword" };

  const found = searchKnowledge(agent.knowledge, message);
  if (found.length) return { answer: found.join("\n\n"), actions: cta, source: "knowledge" };

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
