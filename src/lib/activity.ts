import "server-only";
import { and, desc, eq, gte, like, lt, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { activityLogs, type ActivityStatus } from "@/lib/db/schema";
import { redactSecrets, truncate } from "./redact";

export type ActivityInput = {
  action: string;
  status: ActivityStatus;
  userId?: string | null;
  actor?: "user" | "system" | "ai";
  request?: string | null;
  decision?: string | null;
  tool?: string | null;
  result?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append to the audit trail. Never throws: a logging failure must not break
 * the action being logged. Free text is truncated and metadata is passed
 * through redactSecrets(), so passwords and tokens can't land in the log.
 */
export async function logActivity(entry: ActivityInput) {
  try {
    const db = await getDb();
    await db.insert(activityLogs).values({
      action: entry.action.slice(0, 100),
      status: entry.status,
      userId: entry.userId ?? null,
      actor: entry.actor ?? "user",
      request: truncate(entry.request, 4000),
      decision: truncate(entry.decision, 2000),
      tool: truncate(entry.tool, 200),
      result: truncate(entry.result, 2000),
      error: truncate(entry.error, 2000),
      metadata: entry.metadata ? (redactSecrets(entry.metadata) as Record<string, unknown>) : null,
    });
  } catch (err) {
    console.error("[activity] failed to write log entry:", err instanceof Error ? err.message : "unknown error");
  }
}

export type ActivityFilter = {
  status?: ActivityStatus;
  /** Matches an action or a dotted prefix, e.g. "auth" matches "auth.login". */
  action?: string;
  before?: Date;
  limit?: number;
};

export async function listActivity(filter: ActivityFilter = {}) {
  const db = await getDb();
  const where: SQL[] = [];
  if (filter.status) where.push(eq(activityLogs.status, filter.status));
  if (filter.action) {
    const escaped = filter.action.replace(/[\\%_]/g, (c) => `\\${c}`);
    where.push(sql`(${activityLogs.action} = ${filter.action} OR ${like(activityLogs.action, `${escaped}.%`)})`);
  }
  if (filter.before) where.push(lt(activityLogs.createdAt, filter.before));
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);

  return db
    .select()
    .from(activityLogs)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

export async function activitySummary(since: Date) {
  const db = await getDb();
  const rows = await db
    .select({ status: activityLogs.status, count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(gte(activityLogs.createdAt, since))
    .groupBy(activityLogs.status);
  const summary: Record<ActivityStatus, number> = { success: 0, failure: 0, pending: 0, info: 0 };
  for (const r of rows) summary[r.status] = Number(r.count);
  return summary;
}
