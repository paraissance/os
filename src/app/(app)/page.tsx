import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
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
      <Suspense fallback={<Skeleton className="mb-10 h-36 w-full" />}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <StatusStrip />
      </Suspense>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
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
  const [settings, last24h] = await Promise.all([getSettings(), activitySummary(new Date(now.getTime() - DAY_MS))]);
  const integrations = listIntegrations();
  const connected = integrations.filter((i) => i.status === "connected").length;
  const events = last24h.success + last24h.failure + last24h.pending + last24h.info;

  return (
    <div className="grid grid-cols-2 border-l border-t border-ink xl:grid-cols-4">
      <Stat
        href="/command"
        label="Jody Core"
        value={env.anthropic ? "Online" : "Offline"}
        detail={env.anthropic ? (modelInfo(settings.aiModel)?.label ?? settings.aiModel) : "ANTHROPIC_API_KEY not set"}
        tone={env.anthropic ? "ok" : "warn"}
      />
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
      <Stat
        href="/integrations"
        label="Integrations"
        value={`${connected} / ${integrations.length}`}
        detail={`${integrations.filter((i) => i.status === "planned").length} planned for later phases`}
        tone={connected ? "ok" : "warn"}
      />
    </div>
  );
}

async function RecentActivity() {
  await requireUser();
  const [rows, settings] = await Promise.all([listActivity({ limit: 6 }), getSettings()]);
  if (!rows.length) return <EmptyState title="No activity yet." />;
  return <ActivityList rows={rows} now={requestNow()} timeZone={settings.timezone} />;
}

/** Real conditions only: each item is derived from configuration or the log. */
async function Attention() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const failures = await listActivity({ status: "failure", limit: 3 });
  const recentFailures = failures.filter((f) => now.getTime() - f.createdAt.getTime() < DAY_MS);

  const items: { title: string; body: string; href: string }[] = [];
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

  return (
    <section>
      <h2 className="label mb-3 flex items-center justify-between border-b border-ink pb-2">
        Needs attention
        <span className="font-mono tabular-nums">{String(items.length).padStart(2, "0")}</span>
      </h2>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.title} className="border-b border-hair">
              <Link href={item.href} className="group block py-3">
                <span className="block font-semibold group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                <span className="block text-sm text-muted">{item.body}</span>
              </Link>
            </li>
          ))}
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
