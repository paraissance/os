import type { PostMetrics, SocialPostStatus } from "@/lib/db/schema";
import { dayKey } from "@/lib/format";

/*
 * Social media, the pure part: Blotato's numbers made tidy, which accounts
 * look like a business's, and the totals, platforms and days the Social
 * Media page shows. No database or network code here.
 */

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  twitter: "X",
  pinterest: "Pinterest",
  threads: "Threads",
  bluesky: "Bluesky",
  other: "Other",
};

export function platformLabel(platform: string) {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

/* ─── Accounts ────────────────────────────────────────────────────── */

/** Something a brand can post to: an account, or a Facebook/LinkedIn page under one. */
export type Channel = {
  accountId: string;
  /** "" when the account itself posts. */
  subaccountId: string;
  platform: string;
  /** "@handle" or the page/profile name. */
  name: string;
  handle: string | null;
};

export function channelKey(c: Pick<Channel, "accountId" | "subaccountId">) {
  return `${c.accountId}:${c.subaccountId}`;
}

export function parseChannelKey(key: string): { accountId: string; subaccountId: string } | null {
  const m = /^([A-Za-z0-9_-]{1,64}):([A-Za-z0-9_-]{0,64})$/.exec(key);
  return m ? { accountId: m[1], subaccountId: m[2] } : null;
}

/** Where the profile or page lives, when it can be worked out. */
export function profileUrl(c: Pick<Channel, "platform" | "handle" | "subaccountId">): string | null {
  const h = c.handle?.replace(/^@/, "");
  switch (c.platform) {
    case "instagram":
      return h ? `https://www.instagram.com/${h}/` : null;
    case "tiktok":
      return h ? `https://www.tiktok.com/@${h}` : null;
    case "twitter":
      return h ? `https://x.com/${h}` : null;
    case "threads":
      return h ? `https://www.threads.net/@${h}` : null;
    case "pinterest":
      return h ? `https://www.pinterest.com/${h}/` : null;
    case "bluesky":
      return h ? `https://bsky.app/profile/${h}` : null;
    case "facebook":
      return c.subaccountId ? `https://www.facebook.com/${c.subaccountId}` : null;
    case "linkedin":
      return c.subaccountId ? `https://www.linkedin.com/company/${c.subaccountId}/` : null;
    default:
      return null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Without vowels, so "AgntBrokerCoach" and "agntbrkrcch" still meet "Agent Broker Coach". */
const skeleton = (s: string) => norm(s).replace(/[aeiou]/g, "");

/** The handle or id at the end of a profile address: instagram.com/name/ → "name", facebook.com/123 → "123". */
function lastSegment(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts.at(-1);
    return last ? decodeURIComponent(last).replace(/^@/, "") : null;
  } catch {
    return null;
  }
}

/**
 * The channels that look like this business's: same name, a handle or page id
 * from its saved social links, or the same letters without vowels. A
 * suggestion only: the owner ticks what is really theirs.
 */
export function suggestChannels(business: { name: string; slug: string; links: { url: string; kind: string }[] }, channels: Channel[]): Set<string> {
  const handles = business.links.filter((l) => l.kind === "social").flatMap((l) => lastSegment(l.url) ?? []);
  const names = [business.name, business.slug, ...handles].map(norm).filter((n) => n.length >= 4);
  const skeletons = [business.name, ...handles].map(skeleton).filter((s) => s.length >= 5);
  const ids = new Set(handles.filter((h) => /^\d+$/.test(h)));

  const out = new Set<string>();
  for (const c of channels) {
    if (c.subaccountId && ids.has(c.subaccountId)) {
      out.add(channelKey(c));
      continue;
    }
    // "Nica Marie (Done For You Leads)": the part in brackets counts as a name too.
    const bracket = /\(([^)]+)\)\s*$/.exec(c.name)?.[1];
    const candidates = [c.handle, c.name, bracket].filter((x): x is string => Boolean(x));
    const hit = candidates.some((x) => names.includes(norm(x)) || (skeleton(x).length >= 5 && skeletons.includes(skeleton(x))));
    if (hit) out.add(channelKey(c));
  }
  return out;
}

/* ─── Numbers ─────────────────────────────────────────────────────── */

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Blotato's per-platform metric names, boiled down to views, likes, comments, shares and reach. */
export function normalizeMetrics(raw: Record<string, unknown> | null | undefined): PostMetrics | null {
  if (!raw) return null;
  const pick = (...keys: string[]) => keys.map((k) => num(raw[k])).find((v) => v !== undefined);
  const m: PostMetrics = {
    views: pick("viewsCount", "playsCount", "impressionsCount"),
    likes: pick("likesCount", "pinterestReactionsCount"),
    comments: pick("commentsCount", "repliesCount"),
    shares: pick("sharesCount", "twitterRetweetsCount", "threadsRepostsCount", "blueskyRepostsCount"),
    reach: pick("reachCount"),
  };
  for (const k of Object.keys(m) as (keyof PostMetrics)[]) if (m[k] === undefined) delete m[k];
  return Object.keys(m).length ? m : null;
}

/** A post as the page uses it. */
export type PostRow = {
  id: string;
  platform: string;
  status: SocialPostStatus;
  postTime: Date;
  text: string;
  accountName: string | null;
  postUrl: string | null;
  errorMessage: string | null;
  metrics: PostMetrics | null;
  mediaCount: number;
};

export type Totals = { posts: number; views: number; likes: number; comments: number; shares: number };

export function totals(posts: Pick<PostRow, "metrics">[]): Totals {
  const t: Totals = { posts: posts.length, views: 0, likes: 0, comments: 0, shares: 0 };
  for (const p of posts) {
    t.views += p.metrics?.views ?? 0;
    t.likes += p.metrics?.likes ?? 0;
    t.comments += p.metrics?.comments ?? 0;
    t.shares += p.metrics?.shares ?? 0;
  }
  return t;
}

/** Published posts per platform with their totals, busiest first. */
export function byPlatform(posts: Pick<PostRow, "platform" | "metrics">[]): (Totals & { platform: string })[] {
  const groups = new Map<string, Pick<PostRow, "metrics">[]>();
  for (const p of posts) groups.set(p.platform, [...(groups.get(p.platform) ?? []), p]);
  return [...groups].map(([platform, list]) => ({ platform, ...totals(list) })).sort((a, b) => b.posts - a.posts || b.views - a.views);
}

/** The posts seen most, then liked most. Posts with no numbers yet are left out. */
export function topPosts<T extends Pick<PostRow, "metrics">>(posts: T[], n = 5): T[] {
  return posts
    .filter((p) => (p.metrics?.views ?? 0) + (p.metrics?.likes ?? 0) + (p.metrics?.comments ?? 0) > 0)
    .sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0) || (b.metrics?.likes ?? 0) - (a.metrics?.likes ?? 0))
    .slice(0, n);
}

/** Posts grouped by day in a time zone, in the order given. */
export function groupByDay<T extends Pick<PostRow, "postTime">>(posts: T[], timeZone: string): { key: string; posts: T[] }[] {
  const groups: { key: string; posts: T[] }[] = [];
  for (const p of posts) {
    const key = dayKey(p.postTime, timeZone);
    const last = groups.at(-1);
    if (last?.key === key) last.posts.push(p);
    else groups.push({ key, posts: [p] });
  }
  return groups;
}
