import "server-only";
import { and, asc, desc, eq, gte, lt, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { fetchPosts as fetchFromBlotato, type BlotatoPost, type PostWindow } from "@/lib/blotato";
import { getDb } from "@/lib/db";
import { businesses, settings, socialAccounts, socialPosts, type SocialPostStatus } from "@/lib/db/schema";
import { channelKey, type Channel, type PostRow } from "@/lib/social-model";

/*
 * Social media, the stored part: which Blotato accounts belong to which
 * business, and JodyOS's copy of the posts. Blotato takes ~35 ms per post,
 * so posts are copied here in the background (syncBlotato) and the page
 * reads them from the database.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Older than this, a visit to the page starts a refresh in the background. */
export const STALE_MS = 10 * MINUTE;
/** A refresh that hasn't finished after this is considered dead. */
const LOCK_MS = 5 * MINUTE;
/** Published and failed posts are kept this long. */
const KEEP_MS = 90 * DAY;

/* ─── Brands ──────────────────────────────────────────────────────── */

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type Brand = { business: { id: string; slug: string; name: string }; accounts: SocialAccount[] };

/** The businesses with linked accounts, in the dashboard's order. */
export async function listBrands(): Promise<Brand[]> {
  const db = await getDb();
  const rows = await db
    .select({ account: socialAccounts, business: { id: businesses.id, slug: businesses.slug, name: businesses.name } })
    .from(socialAccounts)
    .innerJoin(businesses, eq(socialAccounts.businessId, businesses.id))
    .orderBy(asc(businesses.sortOrder), asc(businesses.name), asc(socialAccounts.platform), asc(socialAccounts.name));
  const brands = new Map<string, Brand>();
  for (const r of rows) {
    const brand = brands.get(r.business.id) ?? { business: r.business, accounts: [] };
    brand.accounts.push(r.account);
    brands.set(r.business.id, brand);
  }
  return [...brands.values()];
}

/**
 * Sets a business's accounts. An account belongs to one business, so
 * choosing one here takes it away from any other.
 */
export async function setBrandAccounts(businessId: string, channels: Channel[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(socialAccounts).where(eq(socialAccounts.businessId, businessId));
    for (const c of channels) {
      await tx.delete(socialAccounts).where(and(eq(socialAccounts.accountId, c.accountId), eq(socialAccounts.subaccountId, c.subaccountId)));
    }
    if (channels.length) {
      await tx.insert(socialAccounts).values(
        channels.map((c) => ({ businessId, accountId: c.accountId, subaccountId: c.subaccountId, platform: c.platform, name: c.name, handle: c.handle })),
      );
    }
  });
}

/** Which business each account is linked to, by channel key. */
export async function linkedChannelOwners(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.select({ accountId: socialAccounts.accountId, subaccountId: socialAccounts.subaccountId, businessId: socialAccounts.businessId }).from(socialAccounts);
  return new Map(rows.map((r) => [channelKey(r), r.businessId]));
}

/* ─── Refreshing from Blotato ─────────────────────────────────────── */

const SYNC_KEY = "social.blotato";

export type SyncState = {
  lastSyncAt?: string;
  lastFullAt?: string;
  /** Success or not: a failed refresh isn't retried on every visit. */
  lastAttemptAt?: string;
  runningSince?: string | null;
  lastError?: string | null;
  lastCount?: number;
};

export async function getSyncState(): Promise<SyncState> {
  const db = await getDb();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SYNC_KEY)).limit(1);
  return row && typeof row.value === "object" && row.value !== null ? (row.value as SyncState) : {};
}

export function isRunning(state: SyncState, now: Date) {
  return Boolean(state.runningSince && now.getTime() - Date.parse(state.runningSince) < LOCK_MS);
}

export function isStale(state: SyncState, now: Date) {
  const last = state.lastAttemptAt ?? state.lastSyncAt;
  return !last || now.getTime() - Date.parse(last) > STALE_MS;
}

