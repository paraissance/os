import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeRateLimit } from "@/lib/rate-limit";
import { activitySummary, listActivity, logActivity } from "@/lib/activity";
import { redactSecrets, scrubText, truncate } from "@/lib/redact";
import { clientIp, isSameOrigin, safeNextPath } from "@/lib/security";
import { EnvError, parseEnv } from "@/lib/env";
import { activityLogs } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });

describe("rate limiting (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  beforeAll(async () => (ctx = await useTestDatabase()));
  afterAll(() => ctx.close());

  it("allows up to the limit, blocks after, and resets when the window passes", async () => {
    const t0 = new Date("2026-03-01T10:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit("login:ip:9.9.9.9", 3, 60_000, t0));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].count).toBe(4);
    expect(results[3].resetAt.toISOString()).toBe("2026-03-01T10:01:00.000Z");

    const later = new Date(t0.getTime() + 61_000);
    const fresh = await consumeRateLimit("login:ip:9.9.9.9", 3, 60_000, later);
    expect(fresh).toMatchObject({ allowed: true, count: 1 });
  });

  it("keeps keys independent", async () => {
    const t = new Date("2026-03-02T10:00:00Z");
    await consumeRateLimit("k:a", 1, 60_000, t);
    expect((await consumeRateLimit("k:a", 1, 60_000, t)).allowed).toBe(false);
    expect((await consumeRateLimit("k:b", 1, 60_000, t)).allowed).toBe(true);
  });
});

describe("activity log (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  beforeAll(async () => (ctx = await useTestDatabase()));
  afterAll(() => ctx.close());

  it("writes entries with secrets redacted and filters by status and action prefix", async () => {
    await logActivity({
      action: "auth.login",
      status: "success",
      metadata: { email: "a@b.c", password: "hunter2hunter2", nested: { apiKey: "sk-ant-abc" } },
    });
    await logActivity({ action: "auth.login_failed", status: "failure", error: "Invalid password" });
    await logActivity({ action: "ai.chat", status: "success", actor: "ai", request: "hello" });
    await logActivity({ action: "authx.other", status: "info" });

    const all = await ctx.db.select().from(activityLogs);
    expect(all).toHaveLength(4);
    const login = all.find((r) => r.action === "auth.login")!;
    expect(login.metadata).toEqual({ email: "a@b.c", password: "[redacted]", nested: { apiKey: "[redacted]" } });
    expect(JSON.stringify(all)).not.toContain("hunter2");

    const auth = await listActivity({ action: "auth" });
    expect(auth.map((r) => r.action).sort()).toEqual(["auth.login", "auth.login_failed"]);
    const failures = await listActivity({ status: "failure" });
    expect(failures.map((r) => r.action)).toEqual(["auth.login_failed"]);
    // LIKE wildcards in the filter are literal, not patterns.
    expect(await listActivity({ action: "a%" })).toHaveLength(0);

    const summary = await activitySummary(new Date(Date.now() - 60_000));
    expect(summary).toEqual({ success: 2, failure: 1, pending: 0, info: 1 });
  });

  it("never throws, even for values the database rejects", async () => {
    // status is CHECK-constrained; the insert fails and logActivity swallows it.
    await expect(logActivity({ action: "x", status: "bogus" as never })).resolves.toBeUndefined();
  });
});

describe("redaction", () => {
  it("redacts secret-looking keys at any depth and caps sizes", () => {
    const out = redactSecrets({
      Authorization: "Bearer abc",
      session_id: "s",
      list: Array.from({ length: 80 }, (_, i) => i),
      text: "x".repeat(5000),
      ok: 1,
    }) as Record<string, unknown>;
    expect(out.Authorization).toBe("[redacted]");
    expect(out.session_id).toBe("[redacted]");
    expect((out.list as unknown[]).length).toBe(50);
    expect((out.text as string).length).toBe(2000);
    expect(out.ok).toBe(1);
  });

  it("scrubs credentials from free text", () => {
    const text = scrubText(
      "key sk-ant-api03-ABCDEFGHIJKLMNOP and postgres://user:pa55word@db.host/x and Bearer abcdefghijkl",
    );
    expect(text).not.toContain("ABCDEFGHIJKLMNOP");
    expect(text).not.toContain("pa55word");
    expect(text).not.toContain("abcdefghijkl");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate(null, 4)).toBeNull();
  });
});

describe("request safety", () => {
  it("only allows same-site relative redirect targets", () => {
    expect(safeNextPath("/settings?tab=ai")).toBe("/settings?tab=ai");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, "/login", "/setup", "/a\u0000b"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });

  it("checks Origin against the host", () => {
    expect(isSameOrigin(headers({ origin: "https://os.example.com", host: "os.example.com" }))).toBe(true);
    expect(isSameOrigin(headers({ origin: "https://evil.example", host: "os.example.com" }))).toBe(false);
    expect(isSameOrigin(headers({ host: "os.example.com" }))).toBe(false);
    expect(isSameOrigin(headers({ origin: "null", host: "os.example.com" }))).toBe(false);
    expect(
      isSameOrigin(headers({ origin: "https://os.example.com", host: "internal:3000", "x-forwarded-host": "os.example.com" })),
    ).toBe(true);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(headers({}))).toBe("unknown");
  });
});

describe("environment", () => {
  it("accepts an empty local environment", () => {
    const env = parseEnv({});
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.PGLITE_DATA_DIR).toBe(".data/pglite");
  });

  it("requires DATABASE_URL on Vercel and validates its scheme", () => {
    expect(() => parseEnv({ VERCEL: "1" })).toThrow(EnvError);
    expect(() => parseEnv({ DATABASE_URL: "mysql://x" })).toThrow(/postgres/);
    expect(parseEnv({ VERCEL: "1", DATABASE_URL: "postgresql://u:p@h/db" }).DATABASE_URL).toBe("postgresql://u:p@h/db");
  });

  it("checks the sender address for sign-in code emails", () => {
    expect(parseEnv({ EMAIL_FROM: "JodyOS <login@example.com>" }).EMAIL_FROM).toBe("JodyOS <login@example.com>");
    expect(parseEnv({ EMAIL_FROM: "login@example.com" }).EMAIL_FROM).toBe("login@example.com");
    expect(() => parseEnv({ EMAIL_FROM: "JodyOS" })).toThrow(/EMAIL_FROM/);
  });

  it("rejects a weak setup token without echoing it", () => {
    try {
      parseEnv({ SETUP_TOKEN: "tooshort" });
      throw new Error("expected EnvError");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).not.toContain("tooshort");
    }
  });
});
