import "server-only";
import { z } from "zod";
import { isHttpUrl } from "@/lib/business-input";
import type { SocialPostStatus } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { normalizeMetrics, type Channel } from "@/lib/social-model";

/*
 * Blotato's REST API (https://backend.blotato.com/v2), read-only: the
 * connected accounts and pages, and posts (scheduled, published, failed)
 * with their latest numbers. The key stays on the server and never appears
 * in an error message.
 */

export type BlotatoErrorCode = "not_configured" | "unauthorized" | "rate_limited" | "unreachable" | "bad_response";

export class BlotatoError extends Error {
  constructor(
    readonly code: BlotatoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BlotatoError";
  }
}

const BASE = "https://backend.blotato.com/v2";

async function request<T>(path: string, schema: z.ZodType<T>, timeoutMs = 45_000): Promise<T> {
  const key = env().BLOTATO_API_KEY;
  if (!key) throw new BlotatoError("not_configured", "Blotato isn't connected yet: add BLOTATO_API_KEY in Vercel.");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "blotato-api-key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new BlotatoError("unreachable", "Couldn't reach Blotato.");
  }
  if (res.status === 401 || res.status === 403) throw new BlotatoError("unauthorized", "Blotato rejected the API key. Check BLOTATO_API_KEY in Vercel.");
  if (res.status === 429) throw new BlotatoError("rate_limited", "Blotato asked JodyOS to slow down. Try again in a minute.");
  if (!res.ok) throw new BlotatoError("unreachable", `Blotato answered HTTP ${res.status}.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new BlotatoError("bad_response", "Blotato sent something that isn't JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BlotatoError("bad_response", "Blotato sent data in a shape JodyOS doesn't recognise.");
  return parsed.data;
}

const id = z.union([z.string().min(1).max(64), z.number().int()]).transform(String);
const text = z.string().nullish().transform((v) => v ?? null);

/* ─── Accounts ────────────────────────────────────────────────────── */

const accountsSchema = z.object({
  items: z.array(z.object({ id, platform: z.string().min(1).max(40), fullname: text, username: text })),
});
const subaccountsSchema = z.object({ items: z.array(z.object({ id, name: text })) });

/**
 * Everything a brand can post to. Facebook logins post to their pages (the
 * login itself only when it has none); LinkedIn posts to a profile and to
 * company pages.
 */
export async function listChannels(): Promise<Channel[]> {
  const { items } = await request("/users/me/accounts", accountsSchema);
  const out = await Promise.all(
    items.map(async (a): Promise<Channel[]> => {
      const own: Channel = {
        accountId: a.id,
        subaccountId: "",
        platform: a.platform,
        name: a.username ? `@${a.username}` : a.fullname || `${a.platform} ${a.id}`,
        handle: a.username,
      };
      if (a.platform !== "facebook" && a.platform !== "linkedin") return [own];
      const pages = (await request(`/users/me/accounts/${encodeURIComponent(a.id)}/subaccounts`, subaccountsSchema)).items.map(
        (p): Channel => ({ accountId: a.id, subaccountId: p.id, platform: a.platform, name: p.name || `Page ${p.id}`, handle: null }),
      );
      if (a.platform === "facebook") return pages.length ? pages : [own];
      return [own, ...pages];
    }),
  );
  return out.flat();
}

/* ─── Posts ───────────────────────────────────────────────────────── */

const postSchema = z.object({
  id,
  postTime: z.string(),
  platform: z.string().min(1).max(40),
  text,
  mediaUrls: z.array(z.string()).nullish(),
  account: z.object({ id, name: text, subaccount: z.object({ id, name: text }).nullish() }),
  state: z.object({
    type: z.enum(["scheduled", "published", "failed"]),
    postUrl: text,
    errorMessage: text,
    analytics: z
      .object({ latest: z.object({ fetchedAt: text, metrics: z.record(z.string(), z.unknown()).nullish() }).nullish() })
      .nullish(),
  }),
});
const postsPageSchema = z.object({ items: z.array(z.unknown()), cursor: text });

/** A post as JodyOS keeps it. */
export type BlotatoPost = {
  id: string;
  accountId: string;
  subaccountId: string;
  accountName: string | null;
  platform: string;
  status: SocialPostStatus;
  postTime: Date;
  text: string;
  mediaCount: number;
  postUrl: string | null;
  errorMessage: string | null;
  metrics: ReturnType<typeof normalizeMetrics>;
  metricsAt: Date | null;
};

export function toPost(raw: unknown): BlotatoPost | null {
  const p = postSchema.safeParse(raw);
  if (!p.success) return null;
  const { data } = p;
  const time = new Date(data.postTime);
  if (Number.isNaN(time.getTime())) return null;
  const latest = data.state.analytics?.latest;
  const metricsAt = latest?.fetchedAt ? new Date(latest.fetchedAt) : null;
  return {
    id: data.id,
    accountId: data.account.id,
    subaccountId: data.account.subaccount?.id ?? "",
    accountName: data.account.subaccount?.name || data.account.name,
    platform: data.platform,
    status: data.state.type,
    postTime: time,
    text: (data.text ?? "").slice(0, 10_000),
    mediaCount: data.mediaUrls?.length ?? 0,
    // Only real web links are kept, so nothing else can end up in an href.
    postUrl: data.state.postUrl && isHttpUrl(data.state.postUrl) ? data.state.postUrl : null,
    errorMessage: data.state.errorMessage ? data.state.errorMessage.slice(0, 1000) : null,
    metrics: normalizeMetrics(latest?.metrics),
    metricsAt: metricsAt && !Number.isNaN(metricsAt.getTime()) ? metricsAt : null,
  };
}

/** One window, every page of it (250 at a time). Blotato takes ~35 ms per post, so windows are kept small. */
async function postsIn(status: SocialPostStatus, since: Date, until: Date): Promise<BlotatoPost[]> {
  const out: BlotatoPost[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page++) {
    const q = new URLSearchParams({ status, since: since.toISOString(), until: until.toISOString(), limit: "250" });
    if (cursor) q.set("cursor", cursor);
    const body = await request(`/posts?${q}`, postsPageSchema);
    for (const raw of body.items) {
      const post = toPost(raw);
      if (post) out.push(post);
    }
    cursor = body.cursor;
    if (!cursor) break;
  }
  return out;
}

/** Runs tasks with at most `limit` at a time. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

export type PostWindow = { status: SocialPostStatus; since: Date; until: Date; slices: number };

/** Several windows of posts, each cut into slices fetched side by side (at most 6 requests at once). */
export async function fetchPosts(windows: PostWindow[]): Promise<BlotatoPost[]> {
  const tasks = windows.flatMap((w) => {
    const width = (w.until.getTime() - w.since.getTime()) / w.slices;
    return Array.from({ length: w.slices }, (_, i) => () => postsIn(w.status, new Date(w.since.getTime() + i * width), new Date(w.since.getTime() + (i + 1) * width)));
  });
  const seen = new Map<string, BlotatoPost>();
  for (const list of await pool(tasks, 6)) for (const p of list) seen.set(p.id, p);
  return [...seen.values()];
}
