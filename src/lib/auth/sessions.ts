import "server-only";
import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { generateSessionToken, hashToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "owner";
};

export type ValidSession = {
  sessionId: string;
  expiresAt: Date;
  user: SessionUser;
};

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
  now = new Date(),
) {
  const db = await getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    lastSeenAt: now,
    ip: meta.ip?.slice(0, 64) ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string, now = new Date()): Promise<ValidSession | null> {
  if (!token || token.length > 200) return null;
  const db = await getDb();
  const id = hashToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      user: { id: users.id, email: users.email, name: users.name, role: users.role },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  }
  return { sessionId: row.sessionId, expiresAt: row.expiresAt, user: row.user };
}

export async function revokeSession(sessionId: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  const db = await getDb();
  const removed = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
    .returning({ id: sessions.id });
  return removed.length;
}

export async function listActiveSessions(userId: string, now = new Date()) {
  const db = await getDb();
  return db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastSeenAt));
}

export async function deleteExpiredSessions(now = new Date()) {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
