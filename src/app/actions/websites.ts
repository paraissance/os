"use server";

import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/current-user";
import { loadBook } from "@/lib/businesses";
import { env } from "@/lib/env";
import { RoutineError, fireRoutine } from "@/lib/routines";
import type { FormState } from "./form-state";

/** Sends the owner's change for one website to the website routine in Claude Code. */
export async function askClaudeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { SITE_ROUTINE_ID, SITE_ROUTINE_TOKEN } = env();
  if (!SITE_ROUTINE_ID || !SITE_ROUTINE_TOKEN) return { error: "The Claude Code routine isn't connected yet: see Integrations." };

  const siteId = z.uuid().safeParse(formData.get("siteId"));
  const change = String(formData.get("change") ?? "").trim();
  const values = { change: change.slice(0, 4000) };
  if (change.length < 3) return { error: "Say what Claude should change.", values };
  if (change.length > 4000) return { error: "That's a lot for one request: keep it under 4,000 characters, or split it.", values };

  const book = siteId.success ? await loadBook() : null;
  const found = book?.businesses.flatMap((b) => b.sites.map((site) => ({ site, business: b }))).find((x) => x.site.id === siteId.data);
  if (!found) return { error: "That website couldn't be found.", values };
  const { site, business } = found;

  const text = [
    `Website: ${site.domain} (${business.name})`,
    `Live address: ${site.url ?? `https://${site.domain}`}`,
    `Asked by: ${user.name}, from the JodyOS Websites page`,
    "",
    "The change:",
    change,
  ].join("\n");
  try {
    const link = await fireRoutine({ id: SITE_ROUTINE_ID, token: SITE_ROUTINE_TOKEN, envName: "SITE_ROUTINE" }, text);
    await logActivity({ action: "websites.claude_asked", status: "success", userId: user.id, request: text, result: link });
    return { message: `Claude is on it. Follow along, or reply, in the session.`, link };
  } catch (e) {
    if (!(e instanceof RoutineError)) throw e;
    await logActivity({ action: "websites.claude_asked", status: "failure", userId: user.id, request: text, result: e.message });
    return { error: e.message, values };
  }
}
