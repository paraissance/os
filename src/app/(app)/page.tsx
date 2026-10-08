import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Activity as ActivityIcon, ArrowRight, ArrowUpRight, Database, Plug, Sparkles, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { activitySummary, listActivity } from "@/lib/activity";
import { envStatus } from "@/lib/env";
import { DAY_MS, requestNow } from "@/lib/clock";
import { greeting } from "@/lib/format";
import { listIntegrations } from "@/lib/integrations";
import { MODULES, PHASES } from "@/lib/modules";
import { getSettings } from "@/lib/settings";
import { modelInfo } from "@/lib/ai/models";
import { ActivityList } from "@/components/activity-list";
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
      <Suspense fallback={<Skeleton className="mb-8 h-20 w-full max-w-lg" />}>
        <Greeting />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        }
      >
        <StatusCards />
      </Suspense>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel className="animate-fade-up">
            <PanelHeader title="Ask Jody Core" description="Plan, draft or think something through." />
            <Form action="/command" className="flex flex-col gap-3 p-5 sm:flex-row">
              <label htmlFor="quick-command" className="sr-only">
                Command
              </label>
              <input
                id="quick-command"
                name="q"
                required
                maxLength={2000}
                placeholder="e.g. Draft a launch checklist for Done For You Leads"
                className="min-h-11 flex-1 rounded-xl border border-line-strong bg-ink-900/80 px-3.5 text-sm text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none"
              />
              <button type="submit" className={buttonClass("primary")}>
                <Sparkles className="size-4" aria-hidden="true" /> Ask
              </button>
            </Form>
          </Panel>

          <Panel className="animate-fade-up">
            <PanelHeader
              title="Recent activity"
              description="The latest entries in the audit log."
              action={
                <Link href="/activity" className={buttonClass("ghost", "min-h-9 px-3")}>
                  View all <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              }
            />
            <Suspense fallback={<Skeleton className="m-5 h-48" />}>
              <RecentActivity />
            </Suspense>
          </Panel>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<Skeleton className="h-48" />}>
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
    <header className="mb-8 animate-fade-up">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">{date}</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting(now, timezone)}, <span className="text-gradient">{user.name.split(" ")[0]}</span>
      </h1>
      <p className="mt-2 text-[15px] text-muted">Here&apos;s the state of your system.</p>
    </header>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  href: string;
}) {
  return (
    <Link href={href} className="panel group block p-5 transition-colors hover:border-line-strong animate-fade-up">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl border border-line bg-white/[0.04] text-accent">
          {icon}
        </span>
        <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-fg" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-fg">
        <StatusDot tone={tone} pulse={tone === "ok"} />
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-subtle">{detail}</p>
    </Link>
  );
}

async function StatusCards() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [settings, last24h] = await Promise.all([getSettings(), activitySummary(new Date(now.getTime() - DAY_MS))]);
  const integrations = listIntegrations();
  const connected = integrations.filter((i) => i.status === "connected").length;
  const events = last24h.success + last24h.failure + last24h.pending + last24h.info;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        href="/command"
        icon={<Sparkles className="size-4" />}
        label="Jody Core"
        value={env.anthropic ? "Online" : "Offline"}
        detail={env.anthropic ? (modelInfo(settings.aiModel)?.label ?? settings.aiModel) : "ANTHROPIC_API_KEY not set"}
        tone={env.anthropic ? "ok" : "warn"}
      />
      <StatCard
        href="/settings"
        icon={<Database className="size-4" />}
        label="Database"
        value="Connected"
        detail={env.database === "postgres" ? "PostgreSQL" : "Local PGlite (development)"}
        tone="ok"
      />
      <StatCard
        href="/activity"
        icon={<ActivityIcon className="size-4" />}
        label="Activity, last 24 h"
        value={`${events} event${events === 1 ? "" : "s"}`}
        detail={last24h.failure ? `${last24h.failure} failed` : "No failures"}
        tone={last24h.failure ? "bad" : "ok"}
      />
      <StatCard
        href="/integrations"
        icon={<Plug className="size-4" />}
        label="Integrations"
        value={`${connected} of ${integrations.length}`}
        detail={`${integrations.filter((i) => i.status === "planned").length} planned for later phases`}
        tone={connected ? "ok" : "warn"}
      />
    </div>
  );
}

async function RecentActivity() {
  await requireUser();
  const [rows, settings] = await Promise.all([listActivity({ limit: 6 }), getSettings()]);
  if (!rows.length) {
    return <EmptyState icon={<ActivityIcon className="size-6" />} title="No activity yet" />;
  }
  return <ActivityList rows={rows} now={requestNow()} timeZone={settings.timezone} />;
}

/** Real conditions only: each item is derived from configuration or the log. */
async function Attention() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const failures = await listActivity({ status: "failure", limit: 3 });
  const recentFailures = failures.filter((f) => now.getTime() - f.createdAt.getTime() < DAY_MS);

  const items: { tone: Tone; title: string; body: string; href: string }[] = [];
  if (!env.anthropic) {
    items.push({
      tone: "warn",
      title: "Jody Core is offline",
      body: "Add ANTHROPIC_API_KEY to enable AI Command.",
      href: "/integrations",
    });
  }
  if (env.setupToken) {
    items.push({
      tone: "info",
      title: "Remove SETUP_TOKEN",
      body: "Setup is finished. Delete the variable so the setup page stays locked.",
      href: "/settings",
    });
  }
  if (recentFailures.length) {
    items.push({
      tone: "bad",
      title: `${recentFailures.length} failure${recentFailures.length === 1 ? "" : "s"} in the last 24 h`,
      body: `Latest: ${recentFailures[0].action}`,
      href: "/activity?status=failure",
    });
  }

  return (
    <Panel className="animate-fade-up">
      <PanelHeader title="Needs attention" />
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.title}>
              <Link href={item.href} className="flex gap-3 px-5 py-3.5 hover:bg-white/[0.02]">
                <TriangleAlert
                  className={`mt-0.5 size-4 shrink-0 ${item.tone === "bad" ? "text-bad" : item.tone === "warn" ? "text-warn" : "text-info"}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{item.title}</span>
                  <span className="block text-sm text-muted">{item.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="All clear">Nothing needs you right now.</EmptyState>
      )}
    </Panel>
  );
}

function Roadmap() {
  const phases = [1, 2, 3, 4, 5, 6] as const;
  return (
    <Panel className="animate-fade-up">
      <PanelHeader title="Roadmap" description="What each phase switches on." />
      <ol className="space-y-3 p-5">
        {phases.map((p) => {
          const mods = MODULES.filter((m) => m.phase === p);
          return (
            <li key={p} className="flex gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${
                  p === 1 ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-subtle"
                }`}
              >
                {p}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  {PHASES[p]}
                  {p === 1 ? <Badge tone="accent">Live</Badge> : null}
                </p>
                <p className="truncate text-xs text-subtle">
                  {mods.length ? mods.map((m) => m.label).join(", ") : p === 6 ? "MCP, RAG, voice, mobile" : "Engine work"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
