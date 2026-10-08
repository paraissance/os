import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { generateSessionToken, hashToken, normalizeEmail, safeEqual } from "@/lib/auth/tokens";
import {
  SESSION_TTL_MS,
  createSession,
  listActiveSessions,
  revokeOtherSessions,
  revokeSession,
  validateSessionToken,
} from "@/lib/auth/sessions";
import { sessions, users } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery stapler", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-123"), hashPassword("same-password-123")]);
    expect(a).not.toBe(b);
  });

  it("rejects malformed or tampered hashes instead of throwing", async () => {
    const hash = await hashPassword("tamper-check-password");
    const parts = hash.split("$");
    const flipped = Buffer.from(parts[5], "base64");
    flipped[0] ^= 0xff;
    parts[5] = flipped.toString("base64");
    expect(await verifyPassword("tamper-check-password", parts.join("$"))).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$0$8$1$AAAA$AAAA")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$AAAA$AAAA")).toBe(false);
  });

  it("enforces length rules", () => {
    expect(validatePasswordStrength("short")).toMatch(/at least 12/);
    expect(validatePasswordStrength("a".repeat(201))).toMatch(/at most 200/);
    expect(validatePasswordStrength("twelve chars")).toBeNull();
  });
});

describe("tokens", () => {
  it("generates unique 256-bit URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateSessionToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes deterministically and compares safely", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(safeEqual("setup-token-value", "setup-token-value")).toBe(true);
    expect(safeEqual("setup-token-value", "setup-token-valuf")).toBe(false);
    expect(safeEqual("short", "longer-value")).toBe(false);
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Jody@Example.COM ")).toBe("jody@example.com");
  });
});

describe("sessions (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let userId: string;

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const [u] = await ctx.db
      .insert(users)
      .values({ email: "owner@example.com", name: "Owner", passwordHash: "x" })
      .returning({ id: users.id });
    userId = u.id;
  });
  afterAll(() => ctx.close());

  it("stores only the token hash and resolves the user from the raw token", async () => {
    const { token } = await createSession(userId, { ip: "1.2.3.4", userAgent: "vitest" });
    const rows = await ctx.db.select().from(sessions);
    expect(rows.some((r) => r.id === token)).toBe(false);
    expect(rows.some((r) => r.id === hashToken(token))).toBe(true);

    const session = await validateSessionToken(token);
    expect(session?.user).toEqual({ id: userId, email: "owner@example.com", name: "Owner", role: "owner" });
  });

  it("rejects unknown, empty and oversized tokens", async () => {
    expect(await validateSessionToken(generateSessionToken())).toBeNull();
    expect(await validateSessionToken("")).toBeNull();
    expect(await validateSessionToken("a".repeat(500))).toBeNull();
  });

  it("expires sessions and deletes them on sight", async () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const { token } = await createSession(userId, {}, start);
    expect(await validateSessionToken(token, new Date(start.getTime() + SESSION_TTL_MS - 1000))).not.toBeNull();
    expect(await validateSessionToken(token, new Date(start.getTime() + SESSION_TTL_MS + 1000))).toBeNull();
    const left = await ctx.db.select().from(sessions).where(eq(sessions.id, hashToken(token)));
    expect(left).toHaveLength(0);
  });

  it("revokes one session, or every other session", async () => {
    const a = await createSession(userId);
    const b = await createSession(userId);
    const c = await createSession(userId);
    await revokeSession(hashToken(a.token));
    expect(await validateSessionToken(a.token)).toBeNull();

    const removed = await revokeOtherSessions(userId, hashToken(b.token));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await validateSessionToken(b.token)).not.toBeNull();
    expect(await validateSessionToken(c.token)).toBeNull();
    const active = await listActiveSessions(userId);
    expect(active.map((s) => s.id)).toEqual([hashToken(b.token)]);
  });

  it("drops sessions when the user is deleted", async () => {
    const [u2] = await ctx.db
      .insert(users)
      .values({ email: "temp@example.com", name: "Temp", passwordHash: "x" })
      .returning({ id: users.id });
    const { token } = await createSession(u2.id);
    await ctx.db.delete(users).where(eq(users.id, u2.id));
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("enforces one account per email", async () => {
    await expect(
      ctx.db.insert(users).values({ email: "owner@example.com", name: "Dup", passwordHash: "x" }),
    ).rejects.toThrow();
  });
});
