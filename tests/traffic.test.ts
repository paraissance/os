import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessSites, businesses, siteTraffic } from "@/lib/db/schema";
import { dayKey } from "@/lib/format";
import { loadTraffic, recordVisit } from "@/lib/traffic";
import { daysEnding, fromOwnSite, isBot, siteHosts } from "@/lib/traffic-model";
import { useTestDatabase } from "./helpers/db";

const browser = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

describe("who counts as a visit", () => {
  it("only real browsers on the business's own site", () => {
    const hosts = siteHosts(["https://www.leads.example.com/", "leads.example.com", null, "not a url"]);
    expect([...hosts].sort()).toEqual(["leads.example.com", "www.leads.example.com"]);
    expect(fromOwnSite("https://leads.example.com", hosts)).toBe(true);
    expect(fromOwnSite("https://www.leads.example.com", hosts)).toBe(true);
    expect(fromOwnSite("https://jodyos.example.app", hosts)).toBe(false);
    expect(fromOwnSite(null, hosts)).toBe(false);
    expect(isBot(browser)).toBe(false);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot(null)).toBe(true);
  });

  it("puts each visit on the owner's calendar day", () => {
    const late = new Date("2026-10-16T03:30:00Z");
    expect(dayKey(late, "UTC")).toBe("2026-10-16");
    expect(dayKey(late, "America/Los_Angeles")).toBe("2026-10-15");
    expect(daysEnding("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("traffic counts", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let id = "";
  const now = new Date("2026-10-15T12:00:00Z");
  const visit = (over: Partial<Parameters<typeof recordVisit>[0]> = {}) =>
    recordVisit({ slug: "example-leads", origin: "https://www.leads.example.com", userAgent: browser, firstToday: true, now, ...over });

  beforeAll(async () => {
    ctx = await useTestDatabase();
    [{ id }] = await ctx.db.insert(businesses).values({ slug: "example-leads", name: "Example Leads", websiteUrl: "https://leads.example.com" }).returning({ id: businesses.id });
    await ctx.db.insert(businessSites).values({ businessId: id, domain: "leads.example.com" });
  });
  afterAll(() => ctx.close());

  it("adds page views per day, and a visitor only for a browser's first page that day", async () => {
    expect(await visit()).toBe(true);
    expect(await visit({ firstToday: false })).toBe(true);
    expect(await visit({ firstToday: false, now: new Date("2026-10-15T18:00:00Z") })).toBe(true);
    expect(await visit({ now: new Date("2026-10-14T09:00:00Z") })).toBe(true);
    // Not counted: someone else's site, a crawler, a business JodyOS doesn't have.
    expect(await visit({ origin: "https://copycat.example" })).toBe(false);
    expect(await visit({ userAgent: "Googlebot/2.1" })).toBe(false);
    expect(await visit({ slug: "nobody" })).toBe(false);

    const rows = await ctx.db.select().from(siteTraffic);
    expect(rows.map((r) => [r.day, r.visitors, r.views]).sort()).toEqual([
      ["2026-10-14", 1, 1],
      ["2026-10-15", 1, 3],
    ]);
  });

  it("shows the last 30 days with empty days filled, against the 30 before", async () => {
    await ctx.db.insert(siteTraffic).values({ businessId: id, day: "2026-09-01", views: 10, visitors: 4, lastVisitAt: new Date("2026-09-01T10:00:00Z") });
    const t = await loadTraffic(id, now, "UTC");
    expect(t.days).toHaveLength(30);
    expect(t.days.at(-1)).toEqual({ date: "2026-10-15", visitors: 1, views: 3 });
    expect(t.days.at(-3)).toEqual({ date: "2026-10-13", visitors: 0, views: 0 });
    expect(t.last30).toEqual({ visitors: 2, views: 4 });
    expect(t.previous30).toEqual({ visitors: 4, views: 10 });
    expect(t.today).toEqual({ visitors: 1, views: 3 });
    expect(t.lastVisitAt?.toISOString()).toBe("2026-10-15T18:00:00.000Z");
  });
});
