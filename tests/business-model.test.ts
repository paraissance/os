import { describe, expect, it } from "vitest";
import {
  bookAttention,
  daysFrom,
  monthlyCost,
  monthlyTotal,
  mostUrgent,
  renewalWords,
  siteRenewals,
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

  it("totals the active subscriptions a month", () => {
    const subs = [
      sub({ amount: 15 }),
      sub({ amount: 120, billingCycle: "yearly" }),
      sub({ amount: 99, active: false }),
      sub({ amount: 4.99, billingCycle: "quarterly" }),
    ];
    expect(monthlyTotal(subs)).toBe(26.66);
  });
});

describe("attention", () => {
  const r = record({
    sites: [site({ domainExpiry: "2026-10-20", sslExpiry: "2026-10-01", hostingExpiry: "2027-06-01" })],
    subscriptions: [sub({ name: "Canva", nextRenewal: "2026-10-12" }), sub({ name: "Later", nextRenewal: "2026-10-30" })],
  });
  const shared = [sub({ businessId: null, name: "Scheduler", nextRenewal: "2026-10-15" })];

  it("across businesses: names each one, skips paused ones, lists shared tools once, urgent first", () => {
    const paused = record({ id: "b2", slug: "paused", name: "Paused", status: "paused", sites: [site({ sslExpiry: "2026-10-01" })] });
    const items = bookAttention({ businesses: [r, paused], shared }, today);
    expect(items.map((a) => [a.level, a.title, a.href])).toEqual([
      ["critical", "Example Leads: SSL certificate expired", "/businesses/example-leads/edit#websites"],
      ["warning", "Example Leads: Canva renews in 2 days", "/businesses/example-leads/edit#subscriptions"],
      ["warning", "Scheduler renews in 5 days", "/businesses#shared-tools"],
      ["warning", "Example Leads: Domain renews in 10 days", "/businesses/example-leads/edit#websites"],
    ]);
  });

  it("names the website when a business has more than one", () => {
    const two = record({ sites: [site({ domain: "a.example", sslExpiry: "2026-10-01" }), site({ domain: "b.example" })] });
    expect(bookAttention({ businesses: [two], shared: [] }, today)[0].title).toBe("Example Leads: SSL certificate (a.example) expired");
  });
});
