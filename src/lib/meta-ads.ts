import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { campaignFunnel, parseAdAccounts, type CampaignFunnel } from "@/lib/meta-ads-model";
import type { Span } from "@/lib/traffic-model";

/*
 * Facebook (Meta) ads, read-only, through the Marketing API: each campaign's
 * last 7 or 30 days in the business's ad accounts. The token travels in a header,
 * never in a URL, and never appears in an error message.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export class MetaAdsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaAdsError";
  }
}

const rowSchema = z.object({
  campaign_id: z.string(),
  campaign_name: z.string(),
  account_currency: z.string().optional(),
  spend: z.string().optional(),
  inline_link_clicks: z.string().optional(),
  actions: z.array(z.object({ action_type: z.string(), value: z.string() })).optional(),
});
const insightsSchema = z.object({ data: z.array(rowSchema) });
const errorSchema = z.object({ error: z.object({ code: z.number().optional() }) });

/** The ad account ids set for this business in META_AD_ACCOUNTS (none when Meta isn't connected). */
export function adAccountsFor(slug: string): string[] {
  const { META_ADS_TOKEN, META_AD_ACCOUNTS } = env();
  return META_ADS_TOKEN ? (parseAdAccounts(META_AD_ACCOUNTS).get(slug) ?? []) : [];
}

async function accountInsights(accountId: string, token: string, span: Span) {
  const params = new URLSearchParams({
    level: "campaign",
    date_preset: `last_${span}d`,
    fields: "campaign_id,campaign_name,account_currency,spend,inline_link_clicks,actions",
    // shortcut: one page of 200 campaigns, plenty for campaigns with spend in 30 days; follow paging.next if that's ever exceeded.
    limit: "200",
  });
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/act_${accountId}/insights?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MetaAdsError("Couldn't reach Facebook. Try again in a moment.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code = errorSchema.safeParse(body).data?.error.code;
    if (code === 190) throw new MetaAdsError("Facebook didn't accept the token. Make a new one and update META_ADS_TOKEN in Vercel.");
    if (code === 4 || code === 17 || code === 613 || code === 80004) throw new MetaAdsError("Facebook asked JodyOS to slow down. The numbers come back in a few minutes.");
    if (code === 10 || code === 100 || code === 200 || code === 270) {
      throw new MetaAdsError(`The token can't read ad account ${accountId}. Give it access in Meta Business Settings, or check META_AD_ACCOUNTS.`);
    }
    throw new MetaAdsError(`Facebook answered HTTP ${res.status}.`);
  }
  const parsed = insightsSchema.safeParse(body);
  if (!parsed.success) throw new MetaAdsError("Facebook sent data in a shape JodyOS doesn't recognise.");
  return parsed.data.data;
}

/** The business's campaigns with any spend in the last `span` days, biggest spend first. */
export async function loadAds(accountIds: string[], span: Span): Promise<{ campaigns: CampaignFunnel[]; currency: string }> {
  const token = env().META_ADS_TOKEN;
  if (!token) throw new MetaAdsError("Facebook ads aren't connected yet: see Integrations.");
  const rows = (await Promise.all(accountIds.map((id) => accountInsights(id, token, span)))).flat();
  return {
    campaigns: rows.map(campaignFunnel).filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend),
    // shortcut: assumes one currency per business; show per-account currencies if a business ever mixes them.
    currency: rows[0]?.account_currency ?? "USD",
  };
}
