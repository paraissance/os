/*
 * Website traffic, as counted by the agent line on each site: who counts
 * (real browsers on the business's own site), which day a visit falls on
 * (the owner's timezone) and the 7- or 30-day view. Pure, so it can be tested.
 */

/** The periods the dashboard shows; the first is the default. */
export const SPANS = [7, 30] as const;
export type Span = (typeof SPANS)[number];

/** `?days=30` → 30; anything else → the default. */
export function spanFrom(value: unknown): Span {
  return SPANS.find((s) => String(s) === value) ?? SPANS[0];
}

export type TrafficDay = { date: string; visitors: number; views: number };

export type Traffic = {
  /** The period's days, oldest first, with empty days filled in. */
  days: TrafficDay[];
  current: { visitors: number; views: number };
  /** The same number of days just before, to compare. */
  previous: { visitors: number; views: number };
  today: { visitors: number; views: number };
  lastVisitAt: Date | null;
};

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios/i;

/** Crawlers, link previews and monitors aren't visitors. */
export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOTS.test(userAgent);
}

/** The hosts a business's site is reached at: its domains and their www. twins. */
export function siteHosts(addresses: (string | null | undefined)[]): Set<string> {
  const hosts = new Set<string>();
  for (const a of addresses) {
    if (!a) continue;
    try {
      const host = new URL(/^https?:\/\//i.test(a) ? a : `https://${a}`).hostname.toLowerCase().replace(/^www\./, "");
      hosts.add(host);
      hosts.add(`www.${host}`);
    } catch {
      // Not an address; skip it.
    }
  }
  return hosts;
}

/** Only pages on the business's own site count (not JodyOS's Try page, not someone else's copy). */
export function fromOwnSite(origin: string | null, hosts: Set<string>): boolean {
  if (!origin) return false;
  try {
    return hosts.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** `count` days ending on `end` (YYYY-MM-DD), oldest first. */
export function daysEnding(end: string, count: number): string[] {
  const last = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(last - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** The `span`-day view from the stored daily rows (twice as far back, for the comparison). */
export function summarize(rows: (TrafficDay & { lastVisitAt: Date })[], today: string, span: Span): Traffic {
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const sum = (dates: string[]) =>
    dates.reduce((t, d) => ({ visitors: t.visitors + (byDay.get(d)?.visitors ?? 0), views: t.views + (byDay.get(d)?.views ?? 0) }), { visitors: 0, views: 0 });
  const both = daysEnding(today, span * 2);
  const recent = both.slice(span);
  return {
    days: recent.map((date) => ({ date, visitors: byDay.get(date)?.visitors ?? 0, views: byDay.get(date)?.views ?? 0 })),
    current: sum(recent),
    previous: sum(both.slice(0, span)),
    today: sum([today]),
    lastVisitAt: rows.reduce<Date | null>((latest, r) => (!latest || r.lastVisitAt > latest ? r.lastVisitAt : latest), null),
  };
}
