import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { activitySummary, listActivity } from "@/lib/activity";
import { modelInfo } from "@/lib/ai/models";
import { businessHref } from "@/lib/business-sections";
import { bookAttention, costByBusiness, monthlyTotal, mostUrgent, renewalWords, siteRenewals, sortAttention, type Attention } from "@/lib/business-model";
import { shortUrl } from "@/lib/business-view";
import { loadBook } from "@/lib/businesses";
import { DAY_MS, requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { formatMoney, listBusinesses, liveListAttention, percentChange, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { ActivityList } from "@/components/activity-list";
import { Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { EmptyState, Skeleton, StatusDot, buttonClass } from "@/components/ui/primitives";
import { AttentionList, Bars, Facts, Sentence, Title } from "./ui";

/** The "All businesses" tab: the whole picture in one screen. */
export function Overview() {
  return (
    <div className="space-y-12">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Headline />
      </Suspense>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-12">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <Attention />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-96" />}>
            <BusinessCards />
          </Suspense>
        </div>
        <div className="space-y-12">
          <AskJodyCore />
          <Suspense fallback={<Skeleton className="h-60" />}>
            <Spending />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-48" />}>
            <SystemStatus />
          </Suspense>
          <section className="reveal">
            <Title
              note={
                <Link href="/activity" className="text-sm font-semibold text-ink underline decoration-1 underline-offset-4">
                  View all
                </Link>
              }
            >
              Recent activity
            </Title>
            <Suspense fallback={<Skeleton className="h-48" />}>
              <div className="overflow-hidden rounded-2xl bg-wash">
                <RecentActivity />
              </div>
            </Suspense>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Live numbers from OS Analytics, when it is connected; null otherwise. */
async function liveList() {
  return envStatus().osAnalytics ? settle(listBusinesses) : null;
}

async function Headline() {
  await requireUser();
  const [book, live] = await Promise.all([loadBook(), liveList()]);

  if (!book.businesses.length) {
    return (
      <div className="animate-rise rounded-3xl bg-wash p-8 sm:p-10">
        <p className="text-3xl font-extrabold tracking-[-0.02em]">Let&apos;s add your businesses.</p>
        <p className="mt-2 max-w-xl text-lg text-muted">
          Each one gets its own tab here, with its websites, links, what it&apos;s about and what you pay for. Add them one by one, or import a file with all of
          them.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/businesses/new" className={buttonClass("primary")}>
            + Add a business
          </Link>
          <Link href="/businesses/import" className={buttonClass("light")}>
            Import a file
          </Link>
        </div>
      </div>
    );
  }

  const active = book.businesses.filter((b) => b.status === "active");
  const paused = book.businesses.length - active.length;
  const sites = book.businesses.reduce((n, b) => n + b.sites.length, 0);
  const monthly = monthlyTotal([...book.businesses.flatMap((b) => b.subscriptions), ...book.shared]);

  const liveActive = live?.ok ? live.data.businesses.filter((b) => b.active) : [];
  const leads = liveActive.reduce((s, b) => s + b.last30.leads, 0);
  const change = percentChange(leads, liveActive.reduce((s, b) => s + b.previous30.leads, 0));

  return (
    <Sentence>
      You have <b>{active.length} active business{active.length === 1 ? "" : "es"}</b>
      {paused ? ` (and ${paused} paused)` : ""} with <b>{sites} website{sites === 1 ? "" : "s"}</b>.{" "}
      {monthly > 0 ? (
        <>
          Tools and services cost <b>{formatMoney(monthly, "USD")} a month</b>.{" "}
        </>
      ) : null}
      {liveActive.length ? (
        <>
          <b>{leads.toLocaleString("en-US")} leads</b> came in over the last 30 days
          {change === null ? "" : change === 0 ? ", the same as before" : `, ${change > 0 ? "up" : "down"} ${Math.abs(change)}%`}.
        </>
      ) : null}
    </Sentence>
  );
}

/** Real conditions only: each item comes from the owner's records, configuration, OS Analytics or the activity log. */
async function Attention() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [book, failures, live] = await Promise.all([loadBook(), listActivity({ status: "failure", limit: 3 }), liveList()]);
  const recentFailures = failures.filter((f) => now.getTime() - f.createdAt.getTime() < DAY_MS);

  const items: Attention[] = [...bookAttention(book, now)];
  if (live?.ok) {
    // Only businesses that also exist in JodyOS: their tab is where the link goes.
    const names = new Map(book.businesses.map((b) => [b.slug, b.name]));
    items.push(...liveListAttention({ ...live.data, businesses: live.data.businesses.filter((b) => names.has(b.slug)) }, names));
  } else if (live) {
    items.push({ level: "warning", title: "Live numbers unavailable", detail: live.error.message, href: "/integrations", sort: 800 });
  }
  if (!env.anthropic) {
    items.push({ level: "warning", title: "Jody Core is offline", detail: "Add ANTHROPIC_API_KEY to switch on AI Command.", href: "/integrations", sort: 900 });
  }
  if (env.setupToken) {
    items.push({ level: "warning", title: "Remove SETUP_TOKEN", detail: "Setup is finished. Delete the variable so the setup page stays locked.", href: "/settings", sort: 901 });
  }
  if (recentFailures.length) {
    items.push({
      level: "warning",
      title: `${recentFailures.length} failure${recentFailures.length === 1 ? "" : "s"} in the last 24 hours`,
      detail: `Latest: ${recentFailures[0].action}`,
      href: "/activity?status=failure",
      sort: 902,
    });
  }

  const sorted = sortAttention(items);
  return (
    <section>
      <Title count={sorted.length}>Needs attention</Title>
      <AttentionList items={sorted} empty="Nothing needs you right now." />
    </section>
  );
}

async function BusinessCards() {
  await requireUser();
  const [book, live, today] = await Promise.all([loadBook(), liveList(), Promise.resolve(requestNow())]);
  if (!book.businesses.length) return null;
  const liveBySlug = new Map(live?.ok ? live.data.businesses.map((b) => [b.slug, b]) : []);
  const active = book.businesses.filter((b) => b.status === "active");
  const paused = book.businesses.filter((b) => b.status !== "active");

  return (
    <section className="reveal">
      <Title note="tap one to open it">Your businesses</Title>
      {active.length ? (
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {active.map((b) => {
            const renewals = b.sites.flatMap((s) => siteRenewals(s, today));
            const worst = mostUrgent(renewals);
            const lb = liveBySlug.get(b.slug);
            const monthly = monthlyTotal(b.subscriptions);
            const domain = b.sites[0]?.domain ?? (b.websiteUrl ? shortUrl(b.websiteUrl) : null);
            return (
              <li key={b.slug}>
                <Link
                  href={businessHref(b.slug)}
                  className="group flex h-full flex-col rounded-2xl bg-wash p-5 transition-[background-color,transform] duration-200 hover:-translate-y-1 hover:bg-mist"
                >
                  <span className="flex items-start justify-between gap-3 text-xl font-extrabold leading-tight tracking-[-0.02em]">
                    <span className="min-w-0">{b.name}</span>
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-base transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-ink group-hover:text-paper"
                    >
                      →
                    </span>
                  </span>
                  <span className="mt-1 truncate text-sm text-muted">{b.tagline ?? domain ?? " "}</span>
                  {lb ? (
                    <span className="mt-5 flex items-center gap-2">
                      <span className="text-4xl font-extrabold tabular-nums tracking-[-0.03em]">
                        <CountUp value={lb.last30.leads} />
                      </span>
                      <span className="font-semibold">leads</span>
                      <Delta current={lb.last30.leads} previous={lb.previous30.leads} />
                    </span>
                  ) : null}
                  <span className="mt-4 space-y-1 text-sm">
                    <span className="block text-muted">
                      {[domain, monthly > 0 ? `${formatMoney(monthly, "USD")} a month in tools` : null].filter(Boolean).join(" · ") || "No details yet"}
                    </span>
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold">
                    <StatusDot tone={worst ? (worst.status === "expired" ? "bad" : "warn") : renewals.length ? "ok" : "neutral"} />
                    {worst
                      ? `${worst.label}: ${renewalWords(worst).toLowerCase()}`
                      : renewals.length
                        ? "Renewals all current"
                        : b.sites.length
                          ? "No renewal dates saved"
                          : "No websites saved yet"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No active businesses." />
      )}
      {paused.length ? (
        <p className="mt-4 text-sm text-muted">
          Paused for now:{" "}
          {paused.map((b, i) => (
            <span key={b.slug}>
              {i ? ", " : ""}
              <Link href={businessHref(b.slug)} className="font-semibold text-ink underline decoration-1 underline-offset-4">
                {b.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      <p className="mt-4">
        <Link href="/businesses" className="text-sm font-semibold underline decoration-1 underline-offset-4">
          Add, edit or reorder businesses
        </Link>
      </p>
    </section>
  );
}

function AskJodyCore() {
  return (
    <section>
      <Title>Ask Jody Core</Title>
      <Form
        action="/command"
        className="flex items-center gap-2 rounded-full border border-line bg-paper p-1.5 pl-5 transition-colors focus-within:border-ink hover:border-ink"
      >
        <label htmlFor="quick-command" className="sr-only">
          Ask Jody Core
        </label>
        <input
          id="quick-command"
          name="q"
          required
          maxLength={2000}
          placeholder="Which business needs me most this week?"
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
        />
        <button type="submit" className={buttonClass("primary", "min-h-10 shrink-0 px-5")}>
          Ask <span aria-hidden="true">→</span>
        </button>
      </Form>
    </section>
  );
}

async function Spending() {
  await requireUser();
  const book = await loadBook();
  const rows = costByBusiness(book);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.monthly, 0);
  return (
    <section className="reveal">
      <Title id="spending" note="per month">
        Tools and services
      </Title>
      <div className="rounded-2xl bg-wash p-5">
        <Bars rows={rows.map((r) => ({ label: r.name, value: r.monthly, display: formatMoney(r.monthly, "USD") }))} empty="No subscriptions saved." />
      </div>
      <p className="mt-4 text-sm text-muted">
        {formatMoney(total, "USD")} a month in total, {formatMoney(total * 12, "USD", 0)} a year. Open a business&apos;s Money tab for every subscription.
      </p>
    </section>
  );
}

async function SystemStatus() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [settings, last24h, live] = await Promise.all([getSettings(), activitySummary(new Date(now.getTime() - DAY_MS)), liveList()]);
  const events = last24h.success + last24h.failure + last24h.pending + last24h.info;
  const state = (ok: boolean, text: string) => (
    <span className="flex items-center gap-2">
      <StatusDot tone={ok ? "ok" : "neutral"} />
      {text}
    </span>
  );

  return (
    <section className="reveal">
      <Title>JodyOS</Title>
      <Facts
        rows={[
          ["Jody Core", state(env.anthropic, env.anthropic ? `Online · ${modelInfo(settings.aiModel)?.label ?? settings.aiModel}` : "Offline")],
          ["Live numbers", state(!!live?.ok, !live ? "Optional, not connected" : live.ok ? "OS Analytics connected" : "OS Analytics error")],
          ["Database", state(true, env.database === "postgres" ? "PostgreSQL" : "Local PGlite")],
          ["Last 24 hours", `${events} event${events === 1 ? "" : "s"}${last24h.failure ? `, ${last24h.failure} failed` : ""}`],
        ]}
      />
    </section>
  );
}

async function RecentActivity() {
  await requireUser();
  const [rows, settings] = await Promise.all([listActivity({ limit: 6 }), getSettings()]);
  if (!rows.length) return <EmptyState title="No activity yet." />;
  return <ActivityList rows={rows} now={requestNow()} timeZone={settings.timezone} />;
}
