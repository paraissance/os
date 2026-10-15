import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { AgentsFile } from "@/lib/agent-input";
import { getDb } from "@/lib/db";
import { aiAgents, businesses } from "@/lib/db/schema";

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
