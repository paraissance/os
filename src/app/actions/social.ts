"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/current-user";
import { BlotatoError, listChannels } from "@/lib/blotato";
import { getRecordById } from "@/lib/businesses";
import { env } from "@/lib/env";
import { CAMPAIGNS, RoutineError, fireRoutine } from "@/lib/routines";
import { getSyncState, setBrandAccounts, syncBlotato } from "@/lib/social";
import { channelKey } from "@/lib/social-model";
import type { FormState } from "./form-state";

const uuid = z.uuid();

/** Starts the campaign routine for one brand: the program schedules `days` days of posts and videos into Blotato. */
export async function runCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { CAMPAIGN_ROUTINE_ID, CAMPAIGN_ROUTINE_TOKEN } = env();
  if (!CAMPAIGN_ROUTINE_ID || !CAMPAIGN_ROUTINE_TOKEN) return { error: "The campaign routine isn't connected yet: see Integrations." };
  const slug = String(formData.get("brand") ?? "");
  const key = Object.hasOwn(CAMPAIGNS, slug) ? CAMPAIGNS[slug] : null;
  const days = z.coerce.number().int().min(1).max(14).safeParse(formData.get("days"));
  if (!key) return { error: "This brand has no campaign program." };
  if (!days.success) return { error: "Choose 1 to 14 days.", values: { days: String(formData.get("days") ?? "") } };

  const text = [`Brand: ${key} (in config.py)`, `Days: ${days.data}`, `Asked by: ${user.name}, from the JodyOS Social Media page`].join("\n");
  try {
    const link = await fireRoutine({ id: CAMPAIGN_ROUTINE_ID, token: CAMPAIGN_ROUTINE_TOKEN, envName: "CAMPAIGN_ROUTINE" }, text);
    await logActivity({ action: "social.campaign_started", status: "success", userId: user.id, request: text, result: link });
    return { message: `Started: ${days.data} day${days.data === 1 ? "" : "s"} of posts and videos. It takes about ${Math.max(5, days.data * 4)} minutes; the posts show here as Blotato schedules them.`, link };
  } catch (e) {
    if (!(e instanceof RoutineError)) throw e;
    await logActivity({ action: "social.campaign_started", status: "failure", userId: user.id, request: text, result: e.message });
    return { error: e.message };
  }
}

/** Saves which Blotato accounts belong to a business. The list is checked against Blotato, never taken from the form. */
export async function saveBrandAccountsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const businessId = uuid.safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Choose a business." };
  const business = await getRecordById(businessId.data);
  if (!business) return { error: "That business no longer exists." };

  const chosen = new Set(formData.getAll("channel").filter((v): v is string => typeof v === "string"));
  let channels;
  try {
    channels = (await listChannels()).filter((c) => chosen.has(channelKey(c)));
  } catch (e) {
    if (e instanceof BlotatoError) return { error: e.message };
    throw e;
  }
  if (!channels.length) return { error: "Tick at least one account, or use Remove brand." };

  await setBrandAccounts(business.id, channels);
  await logActivity({
    action: "social.accounts_linked",
    status: "success",
    userId: user.id,
    result: `${business.name}: ${channels.length} social account${channels.length === 1 ? "" : "s"}`,
  });
  // The first time, fetch posts straight away so the brand fills in.
  if (!(await getSyncState()).lastSyncAt) after(() => syncBlotato().then(() => undefined));
  redirect(`/social?b=${encodeURIComponent(business.slug)}`);
}

export async function removeBrandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const businessId = uuid.safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Choose a business." };
  const business = await getRecordById(businessId.data);
  if (!business) return { error: "That business no longer exists." };
  await setBrandAccounts(business.id, []);
  await logActivity({ action: "social.brand_removed", status: "success", userId: user.id, result: `${business.name} taken off Social Media` });
  redirect("/social");
}

/** "Refresh now": fetch from Blotato while the button waits (a few seconds, up to a minute once a day). */
export async function refreshSocialAction(): Promise<FormState> {
  const user = await requireUser();
  const result = await syncBlotato();
  if (!result.ok && "skipped" in result) return { message: "A refresh is already running. It will show up in a moment." };
  if (!result.ok) {
    await logActivity({ action: "social.refresh_failed", status: "failure", userId: user.id, error: result.error });
    return { error: result.error };
  }
  await logActivity({ action: "social.refreshed", status: "success", userId: user.id, result: `${result.posts} posts from Blotato` });
  refresh();
  return { message: "Up to date." };
}
