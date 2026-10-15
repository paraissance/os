/*
 * Is a business's website up? The rules for reading one check of its home
 * page, kept pure so they can be tested without the network. The fetching
 * lives in src/lib/site-check.ts.
 */

type Headers = { get(name: string): string | null };

/** What the site sent back: status, headers and the start of the page. */
export type PageAnswer = { status: number; headers: Headers; body: string };

export type SiteHealth = {
  live: boolean;
  /** What's wrong, in plain words, when it isn't live. */
  problem: string | null;
  /** Something worth knowing while it's live (a bot check in front, for one). */
  note: string | null;
  /** How long the home page took, in milliseconds. */
  ms: number | null;
  /** Where the site is served from, when it shows (Vercel, Kajabi…). */
  host: string | null;
  /** When the SSL certificate runs out (YYYY-MM-DD). */
  sslUntil: string | null;
  checkedAt: string;
};

/** How one answer reads: fine, a bot check standing in front, or a problem. */
export type Reading = { kind: "ok" } | { kind: "guarded" } | { kind: "challenge" } | { kind: "down"; problem: string };

/**
 * Some hosts answer anyone they don't know yet with a tiny page that sets a
 * cookie and reloads, or a captcha. The server is up; JodyOS just doesn't
 * get to see the page, and doesn't try to get past the check.
 */
function isBotCheck(a: PageAnswer): boolean {
  return a.body.length < 4000 && /document\.cookie\s*=\s*["']humans_\d+=|sgcaptcha|captcha/i.test(a.body);
}

export function readAnswer(a: PageAnswer): Reading {
  if (a.status >= 200 && a.status < 400) return { kind: "ok" };
  // Cloudflare's "Just a moment…" check: robots.txt is usually let through.
  if (a.headers.get("cf-mitigated")) return { kind: "challenge" };
  if (isBotCheck(a)) return { kind: "guarded" };
  if (a.status >= 500) return { kind: "down", problem: `The site shows a server error (${a.status}).` };
  if (a.status === 404 || a.status === 410) return { kind: "down", problem: `The home page is missing (${a.status}).` };
  return { kind: "down", problem: `The site turns visitors away (error ${a.status}).` };
}

function codeOf(error: unknown): string {
  const e = error as { name?: string; code?: unknown; cause?: { code?: unknown; name?: string } } | null;
  // A timeout is a DOMException, whose numeric `code` says nothing useful.
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return e.name;
  const code = e?.cause?.code ?? e?.code;
  return typeof code === "string" ? code : (e?.cause?.name ?? e?.name ?? "");
}

/** Why the site couldn't be reached at all, in plain words. */
export function readFailure(error: unknown): string {
  const code = codeOf(error);
  if (code === "TimeoutError" || code === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") return "No answer within 10 seconds.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "The domain doesn't point to a server.";
  if (code === "ECONNREFUSED") return "The server refused the connection.";
  if (code === "CERT_HAS_EXPIRED") return "The SSL certificate has expired.";
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) return "The SSL certificate isn't valid for this address.";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "The connection dropped.";
  return "The site couldn't be reached.";
}

/** Where the site is served from, when its answer says so. Null when it doesn't show. */
export function detectHost(headers: Headers, body: string): string | null {
  const server = headers.get("server")?.toLowerCase() ?? "";
  if (headers.get("x-vercel-id") || server === "vercel") return "Vercel";
  if (headers.get("x-nf-request-id") || server.includes("netlify")) return "Netlify";
  if (headers.get("x-powered-by")?.toLowerCase().includes("wp engine")) return "WP Engine";
  if (headers.get("x-kinsta-cache")) return "Kinsta";
  if (headers.get("x-wix-request-id")) return "Wix";
  if (headers.get("x-github-request-id")) return "GitHub Pages";
  if (headers.get("x-shopid") || /cdn\.shopify\.com/i.test(body)) return "Shopify";
  if (server.includes("squarespace")) return "Squarespace";
  if (/kajabi-cdn\.com/i.test(body)) return "Kajabi";
  return null;
}

/** Days before the certificate runs out that it counts as a problem. */
export const SSL_WARN_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * The verdict from everything one check found: the home page (or why it
 * couldn't be reached), robots.txt when Cloudflare's check stood in front,
 * and the certificate's end date.
 */
export function judge(input: {
  home: (PageAnswer & { ms: number }) | { error: unknown };
  robots?: PageAnswer | { error: unknown } | null;
  sslEnd: Date | null;
  now: Date;
}): SiteHealth {
  const { home, robots, sslEnd, now } = input;
  const base = {
    ms: "ms" in home ? home.ms : null,
    host: "status" in home ? detectHost(home.headers, home.body) : null,
    sslUntil: sslEnd ? sslEnd.toISOString().slice(0, 10) : null,
    checkedAt: now.toISOString(),
  };
  const down = (problem: string): SiteHealth => ({ ...base, live: false, problem, note: null });

  if ("error" in home) return down(readFailure(home.error));

  let note: string | null = null;
  const reading = readAnswer(home);
  if (reading.kind === "down") return down(reading.problem);
  if (reading.kind === "guarded") note = "Its host shows new visitors a quick bot check, so JodyOS checked that the server answers.";
  if (reading.kind === "challenge") {
    const second = robots && "status" in robots ? readAnswer(robots) : null;
    if (robots && "error" in robots) return down(readFailure(robots.error));
    if (second?.kind === "down") return down(second.problem);
    note = "Cloudflare shows new visitors a quick bot check, so JodyOS checked the site behind it another way.";
  }

  if (sslEnd) {
    const days = Math.floor((sslEnd.getTime() - now.getTime()) / DAY_MS);
    if (days < 0) return down("The SSL certificate has expired.");
    if (days < SSL_WARN_DAYS) return down(days === 0 ? "The SSL certificate runs out today." : `The SSL certificate runs out in ${days} day${days === 1 ? "" : "s"}.`);
  }
  return { ...base, live: true, problem: null, note };
}
