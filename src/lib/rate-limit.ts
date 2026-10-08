import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  /** When the current window ends. */
  resetAt: Date;
};

/**
 * Fixed-window counter stored in Postgres, so it holds across serverless
 * instances (an in-memory counter would reset on every cold start).
 * One atomic upsert per call: no read-then-write race.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<RateLimitResult> {
  const db = await getDb();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - windowMs).toISOString();
  const expired = sql`${rateLimits.windowStart} <= ${cutoffIso}::timestamptz`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN ${nowIso}::timestamptz ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  return {
    allowed: row.count <= limit,
    count: row.count,
    limit,
    resetAt: new Date(row.windowStart.getTime() + windowMs),
  };
}

export async function resetRateLimit(key: string) {
  const db = await getDb();
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}

export function minutesUntil(date: Date, now = new Date()) {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 60_000));
}
