import { formatDay, formatMoney, type BusinessDetail, type BusinessList, type Link, type Renewal } from "@/lib/os-analytics";

/*
 * Pure helpers that turn OS Analytics data into what the dashboard shows:
 * plain words, grouped links and small derived numbers. No I/O.
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

/* ─── Links ───────────────────────────────────────────────────────── */

export type LinkRow = Link & { note?: string | null };
export type LinkGroup = { id: "website" | "logins" | "saved" | "admin"; title: string; links: LinkRow[] };

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

function sameUrl(url: string) {
  return shortUrl(url).toLowerCase();
}

function dedupe(rows: LinkRow[]): LinkRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = sameUrl(r.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const ADMIN_PAGES: [key: string, label: string][] = [
  ["dashboard", "Dashboard"],
  ["leads", "Leads"],
  ["campaigns", "Campaigns"],
  ["content", "Content"],
  ["publisher", "Social Publisher"],
  ["social", "Social stats"],
  ["sites", "Sites"],
  ["spending", "Spending"],
  ["tasks", "Tasks"],
];

/** Every link the plugin knows for a business, grouped; empty groups are left out. */
export function businessLinks(b: BusinessDetail): LinkGroup[] {
  const website: LinkRow[] = [];
  if (b.siteUrl) website.push({ label: "Website", url: b.siteUrl });
  if (b.about?.cta) website.push({ ...b.about.cta, note: "Main call to action" });
  website.push(...(b.about?.links ?? []));
  for (const q of b.about?.questions ?? []) if (q.link) website.push(q.link);

  const logins: LinkRow[] = [];
  const site = b.site;
  if (site?.registrarLoginUrl) {
    logins.push({ label: `Domain${site.registrar ? ` · ${site.registrar}` : ""}`, url: site.registrarLoginUrl, note: site.registrarAccount });
  }
  if (site?.hostingLoginUrl) {
    logins.push({ label: `Hosting${site.hostingProvider ? ` · ${site.hostingProvider}` : ""}`, url: site.hostingLoginUrl, note: site.hostingAccount });
  }
  for (const s of b.spending?.subscriptions ?? []) {
    if (s.loginUrl) logins.push({ label: s.name, url: s.loginUrl, note: [s.account, s.shared ? "shared" : null].filter(Boolean).join(" · ") || null });
  }

  const admin: LinkRow[] = ADMIN_PAGES.flatMap(([key, label]) => (b.adminLinks[key] ? [{ label, url: b.adminLinks[key] }] : []));

  const groups: LinkGroup[] = [
    { id: "website", title: "Website and pages", links: dedupe(website) },
    { id: "logins", title: "Logins", links: dedupe(logins) },
    { id: "saved", title: "Saved links", links: dedupe(site?.importantLinks ?? []) },
    { id: "admin", title: "Open in OS Analytics", links: admin },
  ];
  return groups.filter((g) => g.links.length);
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

/** "Expired 9 days ago", "Renews in 10 days", "OK until 1 Mar 2027". */
export function renewalPhrase(r: Pick<Renewal, "status" | "daysLeft" | "date">): string {
  const n = (d: number) => `${d} day${d === 1 ? "" : "s"}`;
  if (r.status === "expired") return r.daysLeft === null ? "Expired" : `Expired ${n(Math.abs(r.daysLeft))} ago`;
  if (r.status === "soon") return r.daysLeft === null ? "Renews soon" : r.daysLeft === 0 ? "Renews today" : `Renews in ${n(r.daysLeft)}`;
  if (r.status === "ok") return `OK until ${formatDay(r.date)}`;
  return "No date";
}

/** The renewal that most needs action: expired first, then the soonest due. Null when all are fine. */
export function worstRenewal<R extends Pick<Renewal, "status" | "daysLeft">>(renewals: R[]): R | null {
  const rank = (r: R) => (r.status === "expired" ? 0 : r.status === "soon" ? 1 : 2);
  const urgent = renewals.filter((r) => rank(r) < 2);
  urgent.sort((a, b) => rank(a) - rank(b) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  return urgent[0] ?? null;
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

/** Monthly software cost per business; shared tools under "Shared". Largest first. */
export function spendByBusiness(list: BusinessList): { name: string; slug: string | null; monthly: number; count: number }[] {
  const byId = new Map(list.businesses.map((b) => [b.id, b]));
  const rows = new Map<string, { name: string; slug: string | null; monthly: number; count: number }>();
  for (const s of list.spending?.subscriptions ?? []) {
    const b = s.shared ? undefined : byId.get(s.businessId);
    const key = b ? b.slug : "";
    const row = rows.get(key) ?? { name: b ? b.name : "Shared by all businesses", slug: b ? b.slug : null, monthly: 0, count: 0 };
    row.monthly += s.monthly;
    row.count += 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, monthly: Math.round(r.monthly * 100) / 100 }))
    .sort((a, b) => b.monthly - a.monthly);
}
