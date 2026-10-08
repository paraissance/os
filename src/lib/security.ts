/**
 * Small request-safety helpers. Pure (headers are passed in) so they can be
 * unit tested and used from Server Actions, Route Handlers and the proxy.
 */

type HeaderSource = { get(name: string): string | null };

/** Only same-site relative paths, so `?next=` can't become an open redirect. */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 500) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/setup")) return fallback;
  return next;
}

export function clientIp(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}

/**
 * Same-origin check for state-changing Route Handlers (Server Actions get this
 * from Next.js already). The session cookie is SameSite=Lax as well; this is
 * the second layer.
 */
export function isSameOrigin(headers: HeaderSource): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
