"use client";

import { useActionState } from "react";
import { askClaudeAction } from "@/app/actions/websites";
import { Alert, Button, Textarea } from "@/components/ui/primitives";

/** "What should Claude change?" for one website: starts a Claude Code session and links to it. */
export function AskClaude({ siteId, domain }: { siteId: string; domain: string }) {
  const [state, action, pending] = useActionState(askClaudeAction, undefined);
  const id = `ask-${siteId}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="siteId" value={siteId} />
      <label htmlFor={id} className="sr-only">
        Ask Claude to change {domain}
      </label>
      <Textarea
        id={id}
        name="change"
        rows={3}
        required
        minLength={3}
        maxLength={4000}
        placeholder="Change the homepage headline to “Honest guidance for your home”"
        defaultValue={state?.values?.change}
      />
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message && state.link ? (
        <Alert tone="ok">
          {state.message}{" "}
          <a href={state.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
            Open the session ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send to Claude"}
        </Button>
      </div>
    </form>
  );
}
