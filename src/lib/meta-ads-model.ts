/*
 * Facebook (Meta) ads, one line per campaign: spend → link clicks → site
 * visits (landing page views) → conversions. Pure, so it can be tested.
 */

/**
 * The conversions counted, as Meta reports them: the site's Meta Pixel events,
 * and leads from Facebook's own forms. One action type each, so nothing is
 * counted twice (Meta's plain "lead" adds the two together).
 */
const CONVERSIONS: [actionType: string, label: string][] = [
  ["offsite_conversion.fb_pixel_lead", "leads"],
  ["offsite_conversion.fb_pixel_complete_registration", "sign-ups"],
  ["offsite_conversion.fb_pixel_schedule", "bookings"],
  ["offsite_conversion.fb_pixel_contact", "contacts"],
  ["offsite_conversion.fb_pixel_submit_application", "applications"],
  ["offsite_conversion.fb_pixel_purchase", "purchases"],
  ["onsite_conversion.lead_grouped", "form leads"],
];

export type InsightRow = {
  campaign_id: string;
  campaign_name: string;
  account_currency?: string;
  spend?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
};

export type Funnel = { spend: number; clicks: number; visits: number; conversions: number; byType: { label: string; count: number }[] };
export type CampaignFunnel = Funnel & { id: string; name: string };

const num = (v: string | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function campaignFunnel(row: InsightRow): CampaignFunnel {
  const action = (type: string) => num(row.actions?.find((a) => a.action_type === type)?.value);
  const byType = CONVERSIONS.map(([type, label]) => ({ label, count: action(type) })).filter((c) => c.count > 0);
  return {
    id: row.campaign_id,
    name: row.campaign_name,
    spend: num(row.spend),
    clicks: num(row.inline_link_clicks),
    visits: action("landing_page_view"),
    conversions: byType.reduce((n, c) => n + c.count, 0),
    byType,
  };
}

/** All campaigns added up; conversion types keep their order. */
export function funnelTotals(rows: Funnel[]): Funnel {
  const byType = new Map<string, number>();
  for (const r of rows) for (const c of r.byType) byType.set(c.label, (byType.get(c.label) ?? 0) + c.count);
  return {
    spend: rows.reduce((n, r) => n + r.spend, 0),
    clicks: rows.reduce((n, r) => n + r.clicks, 0),
    visits: rows.reduce((n, r) => n + r.visits, 0),
    conversions: rows.reduce((n, r) => n + r.conversions, 0),
    byType: CONVERSIONS.flatMap(([, label]) => (byType.has(label) ? [{ label, count: byType.get(label)! }] : [])),
  };
}

/** "Spent ÷ conversions", or null when there were none. */
export function costPer(spend: number, count: number): number | null {
  return count > 0 ? spend / count : null;
}

export const AD_ACCOUNTS_FORMAT = /^\s*[a-z0-9][a-z0-9-]*\s*=\s*(act_)?\d+\s*(,\s*[a-z0-9][a-z0-9-]*\s*=\s*(act_)?\d+\s*)*$/;

/** "autismworks=123, mcnamer=act_456, mcnamer=789" → each business's ad account ids (digits only). */
export function parseAdAccounts(value: string | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!value || !AD_ACCOUNTS_FORMAT.test(value)) return map;
  for (const pair of value.split(",")) {
    const [slug, id] = pair.split("=").map((s) => s.trim());
    map.set(slug, [...new Set([...(map.get(slug) ?? []), id.replace(/^act_/, "")])]);
  }
  return map;
}
