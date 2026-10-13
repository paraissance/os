import { formatDay, formatMoney, type BusinessDetail } from "@/lib/os-analytics";

/*
 * Pure helpers for showing business data in plain words: about text,
 * clickable links, dates and times, labels and the live funnel. No I/O.
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

/** "Sat 11 Oct, 09:00" for an ISO time, in the owner's timezone. */
export function formatWhen(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
}

const CYCLE: Record<string, string> = { monthly: "a month", yearly: "a year", quarterly: "a quarter", one_time: "one-time" };

export function cycleLabel(cycle: string): string {
  return CYCLE[cycle] ?? cycle.replace(/_/g, " ");
}

const STATUS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  appointment: "Appointment set",
  approved: "Approved",
  closed: "Closed",
  lost: "Lost",
};

export function leadStatusLabel(status: string): string {
  return STATUS[status] ?? humanize(status);
}

/** "facebook_lead_ads" → "Facebook lead ads". */
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ─── Numbers ─────────────────────────────────────────────────────── */

/** Money that fits a tile: "$1.25M", "$250K"; amounts under 100,000 are written out. */
export function compactMoney(value: number, currency: string): string {
  if (Math.abs(value) < 100_000) return formatMoney(value, currency, 0);
  const n = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Math.abs(value));
  const unit = /^[A-Z]{3}$/.test(currency) ? `${currency} ` : currency || "$";
  return `${value < 0 ? "-" : ""}${unit}${n}`;
}

/** `rate` is the percentage of the step before (`of` names it); null for the first step or a zero step before. */
export type FunnelStep = { key: string; label: string; value: number; rate: number | null; of: string | null };

/**
 * Impressions → clicks → leads → appointments (→ funded loans when there
 * are any), each with the share of the step before it.
 */
export function funnelSteps(f: BusinessDetail["funnel"]): FunnelStep[] {
  const steps: [key: string, label: string, value: number, noun: string][] = [
    ["impressions", "Seen", f.impressions, "views"],
    ["clicks", "Clicked", f.clicks, "clicks"],
    ["leads", "Became leads", f.leads, "leads"],
    ["appointments", "Booked", f.appointments, "bookings"],
  ];
  if (f.loansFunded > 0) steps.push(["loansFunded", "Loans funded", f.loansFunded, "loans"]);
  return steps.map(([key, label, value], i) => {
    const prev = i === 0 ? null : steps[i - 1];
    return {
      key,
      label,
      value,
      rate: prev && prev[2] ? Math.round((value / prev[2]) * 1000) / 10 : null,
      of: prev ? prev[3] : null,
    };
  });
}

