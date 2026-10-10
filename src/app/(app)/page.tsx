import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { activitySummary, listActivity } from "@/lib/activity";
import { envStatus } from "@/lib/env";
import { DAY_MS, requestNow } from "@/lib/clock";
import { greeting } from "@/lib/format";
import { MODULES, PHASES } from "@/lib/modules";
import { businessAttention, formatMoney, listBusinesses, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { modelInfo } from "@/lib/ai/models";
import { ActivityList } from "@/components/activity-list";
import { Delta } from "@/components/business-bits";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  Skeleton,
  StatusDot,
  buttonClass,
  type Tone,
} from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-10 h-36 w-full" />}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <StatusStrip />
      </Suspense>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section>
            <h2 className="label mb-3">Ask Jody Core</h2>
            <Form action="/command" className="flex flex-col sm:flex-row">
              <label htmlFor="quick-command" className="sr-only">
                Command
              </label>
              <input
                id="quick-command"
                name="q"
                required
                maxLength={2000}
                placeholder="Draft a launch checklist for Done For You Leads"
                className="min-h-12 flex-1 border border-ink px-4 text-[15px] placeholder:text-subtle focus:outline-2 focus:-outline-offset-2 focus:outline-ink sm:border-r-0"
              />
              <button type="submit" className={buttonClass("primary", "min-h-12 px-7")}>
                Ask →
              </button>
            </Form>
          </section>

          <Suspense fallback={<Skeleton className="h-64" />}>
            <BusinessesPanel />
          </Suspense>

          <Panel>
            <PanelHeader
              title="Recent activity"
              action={
                <Link href="/activity" className="text-sm font-semibold underline decoration-1 underline-offset-4">
                  View all
                </Link>
              }
            />
            <Suspense fallback={<Skeleton className="m-5 h-48" />}>
              <RecentActivity />
            </Suspense>
          </Panel>
        </div>

        <div className="space-y-10">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <Attention />
          </Suspense>
          <Roadmap />
        </div>
      </div>
    </>
  );
}

async function Greeting() {
  const user = await requireUser();
  const { timezone } = await getSettings();
  const now = requestNow();
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  return (
    <header className="mb-10 border-b-2 border-ink pb-6">
      <p className="label mb-3 text-muted">{date}</p>
      <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
        {greeting(now, timezone)}, {user.name.split(" ")[0]}.
      </h1>
    </header>
  );
}

function Stat({ label, value, detail, tone, href }: { label: string; value: string; detail: string; tone: Tone; href: string }) {
  return (
    <Link href={href} className="group block min-w-0 border-b border-r border-ink p-4 transition-colors hover:bg-ink hover:text-paper sm:p-5">
      <p className="label flex items-center justify-between">
        {label}
        <span aria-hidden="true">→</span>
      </p>
      <p className="mt-4 flex items-center gap-2 text-2xl font-extrabold tracking-[-0.03em] sm:mt-6 sm:gap-2.5 sm:text-3xl">
        <span className="group-hover:invert">
          <StatusDot tone={tone} />
        </span>
        {value}
      </p>
      <p className="mt-1 truncate text-sm text-muted group-hover:text-paper">{detail}</p>
    </Link>
  );
}

async function StatusStrip() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [settings, last24h, biz] = await Promise.all([
    getSettings(),
    activitySummary(new Date(now.getTime() - DAY_MS)),
    env.osAnalytics ? settle(listBusinesses) : Promise.resolve(null),
  ]);
  const events = last24h.success + last24h.failure + last24h.pending + last24h.info;

  let leads = { value: "Not connected", detail: "Connect OS Analytics", tone: "warn" as Tone };
  if (biz && biz.ok) {
    const active = biz.data.businesses.filter((b) => b.active);
    const cur = active.reduce((s, b) => s + b.last30.leads, 0);
    const prev = active.reduce((s, b) => s + b.previous30.leads, 0);
    const change = prev ? Math.round(((cur - prev) / prev) * 100) : null;
    leads = {
      value: String(cur),
      detail: `${active.length} businesses${change === null ? "" : ` · ${change >= 0 ? "↑" : "↓"} ${Math.abs(change)}% vs prior 30 days`}`,
      tone: "ok",
    };
  } else if (biz && !biz.ok) {
    leads = { value: "Unavailable", detail: biz.error.message, tone: "bad" };
  }

  return (
    <div className="grid grid-cols-2 border-l border-t border-ink xl:grid-cols-4">
      <Stat
        href="/command"
        label="Jody Core"
        value={env.anthropic ? "Online" : "Offline"}
        detail={env.anthropic ? (modelInfo(settings.aiModel)?.label ?? settings.aiModel) : "ANTHROPIC_API_KEY not set"}
        tone={env.anthropic ? "ok" : "warn"}
      />
      <Stat href="/businesses" label="Leads, 30 days" value={leads.value} detail={leads.detail} tone={leads.tone} />
      <Stat
        href="/settings"
        label="Database"
        value="Connected"
        detail={env.database === "postgres" ? "PostgreSQL" : "Local PGlite (development)"}
        tone="ok"
      />
      <Stat
        href="/activity"
        label="Last 24 hours"
        value={`${events} event${events === 1 ? "" : "s"}`}
        detail={last24h.failure ? `${last24h.failure} failed` : "No failures"}
        tone={last24h.failure ? "bad" : "ok"}
      />
    </div>
  );
}

