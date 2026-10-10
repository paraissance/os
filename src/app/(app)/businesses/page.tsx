import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-sections";
import { envStatus } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { formatMoney, listBusinesses, settle, type BusinessSummary } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { Delta, OsAnalyticsSetup } from "@/components/business-bits";
import { Alert, Badge, PageHeader, Skeleton, StatusDot } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Businesses" };

export default function BusinessesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Businesses"
        description="Every business side by side, live from OS Analytics. Numbers cover the last 30 days, compared with the 30 days before. Open one for its full tab on the dashboard."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BusinessTable />
      </Suspense>
    </>
  );
}

function domainOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Worst renewal status for a business: expired > soon > ok. */
function RenewalCell({ b }: { b: BusinessSummary }) {
  const expired = b.renewals.filter((r) => r.status === "expired");
  const soon = b.renewals.filter((r) => r.status === "soon");
  if (expired.length) return <Badge tone="bad">{expired.map((r) => r.item).join(", ")} expired</Badge>;
  if (soon.length) return <Badge tone="warn">{soon.map((r) => r.item).join(", ")} due</Badge>;
  if (b.renewals.length) return <span className="text-sm text-muted">All current</span>;
  return <span className="text-sm text-subtle">No dates</span>;
}

async function BusinessTable() {
  await requireUser();
  if (!envStatus().osAnalytics) return <OsAnalyticsSetup />;

  const [result, settings] = await Promise.all([settle(listBusinesses), getSettings()]);
  if (!result.ok) return <Alert tone="bad">{result.error.message}</Alert>;
  const { businesses, spending, generatedAt } = result.data;
  if (!businesses.length) return <p className="text-muted">OS Analytics has no businesses yet.</p>;

  const active = businesses.filter((b) => b.active);
  const paused = businesses.filter((b) => !b.active);
  const totalLeads = active.reduce((s, b) => s + b.last30.leads, 0);
  const prevLeads = active.reduce((s, b) => s + b.previous30.leads, 0);
  const totalSpend = active.reduce((s, b) => s + b.last30.spend, 0);
  const generated = Date.parse(generatedAt);

  const cols = "md:grid-cols-[minmax(0,2.2fr)_6rem_6rem_6rem_6rem_9rem]";

  return (
    <>
      <div className="grid grid-cols-2 border-l border-t border-ink sm:grid-cols-4">
        <div className="border-b border-r border-ink p-4">
          <p className="label">Businesses</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.03em]">{active.length}</p>
          <p className="text-sm text-muted">{paused.length ? `${paused.length} paused` : "all active"}</p>
        </div>
        <div className="border-b border-r border-ink p-4">
          <p className="label">Leads, 30 days</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.03em]">{totalLeads}</p>
          <Delta current={totalLeads} previous={prevLeads} />
        </div>
        <div className="border-b border-r border-ink p-4">
          <p className="label">Marketing spend, 30 days</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.03em]">{formatMoney(totalSpend, "$", 0)}</p>
          <p className="text-sm text-muted">{totalLeads ? `${formatMoney(totalSpend / totalLeads, "$")} per lead` : "no leads yet"}</p>
        </div>
        <div className="border-b border-r border-ink p-4">
          <p className="label">Software, monthly</p>
          <p className="mt-3 text-3xl font-extrabold tracking-[-0.03em]">
            {spending ? formatMoney(spending.monthlyTotal, "USD", 0) : "—"}
          </p>
          <p className="text-sm text-muted">{spending ? `${spending.activeSubscriptions} subscriptions` : "not tracked"}</p>
        </div>
      </div>

      <div className="mt-10 border-t-2 border-ink">
        <div className={`label hidden gap-4 border-b border-ink py-2.5 md:grid ${cols}`}>
          <span>Business</span>
          <span className="text-right">Leads</span>
          <span className="text-right">Spend</span>
          <span className="text-right">Per lead</span>
          <span className="text-right">Won</span>
          <span>Renewals</span>
        </div>
        <ul>
          {[...active, ...paused].map((b) => (
            <li key={b.slug} className="border-b border-hair">
              <Link href={businessHref(b.slug)} className={`group grid gap-x-4 gap-y-1 py-4 hover:bg-wash md:items-center ${cols}`}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-bold leading-tight tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">
                    {b.name}
                    {!b.active ? <Badge tone="neutral">Paused</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{[domainOf(b.siteUrl), b.tagline].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <p className="flex items-baseline justify-between gap-2 md:block md:text-right">
                  <span className="label text-subtle md:hidden">Leads</span>
                  <span>
                    <span className="text-lg font-bold tabular-nums">{b.last30.leads}</span>{" "}
                    <Delta current={b.last30.leads} previous={b.previous30.leads} />
                  </span>
                </p>
                <p className="flex items-baseline justify-between gap-2 tabular-nums md:block md:text-right">
                  <span className="label text-subtle md:hidden">Spend</span>
                  {formatMoney(b.last30.spend, b.currency, 0)}
                </p>
                <p className="flex items-baseline justify-between gap-2 tabular-nums md:block md:text-right">
                  <span className="label text-subtle md:hidden">Per lead</span>
                  {b.last30.leads ? formatMoney(b.last30.costPerLead, b.currency) : "—"}
                </p>
                <p className="flex items-baseline justify-between gap-2 tabular-nums md:block md:text-right">
                  <span className="label text-subtle md:hidden">Won</span>
                  {b.last30.won} <span className="text-xs text-muted">({b.last30.conversionRate}%)</span>
                </p>
                <div className="flex items-center gap-2">
                  <StatusDot tone={b.renewals.some((r) => r.status === "expired") ? "bad" : b.renewals.some((r) => r.status === "soon") ? "warn" : b.renewals.length ? "ok" : "neutral"} />
                  <RenewalCell b={b} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 font-mono text-xs text-subtle">
        Updated {Number.isNaN(generated) ? generatedAt : formatDateTime(new Date(generated), settings.timezone)} · source OS Analytics
      </p>
    </>
  );
}
