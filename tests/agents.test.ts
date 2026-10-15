import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentsFileSchema, languageName, profileName } from "@/lib/agent-input";
import { importAgents, listAgents } from "@/lib/agents";
import { businesses } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

const agent = (over: Record<string, unknown> = {}) => ({
  business: "example-leads",
  name: "Example Leads Assistant",
  tagline: "Leads for agents",
  language: "en",
  safetyProfile: "coaching_us",
  colors: { brand: "#123456", accent: "not-a-colour" },
  cta: { label: "Book a call", url: "https://example.com/book" },
  greeting: "Hi! Ask me anything about Example Leads.",
  note: "General info only.",
  starters: [{ question: "What do you do?", answer: "We find leads.", link: { label: "More", url: "https://example.com" } }],
  keywords: [{ words: ["lead", "leads"], answer: "We find leads.", link: { label: "More", url: "javascript:alert(1)" } }],
  fallbackLinks: [
    { label: "Home", url: "https://example.com" },
    { label: "Bad", url: "ftp://example.com" },
  ],
  knowledge: "# EXAMPLE\nWe find leads. https://example.com",
  instructions: "You are the Example Leads Assistant.",
  crisis: { answer: "Call 988.", actions: [{ label: "Call 988", url: "tel:988" }] },
  shortcode: '[osa_assistant business="example-leads"]',
  ...over,
});

const file = (agents: unknown[]) => ({ format: "jodyos-agents", version: 1, agents });

describe("agents file", () => {
  it("reads an agent and drops what isn't safe or valid, instead of failing", () => {
    const parsed = agentsFileSchema.parse(file([agent()]));
    const a = parsed.agents[0];
    expect(a.colors).toEqual({ brand: "#123456", accent: null });
    expect(a.keywords[0].link).toBeNull(); // javascript: link dropped
    expect(a.fallbackLinks.map((l) => l.label)).toEqual(["Home"]); // ftp link dropped
    expect(a.crisis?.actions).toEqual([{ label: "Call 988", url: "tel:988" }]);
  });

  it("refuses other files and unknown shapes", () => {
    expect(agentsFileSchema.safeParse({ ...file([agent()]), format: "jodyos-businesses" }).success).toBe(false);
    expect(agentsFileSchema.safeParse(file([agent({ business: "Not A Slug!" })])).success).toBe(false);
    expect(agentsFileSchema.safeParse(file([agent({ name: "" })])).success).toBe(false);
    expect(agentsFileSchema.parse(file([agent({ crisis: { answer: "x", actions: [{ label: "Bad", url: "tel:abc" }] } })])).agents[0].crisis).toBeNull();
  });

  it("names languages and safety profiles plainly", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("es")).toBe("Spanish");
    expect(profileName("coaching_us")).toBe("Coaching rules (US)");
    expect(profileName(null)).toBe("Standard rules");
  });
});

describe("agents (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  beforeAll(async () => {
    ctx = await useTestDatabase();
    await ctx.db.insert(businesses).values([
      { slug: "example-leads", name: "Example Leads", sortOrder: 1 },
      { slug: "first-brand", name: "First Brand", sortOrder: 0 },
    ]);
  });
  afterAll(() => ctx.close());

  it("puts each agent on its business, skips unknown ones, and updates on a new import", async () => {
    const first = agentsFileSchema.parse(file([agent(), agent({ business: "first-brand", name: "First Brand Assistant" }), agent({ business: "nobody" })]));
    expect(await importAgents(first)).toEqual({ saved: ["Example Leads", "First Brand"], unknown: ["nobody"] });

    let list = await listAgents();
    expect(list.map((a) => [a.business.slug, a.name])).toEqual([
      ["first-brand", "First Brand Assistant"],
      ["example-leads", "Example Leads Assistant"],
    ]);
    expect(list[1].starters[0].question).toBe("What do you do?");

    await importAgents(agentsFileSchema.parse(file([agent({ greeting: "Hello again.", crisis: null })])));
    list = await listAgents();
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ greeting: "Hello again.", crisis: null });
  });

  it("goes with its business", async () => {
    await ctx.db.delete(businesses);
    expect(await listAgents()).toEqual([]);
  });
});
