import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CODE_TTL_MS, MAX_CODE_ATTEMPTS, generateCode, issueLoginCode, verifyLoginCode } from "@/lib/auth/login-codes";
import { normalizeUsername, usernameFrom, usernameSchema } from "@/lib/auth/usernames";
import { loginCodeMail } from "@/lib/email";
import { loginCodes, users } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

describe("usernames", () => {
  it("are lower-cased and kept to letters, numbers, dots, dashes and underscores", () => {
    expect(normalizeUsername("  Jody ")).toBe("jody");
    expect(usernameSchema.parse("Jody.M_2")).toBe("jody.m_2");
    for (const bad of ["jo", "a b c", "jody@example.com", ".jody", "jody-", "x".repeat(33), ""]) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("can be made from a name", () => {
    expect(usernameFrom("Jody")).toBe("jody");
    expect(usernameFrom("Jody McNamer")).toBe("jodymcnamer");
    expect(usernameFrom("Al")).toBeNull();
  });
});

describe("sign-in code email", () => {
  it("shows the code and when it stops working, and keeps it out of the subject", () => {
    const mail = loginCodeMail("a@example.com", "042917", 10);
    expect(mail.subject).not.toContain("042917");
    expect(mail.text).toContain("042917");
    expect(mail.html).toContain("042917");
    expect(mail.text).toContain("10 minutes");
  });
});

describe("sign-in codes (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let userId: string;
  const now = new Date("2026-10-15T10:00:00Z");

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const [u] = await ctx.db.insert(users).values({ email: "jody@example.com", username: "jody", name: "Jody", passwordHash: "x" }).returning({ id: users.id });
    userId = u.id;
  });
  afterAll(() => ctx.close());

  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("gives nothing to an email that can't sign in", async () => {
    expect(await issueLoginCode("stranger@example.com", now)).toBeNull();
    expect(await verifyLoginCode("stranger@example.com", "123456", now)).toEqual({ ok: false, reason: "wrong" });
  });

  it("signs in once with the right code, whatever the email's capitals, and stores only a hash", async () => {
    const issued = (await issueLoginCode("Jody@Example.com", now))!;
    expect(issued.user.id).toBe(userId);
    const rows = await ctx.db.select().from(loginCodes);
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(issued.code);

    expect(await verifyLoginCode("jody@example.com", issued.code, now)).toEqual({ ok: true, userId });
    expect(await verifyLoginCode("jody@example.com", issued.code, now)).toEqual({ ok: false, reason: "wrong" });
  });

  it("replaces the earlier code when a new one is asked for", async () => {
    const first = (await issueLoginCode("jody@example.com", now))!;
    const second = (await issueLoginCode("jody@example.com", now))!;
    expect(await ctx.db.select().from(loginCodes)).toHaveLength(1);
    if (first.code !== second.code) expect(await verifyLoginCode("jody@example.com", first.code, now)).toEqual({ ok: false, reason: "wrong" });
    expect((await verifyLoginCode("jody@example.com", second.code, now)).ok).toBe(true);
  });

  it("expires", async () => {
    const issued = (await issueLoginCode("jody@example.com", now))!;
    const later = new Date(now.getTime() + CODE_TTL_MS + 1000);
    expect(await verifyLoginCode("jody@example.com", issued.code, later)).toEqual({ ok: false, reason: "expired" });
    expect(await verifyLoginCode("jody@example.com", issued.code, now)).toEqual({ ok: false, reason: "wrong" }); // gone
  });

  it("throws the code away after too many wrong tries, even if the right one comes next", async () => {
    const issued = (await issueLoginCode("jody@example.com", now))!;
    const wrong = issued.code === "000000" ? "111111" : "000000";
    const results = [];
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) results.push((await verifyLoginCode("jody@example.com", wrong, now)) as { reason?: string });
    expect(results.slice(0, -1).every((r) => r.reason === "wrong")).toBe(true);
    expect(results.at(-1)?.reason).toBe("too_many");
    expect(await verifyLoginCode("jody@example.com", issued.code, now)).toEqual({ ok: false, reason: "wrong" });
  });

  it("goes with the person when they are removed", async () => {
    await issueLoginCode("jody@example.com", now);
    await ctx.db.delete(users);
    expect(await ctx.db.select().from(loginCodes)).toHaveLength(0);
  });
});
