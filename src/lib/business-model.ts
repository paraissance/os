import { editHref } from "@/lib/business-href";
import type { businessFaqs, businessLinks, businessSites, businesses, subscriptions } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";

/*
 * The owner's businesses as JodyOS stores them, and what the dashboard
 * derives from them: renewals, monthly costs and what needs attention.
 * Pure functions only; the database code lives in src/lib/businesses.ts.
 */

export type Business = typeof businesses.$inferSelect;
export type BusinessLink = typeof businessLinks.$inferSelect;
export type BusinessFaq = typeof businessFaqs.$inferSelect;
export type BusinessSite = typeof businessSites.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

export type BusinessRecord = Business & {
  links: BusinessLink[];
  faqs: BusinessFaq[];
  sites: BusinessSite[];
  subscriptions: Subscription[];
};

/** Everything: each business with its parts, plus tools shared by all businesses. */
export type BusinessBook = { businesses: BusinessRecord[]; shared: Subscription[] };

export type Attention = {
  level: "critical" | "warning";
  title: string;
  detail: string;
  href: string;
  sort: number;
};

/** Days before a renewal date that it starts to count as "soon". */
export const WARN_DAYS = 30;

const DAY_MS = 86_400_000;
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "20 Oct 2026" for a YYYY-MM-DD date, without any timezone shift. */
export function dayLabel(date: string | null): string | null {
  if (!date) return null;
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ms) ? date : DAY.format(ms);
}

/** Whole days from today (UTC) to a YYYY-MM-DD date; null when it isn't a date. */
export function daysFrom(today: Date, date: string): number | null {
  const due = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  return Math.round((due - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / DAY_MS);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/* ─── Renewals ────────────────────────────────────────────────────── */

export type RenewalItem = "domain" | "hosting" | "ssl";
export type Renewal = {
  item: RenewalItem;
  label: string;
  domain: string;
  date: string;
  status: "ok" | "soon" | "expired";
  daysLeft: number;
};

const RENEWAL_LABELS: Record<RenewalItem, string> = { domain: "Domain", hosting: "Hosting", ssl: "SSL certificate" };

export function renewalLabel(item: RenewalItem) {
  return RENEWAL_LABELS[item];
}

/** Domain, hosting and SSL dates of one website, with how soon each one is due. */
export function siteRenewals(site: BusinessSite, today: Date): Renewal[] {
  const dates: [RenewalItem, string | null][] = [
    ["domain", site.domainExpiry],
    ["hosting", site.hostingExpiry],
    ["ssl", site.sslExpiry],
  ];
  return dates.flatMap(([item, date]) => {
    if (!date) return [];
    const daysLeft = daysFrom(today, date);
    if (daysLeft === null) return [];
    const status = daysLeft < 0 ? "expired" : daysLeft <= WARN_DAYS ? "soon" : "ok";
    return [{ item, label: RENEWAL_LABELS[item], domain: site.domain, date, status, daysLeft }];
  });
}

/** "Expired 9 days ago", "Renews in 10 days", "Renews today", "OK until 1 Mar 2027". */
export function renewalWords(r: Pick<Renewal, "status" | "daysLeft" | "date">): string {
  if (r.status === "expired") return `Expired ${plural(Math.abs(r.daysLeft), "day")} ago`;
  if (r.status === "soon") return r.daysLeft === 0 ? "Renews today" : `Renews in ${plural(r.daysLeft, "day")}`;
  return `OK until ${dayLabel(r.date)}`;
}

/** The renewal that most needs action: expired first, then the soonest due. Null when all are fine. */
export function mostUrgent<R extends Pick<Renewal, "status" | "daysLeft">>(renewals: R[]): R | null {
  const rank = (r: R) => (r.status === "expired" ? 0 : r.status === "soon" ? 1 : 2);
  const urgent = renewals.filter((r) => rank(r) < 2);
  urgent.sort((a, b) => rank(a) - rank(b) || a.daysLeft - b.daysLeft);
  return urgent[0] ?? null;
}

/* ─── Money ───────────────────────────────────────────────────────── */

/** Monthly equivalent of a price: yearly ÷ 12, quarterly ÷ 3; one-time costs aren't recurring. */
export function monthlyCost(amount: number, cycle: Subscription["billingCycle"]): number {
  if (cycle === "yearly") return amount / 12;
  if (cycle === "quarterly") return amount / 3;
  if (cycle === "one_time") return 0;
  return amount;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A business's own tools plus the ones shared by every business. */
export function toolsFor(record: BusinessRecord, shared: Subscription[]): Subscription[] {
  return [...record.subscriptions, ...shared].filter((s) => s.active);
}

/** Monthly cost of the active subscriptions in a list. */
export function monthlyTotal(subs: Subscription[]): number {
  return round2(subs.filter((s) => s.active).reduce((t, s) => t + monthlyCost(s.amount, s.billingCycle), 0));
}

/* ─── Attention ───────────────────────────────────────────────────── */

function renewalAttention(record: BusinessRecord, today: Date, prefix: string): Attention[] {
  const href = editHref(record.slug, "websites");
  const many = record.sites.length > 1;
  return record.sites.flatMap((site) =>
    siteRenewals(site, today).flatMap((r): Attention[] => {
      const what = `${prefix}${r.label}${many ? ` (${r.domain})` : ""}`;
      if (r.status === "expired") {
        return [{ level: "critical", title: `${what} expired`, detail: `Expired ${plural(Math.abs(r.daysLeft), "day")} ago (${dayLabel(r.date)}).`, href, sort: r.daysLeft }];
      }
      if (r.status === "soon") {
        return [{ level: "warning", title: `${what} renews ${r.daysLeft === 0 ? "today" : `in ${plural(r.daysLeft, "day")}`}`, detail: `Renew before ${dayLabel(r.date)}.`, href, sort: r.daysLeft }];
      }
      return [];
    }),
  );
}

/** Subscriptions renewing within a week, or overdue. */
function subscriptionAttention(subs: Subscription[], today: Date, href: string): Attention[] {
  return subs.flatMap((s): Attention[] => {
    if (!s.active || !s.nextRenewal) return [];
    const d = daysFrom(today, s.nextRenewal);
    if (d === null || d > 7) return [];
    return [
      {
        level: d < 0 ? "critical" : "warning",
        title: d < 0 ? `${s.name} renewal is overdue` : `${s.name} renews ${d === 0 ? "today" : `in ${plural(d, "day")}`}`,
        detail: `${formatMoney(s.amount, s.currency)} ${s.billingCycle === "one_time" ? "one-time" : s.billingCycle}${s.businessId ? "" : ", shared by all businesses"}.`,
        href,
        sort: d,
      },
    ];
  });
}

export function sortAttention<T extends Attention>(items: T[]): T[] {
  return items.sort((a, b) => (a.level === b.level ? a.sort - b.sort : a.level === "critical" ? -1 : 1));
}

/** Across all active businesses; shared tools are listed once. */
export function bookAttention(book: BusinessBook, today: Date): Attention[] {
  const items: Attention[] = [];
  for (const b of book.businesses) {
    if (b.status !== "active") continue;
    items.push(...renewalAttention(b, today, `${b.name}: `));
    items.push(...subscriptionAttention(b.subscriptions, today, editHref(b.slug, "subscriptions")).map((a) => ({ ...a, title: `${b.name}: ${a.title}` })));
  }
  items.push(...subscriptionAttention(book.shared, today, "/businesses#shared-tools"));
  return sortAttention(items);
}
