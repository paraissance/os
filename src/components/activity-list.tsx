import type { ReactNode } from "react";
import type { activityLogs } from "@/lib/db/schema";
import { STATUS_TONE, formatDateTime, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";

type Row = typeof activityLogs.$inferSelect;

const ACTOR = { user: "You", ai: "AI", system: "System" } as const;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="label text-subtle">{label}</dt>
      <dd className="break-words text-muted">{children}</dd>
    </>
  );
}

/** One line each: what happened and when. The rest opens on a click. */
export function ActivityList({ rows, now, timeZone }: { rows: Row[]; now: Date; timeZone: string }) {
  return (
    <ul className="stagger">
      {rows.map((row) => {
        const summary = row.result ?? row.request ?? row.error ?? row.action;
        return (
          <li key={row.id} className="border-b border-paper last:border-b-0">
            <details>
              <summary className="shine flex cursor-pointer list-none items-center gap-3 px-6 py-4 transition-colors duration-200 hover:bg-mist [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{summary}</span>
                {row.status === "success" ? null : <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>}
                <time dateTime={row.createdAt.toISOString()} className="shrink-0 text-xs text-muted">
                  {formatRelative(row.createdAt, now)}
                </time>
              </summary>
              <dl className="grid animate-fade gap-x-4 gap-y-1 px-6 pb-4 text-xs sm:grid-cols-[auto_1fr]">
                <Detail label="When">{formatDateTime(row.createdAt, timeZone)}</Detail>
                <Detail label="Who">{ACTOR[row.actor]}</Detail>
                <Detail label="Action">
                  <code className="font-mono">{row.action}</code>
                </Detail>
                {row.tool ? <Detail label="Tool">{row.tool}</Detail> : null}
                {row.request && row.request !== summary ? <Detail label="Request">{row.request}</Detail> : null}
                {row.decision ? <Detail label="Decision">{row.decision}</Detail> : null}
                {row.error && row.error !== summary ? <Detail label="Error">{row.error}</Detail> : null}
                {row.metadata && Object.keys(row.metadata).length ? (
                  <Detail label="Details">
                    <span className="break-all font-mono">{JSON.stringify(row.metadata)}</span>
                  </Detail>
                ) : null}
              </dl>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
