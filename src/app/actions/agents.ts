"use server";

import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { agentsFileSchema } from "@/lib/agent-input";
import { importAgents } from "@/lib/agents";
import { requireUser } from "@/lib/auth/current-user";
import type { FormState } from "./form-state";

const MAX_BYTES = 900_000;

/** Drop the agents file: each agent lands on its business; nothing else changes. */
export async function importAgentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the agents file (jodyos-agents.json)." };
  if (file.size > MAX_BYTES) return { error: "That file is too big (over 900 KB)." };

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const parsed = agentsFileSchema.safeParse(json);
  if (!parsed.success) {
    const lines = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(" → ") || "file"}: ${i.message}`);
    return { error: ["The file couldn't be imported:", ...lines].join("\n") };
  }

  const { saved, unknown } = await importAgents(parsed.data);
  await logActivity({
    action: "ai.agents_imported",
    status: "success",
    userId: user.id,
    result: `AI agents: ${saved.length} saved${unknown.length ? `, ${unknown.length} skipped (no such business)` : ""}`,
    metadata: { saved, unknown },
  });
  refresh();
  return {
    message: [
      saved.length ? `Saved ${saved.length} agent${saved.length === 1 ? "" : "s"}: ${saved.join(", ")}.` : "No agents saved.",
      unknown.length ? `Skipped, no business with this short name: ${unknown.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
