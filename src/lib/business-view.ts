import { formatDay } from "@/lib/os-analytics";

/*
 * Pure helpers for showing business data in plain words: about text,
 * clickable links and dates. No I/O.
 */

/* ─── About ───────────────────────────────────────────────────────── */

export type KnowledgeSection = { heading: string | null; lines: string[] };

/**
 * The business profile text is markdown-ish: "# HEADING" lines followed by
 * one fact per line. Split it into sections; text before the first heading
 * gets a null heading.
 */
export function knowledgeSections(text: string | null): KnowledgeSection[] {
  if (!text) return [];
  const sections: KnowledgeSection[] = [];
  let current: KnowledgeSection | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      const title = heading[1].trim();
      current = { heading: /^ADDITIONAL KNOWLEDGE\b/i.test(title) ? "Added in OS Analytics" : title, lines: [] };
      sections.push(current);
    } else if (line) {
      if (!current) {
        current = { heading: null, lines: [] };
        sections.push(current);
      }
      current.lines.push(line);
    }
  }
  return sections.filter((s) => s.lines.length);
}

/** Split text into plain strings and http(s) links, so URLs in prose become clickable. */
export function linkify(text: string): ({ text: string } | { url: string })[] {
  const out: ({ text: string } | { url: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>()"']+/gi)) {
    const url = m[0].replace(/[.,;:!?]+$/, "");
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** "leads.example.com/pricing" for display: no scheme, "www." or trailing slash; the query stays. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.host.replace(/^www\./, "")}${path}${u.search}`;
  } catch {
    return url;
  }
}

/* ─── Words ───────────────────────────────────────────────────────── */

export { formatDay };
