import "server-only";
import { asc, eq, inArray, isNull } from "drizzle-orm";
import { cache } from "react";
import {
  IMPORT_FORMAT,
  slugify,
  type BusinessInput,
  type FaqInput,
  type ImportFile,
  type LinkInput,
  type SiteInput,
  type SubscriptionInput,
} from "@/lib/business-input";
import type { BusinessBook, BusinessRecord, Subscription } from "@/lib/business-model";
import { getDb, type Database } from "@/lib/db";
import { businessFaqs, businessLinks, businessSites, businesses, subscriptions } from "@/lib/db/schema";

/*
 * The owner's businesses in JodyOS's own database. Every read goes through
 * loadBook() (one pass over five small tables, deduplicated per request);
 * every write is a single Drizzle statement or one transaction.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class BusinessError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

/** Every business with its links, questions, websites and tools, plus the shared tools. */
export const loadBook = cache(async (): Promise<BusinessBook> => {
  const db = await getDb();
  const [bs, links, faqs, sites, subs] = await Promise.all([
    db.select().from(businesses).orderBy(asc(businesses.sortOrder), asc(businesses.name)),
    db.select().from(businessLinks).orderBy(asc(businessLinks.sortOrder), asc(businessLinks.createdAt)),
    db.select().from(businessFaqs).orderBy(asc(businessFaqs.sortOrder), asc(businessFaqs.createdAt)),
    db.select().from(businessSites).orderBy(asc(businessSites.createdAt)),
    db.select().from(subscriptions).orderBy(asc(subscriptions.name)),
  ]);
  const of = <T extends { businessId: string | null }>(rows: T[], id: string) => rows.filter((r) => r.businessId === id);
  return {
    businesses: bs.map((b) => ({
      ...b,
      links: of(links, b.id),
      faqs: of(faqs, b.id),
      sites: of(sites, b.id),
      subscriptions: of(subs, b.id),
    })),
    shared: subs.filter((s) => s.businessId === null),
  };
});

export async function getRecord(slug: string): Promise<BusinessRecord | null> {
  const book = await loadBook();
  return book.businesses.find((b) => b.slug === slug) ?? null;
}

/* ─── Businesses ──────────────────────────────────────────────────── */

async function slugTaken(db: Database | Tx, slug: string, exceptId?: string) {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return Boolean(row && row.id !== exceptId);
}

/** The slug to use: the one typed, or one made from the name (numbered if taken). */
async function resolveSlug(db: Database, input: BusinessInput, exceptId?: string): Promise<string> {
  if (input.slug) {
    if (await slugTaken(db, input.slug, exceptId)) throw new BusinessError("Another business already uses this short name.", "slug");
    return input.slug;
  }
  const base = slugify(input.name) || "business";
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await slugTaken(db, candidate, exceptId))) return candidate;
  }
  throw new BusinessError("Couldn't make a short name for this business. Type one in.", "slug");
}

function businessValues(input: BusinessInput, slug: string) {
  return {
    slug,
    name: input.name,
    tagline: input.tagline,
    about: input.about,
    websiteUrl: input.websiteUrl,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    status: input.status,
    notes: input.notes,
  };
}

export async function createBusiness(input: BusinessInput) {
  const db = await getDb();
  const slug = await resolveSlug(db, input);
  const all = await db.select({ order: businesses.sortOrder }).from(businesses);
  const sortOrder = all.reduce((m, r) => Math.max(m, r.order), -1) + 1;
  const [row] = await db.insert(businesses).values({ ...businessValues(input, slug), sortOrder }).returning();
  return row;
}

export async function updateBusiness(id: string, input: BusinessInput) {
  const db = await getDb();
  const slug = await resolveSlug(db, input, id);
  const [row] = await db
    .update(businesses)
    .set({ ...businessValues(input, slug), updatedAt: new Date() })
    .where(eq(businesses.id, id))
    .returning();
  if (!row) throw new BusinessError("That business no longer exists.");
  return row;
}

export async function deleteBusiness(id: string) {
  const db = await getDb();
  const [row] = await db.delete(businesses).where(eq(businesses.id, id)).returning({ name: businesses.name });
  return row ?? null;
}

