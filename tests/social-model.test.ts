import { describe, expect, it } from "vitest";
import { toPost } from "@/lib/blotato";
import {
  byPlatform,
  calendarDays,
  channelKey,
  groupByDay,
  normalizeMetrics,
  parseChannelKey,
  profileUrl,
  suggestChannels,
  topPosts,
  totals,
  type Channel,
} from "@/lib/social-model";

const ch = (accountId: string, platform: string, name: string, handle: string | null = null, subaccountId = ""): Channel => ({ accountId, subaccountId, platform, name, handle });

const channels: Channel[] = [
  ch("1", "instagram", "@example_leads", "example_leads"),
  ch("2", "twitter", "@ExmplLeads", "ExmplLeads"),
  ch("3", "pinterest", "@xmplelds", "xmplelds"),
  ch("4", "youtube", "Sam Rivers (Example Leads)"),
  ch("5", "facebook", "Example Leads", null, "9000001"),
  ch("5", "facebook", "Other Brand", null, "9000002"),
  ch("6", "tiktok", "@exl_leads", "exl_leads"),
  ch("7", "instagram", "@otherbrand", "otherbrand"),
];

describe("matching accounts to a business", () => {
  it("ticks the accounts that look like the business, and not the others", () => {
    const business = {
      name: "Example Leads",
      slug: "ex-leads",
      links: [
        { url: "https://www.tiktok.com/@exl_leads", kind: "social" },
        { url: "https://www.facebook.com/9000001", kind: "social" },
        { url: "https://example.com/about", kind: "page" },
      ],
    };
    const keys = suggestChannels(business, channels);
    expect([...keys].sort()).toEqual(["1:", "2:", "3:", "4:", "5:9000001", "6:"].sort());
  });

  it("keys channels and reads keys back, refusing anything odd", () => {
    expect(channelKey({ accountId: "5", subaccountId: "9000001" })).toBe("5:9000001");
    expect(parseChannelKey("5:9000001")).toEqual({ accountId: "5", subaccountId: "9000001" });
    expect(parseChannelKey("5:")).toEqual({ accountId: "5", subaccountId: "" });
    expect(parseChannelKey("5:<script>")).toBeNull();
  });

  it("links to the profile when it can", () => {
    expect(profileUrl({ platform: "instagram", handle: "example_leads", subaccountId: "" })).toBe("https://www.instagram.com/example_leads/");
    expect(profileUrl({ platform: "tiktok", handle: "@exl_leads", subaccountId: "" })).toBe("https://www.tiktok.com/@exl_leads");
    expect(profileUrl({ platform: "facebook", handle: null, subaccountId: "9000001" })).toBe("https://www.facebook.com/9000001");
    expect(profileUrl({ platform: "youtube", handle: null, subaccountId: "" })).toBeNull();
  });
});

describe("numbers", () => {
  it("boils Blotato's metric names down and ignores junk", () => {
    expect(normalizeMetrics({ viewsCount: "120", likesCount: "4", commentsCount: "1", sharesCount: "0", reachCount: "90" })).toEqual({ views: 120, likes: 4, comments: 1, shares: 0, reach: 90 });
    expect(normalizeMetrics({ playsCount: "33", repliesCount: "2" })).toEqual({ views: 33, comments: 2 });
    expect(normalizeMetrics({ viewsCount: "lots", likesCount: "-3" })).toBeNull();
    expect(normalizeMetrics({})).toBeNull();
    expect(normalizeMetrics(null)).toBeNull();
  });

  it("adds up posts, by platform, and picks the top ones", () => {
    const posts = [
      { platform: "instagram", metrics: { views: 100, likes: 5 } },
      { platform: "instagram", metrics: { views: 50, comments: 2 } },
      { platform: "tiktok", metrics: { views: 300, likes: 1 } },
      { platform: "facebook", metrics: null },
    ];
    expect(totals(posts)).toEqual({ posts: 4, views: 450, likes: 6, comments: 2, shares: 0 });
    expect(byPlatform(posts).map((p) => [p.platform, p.posts, p.views])).toEqual([
      ["instagram", 2, 150],
      ["tiktok", 1, 300],
      ["facebook", 1, 0],
    ]);
    expect(topPosts(posts, 2).map((p) => p.metrics?.views)).toEqual([300, 100]);
  });
});

describe("calendar", () => {
  const now = new Date("2026-10-15T09:00:00Z");
  const at = (iso: string) => ({ postTime: new Date(iso) });

  it("counts posts per day in the owner's time zone, starting today", () => {
    const days = calendarDays([at("2026-10-15T12:00:00Z"), at("2026-10-16T03:00:00Z"), at("2026-10-17T10:00:00Z")], now, "America/Los_Angeles", 4);
    // 03:00 UTC on the 16th is still the evening of the 15th in Los Angeles.
    expect(days.map((d) => [d.key, d.count])).toEqual([
      ["2026-10-15", 2],
      ["2026-10-16", 0],
      ["2026-10-17", 1],
      ["2026-10-18", 0],
    ]);
    expect(calendarDays([at("2026-10-16T03:00:00Z")], now, "UTC", 2).map((d) => d.count)).toEqual([0, 1]);
  });

  it("does not skip or repeat a day when the clocks change", () => {
    const keys = calendarDays([], new Date("2026-10-24T12:00:00Z"), "Europe/London", 3).map((d) => d.key);
    expect(keys).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("groups posts by day in order", () => {
    const groups = groupByDay([at("2026-10-15T10:00:00Z"), at("2026-10-15T11:00:00Z"), at("2026-10-16T10:00:00Z")], "UTC");
    expect(groups.map((g) => [g.key, g.posts.length])).toEqual([
      ["2026-10-15", 2],
      ["2026-10-16", 1],
    ]);
  });
});

describe("reading Blotato posts", () => {
  const base = { id: "p1", postTime: "2026-10-15T10:00:00.000Z", platform: "instagram", text: "Hello", mediaUrls: ["https://cdn.example/a.jpg"], account: { id: 1, name: "ex" } };

  it("reads scheduled, published and failed posts", () => {
    expect(toPost({ ...base, state: { type: "scheduled" } })).toMatchObject({ id: "p1", accountId: "1", subaccountId: "", status: "scheduled", mediaCount: 1, metrics: null });
    const published = toPost({
      ...base,
      account: { id: "5", name: "Login", subaccount: { id: "9000001", name: "Example Leads" } },
      state: { type: "published", postUrl: "https://instagram.com/p/abc", analytics: { latest: { fetchedAt: "2026-10-15T11:00:00Z", metrics: { viewsCount: "12" } } } },
    });
    expect(published).toMatchObject({ subaccountId: "9000001", accountName: "Example Leads", postUrl: "https://instagram.com/p/abc", metrics: { views: 12 } });
    expect(toPost({ ...base, state: { type: "failed", errorMessage: "Token expired" } })).toMatchObject({ status: "failed", errorMessage: "Token expired" });
  });

  it("drops unsafe links and skips posts it can't read", () => {
    expect(toPost({ ...base, state: { type: "published", postUrl: "javascript:alert(1)" } })?.postUrl).toBeNull();
    expect(toPost({ ...base, postTime: "not a date", state: { type: "scheduled" } })).toBeNull();
    expect(toPost({ ...base, state: { type: "draft" } })).toBeNull();
    expect(toPost("nonsense")).toBeNull();
  });
});
