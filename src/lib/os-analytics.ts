import "server-only";
import { cache } from "react";
import { z } from "zod";
import { env } from "@/lib/env";
import { businessHref } from "@/lib/business-sections";

/**
 * Client for the OS Analytics WordPress plugin's JodyOS connector
 * (`/wp-json/jdy/v1/os/*`, plugin 1.3.0+). Read-only. Every response is
 * validated, so a plugin/JodyOS version mismatch shows up as a clear error
 * instead of wrong numbers. The connection key never appears in errors.
 */

export const PLUGIN_MIN_VERSION = "1.3.0";

const num = z.number().finite();
const int = z.number().int();
const text = z.string().nullable();
const HTTP_URL = /^https?:\/\/\S+$/i;
/** Only http(s) URLs reach an href; anything else becomes null. */
const href = z
  .string()
  .nullable()
  .transform((v) => (v && HTTP_URL.test(v) ? v : null));
const linkSchema = z.object({ label: z.string(), url: z.string().regex(HTTP_URL) });
/** A list of links where a bad entry is dropped instead of failing the whole response. */
const links = z.array(z.unknown()).transform((items) =>
  items.flatMap((item) => {
    const r = linkSchema.safeParse(item);
    return r.success ? [r.data] : [];
  }),
);

const kpisSchema = z.object({
  leads: int,
  won: int,
  appointments: int,
  spend: num,
  costPerLead: num,
  conversionRate: num,
  loanVolume: num,
});

const renewalSchema = z.object({
  item: z.enum(["domain", "hosting", "ssl"]),
  date: z.string(),
  status: z.enum(["ok", "soon", "expired", "unknown"]),
  daysLeft: int.nullable(),
});

const subscriptionSchema = z.object({
  name: z.string(),
  businessId: int,
  category: z.string(),
  categoryLabel: z.string(),
  cycle: z.string(),
  amount: num,
  currency: z.string(),
  monthly: num,
  nextRenewal: text,
  loginUrl: href,
  account: text,
  shared: z.boolean(),
  notes: text,
});

const spendingSchema = z.object({
  monthlyTotal: num,
  yearlyTotal: num,
  activeSubscriptions: int,
  byCategory: z.array(z.object({ category: z.string(), label: z.string(), monthly: num })),
  upcomingRenewals: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      amount: num,
      currency: z.string(),
      cycle: z.string(),
      nextRenewal: z.string(),
      shared: z.boolean(),
    }),
  ),
  subscriptions: z.array(subscriptionSchema),
});

const summarySchema = z.object({
  id: int,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  tagline: z.string().nullable(),
  siteUrl: z.string().nullable(),
  currency: z.string(),
  active: z.boolean(),
  window: z.object({ from: z.string(), to: z.string() }),
  last30: kpisSchema,
  previous30: kpisSchema,
  clientsAllTime: int,
  renewals: z.array(renewalSchema),
});

export const businessListSchema = z.object({
  generatedAt: z.string(),
  timezone: z.string(),
  businesses: z.array(summarySchema),
  spending: spendingSchema.nullable(),
});

const countList = z.array(z.object({ label: z.string(), value: int }));

