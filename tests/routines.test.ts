import { afterEach, describe, expect, it, vi } from "vitest";
import { RoutineError, fireRoutine } from "@/lib/routines";

const routine = { id: "trig_example123", token: "sk-ant-oat01-example-not-real", envName: "SITE_ROUTINE" };

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Claude Code routine", () => {
  it("starts the routine with the request as text and returns the session link", async () => {
    const fetch = respond(200, { type: "routine_fire", claude_code_session_id: "s1", claude_code_session_url: "https://claude.ai/code/s1" });
    expect(await fireRoutine(routine, "Website: example.com\nThe change: new headline")).toBe("https://claude.ai/code/s1");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/claude_code/routines/trig_example123/fire");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk-ant-oat01-example-not-real", "anthropic-version": "2023-06-01" });
    expect(JSON.parse(String(init?.body))).toEqual({ text: "Website: example.com\nThe change: new headline" });
  });

  it("says plainly what to fix, and never repeats the token", async () => {
    respond(401, { error: "bad token" });
    const err = await fireRoutine(routine, "x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RoutineError);
    expect((err as Error).message).toContain("SITE_ROUTINE_TOKEN");
    expect((err as Error).message).not.toContain(routine.token);

    respond(429, {}, { "retry-after": "120" });
    await expect(fireRoutine(routine, "x")).rejects.toThrow("Try again in 2 minutes.");
    respond(404, {});
    await expect(fireRoutine(routine, "x")).rejects.toThrow("SITE_ROUTINE_ID");
  });

  it("only hands back a claude.ai link", async () => {
    respond(200, { claude_code_session_url: "https://evil.example/code/s1" });
    await expect(fireRoutine(routine, "x")).rejects.toThrow("no session link");
  });
});
