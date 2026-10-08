import { Bot, Cpu, User } from "lucide-react";
import type { activityLogs } from "@/lib/db/schema";
import { STATUS_TONE, formatDateTime, formatRelative } from "@/lib/format";
import { Badge, StatusDot } from "@/components/ui/primitives";

type Row = typeof activityLogs.$inferSelect;

const ACTOR_ICON = { user: User, ai: Bot, system: Cpu } as const;

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
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const Icon = ACTOR_ICON[row.actor];
        const summary = row.result ?? row.request ?? row.error ?? row.action;
        return (
          <li key={row.id} className="flex gap-3 px-5 py-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
              <Icon className="size-4 text-subtle" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <code className="font-mono text-[13px] text-fg">{row.action}</code>
                <Badge tone={STATUS_TONE[row.status]}>
                  <StatusDot tone={STATUS_TONE[row.status]} />
                  {row.status}
                </Badge>
                {row.tool ? <Badge tone="accent">{row.tool}</Badge> : null}
              </div>
              <p className="mt-1 break-words text-sm text-muted">{summary}</p>
              {detailed ? (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-subtle sm:grid-cols-[auto_1fr]">
                  {row.request && row.request !== summary ? (
                    <>
                      <dt>Request</dt>
                      <dd className="break-words text-muted">{row.request}</dd>
                    </>
                  ) : null}
                  {row.decision ? (
                    <>
                      <dt>Decision</dt>
                      <dd className="break-words text-muted">{row.decision}</dd>
                    </>
                  ) : null}
                  {row.error && row.error !== summary ? (
                    <>
                      <dt>Error</dt>
                      <dd className="break-words text-bad">{row.error}</dd>
                    </>
                  ) : null}
                  {row.metadata && Object.keys(row.metadata).length ? (
                    <>
                      <dt>Details</dt>
                      <dd className="break-all font-mono text-muted">{JSON.stringify(row.metadata)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </div>
            <time
              dateTime={row.createdAt.toISOString()}
              title={formatDateTime(row.createdAt, timeZone)}
              className="shrink-0 pt-0.5 text-xs text-subtle"
            >
              {formatRelative(row.createdAt, now)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
