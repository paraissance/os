import { z } from "zod";
import { BILLING_CYCLES, BUSINESS_STATUSES, LINK_KINDS } from "@/lib/business-constants";

/*
 * What the owner may type (or import) for a business. Shared by the Server
 * Actions, the import and the tests. Forms send strings, imports send JSON;
 * both pass through the same rules: blanks become null, web addresses get
 * "https://" when it's missing and must be http(s).
 */

export const CATEGORIES = {
  ai: "AI",
  social: "Social media",
  email: "Email",
  hosting: "Hosting and domains",
  crm: "CRM and leads",
  ads: "Advertising",
  analytics: "Analytics",
  design: "Design and media",
  automation: "Automation",
  storage: "Storage and backup",
  other: "Other",
} as const;
export type CategoryId = keyof typeof CATEGORIES;
const CATEGORY_IDS = Object.keys(CATEGORIES) as [CategoryId, ...CategoryId[]];

export const CYCLE_LABELS: Record<(typeof BILLING_CYCLES)[number], string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  quarterly: "Every 3 months",
  one_time: "One-time",
};

export const LINK_KIND_LABELS: Record<(typeof LINK_KINDS)[number], string> = {
  page: "Web page",
  social: "Social media",
  login: "Login page",
  tool: "Tool or app",
  other: "Other",
};

/** "McNamer.com Coaching!" → "mcnamer-com-coaching". */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** "https://www.Example.com/about" → "example.com". */
export function normalizeDomain(value: string): string {
  let v = value.trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split(/[/?#]/)[0];
  v = v.replace(/:\d+$/, "").replace(/^www\./, "").replace(/\.$/, "");
  return v;
}

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

const blankToNull = (v: unknown) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  return v;
};

const optText = (max: number) => z.preprocess(blankToNull, z.string().max(max, `Keep this under ${max.toLocaleString("en-US")} characters.`).nullable());

const reqText = (max: number, message: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string({ error: message }).min(1, message).max(max, `Keep this under ${max} characters.`));

const withScheme = (v: unknown) => {
  const s = blankToNull(v);
  if (typeof s !== "string") return s;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
};

const URL_MESSAGE = "Enter a web address, like example.com/page.";
const optUrl = z.preprocess(withScheme, z.string().max(2000).refine(isHttpUrl, URL_MESSAGE).nullable());
const reqUrl = z.preprocess(withScheme, z.string({ error: URL_MESSAGE }).max(2000).refine(isHttpUrl, URL_MESSAGE));

const optDate = z.preprocess(
  blankToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.")
    // JavaScript quietly rolls 2026-02-31 over to March; the database wouldn't.
    .refine((d) => {
      const t = new Date(`${d}T00:00:00Z`);
      return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
    }, "That date doesn't exist.")
    .nullable(),
);

/** Checkbox "on", JSON true or "true" → true; anything else → false. */
const flag = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

export const businessInput = z.object({
  name: reqText(120, "Give the business a name."),
  /** Empty means "make one from the name". */
  slug: z.preprocess((v) => (typeof v === "string" ? slugify(v) : ""), z.string().max(60)),
  tagline: optText(200),
  about: optText(20_000),
  websiteUrl: optUrl,
  ctaLabel: optText(80),
  ctaUrl: optUrl,
  status: z.preprocess((v) => blankToNull(v) ?? "active", z.enum(BUSINESS_STATUSES)),
  notes: optText(5_000),
});

export const linkInput = z.object({
  label: reqText(120, "Give the link a name."),
  url: reqUrl,
  kind: z.preprocess((v) => blankToNull(v) ?? "page", z.enum(LINK_KINDS)),
  note: optText(200),
});

export const faqInput = z.object({
  question: reqText(300, "Write the question."),
  answer: optText(5_000),
  linkLabel: optText(80),
  linkUrl: optUrl,
});

export const siteInput = z.object({
  domain: z.preprocess(
    (v) => (typeof v === "string" ? normalizeDomain(v) : v),
    z.string({ error: "Enter the domain, like example.com." }).regex(DOMAIN_RE, "Enter the domain, like example.com."),
  ),
  url: optUrl,
  platform: optText(80),
  editUrl: optUrl,
  registrar: optText(120),
  registrarAccount: optText(200),
  registrarLoginUrl: optUrl,
  domainExpiry: optDate,
  domainAutoRenew: flag,
  hostingProvider: optText(120),
  hostingPlan: optText(120),
  hostingAccount: optText(200),
  hostingLoginUrl: optUrl,
  hostingExpiry: optDate,
  sslProvider: optText(120),
  sslExpiry: optDate,
  serverIp: optText(64),
  nameservers: optText(1_000),
  lastBackup: optDate,
  notes: optText(5_000),
});

export const subscriptionInput = z.object({
  name: reqText(120, "Name the tool or service."),
  category: z.preprocess((v) => {
    const s = blankToNull(v);
    return typeof s === "string" && s in CATEGORIES ? s : "other";
  }, z.enum(CATEGORY_IDS)),
  billingCycle: z.preprocess((v) => blankToNull(v) ?? "monthly", z.enum(BILLING_CYCLES)),
  amount: z.preprocess(
    (v) => {
      const s = blankToNull(v);
      if (s === null) return 0;
      return typeof s === "string" ? Number(s.replace(/[$,\s]/g, "")) : s;
    },
    z.number({ error: "Enter the price as a number, like 29 or 29.99." }).min(0, "The price can't be negative.").max(1_000_000_000),
  ),
  currency: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "USD"),
    z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, like USD."),
  ),
  nextRenewal: optDate,
  loginUrl: optUrl,
  account: optText(200),
  notes: optText(2_000),
});