export const businessDetailSchema = summarySchema.extend({
  about: z
    .object({
      name: text,
      tagline: text,
      greeting: text,
      note: text,
      cta: linkSchema.nullable().catch(null),
      links,
      questions: z.array(
        z.object({
          question: z.string(),
          answer: text,
          link: linkSchema.nullable().catch(null),
        }),
      ),
      knowledge: text,
    })
    .nullable(),
  adminLinks: z
    .record(z.string(), z.string())
    .transform((rec) => Object.fromEntries(Object.entries(rec).filter(([, url]) => HTTP_URL.test(url)))),
  pipeline: z.object({
    new: int,
    contacted: int,
    qualified: int,
    appointment: int,
    approved: int,
    closed: int,
    lost: int,
  }),
  funnel: z.object({ impressions: int, clicks: int, leads: int, appointments: int, loansFunded: int }),
  trend: z.array(z.object({ date: z.string(), leads: int })),
  audience: z.object({ region: countList, age: countList, device: countList, platform: countList }),
  recentLeads: z.array(
    z.object({
      name: text,
      source: text,
      platform: text,
      status: z.string(),
      place: text,
      createdAt: text,
    }),
  ),
  appointments: z.array(z.object({ at: text, name: text })),
  site: z
    .object({
      domain: text,
      registrar: text,
      registrarAccount: text,
      registrarLoginUrl: href,
      domainAutoRenew: z.boolean(),
      nameservers: z.array(z.string()),
      hostingProvider: text,
      hostingPlan: text,
      hostingLoginUrl: href,
      hostingAccount: text,
      serverIp: text,
      sslProvider: text,
      domainExpiry: text,
      hostingExpiry: text,
      sslExpiry: text,
      wpVersion: text,
      phpVersion: text,
      activeTheme: text,
      lastBackupAt: text,
      warnDays: int,
      importantLinks: links,
      notes: text,
    })
    .nullable(),
  topPosts: z.array(
    z.object({
      title: text,
      platform: z.string(),
      url: href,
      publishedAt: text,
      impressions: int,
      reach: int,
      clicks: int,
      engagements: int,
      leads: int,
    }),
  ),
  publisher: z
    .object({
      queued: int,
      sent: int,
      published: int,
      failed: int,
      cancelled: int,
      next: text,
      upcoming: z.array(z.object({ title: text, platform: z.string(), label: z.string(), scheduledAt: text })),
      accounts: z.array(z.object({ platform: z.string(), label: z.string() })),
      library: z.object({ total: int, images: int, videos: int, unused: int }),
    })
    .nullable(),
  social: z.array(
    z.object({
      platform: z.string(),
      label: z.string(),
      impressions: int,
      reach: int,
      clicks: int,
      engagements: int,
      leads: int,
      posts: int,
      followers: int,
    }),
  ),
  campaigns: z.array(
    z.object({
      name: z.string(),
      channel: text,
      objective: text,
      status: z.string(),
      startDate: text,
      endDate: text,
      budget: num,
      spend: num,
      impressions: int,
      clicks: int,
      leads: int,
      conversions: int,
      revenue: num,
    }),
  ),
  tasks: z.object({
    pending: int,
    inProgress: int,
    completed: int,
    failed: int,
    skipped: int,
    overdue: int,
    open: z.array(
      z.object({
        title: z.string(),
        status: z.string(),
        assignee: text,
        dueAt: text,
        overdue: z.boolean(),
      }),
    ),
  }),
  spending: spendingSchema.nullable(),
});

export type BusinessList = z.infer<typeof businessListSchema>;
export type BusinessSummary = z.infer<typeof summarySchema>;
export type BusinessDetail = z.infer<typeof businessDetailSchema>;
export type Kpis = z.infer<typeof kpisSchema>;
export type Renewal = z.infer<typeof renewalSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type Link = { label: string; url: string };

export type OsAnalyticsErrorCode =
  | "not_configured"
  | "unauthorized"
  | "disabled"
  | "locked"
  | "no_endpoint"
  | "unreachable"
  | "bad_response";

export class OsAnalyticsError extends Error {
  constructor(
    readonly code: OsAnalyticsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OsAnalyticsError";
  }
}

function config() {
  const { OS_ANALYTICS_URL: url, OS_ANALYTICS_KEY: key } = env();
  if (!url || !key) {
    throw new OsAnalyticsError(
      "not_configured",
      "OS Analytics isn't connected yet: set OS_ANALYTICS_URL and OS_ANALYTICS_KEY.",
    );
  }
  return { url, key };
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "the WordPress site";
  }
}

type WpError = { code?: unknown };

