"use server";

import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { agentsFileSchema } from "@/lib/agent-input";
import { importAgents } from "@/lib/agents";
import { requireUser } from "@/lib/auth/current-user";
import { ZipError, isZip, readZip } from "@/lib/zip";
import type { FormState } from "./form-state";

const MAX_BYTES = 900_000;

/** The agents file's text: the .json itself, or the one inside a .zip. */
function agentsText(bytes: Buffer): { text: string } | { error: string } {
  if (!isZip(bytes)) return { text: bytes.toString("utf8") };
  let files: Map<string, Buffer>;
  try {
    files = readZip(bytes, MAX_BYTES);
  } catch (e) {
    return { error: e instanceof ZipError ? `That zip couldn't be opened: ${e.message}` : "That zip couldn't be opened." };
  }
  const names = [...files.keys()];
  const name = names.find((n) => /(^|\/)jodyos-agents\.json$/i.test(n)) ?? names.find((n) => n.toLowerCase().endsWith(".json"));
  if (name) return { text: files.get(name)!.toString("utf8") };
  if (names.some((n) => n.includes("includes/assistants/"))) {
    return { error: "That's the OS Analytics plugin itself. Upload jodyos-agents.zip, the agents file made from it." };
  }
  return { error: "There's no agents file (jodyos-agents.json) in that zip." };
}

/** Drop the agents file (.zip or .json): each agent lands on its business; nothing else changes. */
export async function importAgentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the agents file (jodyos-agents.zip)." };
  if (file.size > MAX_BYTES) return { error: "That file is too big (over 900 KB)." };

  const read = agentsText(Buffer.from(await file.arrayBuffer()));
  if ("error" in read) return { error: read.error };
  let json: unknown;
  try {
    json = JSON.parse(read.text);
  } catch {
    return { error: "That isn't an agents file (it isn't valid JSON)." };
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
