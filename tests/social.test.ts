import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BlotatoPost, PostWindow } from "@/lib/blotato";
import { businesses, socialPosts } from "@/lib/db/schema";
import { brandPostPage, brandPosts, getSyncState, isRunning, isStale, listBrands, setBrandAccounts, syncBlotato, syncWindows } from "@/lib/social";
import type { Channel } from "@/lib/social-model";
import { useTestDatabase } from "./helpers/db";

const DAY = 86_400_000;
const now = new Date("2026-10-15T12:00:00Z");

function post(id: string, over: Partial<BlotatoPost> = {}): BlotatoPost {
  return {
    id,
    accountId: "1",
    subaccountId: "",
    accountName: "@example_leads",
    platform: "instagram",
    status: "published",
    postTime: new Date(now.getTime() - DAY),
    text: `Post ${id}`,
    mediaCount: 0,
    postUrl: null,
    errorMessage: null,
    metrics: { views: 10, likes: 1 },
    metricsAt: now,
    ...over,
  };
}

/** A pretend Blotato that answers each window with the posts inside it. */
function fakeBlotato(all: BlotatoPost[]) {
  const asked: PostWindow[][] = [];
  const fetchPosts = async (windows: PostWindow[]) => {
    asked.push(windows);
    return all.filter((p) => windows.some((w) => w.status === p.status && p.postTime >= w.since && p.postTime <= w.until));
  };
  return { fetchPosts, asked };
}

const insta: Channel = { accountId: "1", subaccountId: "", platform: "instagram", name: "@example_leads", handle: "example_leads" };
const page: Channel = { accountId: "5", subaccountId: "9000001", platform: "facebook", name: "Example Leads", handle: null };
const otherPage: Channel = { accountId: "5", subaccountId: "9000002", platform: "facebook", name: "Other Brand", handle: null };

describe("social media (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let leadsId: string;
  let otherId: string;

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const rows = await ctx.db
      .insert(businesses)
      .values([
        { slug: "example-leads", name: "Example Leads", sortOrder: 0 },
        { slug: "other-brand", name: "Other Brand", sortOrder: 1 },
      ])
      .returning({ id: businesses.id });
    [leadsId, otherId] = rows.map((r) => r.id);
  });
  afterAll(() => ctx.close());

  it("links accounts to a brand, one brand per account", async () => {
    await setBrandAccounts(leadsId, [insta, page, otherPage]);
    await setBrandAccounts(otherId, [otherPage]); // moves the page
    const brands = await listBrands();
    expect(brands.map((b) => [b.business.slug, b.accounts.map((a) => a.name).sort()])).toEqual([
      ["example-leads", ["@example_leads", "Example Leads"]],
      ["other-brand", ["Other Brand"]],
    ]);
  });

  it("refreshes: a month at first, then the last few days; only one at a time", async () => {
    expect(syncWindows({}, now, false).find((w) => w.status === "published")?.since.getTime()).toBe(now.getTime() - 30 * DAY);
    expect(syncWindows({ lastFullAt: new Date(now.getTime() - DAY / 2).toISOString() }, now, false).find((w) => w.status === "published")?.since.getTime()).toBe(
      now.getTime() - 3 * DAY,
    );

    const blotato = fakeBlotato([
      post("a"),
      post("b", { accountId: "5", subaccountId: "9000001", platform: "facebook", accountName: "Example Leads", metrics: { views: 40 } }),
      post("c", { accountId: "5", subaccountId: "9000002", platform: "facebook" }), // the other brand's page
      post("d", { status: "scheduled", postTime: new Date(now.getTime() + 2 * DAY) }),
      post("e", { status: "failed", errorMessage: "Token expired", metrics: null }),
      post("old", { postTime: new Date(now.getTime() - 40 * DAY) }), // outside every window
    ]);
    const result = await syncBlotato({ now, fetchPosts: blotato.fetchPosts });
    expect(result).toEqual({ ok: true, posts: 5, full: true });

    const state = await getSyncState();
    expect(state.lastSyncAt).toBe(now.toISOString());
    expect(isRunning(state, now)).toBe(false);
    expect(isStale(state, now)).toBe(false);
    expect(isStale(state, new Date(now.getTime() + 11 * 60_000))).toBe(true);

    const [leads] = await listBrands();
    const mine = await brandPosts(leads.accounts, now);
    expect(mine.scheduled.map((p) => p.id)).toEqual(["d"]);
    expect(mine.published.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(mine.failed.map((p) => [p.id, p.errorMessage])).toEqual([["e", "Token expired"]]);
  });

  it("keeps old numbers when Blotato has none, and drops what is no longer scheduled", async () => {
    const later = new Date(now.getTime() + 15 * 60_000);
    const blotato = fakeBlotato([post("a", { metrics: null, metricsAt: null }), post("f", { status: "scheduled", postTime: new Date(now.getTime() + 3 * DAY) })]);
    const result = await syncBlotato({ now: later, fetchPosts: blotato.fetchPosts });
    expect(result).toMatchObject({ ok: true, full: false });

    const rows = await ctx.db.select().from(socialPosts);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("a")?.metrics).toEqual({ views: 10, likes: 1 });
    expect(byId.has("d")).toBe(false); // was scheduled, isn't any more
    expect(byId.get("f")?.status).toBe("scheduled");
    expect(byId.has("e")).toBe(false); // the failure is gone from Blotato's last 30 days
  });

  it("won't run two refreshes at once, and records a failure without retrying on every visit", async () => {
    const slow = new Date(now.getTime() + 30 * 60_000);
    let release!: () => void;
    const stillScheduled = [post("f", { status: "scheduled", postTime: new Date(now.getTime() + 3 * DAY) })];
    const first = syncBlotato({ now: slow, fetchPosts: () => new Promise<BlotatoPost[]>((r) => (release = () => r(stillScheduled))) });
    await new Promise((r) => setTimeout(r, 50));
    expect(await syncBlotato({ now: slow, fetchPosts: async () => [] })).toEqual({ ok: false, skipped: true });
    release();
    await first;

    const failAt = new Date(now.getTime() + 60 * 60_000);
    const failed = await syncBlotato({ now: failAt, fetchPosts: async () => Promise.reject(new Error("Blotato asked JodyOS to slow down.")) });
    expect(failed).toEqual({ ok: false, error: "Blotato asked JodyOS to slow down." });
    const state = await getSyncState();
    expect(state.lastError).toBe("Blotato asked JodyOS to slow down.");
    expect(isStale(state, new Date(failAt.getTime() + 60_000))).toBe(false);
  });

  it("lists a brand's posts a page at a time, by status", async () => {
    const [leads] = await listBrands();
    const all = await brandPostPage(leads.accounts, null, 1);
    expect(all.total).toBe(3); // a, b and f; c belongs to the other brand
    const scheduled = await brandPostPage(leads.accounts, "scheduled", 1);
    expect(scheduled.rows.map((r) => r.id)).toEqual(["f"]);
    expect((await brandPostPage(leads.accounts, null, 2)).rows).toEqual([]);
  });

  it("forgets a brand's accounts when the business is deleted", async () => {
    await ctx.db.delete(businesses);
    expect(await listBrands()).toEqual([]);
  });
});
