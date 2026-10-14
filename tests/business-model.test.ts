import { describe, expect, it } from "vitest";
import {
  bookAttention,
  daysFrom,
  linkGroups,
  monthlyCost,
  mostUrgent,
  recordAttention,
  renewalWords,
  siteRenewals,
  spending,
  upcomingDates,
  type BusinessRecord,
  type BusinessSite,
  type Subscription,
} from "@/lib/business-model";

const today = new Date("2026-10-10T12:00:00Z");
const at = new Date("2026-01-01T00:00:00Z");

function site(over: Partial<BusinessSite> = {}): BusinessSite {
  return {
    id: crypto.randomUUID(),
    businessId: "b1",
    domain: "leads.example.com",
    url: null,
    platform: null,
    editUrl: null,
    registrar: null,
    registrarAccount: null,
    registrarLoginUrl: null,
    domainExpiry: null,
    domainAutoRenew: false,
    hostingProvider: null,
    hostingPlan: null,
    hostingAccount: null,
    hostingLoginUrl: null,
    hostingExpiry: null,
    sslProvider: null,
    sslExpiry: null,
    serverIp: null,
    nameservers: null,
    lastBackup: null,
    notes: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: crypto.randomUUID(),
    businessId: "b1",
    name: "Tool",
    category: "other",
    billingCycle: "monthly",
    amount: 10,
    currency: "USD",
    nextRenewal: null,
    loginUrl: null,
    account: null,
    notes: null,
    active: true,
    createdAt: at,
    updatedAt: at,
    ...over,
  };
}

function record(over: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    id: "b1",
    slug: "example-leads",
    name: "Example Leads",
    tagline: null,
    about: null,
    websiteUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    status: "active",
    notes: null,
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
    links: [],
    faqs: [],
    sites: [],
    subscriptions: [],
    ...over,
  };
}

describe("renewals", () => {
  it("dates each of a site's renewals: expired, within 30 days, or fine", () => {
    const rs = siteRenewals(site({ domainExpiry: "2026-10-20", hostingExpiry: "2027-03-01", sslExpiry: "2026-10-01" }), today);
    expect(rs.map((r) => [r.item, r.status, r.daysLeft])).toEqual([
      ["domain", "soon", 10],
      ["hosting", "ok", 142],
      ["ssl", "expired", -9],
    ]);
    expect(siteRenewals(site({ domainExpiry: "2026-11-09" }), today)[0].status).toBe("soon"); // day 30 still counts
    expect(siteRenewals(site({ domainExpiry: "2026-11-10" }), today)[0].status).toBe("ok");
    expect(siteRenewals(site(), today)).toEqual([]);
  });

  it("says it plainly and picks the most urgent", () => {
    const rs = siteRenewals(site({ domainExpiry: "2026-10-20", hostingExpiry: "2027-03-01", sslExpiry: "2026-10-09" }), today);
    expect(rs.map(renewalWords)).toEqual(["Renews in 10 days", "OK until 1 Mar 2027", "Expired 1 day ago"]);
    expect(renewalWords({ status: "soon", daysLeft: 0, date: "2026-10-10" })).toBe("Renews today");
    expect(mostUrgent(rs)?.item).toBe("ssl");
    expect(mostUrgent(rs.filter((r) => r.status !== "expired"))?.item).toBe("domain");
    expect(mostUrgent(rs.filter((r) => r.status === "ok"))).toBeNull();
  });

  it("counts days in UTC", () => {
    expect(daysFrom(today, "2026-10-15")).toBe(5);
    expect(daysFrom(today, "2026-10-10")).toBe(0);
    expect(daysFrom(today, "nope")).toBeNull();
  });
});

describe("money", () => {
  it("turns any billing cycle into a monthly cost", () => {
    expect(monthlyCost(120, "yearly")).toBe(10);
    expect(monthlyCost(30, "quarterly")).toBe(10);
    expect(monthlyCost(10, "monthly")).toBe(10);
    expect(monthlyCost(500, "one_time")).toBe(0);
  });

  it("totals active subscriptions by category and lists what renews within 30 days", () => {
    const s = spending(
      [
        sub({ name: "Canva", category: "design", amount: 15, nextRenewal: "2026-10-12" }),
        sub({ name: "Host", category: "hosting", amount: 120, billingCycle: "yearly", nextRenewal: "2026-12-01" }),
        sub({ name: "Old", amount: 99, active: false, nextRenewal: "2026-10-11" }),
        sub({ name: "Late", category: "design", amount: 5, nextRenewal: "2026-10-01" }),
      ],
      today,
    );
    expect(s.monthly).toBe(30);
    expect(s.yearly).toBe(360);
    expect(s.count).toBe(3);
    expect(s.byCategory).toEqual([
      { category: "design", label: "Design and media", monthly: 20 },
      { category: "hosting", label: "Hosting and domains", monthly: 10 },
    ]);
    expect(s.upcoming.map((u) => [u.sub.name, u.daysLeft])).toEqual([
      ["Late", -9],
      ["Canva", 2],
    ]);
  });
});

