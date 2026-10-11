import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { activitySummary, listActivity } from "@/lib/activity";
import { modelInfo } from "@/lib/ai/models";
import { businessHref } from "@/lib/business-sections";
import { renewalPhrase, shortUrl, spendByBusiness, worstRenewal } from "@/lib/business-view";
import { DAY_MS, requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import {
  RENEWAL_LABEL,
  businessAttention,
  formatMoney,
  listBusinesses,
  percentChange,
  settle,
  type AttentionItem,
} from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { ActivityList } from "@/components/activity-list";
import { Delta, OsAnalyticsSetup } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { Alert, EmptyState, Skeleton, StatusDot, buttonClass } from "@/components/ui/primitives";
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

async function businesses() {
  return envStatus().osAnalytics ? settle(listBusinesses) : null;
}

async function Headline() {
  await requireUser();
  const result = await businesses();
  if (!result) return <OsAnalyticsSetup />;
  if (!result.ok) return <Alert tone="bad">{result.error.message}</Alert>;

  const active = result.data.businesses.filter((b) => b.active);
  const paused = result.data.businesses.length - active.length;
  const leads = active.reduce((s, b) => s + b.last30.leads, 0);
  const prev = active.reduce((s, b) => s + b.previous30.leads, 0);
  const spend = active.reduce((s, b) => s + b.last30.spend, 0);
  const change = percentChange(leads, prev);
  const software = result.data.spending;

  return (
    <Sentence>
      Across <b>{active.length} businesses</b>
      {paused ? ` (${paused} paused)` : ""}: <b>{leads.toLocaleString("en-US")} leads</b> in the last 30 days
      {change === null ? "" : change === 0 ? ", the same as before" : `, ${change > 0 ? "up" : "down"} ${Math.abs(change)}%`}.{" "}
      {spend > 0 ? (
        <>
          <b>{formatMoney(spend, "$", 0)}</b> spent on marketing
          {leads ? (
            <>
              , <b>{formatMoney(spend / leads, "$", 2)}</b> per lead
            </>
          ) : null}
          .{" "}
        </>
      ) : null}
      {software ? (
        <>
          Software costs <b>{formatMoney(software.monthlyTotal, "USD")} a month</b>.
        </>
      ) : null}
    </Sentence>
  );
}

/** Real conditions only: each item comes from OS Analytics, configuration or the activity log. */
async function Attention() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [failures, result] = await Promise.all([listActivity({ status: "failure", limit: 3 }), businesses()]);
  const recentFailures = failures.filter((f) => now.getTime() - f.createdAt.getTime() < DAY_MS);

  const items: AttentionItem[] = [];
  if (result?.ok) items.push(...businessAttention(result.data, now));
  else if (result) items.push({ level: "critical", title: "OS Analytics unavailable", detail: result.error.message, href: "/integrations", sort: 0 });

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

  return (
    <section>
      <Title count={items.length}>Needs attention</Title>
      <AttentionList items={items} empty="Nothing needs you right now." />
    </section>
  );
}

async function BusinessCards() {
  await requireUser();
  const result = await businesses();
  if (!result?.ok) return null;
  const active = result.data.businesses.filter((b) => b.active);
  const paused = result.data.businesses.filter((b) => !b.active);

  return (
    <section className="reveal">
      <Title note="last 30 days · tap one to open it">Your businesses</Title>
      {active.length ? (
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {active.map((b) => {
            const worst = worstRenewal(b.renewals);
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
                  <span className="mt-1 truncate text-sm text-muted">{b.tagline ?? (b.siteUrl ? shortUrl(b.siteUrl) : " ")}</span>
                  <span className="mt-5 flex items-center gap-2">
                    <span className="text-4xl font-extrabold tabular-nums tracking-[-0.03em]">
                      <CountUp value={b.last30.leads} />
                    </span>
                    <span className="font-semibold">leads</span>
                    <Delta current={b.last30.leads} previous={b.previous30.leads} />
                  </span>
                  <span className="mt-1 text-sm text-muted">
                    {formatMoney(b.last30.spend, b.currency, 0)} marketing · {b.last30.won} won
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-4 text-sm font-semibold">
                    <StatusDot tone={worst ? (worst.status === "expired" ? "bad" : "warn") : b.renewals.length ? "ok" : "neutral"} />
                    {worst
                      ? `${RENEWAL_LABEL[worst.item]}: ${renewalPhrase(worst).toLowerCase()}`
                      : b.renewals.length
                        ? "Website renewals all current"
                        : "No renewal dates saved"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No active businesses in OS Analytics." />
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
  const result = await businesses();
  if (!result?.ok || !result.data.spending) return null;
  const rows = spendByBusiness(result.data);
  return (
    <section className="reveal">
      <Title id="spending" note="per month">
        Software and tools
      </Title>
      <div className="rounded-2xl bg-wash p-5">
        <Bars rows={rows.map((r) => ({ label: r.name, value: r.monthly, display: formatMoney(r.monthly, "USD") }))} empty="No subscriptions recorded." />
      </div>
      <p className="mt-4 text-sm text-muted">
        {formatMoney(result.data.spending.monthlyTotal, "USD")} a month in total, {formatMoney(result.data.spending.yearlyTotal, "USD", 0)} a year. Open a
        business&apos;s Money tab for every subscription.
      </p>
    </section>
  );
}

async function SystemStatus() {
  await requireUser();
  const env = envStatus();
  const now = requestNow();
  const [settings, last24h, result] = await Promise.all([getSettings(), activitySummary(new Date(now.getTime() - DAY_MS)), businesses()]);
  const events = last24h.success + last24h.failure + last24h.pending + last24h.info;
  const state = (ok: boolean, text: string) => (
    <span className="flex items-center gap-2">
      <StatusDot tone={ok ? "ok" : "warn"} />
      {text}
    </span>
  );

  return (
    <section className="reveal">
      <Title>JodyOS</Title>
      <Facts
        rows={[
          ["Jody Core", state(env.anthropic, env.anthropic ? `Online · ${modelInfo(settings.aiModel)?.label ?? settings.aiModel}` : "Offline")],
          ["OS Analytics", state(!!result?.ok, !result ? "Not connected" : result.ok ? "Connected" : "Error")],
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