/** Marks a refresh as running, unless one already is. False when another refresh holds the lock. */
async function acquire(now: Date): Promise<SyncState | null> {
  const db = await getDb();
  await db.insert(settings).values({ key: SYNC_KEY, value: {}, updatedAt: now }).onConflictDoNothing();
  const cutoff = new Date(now.getTime() - LOCK_MS).toISOString();
  const rows = await db
    .update(settings)
    .set({ value: sql`${settings.value} || ${JSON.stringify({ runningSince: now.toISOString() })}::jsonb`, updatedAt: now })
    .where(
      and(
        eq(settings.key, SYNC_KEY),
        sql`(coalesce(${settings.value}->>'runningSince', '') = '' or (${settings.value}->>'runningSince')::timestamptz < ${cutoff}::timestamptz)`,
      ),
    )
    .returning({ value: settings.value });
  return rows.length ? (rows[0].value as SyncState) : null;
}

async function release(state: SyncState, now: Date) {
  const db = await getDb();
  await db.update(settings).set({ value: { ...state, runningSince: null }, updatedAt: now }).where(eq(settings.key, SYNC_KEY));
}

/** Which posts to ask for: what's scheduled, recent failures, and published posts (a month once a day, else the last 3 days for fresh numbers). */
export function syncWindows(state: SyncState, now: Date, full: boolean): PostWindow[] {
  const t = now.getTime();
  const fullDue = full || !state.lastFullAt || t - Date.parse(state.lastFullAt) > DAY;
  return [
    { status: "scheduled", since: new Date(t - HOUR), until: new Date(t + 60 * DAY), slices: 4 },
    { status: "failed", since: new Date(t - 30 * DAY), until: new Date(t), slices: 1 },
    fullDue
      ? { status: "published", since: new Date(t - 30 * DAY), until: new Date(t), slices: 10 }
      : { status: "published", since: new Date(t - 3 * DAY), until: new Date(t), slices: 3 },
  ];
}

export type SyncResult = { ok: true; posts: number; full: boolean } | { ok: false; skipped: true } | { ok: false; error: string };

/**
 * Copies posts from Blotato into the database: upserts what came back, drops
 * scheduled posts that are no longer scheduled (and, on a full refresh,
 * published posts that were deleted), and forgets anything older than 90
 * days. Only one refresh runs at a time.
 */
