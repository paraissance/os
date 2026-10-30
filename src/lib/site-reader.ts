import "server-only";
import { readAnswer } from "@/lib/site-health";

/*
 * Reads a business's own website so its AI agent knows what the site says:
 * the home page, the pages it links to, then the sitemap, as plain text.
 * Bot checks are reported, never worked around. Only the business's own
 * sites are read, so robots.txt rules aren't consulted.
 */

export const MAX_PAGES = 25;
const PAGE_CHARS = 4_000;
const TOTAL_CHARS = 50_000;
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; JodyOS site reader)", Accept: "text/html,application/xhtml+xml,*/*;q=0.5" };

export type SitePage = { url: string; title: string | null; text: string };

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", hellip: "…", copy: "©", reg: "®", trade: "™", bull: "•", middot: "·",
};

function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

/** A page's title and readable text, one line per block; menus, footers, forms and scripts left out. */
export function pageText(html: string): { title: string | null; text: string } {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim() || null;
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|nav|header|footer|form|button|select)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|h[1-6]|section|article|tr|blockquote|dd|dt|figcaption|summary)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines: string[] = [];
  for (const raw of decode(body).split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length > 2 && line !== lines.at(-1)) lines.push(line);
  }
  return { title, text: lines.join("\n") };
}

const SKIP = /(checkout|cart|log-?in|sign-?in|sign-?up|register|opt-?in|confirmation|thank-?you|password|account|wp-admin|wp-json|feed|\/tag\/|\/category\/|\/author\/|\/page\/\d+|privacy|terms|cookie)/i;
const FILE = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|mp4|mp3|mov|xml|txt|css|js)$/i;

const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

/** The site's own pages among `hrefs`, cleaned (no query or #part), in order, each once; logins, carts and the like left out. */
export function sitePages(hrefs: string[], home: URL): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    let u: URL;
    try {
      u = new URL(decode(href), home);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || !sameSite(u, home) || FILE.test(u.pathname) || SKIP.test(u.pathname)) continue;
    const clean = `${home.origin}${u.pathname.replace(/\/+$/, "") || "/"}`;
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

const links = (html: string) => [...html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)].map((m) => m[1]);
const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));

/** The pages as knowledge: each under its title and address, lines already said on an earlier page (menus, footers) dropped, capped in size. */
export function siteKnowledgeText(pages: SitePage[]): string {
  const said = new Set<string>();
  const parts: string[] = [];
  let total = 0;
  for (const p of pages) {
    const fresh = p.text.split("\n").filter((line) => !said.has(line));
    p.text.split("\n").forEach((line) => said.add(line));
    const text = fresh.join("\n").slice(0, PAGE_CHARS);
    if (!text) continue;
    const part = `# PAGE: ${p.title ?? p.url} (${p.url})\n${text}`;
    if (total + part.length > TOTAL_CHARS) break;
    parts.push(part);
    total += part.length;
  }
  return parts.join("\n\n");
}

async function get(url: string): Promise<{ status: number; headers: Headers; body: string; url: string } | null> {
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store", headers: HEADERS, signal: AbortSignal.timeout(10_000) });
    return { status: res.status, headers: res.headers, body: (await res.text()).slice(0, 2_000_000), url: res.url };
  } catch {
    return null;
  }
}

/** Reads up to MAX_PAGES pages of the site at `address`. `problem` says why nothing (or only part) could be read. */
export async function readSite(address: string): Promise<{ pages: SitePage[]; problem: string | null }> {
  let home: URL;
  try {
    home = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
  } catch {
    return { pages: [], problem: "The saved website address isn't valid." };
  }
  const first = await get(home.href);
  if (!first) return { pages: [], problem: "The website didn't answer." };
  const reading = readAnswer(first);
  if (reading.kind === "challenge" || reading.kind === "guarded") return { pages: [], problem: "The website's bot check stops JodyOS from reading it." };
  if (reading.kind === "down") return { pages: [], problem: reading.problem };
  home = new URL(first.url);

  // The menu's pages come first, then whatever the sitemap adds.
  const robots = await get(new URL("/robots.txt", home).href);
  const maps = robots?.status === 200 ? [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  const mapUrls: string[] = [];
  for (const map of (maps.length ? maps : [new URL("/sitemap.xml", home).href]).slice(0, 3)) {
    const xml = await get(map);
    if (xml?.status !== 200) continue;
    if (/<sitemapindex/i.test(xml.body)) {
      for (const child of locs(xml.body).slice(0, 5)) {
        const c = await get(child);
        if (c?.status === 200) mapUrls.push(...locs(c.body));
      }
    } else mapUrls.push(...locs(xml.body));
  }
  const queue = sitePages([home.href, ...links(first.body), ...mapUrls], home).slice(0, MAX_PAGES);

  const pages: SitePage[] = [{ url: queue[0] ?? home.href, ...pageText(first.body) }];
  const rest = queue.slice(1);
  for (let i = 0; i < rest.length; i += 4) {
    const batch = await Promise.all(rest.slice(i, i + 4).map(get));
    batch.forEach((res, j) => {
      if (res && res.status === 200 && /html/i.test(res.headers.get("content-type") ?? "html")) pages.push({ url: rest[i + j], ...pageText(res.body) });
    });
  }
  return { pages: pages.filter((p) => p.text), problem: null };
}
