import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { modelInfo } from "@/lib/ai/models";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-sections";
import { loadBook } from "@/lib/businesses";
import { listConversations } from "@/lib/chat";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { getModule } from "@/lib/modules";
import { listBusinesses, percentChange, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { AskBar } from "@/components/dashboard/ask-bar";
import { Bars, Rows, Sentence, Title } from "@/components/dashboard/ui";
import { Alert, PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "AI & Analytics" };

/**
 * Jody Core (ask, and pick up recent conversations) and the numbers:
 * leads per business when OS Analytics is connected. Website traffic
 * (Google Analytics) arrives in Phase 3.
 */
export default function AiAnalyticsPage() {
  const later = getModule("analytics").planned;
  return (
    <>
      <PageHeader eyebrow="Core" title="AI & Analytics" description="Ask Jody Core anything, pick up a conversation, and see how your businesses are doing." />
      <div className="space-y-16">
        <section>
          <Title>Jody Core</Title>
          <Suspense fallback={<Skeleton className="mb-6 h-10" />}>
            <CoreStatus />
          </Suspense>
          <AskBar />
          <Suspense fallback={<Skeleton className="h-40" />}>
            <RecentChats />
          </Suspense>
        </section>

        <Suspense fallback={<Skeleton className="h-64" />}>
          <Numbers />
        </Suspense>

        <section className="reveal rounded-2xl bg-wash p-5 sm:p-6">
          <h2 className="font-bold">Coming later</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
            {later.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

async function CoreStatus() {
  await requireUser();
  const settings = await getSettings();
  if (!envStatus().anthropic) {
    return (
      <p className="mb-6 max-w-3xl animate-rise text-lg">
        Jody Core is <b>offline</b>: it needs an Anthropic API key.{" "}
        <Link href="/integrations" className="font-semibold underline decoration-1 underline-offset-4">
          See Integrations
        </Link>
      </p>
    );
  }
  return (
    <p className="mb-6 max-w-3xl animate-rise text-lg">
      Jody Core is <b>ready</b>, thinking with <b>{modelInfo(settings.aiModel)?.label ?? settings.aiModel}</b> at <b>{settings.aiEffort}</b> effort.{" "}
      <Link href="/settings" className="text-base text-muted underline decoration-1 underline-offset-4">
        Change
      </Link>
    </p>
  );
}

async function RecentChats() {
  const user = await requireUser();
  const [chats, now] = [await listConversations(user.id, 6), requestNow()];
  return (
    <div className="space-y-4">
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
        <p className="rounded-2xl bg-wash px-5 py-4 text-muted">No conversations yet. Ask something above to start one.</p>
      )}
      <Link href="/command" className={buttonClass("light")}>
        Open AI Command →
      </Link>
    </div>
  );
}

async function Numbers() {
  await requireUser();
  if (!envStatus().osAnalytics) {
    return (
      <section className="reveal">
        <Title>Analytics</Title>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-wash px-5 py-4">
          <p className="max-w-2xl text-muted">
            Live numbers aren&apos;t connected. Connect OS Analytics to see leads, marketing spend and campaigns for each business.
          </p>
          <Link href="/integrations" className={buttonClass("light", "min-h-9 px-4")}>
            See Integrations →
          </Link>
        </div>
      </section>
    );
  }

  const [book, live] = await Promise.all([loadBook(), settle(listBusinesses)]);
  if (!live.ok) {
    return (
      <section className="reveal">
        <Title>Analytics</Title>
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
    <section className="reveal space-y-6">
      <Title note="last 30 days">Leads</Title>
      <Sentence>
        <b>{total.toLocaleString("en-US")} leads</b> came in across your businesses
        {change === null ? "" : change === 0 ? ", the same as the 30 days before" : `, ${change > 0 ? "up" : "down"} ${Math.abs(change)}% on the 30 days before`}.
      </Sentence>
      <div className="rounded-2xl bg-wash p-5">
        <Bars rows={rows.map((r) => ({ label: r.name, value: r.leads }))} empty="No leads recorded in the last 30 days." />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {rows.map((r) => (
          <Link key={r.slug} href={businessHref(r.slug, "leads")} className="font-semibold underline decoration-1 underline-offset-4">
            {r.name} leads
          </Link>
        ))}
      </p>
    </section>
  );
}