/* ─── Import file ─────────────────────────────────────────────────── */

export const IMPORT_FORMAT = "jodyos-businesses";

const importSubscription = subscriptionInput.extend({ active: z.boolean().default(true) });

const importBusiness = businessInput.extend({
  slug: z.preprocess((v) => (typeof v === "string" ? slugify(v) : v), z.string().regex(SLUG_RE, "Every business needs a short name (slug).")),
  links: z.array(linkInput).max(300).default([]),
  faqs: z.array(faqInput).max(300).default([]),
  sites: z.array(siteInput).max(50).default([]),
  subscriptions: z.array(importSubscription).max(300).default([]),
});

export const importFileSchema = z.object({
  format: z.literal(IMPORT_FORMAT, { error: `This isn't a JodyOS businesses file (format must be "${IMPORT_FORMAT}").` }),
  version: z.literal(1, { error: "This file was made by a newer JodyOS." }),
  businesses: z.array(importBusiness).max(200),
  /** When present, replaces every shared subscription. */
  sharedSubscriptions: z.array(importSubscription).max(500).optional(),
});

export type BusinessInput = z.infer<typeof businessInput>;
export type LinkInput = z.infer<typeof linkInput>;
export type FaqInput = z.infer<typeof faqInput>;
export type SiteInput = z.infer<typeof siteInput>;
export type SubscriptionInput = z.infer<typeof subscriptionInput>;
export type ImportFile = z.infer<typeof importFileSchema>;

/** Field → first message, for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

/** "Business 3 (example-leads) → sites → 1 → domain: Enter the domain…", for import errors. */
export function describeIssues(error: z.ZodError, file: unknown, max = 5): string[] {
  const slugAt = (i: number) => {
    const b = (file as { businesses?: { slug?: unknown }[] })?.businesses?.[i];
    return typeof b?.slug === "string" ? ` (${b.slug})` : "";
  };
  return error.issues.slice(0, max).map((issue) => {
    const [head, index, ...rest] = issue.path;
    const where =
      head === "businesses" && typeof index === "number"
        ? [`Business ${index + 1}${slugAt(index)}`, ...rest.map(String)].join(" → ")
        : issue.path.map(String).join(" → ") || "File";
    return `${where}: ${issue.message}`;
  });
}
