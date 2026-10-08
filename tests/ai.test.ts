import { describe, expect, it } from "vitest";
import { buildSystemPrompt, toTranscript } from "@/lib/ai/system-prompt";
import { AI_MODELS, DEFAULT_MODEL, isKnownModel } from "@/lib/ai/models";

describe("system prompt", () => {
  const base = { userName: "Jody", timezone: "Europe/Madrid", instructions: "", now: new Date("2026-10-08T12:00:00Z") };

  it("states the no-tools limits and today's date in the user's time zone", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("You are Jody Core");
    expect(prompt).toMatch(/no tools or integrations yet/);
    expect(prompt).toMatch(/Never claim or imply that you checked/);
    // ICU versions differ on the comma after the weekday.
    expect(prompt).toMatch(/Today is Thursday,? 8 October 2026 \(Europe\/Madrid\)\./);
  });

  it("adds standing instructions only when set", () => {
    expect(buildSystemPrompt(base)).not.toContain("Standing instructions");
    expect(buildSystemPrompt({ ...base, instructions: "  Answer in Spanish.  " })).toContain(
      "Standing instructions from Jody:\nAnswer in Spanish.",
    );
  });

  it("keeps the stable part first so prompt caching can reuse it", () => {
    const a = buildSystemPrompt(base);
    const b = buildSystemPrompt({ ...base, now: new Date("2026-10-09T12:00:00Z") });
    const firstDiff = [...a].findIndex((ch, i) => ch !== b[i]);
    expect(firstDiff).toBeGreaterThan(a.indexOf("Today is"));
  });
});

describe("transcript", () => {
  it("starts with a user turn, merges same-role neighbours and drops blanks", () => {
    expect(
      toTranscript([
        { role: "assistant", content: "orphan" },
        { role: "user", content: "first" },
        { role: "user", content: "retry" },
        { role: "assistant", content: "  " },
        { role: "assistant", content: "answer" },
      ]),
    ).toEqual([
      { role: "user", content: "first\n\nretry" },
      { role: "assistant", content: "answer" },
    ]);
  });

  it("keeps only the most recent turns and still starts with the user", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `m${i}`,
    }));
    const out = toTranscript(history, 3);
    expect(out[0]).toEqual({ role: "user", content: "m8" });
    expect(out).toHaveLength(2);
  });
});

describe("models", () => {
  it("defaults to Claude Opus 5.5 and knows the offered models", () => {
    expect(DEFAULT_MODEL).toBe("claude-opus-5-5");
    expect(AI_MODELS.map((m) => m.id)).toContain(DEFAULT_MODEL);
    expect(isKnownModel("gpt-4")).toBe(false);
  });
});