describe("attention", () => {
  const r = record({
    sites: [site({ domainExpiry: "2026-10-20", sslExpiry: "2026-10-01", hostingExpiry: "2027-06-01" })],
    subscriptions: [sub({ name: "Canva", nextRenewal: "2026-10-12" }), sub({ name: "Later", nextRenewal: "2026-10-30" })],
  });
  const shared = [sub({ businessId: null, name: "Scheduler", nextRenewal: "2026-10-15" })];

  it("inside a business: renewals, its tools and shared tools due within a week, urgent first", () => {
    expect(recordAttention(r, shared, today).map((a) => [a.level, a.title, a.href])).toEqual([
      ["critical", "SSL certificate expired", "/?b=example-leads&s=website"],
      ["warning", "Canva renews in 2 days", "/?b=example-leads&s=money"],
      ["warning", "Scheduler renews in 5 days", "/?b=example-leads&s=money"],
      ["warning", "Domain renews in 10 days", "/?b=example-leads&s=website"],
    ]);
  });

  it("names the website when a business has more than one", () => {
    const two = record({ sites: [site({ domain: "a.example", sslExpiry: "2026-10-01" }), site({ domain: "b.example" })] });
    expect(recordAttention(two, [], today)[0].title).toBe("SSL certificate (a.example) expired");
  });

  it("across businesses: names each one, skips paused ones, lists shared tools once", () => {
    const paused = record({ id: "b2", slug: "paused", name: "Paused", status: "paused", sites: [site({ sslExpiry: "2026-10-01" })] });
    const items = bookAttention({ businesses: [r, paused], shared }, today);
    expect(items.map((a) => a.title)).toEqual([
      "Example Leads: SSL certificate expired",
      "Example Leads: Canva renews in 2 days",
      "Scheduler renews in 5 days",
      "Example Leads: Domain renews in 10 days",
    ]);
    expect(items[2].href).toBe("/businesses#shared-tools");
  });
});

describe("links and dates", () => {
  const r = record({
    websiteUrl: "https://leads.example.com",
    ctaLabel: "Book a call",
    ctaUrl: "https://leads.example.com/book",
    links: [
      { id: "l1", businessId: "b1", label: "Home again", url: "https://www.leads.example.com/", kind: "page", note: null, sortOrder: 0, createdAt: at },
      { id: "l2", businessId: "b1", label: "Instagram", url: "https://instagram.com/example", kind: "social", note: null, sortOrder: 1, createdAt: at },
      { id: "l3", businessId: "b1", label: "CRM", url: "https://crm.example/login", kind: "login", note: "owner", sortOrder: 2, createdAt: at },
    ],
    faqs: [{ id: "f1", businessId: "b1", question: "Price?", answer: null, linkLabel: "Pricing", linkUrl: "https://leads.example.com/pricing", sortOrder: 0, createdAt: at }],
    sites: [
      site({ registrar: "GoDaddy", registrarLoginUrl: "https://sso.godaddy.com", registrarAccount: "Main", domainExpiry: "2026-12-01", editUrl: "https://editor.example.com/leads" }),
    ],
    subscriptions: [sub({ name: "Canva", loginUrl: "https://canva.com/login", account: "me@x", nextRenewal: "2026-10-20" })],
  });
  const shared = [sub({ businessId: null, name: "Scheduler", loginUrl: "https://sched.example", nextRenewal: "2027-05-01" })];

  it("groups every link, without duplicates, and leaves out empty groups", () => {
    const groups = linkGroups(r, shared);
    expect(groups.map((g) => [g.id, g.links.map((l) => l.label)])).toEqual([
      ["pages", ["Website", "Book a call", "Pricing"]],
      ["social", ["Instagram"]],
      ["logins", ["CRM", "Edit leads.example.com", "Domain · GoDaddy", "Canva", "Scheduler"]],
    ]);
    expect(groups[2].links.find((l) => l.label === "Scheduler")?.note).toBe("shared");
    expect(linkGroups(r, shared, { leads: "https://wp.example/wp-admin/admin.php?page=jdy-leads" }).at(-1)).toMatchObject({ id: "admin", links: [{ label: "Leads" }] });
    expect(linkGroups(record(), [])).toEqual([]);
  });

  it("lists what's due in the next 90 days, soonest first", () => {
    expect(upcomingDates(r, shared, today).map((d) => [d.what, d.daysLeft])).toEqual([
      ["Canva · $10", 10],
      ["Domain · leads.example.com", 52],
    ]);
  });
});
