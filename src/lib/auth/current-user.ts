import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isProduction } from "@/lib/env";
import { sessionCookieName } from "./cookie";
import { validateSessionToken, type ValidSession } from "./sessions";

/**
 * Data Access Layer entry point. Every Server Component, Server Action and
 * Route Handler that touches private data calls one of these; the proxy's
 * cookie check is only an optimistic redirect, never the real gate.
 */
export const getSession = cache(async (): Promise<ValidSession | null> => {
  const token = (await cookies()).get(sessionCookieName(isProduction()))?.value;
  if (!token) return null;
  // Validation reads the clock and writes (expiry clean-up, last-seen), so it
  // must run for a real request, never inside a prefetch prerender of the
  // per-session app shell, where cookies are readable too.
  await connection();
  return validateSessionToken(token);
});

export async function getCurrentUser() {
  return (await getSession())?.user ?? null;
}

export async function requireSession(): Promise<ValidSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireUser() {
  return (await requireSession()).user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const production = isProduction();
  (await cookies()).set(sessionCookieName(production), token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName(isProduction()));
}