export async function syncBlotato({
  now = new Date(),
  full = false,
  fetchPosts = fetchFromBlotato,
}: { now?: Date; full?: boolean; fetchPosts?: (w: PostWindow[]) => Promise<BlotatoPost[]> } = {}): Promise<SyncResult> {
  const state = await acquire(now);
  if (!state) return { ok: false, skipped: true };
  const windows = syncWindows(state, now, full);
  const isFull = windows.some((w) => w.status === "published" && w.slices === 10);
  try {
    const posts = await fetchPosts(windows);
    const db = await getDb();
    const syncedAt = new Date();

    for (let i = 0; i < posts.length; i += 200) {
      const chunk = posts.slice(i, i + 200).map((p) => ({ ...p, provider: "blotato", syncedAt }));
      await db
        .insert(socialPosts)
        .values(chunk)
        .onConflictDoUpdate({
          target: socialPosts.id,
          set: {
            accountId: sql`excluded.account_id`,
            subaccountId: sql`excluded.subaccount_id`,
            accountName: sql`excluded.account_name`,
            platform: sql`excluded.platform`,
            status: sql`excluded.status`,
            postTime: sql`excluded.post_time`,
            text: sql`excluded.text`,
            mediaCount: sql`excluded.media_count`,
            postUrl: sql`excluded.post_url`,
            errorMessage: sql`excluded.error_message`,
            // Keep the last numbers when Blotato hasn't fetched new ones.
            metrics: sql`coalesce(excluded.metrics, ${socialPosts.metrics})`,
            metricsAt: sql`coalesce(excluded.metrics_at, ${socialPosts.metricsAt})`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    // Whatever a window asked for and didn't get back is gone (moved, deleted or published).
    for (const w of windows) {
      if (w.status === "published" && !isFull) continue;
      const ids = posts.filter((p) => p.status === w.status).map((p) => p.id);
      // A month with nothing published across every account is far likelier a Blotato hiccup than real: keep what we have.
      if (w.status === "published" && !ids.length) continue;
      await db
        .delete(socialPosts)
        .where(and(eq(socialPosts.status, w.status), gte(socialPosts.postTime, w.since), lte(socialPosts.postTime, w.until), ids.length ? notInArray(socialPosts.id, ids) : undefined));
    }
    // Scheduled for the past but not seen since: it was published or failed under another id.
    await db.delete(socialPosts).where(and(eq(socialPosts.status, "scheduled"), lt(socialPosts.postTime, new Date(now.getTime() - HOUR))));
    await db.delete(socialPosts).where(lt(socialPosts.postTime, new Date(now.getTime() - KEEP_MS)));

    await release(
      {
        ...state,
        lastSyncAt: now.toISOString(),
        lastAttemptAt: now.toISOString(),
        lastFullAt: isFull ? now.toISOString() : state.lastFullAt,
        lastError: null,
        lastCount: posts.length,
      },
      new Date(),
    );
    return { ok: true, posts: posts.length, full: isFull };
  } catch (e) {
    const message = e instanceof Error ? e.message : "The refresh failed.";
    await release({ ...state, lastAttemptAt: now.toISOString(), lastError: message }, new Date());
    return { ok: false, error: message };
  }
}

/* ─── Reading a brand's posts ─────────────────────────────────────── */

function forAccounts(accounts: Pick<SocialAccount, "accountId" | "subaccountId">[]): SQL | undefined {
  if (!accounts.length) return sql`false`;
  return or(...accounts.map((a) => and(eq(socialPosts.accountId, a.accountId), eq(socialPosts.subaccountId, a.subaccountId))));
}

const rowColumns = {
  id: socialPosts.id,
  platform: socialPosts.platform,
  status: socialPosts.status,
  postTime: socialPosts.postTime,
  text: socialPosts.text,
  accountName: socialPosts.accountName,
  postUrl: socialPosts.postUrl,
  errorMessage: socialPosts.errorMessage,
  metrics: socialPosts.metrics,
  mediaCount: socialPosts.mediaCount,
};

/** Everything the brand page sums up: what's scheduled, and the last 30 days published and failed. */
export async function brandPosts(accounts: SocialAccount[], now: Date): Promise<{ scheduled: PostRow[]; published: PostRow[]; failed: PostRow[] }> {
  const db = await getDb();
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const mine = forAccounts(accounts);
  const [scheduled, published, failed] = await Promise.all([
    db.select(rowColumns).from(socialPosts).where(and(mine, eq(socialPosts.status, "scheduled"), gte(socialPosts.postTime, now))).orderBy(asc(socialPosts.postTime)).limit(500),
    db.select(rowColumns).from(socialPosts).where(and(mine, eq(socialPosts.status, "published"), gte(socialPosts.postTime, monthAgo))).orderBy(desc(socialPosts.postTime)),
    db.select(rowColumns).from(socialPosts).where(and(mine, eq(socialPosts.status, "failed"), gte(socialPosts.postTime, monthAgo))).orderBy(desc(socialPosts.postTime)),
  ]);
  return { scheduled, published, failed };
}

export const PAGE_SIZE = 30;

/** One page of every post JodyOS keeps for the brand, newest first (scheduled ones soonest first). */
export async function brandPostPage(accounts: SocialAccount[], status: SocialPostStatus | null, page: number) {
  const db = await getDb();
  const where = and(forAccounts(accounts), status ? eq(socialPosts.status, status) : undefined);
  const [rows, [{ count }]] = await Promise.all([
    db
      .select(rowColumns)
      .from(socialPosts)
      .where(where)
      .orderBy(status === "scheduled" ? asc(socialPosts.postTime) : desc(socialPosts.postTime))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(socialPosts).where(where),
  ]);
  return { rows, total: Number(count) };
}

