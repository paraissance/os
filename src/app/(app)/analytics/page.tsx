import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { modelInfo } from "@/lib/ai/models";
import { requireUser } from "@/lib/auth/current-user";
import { loadBook } from "@/lib/businesses";
import { listConversations } from "@/lib/chat";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { listBusinesses, percentChange, settle } from "@/lib/os-analytics";
import { requestOrigin } from "@/lib/request-origin";
import { getSettings } from "@/lib/settings";
import { listAgents } from "@/lib/agents";
import { AgentView } from "@/components/agents/agent-view";
import { AgentsImport } from "@/components/agents/agents-import";
import { LearnWebsites } from "@/components/agents/embed-tools";
import { AskBar } from "@/components/dashboard/ask-bar";
import { Rows, Title } from "@/components/dashboard/ui";
import { Alert, PageHeader, Skeleton, buttonClass, pillClass, pillTrack } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "AI & Analytics" };

// "Learn from the websites" reads every agent's site from here and can take a minute.
export const maxDuration = 300;

/**
 * Jody Core (ask, and pick up recent conversations), leads per business when
 * OS Analytics is connected, and the website agents.
 */
export default function AiAnalyticsPage(props: PageProps<"/analytics">) {
  return (
    <>
      <PageHeader title="AI & Analytics" />
      <div className="space-y-3">
        <section className="hero animate-rise rounded-3xl p-6 sm:p-8">
          <h2 className="label mb-3 text-white/70">Jody Core</h2>
          <Suspense fallback={<div aria-hidden="true" className="mb-6 h-9 max-w-xl animate-shimmer rounded-full bg-white/10" />}>
            <CoreStatus />
          </Suspense>
          <AskBar />
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-10 pt-7 xl:grid-cols-6">
          <div className="min-w-0 xl:col-span-4">
            <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
              <RecentChats />
            </Suspense>
          </div>
          <div className="min-w-0 xl:col-span-2">
            <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
              <Numbers />
            </Suspense>
          </div>
        </div>

        <div className="pt-7">
          <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
            <Agents searchParams={props.searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

const HERO_LINE = "mb-6 max-w-3xl animate-rise text-2xl font-extrabold leading-snug tracking-[-0.02em] sm:text-3xl";
const HERO_LINK = "ml-2 whitespace-nowrap text-sm font-semibold tracking-normal text-white/70 underline decoration-1 underline-offset-4 transition-colors hover:text-white";

async function CoreStatus() {
  await requireUser();
  const settings = await getSettings();
  if (!envStatus().anthropic) {
    return (
      <p className={HERO_LINE}>
        Offline: it needs an Anthropic API key.
        <Link href="/integrations" className={HERO_LINK}>
          See Integrations
        </Link>
      </p>
    );
  }
  return (
    <p className={HERO_LINE}>
      Ready, thinking with {modelInfo(settings.aiModel)?.label ?? settings.aiModel} at {settings.aiEffort} effort.
      <Link href="/settings" className={HERO_LINK}>
        Change
      </Link>
    </p>
  );
}

async function RecentChats() {
  const user = await requireUser();
  const [chats, now] = [await listConversations(user.id, 3), requestNow()];
  return (
    <section className="reveal">
      <Title
        note={
          <Link href="/command" className="font-semibold text-ink underline decoration-1 underline-offset-4">
            Open AI Command
          </Link>
        }
      >
        Recent conversations
      </Title>
      {chats.length ? (
        <Rows>
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={`/command?c=${c.id}`} className="group flex items-center justify-between gap-4">
                <span className="min-w-0 truncate font-semibold group-hover:underline">{c.title}</span>
                <span className="shrink-0 text-sm text-muted">{formatRelative(c.updatedAt, now)}</span>
              </Link>
            </li>
          ))}
        </Rows>
      ) : (
        <p className="rounded-3xl bg-wash px-6 py-5 text-muted">No conversations yet.</p>
      )}
    </section>
  );
}

/** The website AI assistants, one tab per business: /analytics?agent=<slug>#agents. */
async function Agents({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  await requireUser();
  const [{ agent: wanted }, agents] = await Promise.all([searchParams, listAgents()]);
  if (!agents.length) {
    return (
      <section id="agents" className="scroll-mt-24">
        <Title>AI agents</Title>
        <AgentsImport />
      </section>
    );
  }
  const current = agents.find((a) => a.business.slug === wanted) ?? agents[0];
  const origin = await requestOrigin();
  return (
    <section id="agents" className="scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Title count={agents.length}>AI agents</Title>
        <LearnWebsites />
      </div>
      <nav aria-label="AI agents" className={pillTrack}>
        {agents.map((a) => (
          <Link key={a.id} href={`/analytics?agent=${a.business.slug}#agents`} aria-current={a.id === current.id ? "page" : undefined} className={pillClass(a.id === current.id)}>
            {a.business.name}
          </Link>
        ))}
      </nav>
      <AgentView key={current.id} agent={current} origin={origin} aiReady={envStatus().anthropic} />
      <details className="pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-muted">Update the agents from a new file</summary>
        <div className="mt-4">
          <AgentsImport />
        </div>
      </details>
    </section>
  );
}

async function Numbers() {
  await requireUser();
  if (!envStatus().osAnalytics) {
    return (
      <section className="reveal">
        <Title>Leads</Title>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-wash p-6">
          <p className="text-[15px] text-muted">Not connected</p>
          <Link href="/integrations" className={buttonClass("light", "min-h-9! px-4!")}>
            Connect
          </Link>
        </div>
      </section>
    );
  }

  const [book, live] = await Promise.all([loadBook(), settle(listBusinesses)]);
  if (!live.ok) {
    return (
      <section className="reveal">
        <Title>Leads</Title>
        <Alert>Live numbers from OS Analytics are unavailable right now: {live.error.message}</Alert>
      </section>
    );
  }

  // In the dashboard's order, only businesses that also exist in JodyOS (their tab is where the details are).
  const bySlug = new Map(live.data.businesses.filter((b) => b.active).map((b) => [b.slug, b]));
  const rows = book.businesses.flatMap((b) => {
    const l = bySlug.get(b.slug);
    return l ? [{ name: b.name, slug: b.slug, leads: l.last30.leads, before: l.previous30.leads }] : [];
  });
  const total = rows.reduce((s, r) => s + r.leads, 0);
  const change = percentChange(total, rows.reduce((s, r) => s + r.before, 0));

  return (
    <section className="reveal">
      <Title note="last 30 days">Leads</Title>
      <div className="rounded-3xl bg-wash p-6">
        <p className="text-4xl font-extrabold tabular-nums tracking-[-0.03em]">{total.toLocaleString("en-US")}</p>
        {change ? <p className="mt-1 text-sm text-muted">{`${change > 0 ? "Up" : "Down"} ${Math.abs(change)}%`}</p> : null}
      </div>
    </section>
  );
}
