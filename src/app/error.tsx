"use client";

import { RefreshCw } from "lucide-react";
import { Button, Panel } from "@/components/ui/primitives";

// Shown when a page fails to render. The error message is deliberately not
// displayed: it could contain internal details. The digest ties it to server logs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <Panel className="w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">The page couldn&apos;t load. It has been logged on the server.</p>
        {error.digest ? <p className="mt-3 font-mono text-xs text-subtle">Reference: {error.digest}</p> : null}
        <Button className="mt-6" onClick={reset}>
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </Button>
      </Panel>
    </div>
  );
}