/** Move a business one place up or down in the tab order. */
export async function moveBusiness(id: string, direction: "up" | "down") {
  const db = await getDb();
  const all = await db.select({ id: businesses.id }).from(businesses).orderBy(asc(businesses.sortOrder), asc(businesses.name));
  const i = all.findIndex((b) => b.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.transaction(async (tx) => {
    for (const [order, b] of all.entries()) await tx.update(businesses).set({ sortOrder: order }).where(eq(businesses.id, b.id));
  });
}

/* ─── Parts of a business ─────────────────────────────────────────── */

async function requireBusiness(db: Database, businessId: string) {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!row) throw new BusinessError("That business no longer exists.");
}

export async function saveLink(businessId: string, id: string | null, input: LinkInput) {
  const db = await getDb();
  await requireBusiness(db, businessId);
  if (id) {
    const [row] = await db.update(businessLinks).set(input).where(eq(businessLinks.id, id)).returning();
    if (!row) throw new BusinessError("That link no longer exists.");
    return row;
  }
  const count = (await db.select({ id: businessLinks.id }).from(businessLinks).where(eq(businessLinks.businessId, businessId))).length;
  const [row] = await db.insert(businessLinks).values({ ...input, businessId, sortOrder: count }).returning();
  return row;
}

export async function saveFaq(businessId: string, id: string | null, input: FaqInput) {
  const db = await getDb();
  await requireBusiness(db, businessId);
  if (id) {
    const [row] = await db.update(businessFaqs).set(input).where(eq(businessFaqs.id, id)).returning();
    if (!row) throw new BusinessError("That question no longer exists.");
    return row;
  }
  const count = (await db.select({ id: businessFaqs.id }).from(businessFaqs).where(eq(businessFaqs.businessId, businessId))).length;
  const [row] = await db.insert(businessFaqs).values({ ...input, businessId, sortOrder: count }).returning();
  return row;
}

export async function saveSite(businessId: string, id: string | null, input: SiteInput) {
  const db = await getDb();
  await requireBusiness(db, businessId);
  if (id) {
    const [row] = await db.update(businessSites).set({ ...input, updatedAt: new Date() }).where(eq(businessSites.id, id)).returning();
    if (!row) throw new BusinessError("That website no longer exists.");
    return row;
  }
  const [row] = await db.insert(businessSites).values({ ...input, businessId }).returning();
  return row;
}