/** GET a connector path; returns parsed data, or null for the plugin's "business not found". */
async function request<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  const { url, key } = config();
  const host = hostOf(url);

  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      headers: { "X-OS-Key": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new OsAnalyticsError("unreachable", `Couldn't reach OS Analytics at ${host}.`);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const wpCode = typeof (body as WpError | null)?.code === "string" ? (body as { code: string }).code : "";

  if (!res.ok) {
    if (res.status === 404 && wpCode === "jdy_os_not_found") return null;
    if (res.status === 401) {
      throw new OsAnalyticsError(
        "unauthorized",
        "OS Analytics rejected the connection key. Generate a new one in the plugin's Settings and update OS_ANALYTICS_KEY.",
      );
    }
    if (res.status === 429) {
      throw new OsAnalyticsError("locked", "OS Analytics locked JodyOS out after failed attempts. It unlocks within 15 minutes.");
    }
    if (res.status === 403 && wpCode === "jdy_os_disabled") {
      throw new OsAnalyticsError("disabled", "The JodyOS connection is switched off on the WordPress site (no key generated).");
    }
    if (res.status === 404) {
      throw new OsAnalyticsError(
        "no_endpoint",
        `No JodyOS connector at ${host}. Check OS_ANALYTICS_URL and that OS Analytics ${PLUGIN_MIN_VERSION} or later is active.`,
      );
    }
    throw new OsAnalyticsError("unreachable", `OS Analytics at ${host} answered HTTP ${res.status}.`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new OsAnalyticsError(
      "bad_response",
      `OS Analytics sent data in a shape JodyOS doesn't recognise. Update the plugin to ${PLUGIN_MIN_VERSION} or later.`,
    );
  }
  return parsed.data;
}

/** Every business with 30-day numbers. Deduplicated per request. */
export const listBusinesses = cache(async (): Promise<BusinessList> => {
  const data = await request("/businesses", businessListSchema);
  if (!data) throw new OsAnalyticsError("no_endpoint", "OS Analytics returned no business list.");
  return data;
});

/** One business in full, or null when the slug doesn't exist. */
export const getBusiness = cache(async (slug: string): Promise<BusinessDetail | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return request(`/businesses/${slug}`, businessDetailSchema);
});

/** Run a fetch and turn connector failures into a value the UI can show. */
export async function settle<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: OsAnalyticsError }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof OsAnalyticsError) return { ok: false, error: err };
    throw err;
  }
}

/* ─── Derived values (pure) ─────────────────────────────────────────── */

/** Percent change, or null when there is no baseline to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export type AttentionItem = {
  level: "critical" | "warning";
  title: string;
  detail: string;
  href: string;
  sort: number;
};

export const RENEWAL_LABEL = { domain: "Domain", hosting: "Hosting", ssl: "SSL certificate" } as const;

export function dayCount(n: number) {
  return `${n} day${n === 1 ? "" : "s"}`;
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "20 Oct 2026" for a YYYY-MM-DD date, without any timezone shift. */
export function formatDay(date: string | null): string | null {
  if (!date) return null;
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ms) ? date : DAY.format(ms);
}

/** Whole days from today (UTC) to a YYYY-MM-DD date; null when it isn't a date. */
export function daysUntil(date: string, today: Date): number | null {
  const due = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(due)) return null;
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((due - todayMs) / 86_400_000);
}

/** `prefix` is "Business name: " on the all-businesses view and "" inside a business. */
function renewalAttention(b: BusinessSummary, prefix: string): AttentionItem[] {
  const href = businessHref(b.slug, "website");
  return b.renewals.flatMap((r): AttentionItem[] => {
    if (r.status === "expired") {
      const ago = r.daysLeft === null ? "" : ` ${dayCount(Math.abs(r.daysLeft))} ago`;
      return [{ level: "critical", title: `${prefix}${RENEWAL_LABEL[r.item]} expired`, detail: `Expired${ago} (${formatDay(r.date)}).`, href, sort: r.daysLeft ?? -999 }];
    }
    if (r.status === "soon") {
      const left = r.daysLeft === null ? "soon" : `in ${dayCount(r.daysLeft)}`;
      return [{ level: "warning", title: `${prefix}${RENEWAL_LABEL[r.item]} expires ${left}`, detail: `Renew before ${formatDay(r.date)}.`, href, sort: r.daysLeft ?? 0 }];
    }
    return [];
  });
}

