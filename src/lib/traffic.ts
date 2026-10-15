import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businessSites, businesses, siteTraffic } from "@/lib/db/schema";
import { dayKey } from "@/lib/format";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { daysEnding, fromOwnSite, isBot, siteHosts, summarize, type Traffic } from "@/lib/traffic-model";

/*
 * Website visits, counted by the agent line (public/agent.js): one row per
 * business per day. Nothing about the visitor is kept, not even the IP
 * address; a browser says itself whether it's its first page that day.
 */

/** Far above these sites' real traffic: a flood of fake visits stops counting here. */
const MAX_VIEWS = { limit: 3000, windowMs: 10 * 60_000 };

/** Counts one page view. False when it doesn't count (a bot, another site, an unknown business). */
export async function recordVisit(visit: { slug: string; origin: string | null; userAgent: string | null; firstToday: boolean; now: Date }): Promise<boolean> {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(visit.slug) || isBot(visit.userAgent)) return false;
  const db = await getDb();
  const rows = await db
    .select({ id: businesses.id, websiteUrl: businesses.websiteUrl, domain: businessSites.domain, url: businessSites.url })
    .from(businesses)
    .leftJoin(businessSites, eq(businessSites.businessId, businesses.id))
    .where(eq(businesses.slug, visit.slug));
  if (!rows.length) return false;
  if (!fromOwnSite(visit.origin, siteHosts([rows[0].websiteUrl, ...rows.flatMap((r) => [r.domain, r.url])]))) return false;
  if (!(await consumeRateLimit(`visits:${visit.slug}`, MAX_VIEWS.limit, MAX_VIEWS.windowMs, visit.now)).allowed) return false;

  const { timezone } = await getSettings();
  const visitors = visit.firstToday ? 1 : 0;
  await db
    .insert(siteTraffic)
    .values({ businessId: rows[0].id, day: dayKey(visit.now, timezone), views: 1, visitors, lastVisitAt: visit.now })
    .onConflictDoUpdate({
      target: [siteTraffic.businessId, siteTraffic.day],
      set: { views: sql`${siteTraffic.views} + 1`, visitors: sql`${siteTraffic.visitors} + ${visitors}`, lastVisitAt: visit.now },
    });
  return true;
}

/** The last 30 days of a business's traffic (and the 30 before, to compare). */
export async function loadTraffic(businessId: string, now: Date, timeZone: string): Promise<Traffic> {
  const today = dayKey(now, timeZone);
  const db = await getDb();
  const rows = await db
    .select({ date: siteTraffic.day, visitors: siteTraffic.visitors, views: siteTraffic.views, lastVisitAt: siteTraffic.lastVisitAt })
    .from(siteTraffic)
    .where(and(eq(siteTraffic.businessId, businessId), gte(siteTraffic.day, daysEnding(today, 60)[0])));
  return summarize(rows, today);
}
