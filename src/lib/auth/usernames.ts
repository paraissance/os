import { z } from "zod";

/*
 * Usernames are what people sign in with: 3 to 32 letters, numbers, dots,
 * dashes or underscores, stored lower-cased so "Jody" and "jody" are the same.
 * Pure helpers, safe to import anywhere.
 */

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30})[a-z0-9]$/;
const USERNAME_RULE = "Use 3 to 32 letters, numbers, dots, dashes or underscores.";

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string({ error: "Enter a user name." })
  .trim()
  .min(1, "Enter a user name.")
  .transform(normalizeUsername)
  .refine((v) => USERNAME_RE.test(v), USERNAME_RULE);

/** A username made from a name ("Jody McNamer" → "jodymcnamer"), or null if too little is left. */
export function usernameFrom(name: string): string | null {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  return base.length >= 3 ? base : null;
}
