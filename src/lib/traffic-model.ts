/*
 * Website traffic, as counted by the agent line on each site: who counts
 * (real browsers on the business's own site), which day a visit falls on
 * (the owner's timezone) and the 30-day view. Pure, so it can be tested.
 */

export type TrafficDay = { date: string; visitors: number; views: number };

export type Traffic = {
  /** The last 30 days, oldest first, with empty days filled in. */
  days: TrafficDay[];
  last30: { visitors: number; views: number };
  previous30: { visitors: number; views: number };
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

/** The 30-day view from the stored daily rows (up to 60 days back, for the comparison). */
export function summarize(rows: (TrafficDay & { lastVisitAt: Date })[], today: string): Traffic {
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const sum = (dates: string[]) =>
    dates.reduce((t, d) => ({ visitors: t.visitors + (byDay.get(d)?.visitors ?? 0), views: t.views + (byDay.get(d)?.views ?? 0) }), { visitors: 0, views: 0 });
  const sixty = daysEnding(today, 60);
  const recent = sixty.slice(30);
  return {
    days: recent.map((date) => ({ date, visitors: byDay.get(date)?.visitors ?? 0, views: byDay.get(date)?.views ?? 0 })),
    last30: sum(recent),
    previous30: sum(sixty.slice(0, 30)),
    today: sum([today]),
    lastVisitAt: rows.reduce<Date | null>((latest, r) => (!latest || r.lastVisitAt > latest ? r.lastVisitAt : latest), null),
  };
}
