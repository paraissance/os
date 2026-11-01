import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { requestNow } from "@/lib/clock";
import { listActivity } from "@/lib/activity";
import { ACTIVITY_STATUSES, type ActivityStatus } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { ActivityList } from "@/components/activity-list";
import { EmptyState, PageHeader, Panel, Skeleton, buttonClass, pillClass, pillTrack } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;

const ACTION_FILTERS = [
  { value: "", label: "All" },
  { value: "auth", label: "Auth" },
  { value: "ai", label: "AI" },
  { value: "settings", label: "Settings" },
];

export default function ActivityPage(props: PageProps<"/activity">) {
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Activity"
        description="Everything that happened in JodyOS, newest first. Secrets are removed before anything is written."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <ActivityView searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function ActivityView({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status = ACTIVITY_STATUSES.includes(statusParam as ActivityStatus) ? (statusParam as ActivityStatus) : undefined;
  const actionParam = first(sp.action) ?? "";
  const action = ACTION_FILTERS.some((f) => f.value === actionParam) ? actionParam : "";
  const beforeParam = first(sp.before);
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam) : undefined;

  const [rows, settings] = await Promise.all([
    listActivity({ status, action: action || undefined, before, limit: PAGE_SIZE + 1 }),
    getSettings(),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);

  const href = (next: { status?: string; action?: string; before?: string }) => {
    const q = new URLSearchParams();
    const s = "status" in next ? next.status : status;
    const a = "action" in next ? next.action : action;
    if (s) q.set("status", s);
    if (a) q.set("action", a);
    if (next.before) q.set("before", next.before);
    const qs = q.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={pillTrack} role="group" aria-label="Filter by type">
          {ACTION_FILTERS.map((f) => (
            <Link key={f.label} href={href({ action: f.value, before: undefined })} aria-current={action === f.value ? "true" : undefined} className={pillClass(action === f.value)}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className={pillTrack} role="group" aria-label="Filter by status">
          <Link href={href({ status: undefined, before: undefined })} aria-current={!status ? "true" : undefined} className={pillClass(!status)}>
            Any status
          </Link>
          {ACTIVITY_STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, before: undefined })} aria-current={status === s ? "true" : undefined} className={pillClass(status === s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      <Panel>
        {page.length ? (
          <ActivityList rows={page} now={requestNow()} timeZone={settings.timezone} detailed />
        ) : (
          <EmptyState title="Nothing matches.">No activity for this filter yet.</EmptyState>
        )}

        {hasMore || before ? (
          <div className="flex justify-between gap-3 border-t border-paper px-6 py-3">
            {before ? (
              <Link href={href({})} className={buttonClass("ghost")}>
                ← Newest
              </Link>
            ) : (
              <span />
            )}
            {hasMore ? (
              <Link href={href({ before: page[page.length - 1].createdAt.toISOString() })} className={buttonClass("light")}>
                Older →
              </Link>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
