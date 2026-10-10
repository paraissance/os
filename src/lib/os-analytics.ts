import "server-only";
import { cache } from "react";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * Client for the OS Analytics WordPress plugin's JodyOS connector
 * (`/wp-json/jdy/v1/os/*`, plugin 1.2.0+). Read-only. Every response is
 * validated, so a plugin/JodyOS version mismatch shows up as a clear error
 * instead of wrong numbers. The connection key never appears in errors.
 */

const num = z.number().finite();
const int = z.number().int();

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

const spendingSchema = z.object({
  monthlyTotal: num,
  yearlyTotal: num,
  activeSubscriptions: int,
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

export const businessDetailSchema = summarySchema.extend({
  pipeline: z.object({
    new: int,
    contacted: int,
    qualified: int,
    appointment: int,
    approved: int,
    closed: int,
    lost: int,
  }),
  trend: z.array(z.object({ date: z.string(), leads: int })),
  site: z
    .object({
      domain: z.string().nullable(),
      registrar: z.string().nullable(),
      registrarAccount: z.string().nullable(),
      domainAutoRenew: z.boolean(),
      hostingProvider: z.string().nullable(),
      hostingPlan: z.string().nullable(),
      sslProvider: z.string().nullable(),
      domainExpiry: z.string().nullable(),
      hostingExpiry: z.string().nullable(),
      sslExpiry: z.string().nullable(),
      wpVersion: z.string().nullable(),
      phpVersion: z.string().nullable(),
      activeTheme: z.string().nullable(),
      lastBackupAt: z.string().nullable(),
      warnDays: int,
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
      channel: z.string().nullable(),
      status: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      budget: num,
      spend: num,
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
  }),
  spending: spendingSchema.nullable(),
});

export type BusinessList = z.infer<typeof businessListSchema>;
export type BusinessSummary = z.infer<typeof summarySchema>;
export type BusinessDetail = z.infer<typeof businessDetailSchema>;
export type Kpis = z.infer<typeof kpisSchema>;

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
        `No JodyOS connector at ${host}. Check OS_ANALYTICS_URL and that OS Analytics 1.2.0 or later is active.`,
      );
    }
    throw new OsAnalyticsError("unreachable", `OS Analytics at ${host} answered HTTP ${res.status}.`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new OsAnalyticsError(
      "bad_response",
      "OS Analytics sent data in a shape JodyOS doesn't recognise. Update the plugin to 1.2.0 or later.",
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

const ITEM_LABEL = { domain: "Domain", hosting: "Hosting", ssl: "SSL certificate" } as const;

function dayCount(n: number) {
  return `${n} day${n === 1 ? "" : "s"}`;
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
    const href = `/businesses/${b.slug}`;
    for (const r of b.renewals) {
      if (r.status === "expired") {
        const ago = r.daysLeft === null ? "" : ` ${dayCount(Math.abs(r.daysLeft))} ago`;
        items.push({ level: "critical", title: `${b.name}: ${ITEM_LABEL[r.item]} expired`, detail: `Expired${ago} (${r.date}).`, href, sort: r.daysLeft ?? -999 });
      } else if (r.status === "soon") {
        const left = r.daysLeft === null ? "soon" : `in ${dayCount(r.daysLeft)}`;
        items.push({ level: "warning", title: `${b.name}: ${ITEM_LABEL[r.item]} expires ${left}`, detail: `Renew before ${r.date}.`, href, sort: r.daysLeft ?? 0 });
      }
    }
    const change = percentChange(b.last30.leads, b.previous30.leads);
    if (b.previous30.leads >= 10 && change !== null && change <= -50) {
      items.push({
        level: "warning",
        title: `${b.name}: leads down ${Math.abs(change)}%`,
        detail: `${b.last30.leads} in the last 30 days, ${b.previous30.leads} the 30 days before.`,
        href,
        sort: 100,
      });
    }
  }

  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (const r of list.spending?.upcomingRenewals ?? []) {
    const due = Date.parse(`${r.nextRenewal}T00:00:00Z`);
    if (Number.isNaN(due)) continue;
    const days = Math.round((due - todayMs) / 86_400_000);
    if (days > 7) continue;
    items.push({
      level: days < 0 ? "critical" : "warning",
      title: days < 0 ? `${r.name} renewal is overdue` : `${r.name} renews ${days === 0 ? "today" : `in ${dayCount(days)}`}`,
      detail: `${formatMoney(r.amount, r.currency)} ${r.cycle}.`,
      href: "/businesses",
      sort: days,
    });
  }

  return items.sort((a, b) => (a.level === b.level ? a.sort - b.sort : a.level === "critical" ? -1 : 1));
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
