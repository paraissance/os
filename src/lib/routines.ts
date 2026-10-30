import "server-only";
import { z } from "zod";

/*
 * Claude Code routines: a saved Claude Code task on claude.ai that JodyOS
 * starts with one HTTP call, passing the request as text. The work runs in a
 * new Claude Code session on the owner's Claude plan (not API tokens); JodyOS
 * only gets that session's link back. The token stays on the server and never
 * appears in an error message.
 * https://code.claude.com/docs/en/routines#trigger-a-routine
 */

/** Businesses whose weekly Blotato campaign the campaign routine can run: JodyOS short name → its key in the program's config.py. */
export const CAMPAIGNS: Record<string, string> = { "agent-coach": "agent_broker_coach" };

export class RoutineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutineError";
  }
}

const fired = z.object({
  claude_code_session_url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://claude.ai/"), "not a claude.ai link"),
});

/** Starts the routine with `text` and returns the new session's link. */
export async function fireRoutine(routine: { id: string; token: string; envName: string }, text: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${encodeURIComponent(routine.id)}/fire`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${routine.token}`,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new RoutineError("Couldn't reach Claude. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new RoutineError(`Claude didn't accept the routine's token. Make a new one in the routine (API trigger) and update ${routine.envName}_TOKEN in Vercel.`);
  }
  if (res.status === 404) throw new RoutineError(`Claude couldn't find the routine. Check ${routine.envName}_ID in Vercel.`);
  if (res.status === 429) {
    const minutes = Math.max(1, Math.ceil(Number(res.headers.get("retry-after") ?? 60) / 60));
    throw new RoutineError(`Claude has had a lot of requests from this routine. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
  if (res.status === 400) throw new RoutineError("Claude refused the request. The routine may be paused: check it on claude.ai/code.");
  if (!res.ok) throw new RoutineError(`Claude Code is unavailable right now (HTTP ${res.status}). Try again shortly.`);
  const body = fired.safeParse(await res.json().catch(() => null));
  if (!body.success) throw new RoutineError("Claude started something but sent back no session link. Look for it on claude.ai/code.");
  return body.data.claude_code_session_url;
}
