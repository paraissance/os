"use client";

import { useActionState, useEffect, useState } from "react";
import { learnFromWebsitesAction } from "@/app/actions/agents";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";

/** Reads every agent's website again; takes up to a minute. */
export function LearnWebsites() {
  const [state, action, pending] = useActionState(learnFromWebsitesAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Reading… (up to a minute)" : "Learn from the websites"}
      </Button>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok"><span className="whitespace-pre-line">{state.message}</span></Alert> : null}
    </form>
  );
}

/** Copies a snippet; says so for two seconds. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={buttonClass("primary", "min-h-9! px-4!")}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * Loads the real website widget (/agent.js) on this page, open, and removes
 * it again when the page is left, so it doesn't follow you around JodyOS.
 * As a preview it doesn't count page views.
 */
export function TryAgent({ slug }: { slug: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/agent.js";
    script.defer = true;
    script.dataset.agent = slug;
    script.dataset.open = "";
    script.dataset.preview = "";
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.querySelectorAll(`[data-jodyos-agent="${slug}"]`).forEach((n) => n.remove());
      delete (window as unknown as Record<string, unknown>)[`__jodyosAgent_${slug}`];
    };
  }, [slug]);
  return null;
}
