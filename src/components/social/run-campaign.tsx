"use client";

import { useActionState } from "react";
import { runCampaignAction } from "@/app/actions/social";
import { Alert, Button, Input } from "@/components/ui/primitives";

/** "Run a campaign week": how many days, then the campaign routine does the rest in Claude Code. */
export function RunCampaign({ brand, name }: { brand: string; name: string }) {
  const [state, action, pending] = useActionState(runCampaignAction, undefined);
  return (
    <form action={action} className="space-y-3 rounded-3xl bg-wash p-6">
      <input type="hidden" name="brand" value={brand} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-lg font-extrabold">Run a campaign week</p>
          <p className="text-[15px] text-muted">
            Fresh posts, photo cards and videos for {name}, scheduled into Blotato: 16 images and 8 videos a day. Already-scheduled posts stay.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm font-semibold">
            Days
            <Input name="days" type="number" min={1} max={14} defaultValue={state?.values?.days ?? "7"} required className="mt-1 w-20 bg-paper" />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Starting…" : "Start"}
          </Button>
        </div>
      </div>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message && state.link ? (
        <Alert tone="ok">
          {state.message}{" "}
          <a href={state.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
            Watch it in Claude Code ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Alert>
      ) : null}
    </form>
  );
}
