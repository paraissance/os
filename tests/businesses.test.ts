import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  businessInput,
  describeIssues,
  importFileSchema,
  linkInput,
  normalizeDomain,
  siteInput,
  slugify,
  subscriptionInput,
} from "@/lib/business-input";
import {
  BusinessError,
  createBusiness,
  deleteBusiness,
  deletePart,
  exportBook,
  getRecord,
  importBook,
  loadBook,
  moveBusiness,
  saveLink,
  saveSite,
  saveSubscription,
  updateBusiness,
} from "@/lib/businesses";
import { useTestDatabase } from "./helpers/db";

const biz = (over: Record<string, unknown> = {}) => businessInput.parse({ name: "Example Leads", ...over });

describe("what the owner may type", () => {
  it("makes short names from names", () => {
    expect(slugify("McNamer.com Coaching!")).toBe("mcnamer-com-coaching");
    expect(slugify("  Café Société  ")).toBe("cafe-societe");
    expect(slugify("!!!")).toBe("");
  });

  it("adds https:// to web addresses and refuses anything that isn't a web link", () => {
    expect(linkInput.parse({ label: "Site", url: "example.com/page" }).url).toBe("https://example.com/page");
    expect(linkInput.parse({ label: "Site", url: " http://example.com " }).url).toBe("http://example.com");
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", ""]) {
      expect(linkInput.safeParse({ label: "x", url: bad }).success, bad).toBe(false);
    }
    expect(biz({ websiteUrl: "", ctaUrl: "  " })).toMatchObject({ websiteUrl: null, ctaUrl: null });
    expect(businessInput.safeParse({ name: "x", websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("cleans up domains and checks dates", () => {
    expect(normalizeDomain("https://www.Example.com/about?x=1")).toBe("example.com");
    expect(siteInput.parse({ domain: "WWW.Example.COM" }).domain).toBe("example.com");
    expect(siteInput.safeParse({ domain: "not a domain" }).success).toBe(false);
    expect(siteInput.parse({ domain: "a.com", domainExpiry: "2026-12-31", domainAutoRenew: "on" })).toMatchObject({ domainExpiry: "2026-12-31", domainAutoRenew: true });
    expect(siteInput.safeParse({ domain: "a.com", sslExpiry: "31/12/2026" }).success).toBe(false);
    expect(siteInput.safeParse({ domain: "a.com", sslExpiry: "2026-02-31" }).success).toBe(false);
  });

  it("reads prices the way people type them", () => {
    expect(subscriptionInput.parse({ name: "Canva", amount: "$1,299.50" }).amount).toBe(1299.5);
    expect(subscriptionInput.parse({ name: "Free", amount: "" })).toMatchObject({ amount: 0, currency: "USD", billingCycle: "monthly", category: "other" });
    expect(subscriptionInput.parse({ name: "x", category: "made-up", currency: "eur" })).toMatchObject({ category: "other", currency: "EUR" });
    expect(subscriptionInput.safeParse({ name: "x", amount: "-5" }).success).toBe(false);
    expect(subscriptionInput.safeParse({ name: "x", amount: "lots" }).success).toBe(false);
  });

  it("explains import mistakes by business", () => {
    const file = { format: "jodyos-businesses", version: 1, businesses: [{ slug: "a", name: "A", sites: [{ domain: "nope" }] }] };
    const r = importFileSchema.safeParse(file);
    expect(r.success).toBe(false);
    if (!r.success) expect(describeIssues(r.error, file)).toEqual(["Business 1 (a) → sites → 0 → domain: Enter the domain, like example.com."]);
    expect(importFileSchema.safeParse({ ...file, format: "something-else" }).success).toBe(false);
  });
});

describe("businesses in the database", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  beforeAll(async () => (ctx = await useTestDatabase()));
  afterAll(() => ctx.close());

  it("adds a business with a short name made from its name, numbered when taken", async () => {
    const a = await createBusiness(biz());
    const b = await createBusiness(biz());
    expect([a.slug, b.slug]).toEqual(["example-leads", "example-leads-2"]);
    expect(b.sortOrder).toBe(a.sortOrder + 1);
    await expect(updateBusiness(b.id, biz({ slug: "example-leads" }))).rejects.toThrow(BusinessError);
    const renamed = await updateBusiness(b.id, biz({ name: "Second", slug: "Second One" }));
    expect(renamed.slug).toBe("second-one");
    await deleteBusiness(renamed.id);
  });

  it("keeps links, websites and subscriptions with their business, and deletes them with it", async () => {
    const a = (await getRecord("example-leads"))!;
    const link = await saveLink(a.id, null, linkInput.parse({ label: "Instagram", url: "instagram.com/x", kind: "social" }));
    await saveLink(a.id, link.id, linkInput.parse({ label: "Instagram (main)", url: "instagram.com/x", kind: "social" }));
    await saveSite(a.id, null, siteInput.parse({ domain: "leads.example.com", sslExpiry: "2026-10-01" }));
    await saveSubscription(a.id, null, subscriptionInput.parse({ name: "Canva", amount: "15" }));
    const shared = await saveSubscription(null, null, subscriptionInput.parse({ name: "Scheduler", amount: "29" }));

    const book = await loadBook();
    const rec = book.businesses.find((b) => b.slug === "example-leads")!;
    expect(rec.links.map((l) => l.label)).toEqual(["Instagram (main)"]);
    expect(rec.sites.map((s) => s.domain)).toEqual(["leads.example.com"]);
    expect(rec.subscriptions.map((s) => [s.name, s.amount])).toEqual([["Canva", 15]]);
    expect(book.shared.map((s) => s.name)).toEqual(["Scheduler"]);

    expect(await deletePart("subscription", shared.id)).toBe(true);
    expect(await deletePart("subscription", shared.id)).toBe(false);
    await expect(saveLink("00000000-0000-4000-8000-000000000000", null, linkInput.parse({ label: "x", url: "x.com" }))).rejects.toThrow(BusinessError);
  });

  it("moves a business up and down the tab order", async () => {
    const second = await createBusiness(biz({ name: "Zeta" }));
    await moveBusiness(second.id, "up");
    expect((await loadBook()).businesses.map((b) => b.name)).toEqual(["Zeta", "Example Leads"]);
    await moveBusiness(second.id, "up"); // already first: no change
    expect((await loadBook()).businesses[0].name).toBe("Zeta");
    await deleteBusiness(second.id);
  });

  it("imports a file: adds new businesses, replaces an existing one's parts, replaces shared tools", async () => {
    const file = importFileSchema.parse({
      format: "jodyos-businesses",
      version: 1,
      businesses: [
        {
          slug: "example-leads",
          name: "Example Leads Co",
          tagline: "Leads for agents",
          links: [{ label: "Facebook", url: "facebook.com/x", kind: "social" }],
          sites: [{ domain: "leads.example.com", registrar: "Example Registrar" }],
        },
        { slug: "new-one", name: "New One", faqs: [{ question: "Price?", answer: "Ask us." }], subscriptions: [{ name: "Host", amount: 120, billingCycle: "yearly" }] },
      ],
      sharedSubscriptions: [{ name: "AI tool", amount: 20 }],
    });
    const summary = await importBook(file);
    expect(summary).toEqual({ created: ["New One"], updated: ["Example Leads Co"], shared: 1 });

    const book = await loadBook();
    const leads = book.businesses.find((b) => b.slug === "example-leads")!;
    expect(leads).toMatchObject({ name: "Example Leads Co", tagline: "Leads for agents" });
    expect(leads.links.map((l) => l.label)).toEqual(["Facebook"]); // the old Instagram link was replaced
    expect(leads.subscriptions).toEqual([]); // Canva wasn't in the file
    expect(leads.sites.map((s) => s.registrar)).toEqual(["Example Registrar"]);
    expect(book.businesses.find((b) => b.slug === "new-one")!.faqs.map((f) => f.question)).toEqual(["Price?"]);
    expect(book.shared.map((s) => s.name)).toEqual(["AI tool"]);
  });

  it("leaves shared tools alone when the file doesn't list them, and refuses duplicates", async () => {
    await importBook(importFileSchema.parse({ format: "jodyos-businesses", version: 1, businesses: [] }));
    expect((await loadBook()).shared.map((s) => s.name)).toEqual(["AI tool"]);
    const dup = importFileSchema.parse({ format: "jodyos-businesses", version: 1, businesses: [{ slug: "x", name: "X" }, { slug: "x", name: "X again" }] });
    await expect(importBook(dup)).rejects.toThrow(/twice/);
    expect((await loadBook()).businesses.some((b) => b.slug === "x")).toBe(false);
  });

  it("exports everything in the format it imports, so a backup restores exactly", async () => {
    const file = await exportBook(new Date("2026-10-14T10:00:00Z"));
    const parsed = importFileSchema.parse(JSON.parse(JSON.stringify(file)));
    expect(parsed.businesses.map((b) => b.slug)).toEqual(["example-leads", "new-one"]);

    for (const b of (await loadBook()).businesses) await deleteBusiness(b.id);
    expect((await loadBook()).businesses).toEqual([]);
    await importBook(parsed);
    const again = await exportBook(new Date("2026-10-14T10:00:00Z"));
    expect(again).toEqual(file);
  });
});