/** The businesses with the most leads, straight from OS Analytics. */
async function BusinessesPanel() {
  await requireUser();
  const link = (
    <Link href="/businesses" className="text-sm font-semibold underline decoration-1 underline-offset-4">
      All businesses
    </Link>
  );

  if (!envStatus().osAnalytics) {
    return (
      <Panel>
        <PanelHeader title="Businesses" action={link} />
        <EmptyState title="OS Analytics isn't connected.">Open Businesses for the three setup steps.</EmptyState>
      </Panel>
    );
  }

  const result = await settle(listBusinesses);
  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader title="Businesses" action={link} />
        <p className="px-5 py-4 text-sm font-semibold">{result.error.message}</p>
      </Panel>
    );
  }

  const top = result.data.businesses
    .filter((b) => b.active)
    .sort((a, b) => b.last30.leads - a.last30.leads)
    .slice(0, 6);

  return (
    <Panel>
      <PanelHeader title="Businesses, last 30 days" action={link} />
      {top.length ? (
        <ul>
          {top.map((b) => (
            <li key={b.slug} className="border-b border-hair last:border-b-0">
              <Link href={`/businesses/${b.slug}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-5 py-3 hover:bg-wash sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
                <span className="min-w-0 truncate font-semibold">{b.name}</span>
                <span className="text-right tabular-nums">
                  <span className="font-bold">{b.last30.leads}</span> <span className="text-sm text-muted">leads</span>{" "}
                  <Delta current={b.last30.leads} previous={b.previous30.leads} />
                </span>
                <span className="hidden text-right text-sm tabular-nums text-muted sm:block">{formatMoney(b.last30.spend, b.currency, 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No active businesses." />
      )}
    </Panel>
  );
}

async function RecentActivity() {
  await requireUser();
  const [rows, settings] = await Promise.all([listActivity({ limit: 6 }), getSettings()]);
  if (!rows.length) return <EmptyState title="No activity yet." />;
  return <ActivityList rows={rows} now={requestNow()} timeZone={settings.timezone} />;
}

/** Real conditions only: each item is derived from configuration, the log or OS Analytics. */
async function Attention() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [failures, biz] = await Promise.all([
    listActivity({ status: "failure", limit: 3 }),
    env.osAnalytics ? settle(listBusinesses) : Promise.resolve(null),
  ]);
  const recentFailures = failures.filter((f) => now.getTime() - f.createdAt.getTime() < DAY_MS);

  const items: { title: string; body: string; href: string; critical?: boolean }[] = [];

  if (biz && biz.ok) {
    for (const a of businessAttention(biz.data, now)) {
      items.push({ title: a.title, body: a.detail, href: a.href, critical: a.level === "critical" });
    }
  } else if (biz && !biz.ok) {
    items.push({ title: "OS Analytics unavailable", body: biz.error.message, href: "/businesses", critical: true });
  }
  if (!env.anthropic) {
    items.push({ title: "Jody Core is offline", body: "Add ANTHROPIC_API_KEY to enable AI Command.", href: "/integrations" });
  }
  if (env.setupToken) {
    items.push({
      title: "Remove SETUP_TOKEN",
      body: "Setup is finished. Delete the variable so the setup page stays locked.",
      href: "/settings",
    });
  }
  if (recentFailures.length) {
    items.push({
      title: `${recentFailures.length} failure${recentFailures.length === 1 ? "" : "s"} in the last 24 hours`,
      body: `Latest: ${recentFailures[0].action}`,
      href: "/activity?status=failure",
    });
  }

  const shown = items.slice(0, 8);
  return (
    <section>
      <h2 className="label mb-3 flex items-center justify-between border-b border-ink pb-2">
        Needs attention
        <span className="font-mono tabular-nums">{String(items.length).padStart(2, "0")}</span>
      </h2>
      {shown.length ? (
        <ul>
          {shown.map((item) => (
            <li key={item.title} className="border-b border-hair">
              <Link href={item.href} className="group flex gap-3 py-3">
                <span className="pt-1.5">
                  <StatusDot tone={item.critical ? "bad" : "warn"} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                  <span className="block text-sm text-muted">{item.body}</span>
                </span>
              </Link>
            </li>
          ))}
          {items.length > shown.length ? (
            <li className="py-3 text-sm">
              <Link href="/businesses" className="font-semibold underline underline-offset-4">
                {items.length - shown.length} more
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="py-3 text-sm text-muted">Nothing needs you right now.</p>
      )}
    </section>
  );
}

function Roadmap() {
  const phases = [1, 2, 3, 4, 5, 6] as const;
  return (
    <section>
      <h2 className="label mb-3 border-b border-ink pb-2">Roadmap</h2>
      <ol>
        {phases.map((p) => {
          const mods = MODULES.filter((m) => m.phase === p);
          return (
            <li key={p} className="flex gap-4 border-b border-hair py-3">
              <span className="w-6 shrink-0 font-mono text-xs leading-6 text-subtle">{String(p).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  {PHASES[p]}
                  {p === 1 ? <Badge tone="accent">Live</Badge> : null}
                </p>
                <p className="truncate text-sm text-muted">
                  {mods.length ? mods.map((m) => m.label).join(", ") : p === 6 ? "MCP, RAG, voice, mobile" : "Engine work"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
