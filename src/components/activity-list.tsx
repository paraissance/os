import type { activityLogs } from "@/lib/db/schema";
import { STATUS_TONE, formatDateTime, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";

type Row = typeof activityLogs.$inferSelect;

const ACTOR = { user: "You", ai: "AI", system: "System" } as const;

export function ActivityList({
  rows,
  now,
  timeZone,
  detailed = false,
}: {
  rows: Row[];
  now: Date;
  timeZone: string;
  detailed?: boolean;
}) {
  return (
    <ul className="stagger">
      {rows.map((row) => {
        const summary = row.result ?? row.request ?? row.error ?? row.action;
        return (
          <li
            key={row.id}
            className="grid gap-x-4 gap-y-1 border-b border-paper px-5 py-3.5 last:border-b-0 sm:grid-cols-[6.5rem_1fr]"
          >
            <time
              dateTime={row.createdAt.toISOString()}
              title={formatDateTime(row.createdAt, timeZone)}
              className="text-xs leading-6 text-muted"
            >
              {formatRelative(row.createdAt, now)}
            </time>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <code className="font-mono text-[13px] font-semibold">{row.action}</code>
                <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                <span className="label text-muted">{ACTOR[row.actor]}</span>
                {row.tool ? <Badge>{row.tool}</Badge> : null}
              </div>
              <p className="mt-1 break-words text-sm text-muted">{summary}</p>
              {detailed ? (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                  {row.request && row.request !== summary ? (
                    <>
                      <dt className="label text-subtle">Request</dt>
                      <dd className="break-words text-muted">{row.request}</dd>
                    </>
                  ) : null}
                  {row.decision ? (
                    <>
                      <dt className="label text-subtle">Decision</dt>
                      <dd className="break-words text-muted">{row.decision}</dd>
                    </>
                  ) : null}
                  {row.error && row.error !== summary ? (
                    <>
                      <dt className="label text-subtle">Error</dt>
                      <dd className="break-words font-semibold">{row.error}</dd>
                    </>
                  ) : null}
                  {row.metadata && Object.keys(row.metadata).length ? (
                    <>
                      <dt className="label text-subtle">Details</dt>
                      <dd className="break-all font-mono text-muted">{JSON.stringify(row.metadata)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
