"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";
import { refreshSocialAction } from "@/app/actions/social";
import { cx } from "@/components/ui/primitives";

/** "Refresh now": waits for Blotato, then shows the new posts. */
export function RefreshButton({ busy }: { busy: boolean }) {
  const [state, run, pending] = useActionState(refreshSocialAction, undefined);
  const working = pending || busy;
  return (
    <span className="flex items-center gap-3">
      {state?.error ? (
        <span className="text-sm font-semibold" role="alert">
          {state.error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => startTransition(() => run())}
        disabled={working}
        className={cx(
          "inline-flex min-h-9 items-center gap-2 rounded-full bg-wash px-4 text-sm font-semibold transition-colors hover:bg-mist disabled:cursor-default disabled:opacity-60",
        )}
      >
        <span aria-hidden="true" className={cx("inline-block", working && "animate-spin")}>
          ↻
        </span>
        {working ? "Refreshing…" : "Refresh"}
      </button>
    </span>
  );
}

/** While a refresh runs in the background, reload the page's data every few seconds so new posts appear on their own. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}