/** businessId null = a tool shared by every business. */
export async function saveSubscription(businessId: string | null, id: string | null, input: SubscriptionInput) {
  const db = await getDb();
  if (businessId) await requireBusiness(db, businessId);
  if (id) {
    const [row] = await db
      .update(subscriptions)
      .set({ ...input, businessId, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    if (!row) throw new BusinessError("That subscription no longer exists.");
    return row;
  }
  const [row] = await db.insert(subscriptions).values({ ...input, businessId }).returning();
  return row;
}

const PART_TABLES = { link: businessLinks, faq: businessFaqs, site: businessSites, subscription: subscriptions } as const;
export type PartKind = keyof typeof PART_TABLES;

export async function deletePart(kind: PartKind, id: string) {
  const db = await getDb();
  const table = PART_TABLES[kind];
  const rows = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
  return rows.length > 0;
}

/* ─── Import and export ───────────────────────────────────────────── */

export type ImportSummary = { created: string[]; updated: string[]; shared: number | null };

/**
 * Bring in a businesses file. A business is matched by its short name
 * (slug): new ones are added, existing ones are updated and their links,
 * questions, websites and subscriptions are replaced by the file's. When
 * the file lists shared subscriptions, they replace the current ones.
 * All or nothing: one transaction.
 */
export async function importBook(file: ImportFile): Promise<ImportSummary> {
  const db = await getDb();
  const slugs = file.businesses.map((b) => b.slug);
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new BusinessError(`The file lists "${dup}" twice.`);

  return db.transaction(async (tx) => {
    const summary: ImportSummary = { created: [], updated: [], shared: null };
    const existing = slugs.length ? await tx.select({ id: businesses.id, slug: businesses.slug }).from(businesses).where(inArray(businesses.slug, slugs)) : [];
    const all = await tx.select({ s: businesses.sortOrder }).from(businesses);
    let nextOrder = all.reduce((m, r) => Math.max(m, r.s), -1) + 1;

    for (const b of file.businesses) {
      const values = businessValues(b, b.slug);
      const found = existing.find((e) => e.slug === b.slug);
      let id: string;
      if (found) {
        id = found.id;
        await tx.update(businesses).set({ ...values, updatedAt: new Date() }).where(eq(businesses.id, id));
        await tx.delete(businessLinks).where(eq(businessLinks.businessId, id));
        await tx.delete(businessFaqs).where(eq(businessFaqs.businessId, id));
        await tx.delete(businessSites).where(eq(businessSites.businessId, id));
        await tx.delete(subscriptions).where(eq(subscriptions.businessId, id));
        summary.updated.push(b.name);
      } else {
        const [row] = await tx.insert(businesses).values({ ...values, sortOrder: nextOrder++ }).returning({ id: businesses.id });
        id = row.id;
        summary.created.push(b.name);
      }
      if (b.links.length) await tx.insert(businessLinks).values(b.links.map((l, i) => ({ ...l, businessId: id, sortOrder: i })));
      if (b.faqs.length) await tx.insert(businessFaqs).values(b.faqs.map((f, i) => ({ ...f, businessId: id, sortOrder: i })));
      if (b.sites.length) await tx.insert(businessSites).values(b.sites.map((s) => ({ ...s, businessId: id })));
      if (b.subscriptions.length) await tx.insert(subscriptions).values(b.subscriptions.map((s) => ({ ...s, businessId: id })));
    }

    if (file.sharedSubscriptions) {
      await tx.delete(subscriptions).where(isNull(subscriptions.businessId));
      if (file.sharedSubscriptions.length) {
        await tx.insert(subscriptions).values(file.sharedSubscriptions.map((s) => ({ ...s, businessId: null })));
      }
      summary.shared = file.sharedSubscriptions.length;
    }
    return summary;
  });
}

function exportSubscription(s: Subscription) {
  return {
    name: s.name,
    category: s.category,
    billingCycle: s.billingCycle,
    amount: s.amount,
    currency: s.currency,
    nextRenewal: s.nextRenewal,
    loginUrl: s.loginUrl,
    account: s.account,
    notes: s.notes,
    active: s.active,
  };
}

/** Everything, in the same format importBook() reads: a backup the owner can keep. */
export async function exportBook(now: Date) {
  const book = await loadBook();
  return {
    format: IMPORT_FORMAT,
    version: 1 as const,
    exportedAt: now.toISOString(),
    businesses: book.businesses.map((b) => ({
      slug: b.slug,
      name: b.name,
      tagline: b.tagline,
      about: b.about,
      websiteUrl: b.websiteUrl,
      ctaLabel: b.ctaLabel,
      ctaUrl: b.ctaUrl,
      status: b.status,
      notes: b.notes,
      links: b.links.map((l) => ({ label: l.label, url: l.url, kind: l.kind, note: l.note })),
      faqs: b.faqs.map((f) => ({ question: f.question, answer: f.answer, linkLabel: f.linkLabel, linkUrl: f.linkUrl })),
      sites: b.sites.map((s) => ({
        domain: s.domain,
        url: s.url,
        platform: s.platform,
        registrar: s.registrar,
        registrarAccount: s.registrarAccount,
        registrarLoginUrl: s.registrarLoginUrl,
        domainExpiry: s.domainExpiry,
        domainAutoRenew: s.domainAutoRenew,
        hostingProvider: s.hostingProvider,
        hostingPlan: s.hostingPlan,
        hostingAccount: s.hostingAccount,
        hostingLoginUrl: s.hostingLoginUrl,
        hostingExpiry: s.hostingExpiry,
        sslProvider: s.sslProvider,
        sslExpiry: s.sslExpiry,
        serverIp: s.serverIp,
        nameservers: s.nameservers,
        lastBackup: s.lastBackup,
        notes: s.notes,
      })),
      subscriptions: b.subscriptions.map(exportSubscription),
    })),
    sharedSubscriptions: book.shared.map(exportSubscription),
  };
}
