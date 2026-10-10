import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { envStatus } from "@/lib/env";
import { formatMoney, getBusiness, settle, type BusinessDetail } from "@/lib/os-analytics";
import { BarChart, Delta, OsAnalyticsSetup } from "@/components/business-bits";
import { Alert, Badge, Panel, PanelHeader, Skeleton, StatusDot } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage(props: PageProps<"/businesses/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem]" />}>
      <BusinessView params={props.params} />
    </Suspense>
  );
}

const STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["appointment", "Appointment"],
  ["approved", "Approved"],
  ["closed", "Closed"],
  ["lost", "Lost"],
] as const;

function Kpi({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-r border-ink p-4">
      <p className="label">{label}</p>
      <p className="mt-3 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">{value}</p>
      <div className="mt-0.5 min-h-5 text-sm text-muted">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-hair px-5 py-2.5 text-sm last:border-b-0">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{v ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

async function BusinessView({ params }: { params: PageProps<"/businesses/[slug]">["params"] }) {
  await requireUser();
  const { slug } = await params;
  if (!envStatus().osAnalytics) return <OsAnalyticsSetup />;

  const result = await settle(() => getBusiness(slug));
  if (!result.ok) {
    return (
      <>
        <BackLink />
        <Alert tone="bad">{result.error.message}</Alert>
      </>
    );
  }
  const b = result.data;
  if (!b) notFound();
  return <BusinessContent b={b} />;
}

function BackLink() {
  return (
    <Link href="/businesses" className="mb-6 inline-block text-sm font-semibold underline decoration-1 underline-offset-4">
      ← All businesses
    </Link>
  );
}

function BusinessContent({ b }: { b: BusinessDetail }) {
  const c = b.currency;
  const showLoans = b.last30.loanVolume > 0 || b.previous30.loanVolume > 0;
  const pipelineTotal = STAGES.reduce((s, [k]) => s + b.pipeline[k], 0);

  return (
    <>
      <BackLink />
      <header className="mb-10 border-b-2 border-ink pb-6">
        <p className="label mb-3 text-muted">
          Business · {b.window.from} to {b.window.to}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-6xl">{b.name}</h1>
          <div className="flex items-center gap-3">
            {!b.active ? <Badge tone="neutral">Paused</Badge> : null}
            {b.siteUrl ? (
              <a href={b.siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline decoration-1 underline-offset-4">
                Visit site ↗
              </a>
            ) : null}
          </div>
        </div>
        {b.tagline ? <p className="mt-4 text-base text-muted">{b.tagline}</p> : null}
      </header>

      <div className="grid grid-cols-2 border-l border-t border-ink sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={b.last30.leads}>
          <Delta current={b.last30.leads} previous={b.previous30.leads} />
        </Kpi>
        <Kpi label="Won" value={b.last30.won}>
          {b.last30.conversionRate}% of leads
        </Kpi>
        <Kpi label="Appointments" value={b.last30.appointments}>
          <Delta current={b.last30.appointments} previous={b.previous30.appointments} />
        </Kpi>
        <Kpi label="Spend" value={formatMoney(b.last30.spend, c, 0)}>
          <Delta current={b.last30.spend} previous={b.previous30.spend} />
        </Kpi>
        <Kpi label="Cost per lead" value={b.last30.leads ? formatMoney(b.last30.costPerLead, c) : "—"}>
          {b.previous30.leads ? `was ${formatMoney(b.previous30.costPerLead, c)}` : null}
        </Kpi>
        {showLoans ? (
          <Kpi label="Loan volume" value={formatMoney(b.last30.loanVolume, c, 0)}>
            <Delta current={b.last30.loanVolume} previous={b.previous30.loanVolume} />
          </Kpi>
        ) : (
          <Kpi label="Clients" value={b.clientsAllTime}>
            all time
          </Kpi>
        )}
      </div>

      {/* minmax(0, …) stops a wide table from stretching its column past the screen. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-10">
          <section>
            <h2 className="label mb-4 border-b border-ink pb-2">Leads per day</h2>
            <BarChart points={b.trend} />
          </section>

          <section>
            <h2 className="label mb-3 flex justify-between border-b border-ink pb-2">
              Pipeline <span className="font-mono tabular-nums">{pipelineTotal} all time</span>
            </h2>
            {pipelineTotal ? (
              <>
                <div className="flex h-3 w-full border border-ink" aria-hidden="true">
                  {STAGES.map(([k], i) =>
                    b.pipeline[k] ? (
                      <span
                        key={k}
                        style={{ width: `${(b.pipeline[k] / pipelineTotal) * 100}%` }}
                        className={`border-r border-ink last:border-r-0 ${i % 2 === 0 ? "bg-ink" : "bg-paper"}`}
                      />
                    ) : null,
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                  {STAGES.map(([k, label]) => (
                    <div key={k} className="flex justify-between border-b border-hair py-1.5 text-sm">
                      <dt className="text-muted">{label}</dt>
                      <dd className="font-semibold tabular-nums">{b.pipeline[k]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted">No leads recorded yet.</p>
            )}
          </section>

          <section>
            <h2 className="label mb-1 border-b border-ink pb-2">Campaigns</h2>
            {b.campaigns.length ? (
              <ul>
                {b.campaigns.map((cmp) => (
                  <li key={`${cmp.name}-${cmp.startDate}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hair py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        {cmp.name}
                        <Badge tone={cmp.status === "active" ? "accent" : "neutral"}>{cmp.status}</Badge>
                      </p>
                      <p className="text-sm text-muted">
                        {[cmp.channel, cmp.startDate && `from ${cmp.startDate}`, cmp.endDate && `to ${cmp.endDate}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="font-mono text-sm tabular-nums">
                      {formatMoney(cmp.spend, c, 0)} · {cmp.leads} leads · {cmp.conversions} won
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted">No campaigns.</p>
            )}
          </section>

          <section>
            <h2 className="label mb-1 border-b border-ink pb-2">Social, last 4 weeks</h2>
            {b.social.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="label text-left text-subtle">
                      <th className="py-2 font-semibold">Platform</th>
                      <th className="py-2 text-right font-semibold">Impressions</th>
                      <th className="py-2 text-right font-semibold">Clicks</th>
                      <th className="py-2 text-right font-semibold">Leads</th>
                      <th className="py-2 text-right font-semibold">Posts</th>
                      <th className="py-2 text-right font-semibold">Followers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.social.map((s) => (
                      <tr key={s.platform} className="border-t border-hair tabular-nums">
                        <td className="py-2 font-semibold">{s.label}</td>
                        <td className="py-2 text-right">{s.impressions.toLocaleString("en-US")}</td>
                        <td className="py-2 text-right">{s.clicks.toLocaleString("en-US")}</td>
                        <td className="py-2 text-right">{s.leads}</td>
                        <td className="py-2 text-right">{s.posts}</td>
                        <td className="py-2 text-right">{s.followers.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-3 text-sm text-muted">No social stats entered for the last 4 weeks.</p>
            )}
          </section>
        </div>

        <div className="space-y-10">
          <Panel>
            <PanelHeader title="Website and renewals" />
            {b.renewals.length ? (
              <ul>
                {b.renewals.map((r) => (
                  <li key={r.item} className="flex items-center justify-between gap-3 border-b border-hair px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <StatusDot tone={r.status === "expired" ? "bad" : r.status === "soon" ? "warn" : "ok"} />
                      {r.item === "ssl" ? "SSL" : r.item[0].toUpperCase() + r.item.slice(1)}
                    </span>
                    <span className="font-mono text-xs">
                      {r.date}
                      {r.daysLeft !== null ? (
                        <span className={r.status === "ok" ? "text-muted" : "font-semibold"}>
                          {" "}
                          · {r.daysLeft < 0 ? `${Math.abs(r.daysLeft)}d ago` : `${r.daysLeft}d`}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-b border-hair px-5 py-3 text-sm text-muted">No expiry dates recorded.</p>
            )}
            {b.site ? (
              <dl>
                <Row k="Domain" v={b.site.domain} />
                <Row k="Registrar" v={[b.site.registrar, b.site.registrarAccount].filter(Boolean).join(" · ") || null} />
                <Row k="Auto-renew" v={b.site.domainAutoRenew ? "On" : "Off"} />
                <Row k="Hosting" v={[b.site.hostingProvider, b.site.hostingPlan].filter(Boolean).join(" · ") || null} />
                <Row k="SSL" v={b.site.sslProvider} />
                <Row k="WordPress / PHP" v={[b.site.wpVersion, b.site.phpVersion].filter(Boolean).join(" / ") || null} />
                <Row k="Theme" v={b.site.activeTheme} />
                <Row k="Last backup" v={b.site.lastBackupAt} />
              </dl>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title="Tasks" />
            <dl className="grid grid-cols-2">
              {(
                [
                  ["Pending", b.tasks.pending],
                  ["In progress", b.tasks.inProgress],
                  ["Overdue", b.tasks.overdue],
                  ["Failed", b.tasks.failed],
                  ["Completed", b.tasks.completed],
                  ["Skipped", b.tasks.skipped],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="flex justify-between border-b border-hair px-5 py-2.5 text-sm odd:border-r">
                  <dt className="text-muted">{label}</dt>
                  <dd className={label === "Overdue" && n > 0 ? "font-bold" : "font-semibold"}>{n}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {b.spending ? (
            <Panel>
              <PanelHeader
                title="Subscriptions"
                description={`${formatMoney(b.spending.monthlyTotal, "USD")} a month · ${b.spending.activeSubscriptions} active, shared tools included`}
              />
              {b.spending.upcomingRenewals.length ? (
                <ul>
                  {b.spending.upcomingRenewals.map((r) => (
                    <li key={`${r.name}-${r.nextRenewal}`} className="flex justify-between gap-3 border-b border-hair px-5 py-2.5 text-sm last:border-b-0">
                      <span>
                        {r.name}
                        {r.shared ? <span className="text-subtle"> · shared</span> : null}
                      </span>
                      <span className="font-mono text-xs">
                        {r.nextRenewal} · {formatMoney(r.amount, r.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-3 text-sm text-muted">No renewals in the next 30 days.</p>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
