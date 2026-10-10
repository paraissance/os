"use client";

import { Button } from "@/components/ui/primitives";

// Shown when a page fails to render. The error message is deliberately not
// displayed: it could contain internal details. The digest ties it to server logs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <p className="label text-muted">Error</p>
      <h1 className="mt-3 text-5xl font-extrabold leading-[0.95] tracking-[-0.045em]">Something went wrong.</h1>
      <p className="mt-4 text-muted">The page couldn&apos;t load. It has been logged on the server.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-subtle">Reference {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
