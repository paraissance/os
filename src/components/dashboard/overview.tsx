import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-href";
import { bookAttention, monthlyTotal, mostUrgent, renewalWords, siteRenewals, sortAttention, type Attention } from "@/lib/business-model";
import { shortUrl } from "@/lib/business-view";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { formatMoney, listBusinesses, liveListAttention, percentChange, settle } from "@/lib/os-analytics";
import { ImportForm } from "@/components/businesses/editors";
import { Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { EmptyState, Skeleton, StatusDot, buttonClass } from "@/components/ui/primitives";
import { AttentionList, Sentence, Title } from "./ui";

/**
 * The "All businesses" tab: the businesses and what needs doing, nothing
 * else. Money has its own page (/spending); Ask Jody Core sits under the greeting.
 */
export function Overview() {
  return (
    <div className="space-y-12">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Headline />
      </Suspense>
      {/* Usually empty, so no placeholder that would only flash and vanish. */}
      <Suspense fallback={null}>
        <Attention />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BusinessCards />
      </Suspense>
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
      <div className="grid animate-rise gap-8 rounded-3xl bg-wash p-8 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-3xl font-extrabold tracking-[-0.02em]">Let&apos;s add your businesses.</p>
          <p className="mt-2 max-w-xl text-lg text-muted">
            Each one gets its own tab here, with its websites, links, what it&apos;s about and what you pay for.
          </p>
          <p className="mt-4 max-w-xl text-[15px] text-muted">
            Have a businesses file? Drop it in the box to add them all at once. Or add them one by one.
          </p>
          <Link href="/businesses/new" className={buttonClass("light", "mt-6")}>
            + Add one business
          </Link>
        </div>
        <ImportForm submitOnPick />
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
      {paused ? ` (and ${paused} paused)` : ""} with <b>{sites} site{sites === 1 ? "" : "s"}</b>.{" "}
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

/** Business things only: renewals and payments coming due, and (when connected) big lead drops. Hidden when there's nothing. */
async function Attention() {
  await requireUser();
  const now = requestNow();
  const [book, live] = await Promise.all([loadBook(), liveList()]);

  const items: Attention[] = [...bookAttention(book, now)];
  if (live?.ok) {
    // Only businesses that also exist in JodyOS: their tab is where the link goes.
    const names = new Map(book.businesses.map((b) => [b.slug, b.name]));
    items.push(...liveListAttention({ ...live.data, businesses: live.data.businesses.filter((b) => names.has(b.slug)) }, names));
  }
  if (!items.length) return null;

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
      <Title>Your businesses</Title>
      {active.length ? (
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
