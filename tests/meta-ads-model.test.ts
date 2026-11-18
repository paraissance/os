import { describe, expect, it } from "vitest";
import { campaignFunnel, costPer, funnelTotals, parseAdAccounts } from "@/lib/meta-ads-model";

const row = (id: string, spend: string, clicks: string, actions: [string, string][]) => ({
  campaign_id: id,
  campaign_name: `Campaign ${id}`,
  account_currency: "USD",
  spend,
  inline_link_clicks: clicks,
  actions: actions.map(([action_type, value]) => ({ action_type, value })),
});

describe("a campaign from ad to conversion", () => {
  it("counts site visits and each conversion once, ignoring Meta's overlapping totals", () => {
    const c = campaignFunnel(
      row("1", "120.50", "300", [
        ["link_click", "300"],
        ["landing_page_view", "210"],
        ["lead", "14"], // pixel leads + form leads, added together by Meta
        ["offsite_conversion.fb_pixel_lead", "9"],
        ["onsite_conversion.lead_grouped", "5"],
        ["offsite_conversion.fb_pixel_purchase", "2"],
        ["purchase", "2"],
      ]),
    );
    expect(c).toMatchObject({ spend: 120.5, clicks: 300, visits: 210, conversions: 16 });
    expect(c.byType).toEqual([
      { label: "leads", count: 9 },
      { label: "purchases", count: 2 },
      { label: "form leads", count: 5 },
    ]);
  });

  it("treats missing numbers as zero", () => {
    expect(campaignFunnel({ campaign_id: "2", campaign_name: "Quiet" })).toMatchObject({ spend: 0, clicks: 0, visits: 0, conversions: 0, byType: [] });
  });

  it("adds campaigns up and prices each step", () => {
    const t = funnelTotals([
      campaignFunnel(row("1", "100", "50", [["landing_page_view", "40"], ["offsite_conversion.fb_pixel_lead", "4"]])),
      campaignFunnel(row("2", "50", "25", [["landing_page_view", "20"], ["offsite_conversion.fb_pixel_lead", "1"]])),
    ]);
    expect(t).toEqual({ spend: 150, clicks: 75, visits: 60, conversions: 5, byType: [{ label: "leads", count: 5 }] });
    expect(costPer(t.spend, t.conversions)).toBe(30);
    expect(costPer(10, 0)).toBeNull();
  });
});

describe("which ad accounts belong to which business", () => {
  it("reads short-name=account pairs, with or without act_", () => {
    const map = parseAdAccounts(" example-co=act_111, other=222 ,example-co=333, example-co=111");
    expect(map.get("example-co")).toEqual(["111", "333"]);
    expect(map.get("other")).toEqual(["222"]);
  });

  it("reads nothing from a malformed value", () => {
    expect(parseAdAccounts("example-co:111").size).toBe(0);
    expect(parseAdAccounts(undefined).size).toBe(0);
  });
});
