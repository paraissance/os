"use server";

import { count, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/auth/current-user";
import { CODE_TTL_MS, issueLoginCode, verifyLoginCode } from "@/lib/auth/login-codes";
import { getDummyHash, hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession } from "@/lib/auth/sessions";
import { hashToken, normalizeEmail, safeEqual } from "@/lib/auth/tokens";
import { normalizeUsername, usernameFrom } from "@/lib/auth/usernames";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { emailReady, loginCodeMail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { consumeRateLimit, minutesUntil, resetRateLimit } from "@/lib/rate-limit";
import { clientIp, safeNextPath } from "@/lib/security";
import type { FormState } from "./form-state";

const WINDOW_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(500),
});

/** Signs the user in on this device and records it. */
async function startSession(userId: string, ip: string, userAgent: string | null, how: string) {
  const { token, expiresAt } = await createSession(userId, { ip, userAgent });
  await setSessionCookie(token, expiresAt);
  const db = await getDb();
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await logActivity({ action: "auth.login", status: "success", userId, result: how, metadata: { ip } });
}

/** Username and password. An email address works in the username box too. */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  const values = { username: String(formData.get("username") ?? "").slice(0, 254) };
  if (!parsed.success) return { error: "Enter your user name and password.", values };

  const h = await headers();
  const ip = clientIp(h);
  const login = parsed.data.username.includes("@") ? normalizeEmail(parsed.data.username) : normalizeUsername(parsed.data.username);

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(login.includes("@") ? eq(users.email, login) : eq(users.username, login))
    .limit(1);

  // One budget per account, whether its username or its email is typed.
  const accountKey = user ? `login:user:${user.id}` : `login:name:${hashToken(login)}`;
  const [byIp, byAccount] = await Promise.all([consumeRateLimit(`login:ip:${ip}`, 10, WINDOW_MS), consumeRateLimit(accountKey, 5, WINDOW_MS)]);
  if (!byIp.allowed || !byAccount.allowed) {
    const blocked = [byIp, byAccount].filter((r) => !r.allowed);
    const resetAt = new Date(Math.max(...blocked.map((r) => r.resetAt.getTime())));
    await logActivity({
      action: "auth.login_blocked",
      status: "failure",
      request: `Sign-in attempt for ${login}`,
      error: "Too many attempts",
      metadata: { ip },
    });
    return { error: `Too many sign-in attempts. Try again in ${minutesUntil(resetAt)} min.`, values };
  }

  // Hash even for an unknown name so response time doesn't reveal who exists.
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : (await verifyPassword(parsed.data.password, await getDummyHash())) && false;

  if (!user || !valid) {
    await logActivity({
      action: "auth.login_failed",
      status: "failure",
      userId: user?.id ?? null,
      request: `Sign-in attempt for ${login}`,
      error: "Invalid user name or password",
      metadata: { ip },
    });
    return { error: "Invalid user name or password.", values };
  }

  await resetRateLimit(accountKey);
  await startSession(user.id, ip, h.get("user-agent"), "Signed in with password");
  redirect(safeNextPath(formData.get("next")));
}

const codeRequestSchema = z.object({ email: z.email("Enter a valid email address.").max(254) });

/**
 * Step 1 of signing in with a code. The answer is the same whether or not
 * the email can sign in, and the email is sent after the response, so
 * neither the words nor the timing tell anyone which addresses exist.
 */
export async function requestCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!emailReady()) return { error: "Sign-in codes aren't switched on yet. Sign in with your user name and password." };
  const raw = String(formData.get("email") ?? "").trim().slice(0, 254);
  const parsed = codeRequestSchema.safeParse({ email: raw });
  if (!parsed.success) return { error: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address." }, values: { email: raw } };

  const h = await headers();
  const ip = clientIp(h);
  const email = normalizeEmail(parsed.data.email);
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`code:ip:${ip}`, 5, WINDOW_MS),
    consumeRateLimit(`code:email:${hashToken(email)}`, 3, WINDOW_MS),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    const resetAt = new Date(Math.max(...[byIp, byEmail].filter((r) => !r.allowed).map((r) => r.resetAt.getTime())));
    return { error: `Too many codes asked for. Try again in ${minutesUntil(resetAt)} min.`, values: { email } };
  }

  after(async () => {
    const issued = await issueLoginCode(email);
    if (!issued) {
      await logActivity({ action: "auth.code_requested", status: "info", request: `Code asked for ${email}`, result: "No account with that email: nothing sent", metadata: { ip } });
      return;
    }
    try {
      await sendEmail(loginCodeMail(issued.user.email, issued.code, CODE_TTL_MS / 60_000));
      await logActivity({ action: "auth.code_sent", status: "success", userId: issued.user.id, result: "Sign-in code emailed", metadata: { ip } });
    } catch (e) {
      await logActivity({ action: "auth.code_sent", status: "failure", userId: issued.user.id, error: e instanceof Error ? e.message : "Email failed", metadata: { ip } });
    }
  });

  return { message: `If ${email} can sign in, a 6-digit code is on its way. It works for ${CODE_TTL_MS / 60_000} minutes.`, values: { email } };
}

const codeSchema = z.object({
  email: z.email().max(254),
  code: z.string().transform((v) => v.replace(/\s+/g, "")).pipe(z.string().regex(/^\d{6}$/, "Enter the 6 digits from the email.")),
});

/** Step 2: the code from the email signs you in. */
export async function verifyCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const values = { email };
  const parsed = codeSchema.safeParse({ email, code: String(formData.get("code") ?? "") });
  if (!parsed.success) return { fieldErrors: { code: "Enter the 6 digits from the email." }, values };

  const h = await headers();
  const ip = clientIp(h);
  const limit = await consumeRateLimit(`code-check:ip:${ip}`, 10, WINDOW_MS);
  if (!limit.allowed) return { error: `Too many tries. Try again in ${minutesUntil(limit.resetAt)} min.`, values };

  const check = await verifyLoginCode(parsed.data.email, parsed.data.code);
  if (!check.ok) {
    await logActivity({ action: "auth.code_failed", status: "failure", request: `Code sign-in for ${normalizeEmail(email)}`, error: check.reason, metadata: { ip } });
    const words = {
      wrong: "That code isn't right. Check the email and try again.",
      expired: "That code has expired. Get a new one.",
      too_many: "Too many wrong tries. Get a new code.",
    } as const;
    return { error: words[check.reason], fieldErrors: check.reason === "wrong" ? { code: "Wrong code." } : undefined, values };
  }

  await startSession(check.userId, ip, h.get("user-agent"), "Signed in with an email code");
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
    const email = normalizeEmail(input.email);
    // The owner signs in with a username made from their name ("Jody" → "jody").
    const username = usernameFrom(input.name) ?? usernameFrom(email.split("@")[0]) ?? "owner";
    const [row] = await tx.insert(users).values({ email, username, name: input.name, passwordHash, role: "owner" }).returning({ id: users.id });
    return row;
  });

  if (!created) return { error: "JodyOS is already set up. Sign in instead." };

  const { token, expiresAt } = await createSession(created.id, { ip, userAgent: h.get("user-agent") });
  await setSessionCookie(token, expiresAt);
  await logActivity({ action: "auth.setup", status: "success", userId: created.id, result: "Owner account created", metadata: { ip } });
  redirect("/");
}
