import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { AgentsFile } from "@/lib/agent-input";
import { getDb } from "@/lib/db";
import { aiAgents, businessSites, businesses } from "@/lib/db/schema";
import { readSite, siteKnowledgeText } from "@/lib/site-reader";

/* The businesses' website AI assistants, as imported from the OS Analytics plugin. */

export type Agent = typeof aiAgents.$inferSelect & { business: { slug: string; name: string } };

/** Every agent with its business, in the dashboard's order. */
export async function listAgents(): Promise<Agent[]> {
  const db = await getDb();
  const rows = await db
    .select({ agent: aiAgents, business: { slug: businesses.slug, name: businesses.name } })
    .from(aiAgents)
    .innerJoin(businesses, eq(aiAgents.businessId, businesses.id))
    .orderBy(asc(businesses.sortOrder), asc(businesses.name));
  return rows.map((r) => ({ ...r.agent, business: r.business }));
}

/** One business's agent, by the business's short name, or null. */
export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ agent: aiAgents, business: { slug: businesses.slug, name: businesses.name } })
    .from(aiAgents)
    .innerJoin(businesses, eq(aiAgents.businessId, businesses.id))
    .where(eq(businesses.slug, slug))
    .limit(1);
  return row ? { ...row.agent, business: row.business } : null;
}

export type SiteLearning = { name: string; pages: number; problem: string | null };

/**
 * Reads every agent's business website (all at once) and saves what it says
 * on the agent. When a site can't be read, what the agent learned before stays.
 */
export async function learnFromWebsites(now: Date): Promise<SiteLearning[]> {
  const db = await getDb();
  const agents = await db
    .select({ id: aiAgents.id, businessId: businesses.id, name: businesses.name, websiteUrl: businesses.websiteUrl })
    .from(aiAgents)
    .innerJoin(businesses, eq(aiAgents.businessId, businesses.id))
    .orderBy(asc(businesses.sortOrder), asc(businesses.name));
  const sites = agents.length
    ? await db.select({ businessId: businessSites.businessId, url: businessSites.url, domain: businessSites.domain }).from(businessSites).where(inArray(businessSites.businessId, agents.map((a) => a.businessId)))
    : [];
  return Promise.all(
    agents.map(async (a): Promise<SiteLearning> => {
      const site = sites.find((s) => s.businessId === a.businessId);
      const address = a.websiteUrl ?? site?.url ?? (site ? `https://${site.domain}` : null);
      if (!address) return { name: a.name, pages: 0, problem: "No website saved for this business." };
      const { pages, problem } = await readSite(address);
      if (pages.length) await db.update(aiAgents).set({ siteKnowledge: siteKnowledgeText(pages), siteLearnedAt: now }).where(eq(aiAgents.id, a.id));
      return { name: a.name, pages: pages.length, problem };
    }),
  );
}

/**
 * Saves each agent on its business (matched by short name), replacing the
 * one it had. Agents for businesses JodyOS doesn't have are skipped and
 * reported. Nothing else about the businesses changes.
 */
export async function importAgents(file: AgentsFile): Promise<{ saved: string[]; unknown: string[] }> {
  const db = await getDb();
  const slugs = [...new Set(file.agents.map((a) => a.business))];
  const found = slugs.length ? await db.select({ id: businesses.id, slug: businesses.slug, name: businesses.name }).from(businesses).where(inArray(businesses.slug, slugs)) : [];
  const bySlug = new Map(found.map((b) => [b.slug, b]));
  const saved: string[] = [];
  const unknown: string[] = [];

  await db.transaction(async (tx) => {
    for (const a of file.agents) {
      const business = bySlug.get(a.business);
      if (!business) {
        unknown.push(a.business);
        continue;
      }
      const fields = {
        name: a.name,
        tagline: a.tagline,
        language: a.language,
        safetyProfile: a.safetyProfile,
        brandColor: a.colors?.brand ?? null,
        accentColor: a.colors?.accent ?? null,
        ctaLabel: a.cta?.label ?? null,
        ctaUrl: a.cta?.url ?? null,
        greeting: a.greeting,
        note: a.note,
        starters: a.starters,
        keywords: a.keywords,
        fallbackLinks: a.fallbackLinks,
        knowledge: a.knowledge,
        instructions: a.instructions,
        crisis: a.crisis,
        shortcode: a.shortcode,
      };
      await tx
        .insert(aiAgents)
        .values({ businessId: business.id, ...fields })
        .onConflictDoUpdate({ target: aiAgents.businessId, set: { ...fields, updatedAt: new Date() } });
      saved.push(business.name);
    }
  });
  return { saved, unknown };
}