function leadDropAttention(b: BusinessSummary, prefix: string): AttentionItem[] {
  const change = percentChange(b.last30.leads, b.previous30.leads);
  if (b.previous30.leads < 10 || change === null || change > -50) return [];
  return [
    {
      level: "warning",
      title: `${prefix}Leads down ${Math.abs(change)}%`,
      detail: `${b.last30.leads} in the last 30 days, ${b.previous30.leads} the 30 days before.`,
      href: businessHref(b.slug, "leads"),
      sort: 100,
    },
  ];
}

type UpcomingRenewal = NonNullable<BusinessList["spending"]>["upcomingRenewals"][number];

function subscriptionAttention(rows: UpcomingRenewal[], today: Date, hrefFor: (name: string) => string): AttentionItem[] {
  return rows.flatMap((r): AttentionItem[] => {
    const days = daysUntil(r.nextRenewal, today);
    if (days === null || days > 7) return [];
    return [
      {
        level: days < 0 ? "critical" : "warning",
        title: days < 0 ? `${r.name} renewal is overdue` : `${r.name} renews ${days === 0 ? "today" : `in ${dayCount(days)}`}`,
        detail: `${formatMoney(r.amount, r.currency)} ${r.cycle}${r.shared ? ", shared by all businesses" : ""}.`,
        href: hrefFor(r.name),
        sort: days,
      },
    ];
  });
}

function sortAttention(items: AttentionItem[]) {
  return items.sort((a, b) => (a.level === b.level ? a.sort - b.sort : a.level === "critical" ? -1 : 1));
}

/**
 * What needs the owner across all businesses: expired or expiring domains,
 * hosting and SSL; subscription renewals in the next 7 days; and a lead drop
 * of more than half against the previous 30 days.
 */
export function businessAttention(list: BusinessList, today: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const b of list.businesses) {
    if (!b.active) continue;
    items.push(...renewalAttention(b, `${b.name}: `), ...leadDropAttention(b, `${b.name}: `));
  }
  // A subscription that belongs to one business links to that business's Money tab.
  const slugById = new Map(list.businesses.map((b) => [b.id, b.slug]));
  const owner = new Map((list.spending?.subscriptions ?? []).map((s) => [s.name, slugById.get(s.businessId)]));
  items.push(
    ...subscriptionAttention(list.spending?.upcomingRenewals ?? [], today, (name) => {
      const slug = owner.get(name);
      return slug ? businessHref(slug, "money") : "/#spending";
    }),
  );
  return sortAttention(items);
}

/**
 * The same checks for one business, plus overdue tasks and posts that failed
 * to publish. Titles drop the business name: they show inside its tab.
 */
export function detailAttention(b: BusinessDetail, today: Date): AttentionItem[] {
  const items = [...renewalAttention(b, ""), ...leadDropAttention(b, "")];
  if (b.tasks.overdue > 0) {
    items.push({
      level: "warning",
      title: `${b.tasks.overdue} overdue task${b.tasks.overdue === 1 ? "" : "s"}`,
      detail: "Past their due date and not done yet.",
      href: businessHref(b.slug),
      sort: 50,
    });
  }
  if (b.publisher && b.publisher.failed > 0) {
    items.push({
      level: "warning",
      title: `${b.publisher.failed} social post${b.publisher.failed === 1 ? "" : "s"} failed to publish`,
      detail: "Open Social Publisher in OS Analytics to retry them.",
      href: businessHref(b.slug, "marketing"),
      sort: 60,
    });
  }
  items.push(...subscriptionAttention(b.spending?.upcomingRenewals ?? [], today, () => businessHref(b.slug, "money")));
  return sortAttention(items);
}

/** Money with either a symbol ("$") or an ISO code ("USD"). */
export function formatMoney(value: number, currency: string, fractionDigits?: number): string {
  const digits = fractionDigits ?? (Number.isInteger(value) ? 0 : 2);
  if (/^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch {
      // Unknown code: fall through to the plain format.
    }
  }
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${currency || "$"}${n}`;
}
