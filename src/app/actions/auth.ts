"use server";

import { count, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/auth/current-user";
import { getDummyHash, hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession } from "@/lib/auth/sessions";
import { hashToken, normalizeEmail, safeEqual } from "@/lib/auth/tokens";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { consumeRateLimit, minutesUntil, resetRateLimit } from "@/lib/rate-limit";
import { clientIp, safeNextPath } from "@/lib/security";
import type { FormState } from "./form-state";

const WINDOW_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(500),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "").slice(0, 254) };
  if (!parsed.success) return { error: "Enter your email and password.", values };

  const h = await headers();
  const ip = clientIp(h);
  const email = normalizeEmail(parsed.data.email);
  const emailKey = `login:email:${hashToken(email)}`;

  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`login:ip:${ip}`, 10, WINDOW_MS),
    consumeRateLimit(emailKey, 5, WINDOW_MS),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    const blocked = [byIp, byEmail].filter((r) => !r.allowed);
    const resetAt = new Date(Math.max(...blocked.map((r) => r.resetAt.getTime())));
    await logActivity({
      action: "auth.login_blocked",
      status: "failure",
      request: `Sign-in attempt for ${email}`,
      error: "Too many attempts",
      metadata: { ip },
    });
    return { error: `Too many sign-in attempts. Try again in ${minutesUntil(resetAt)} min.`, values };
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Hash even for an unknown email so response time doesn't reveal which emails exist.
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : (await verifyPassword(parsed.data.password, await getDummyHash())) && false;

  if (!user || !valid) {
    await logActivity({
      action: "auth.login_failed",
      status: "failure",
      userId: user?.id ?? null,
      request: `Sign-in attempt for ${email}`,
      error: "Invalid email or password",
      metadata: { ip },
    });
    return { error: "Invalid email or password.", values };
  }

  await resetRateLimit(emailKey);
  const { token, expiresAt } = await createSession(user.id, { ip, userAgent: h.get("user-agent") });
  await setSessionCookie(token, expiresAt);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await logActivity({ action: "auth.login", status: "success", userId: user.id, result: "Signed in", metadata: { ip } });

  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await revokeSession(session.sessionId);
    await logActivity({ action: "auth.logout", status: "success", userId: session.user.id, result: "Signed out" });
  }
  await clearSessionCookie();
  redirect("/login");
}

const setupSchema = z
  .object({
    setupToken: z.string().min(1, "Enter the setup token.").max(500),
    name: z.string().trim().min(1, "Enter your name.").max(80),
    email: z.email("Enter a valid email address.").max(254),
    password: z.string().max(500),
    confirm: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    const weak = validatePasswordStrength(v.password);
    if (weak) ctx.addIssue({ code: "custom", path: ["password"], message: weak });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const expected = env().SETUP_TOKEN;
  if (!expected) return { error: "SETUP_TOKEN isn't configured on the server." };

  const h = await headers();
  const ip = clientIp(h);
  const limit = await consumeRateLimit(`setup:ip:${ip}`, 5, WINDOW_MS);
  if (!limit.allowed) {
    return { error: `Too many attempts. Try again in ${minutesUntil(limit.resetAt)} min.` };
  }

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  // Echo back only what is safe to re-display: never the token or passwords.
  const values = { name: String(formData.get("name") ?? "").slice(0, 80), email: String(formData.get("email") ?? "").slice(0, 254) };
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }
  const input = parsed.data;

  if (!safeEqual(input.setupToken.trim(), expected)) {
    await logActivity({ action: "auth.setup_failed", status: "failure", error: "Wrong setup token", metadata: { ip } });
    return { error: "That setup token is incorrect.", fieldErrors: { setupToken: "Incorrect token." }, values };
  }

  const passwordHash = await hashPassword(input.password);
  const db = await getDb();
  const created = await db.transaction(async (tx) => {
    // Serialise concurrent setup attempts so only one owner can ever be created.
    await tx.execute(sql`select pg_advisory_xact_lock(71001)`);
    const [{ value: existing }] = await tx.select({ value: count() }).from(users);
    if (existing > 0) return null;
    const [row] = await tx
      .insert(users)
      .values({ email: normalizeEmail(input.email), name: input.name, passwordHash, role: "owner" })
      .returning({ id: users.id });
    return row;
  });

  if (!created) return { error: "JodyOS is already set up. Sign in instead." };

  const { token, expiresAt } = await createSession(created.id, { ip, userAgent: h.get("user-agent") });
  await setSessionCookie(token, expiresAt);
  await logActivity({
    action: "auth.setup",
    status: "success",
    userId: created.id,
    result: "Owner account created",
    metadata: { ip },
  });
  redirect("/");
}
