import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit random session token, URL-safe. Only its hash is stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time string comparison that doesn't leak length through early exit. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
