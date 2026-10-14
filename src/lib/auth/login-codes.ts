import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginCodes, users } from "@/lib/db/schema";
import { hashToken, normalizeEmail, safeEqual } from "./tokens";

/*
 * Signing in with a 6-digit code sent by email, for people a super admin has
 * added. One live code per person: asking again replaces it. A code works
 * once, expires after CODE_TTL_MS and allows MAX_CODE_ATTEMPTS tries; every
 * try is counted before the code is compared, so parallel guesses can't skip
 * the limit.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** The code is tied to its user, so the same digits hash differently for everyone. */
function codeHash(userId: string, code: string) {
  return hashToken(`login-code:${userId}:${code}`);
}

/**
 * A fresh code for whoever signs in with this email, replacing any earlier
 * one. Null when nobody with that email can sign in.
 */
export async function issueLoginCode(email: string, now = new Date()) {
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!user) return null;
  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await db.transaction(async (tx) => {
    await tx.delete(loginCodes).where(eq(loginCodes.userId, user.id));
    await tx.insert(loginCodes).values({ userId: user.id, codeHash: codeHash(user.id, code), expiresAt, createdAt: now });
  });
  return { user, code, expiresAt };
}

export type CodeCheck = { ok: true; userId: string } | { ok: false; reason: "wrong" | "expired" | "too_many" };

export async function verifyLoginCode(email: string, code: string, now = new Date()): Promise<CodeCheck> {
  const db = await getDb();
  const [row] = await db
    .select({ id: loginCodes.id, userId: loginCodes.userId, codeHash: loginCodes.codeHash, expiresAt: loginCodes.expiresAt })
    .from(loginCodes)
    .innerJoin(users, eq(loginCodes.userId, users.id))
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!row) return { ok: false, reason: "wrong" };

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.delete(loginCodes).where(eq(loginCodes.id, row.id));
    return { ok: false, reason: "expired" };
  }

  // Count this try first; when no try is left, the code is gone.
  const [counted] = await db
    .update(loginCodes)
    .set({ attempts: sql`${loginCodes.attempts} + 1` })
    .where(and(eq(loginCodes.id, row.id), lt(loginCodes.attempts, MAX_CODE_ATTEMPTS)))
    .returning({ attempts: loginCodes.attempts });
  if (!counted) {
    await db.delete(loginCodes).where(eq(loginCodes.id, row.id));
    return { ok: false, reason: "too_many" };
  }

  if (!/^\d{6}$/.test(code) || !safeEqual(codeHash(row.userId, code), row.codeHash)) {
    if (counted.attempts >= MAX_CODE_ATTEMPTS) {
      await db.delete(loginCodes).where(eq(loginCodes.id, row.id));
      return { ok: false, reason: "too_many" };
    }
    return { ok: false, reason: "wrong" };
  }

  // Works once: only the request that deletes it signs in.
  const used = await db.delete(loginCodes).where(eq(loginCodes.id, row.id)).returning({ id: loginCodes.id });
  return used.length ? { ok: true, userId: row.userId } : { ok: false, reason: "wrong" };
}
