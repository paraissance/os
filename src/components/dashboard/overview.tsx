import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-href";
import { bookAttention, sortAttention, type Attention } from "@/lib/business-model";
import { shortUrl } from "@/lib/business-view";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { listBusinesses, liveListAttention, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { checkSite } from "@/lib/site-check";
import { loadAllTraffic } from "@/lib/traffic";
import { SPANS, type Span } from "@/lib/traffic-model";
import { Delta, Sparkline } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { EmptyState, Skeleton, cx } from "@/components/ui/primitives";
import { mainAddress } from "./business-page";
import { AttentionList, SpanPills, Title } from "./ui";

/**
 * The dashboard home: the businesses and what needs doing, nothing else.
 * Money has its own page (/spending); Ask Jody Core sits under the greeting;
 * each business's magic links are on its own page.
 */
export function Overview({ span }: { span: Span }) {
  return (
    <div className="space-y-12">
      {/* Usually empty, so no placeholder that would only flash and vanish. */}
      <Suspense fallback={null}>
        <Attention />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BusinessCards span={span} />
      </Suspense>
    </div>
  );
}
/** Live numbers from OS Analytics, when it is connected; null otherwise. */
async function liveList() {
  return envStatus().osAnalytics ? settle(listBusinesses) : null;
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
/** A small labelled box on a business's card; all of a card's boxes line up along its bottom edge. */
function CardStat({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <span className={cx("flex min-w-0 flex-col rounded-2xl bg-paper px-3 py-2.5", wide && "col-span-2")}>
      <span className="truncate text-xs text-muted">{label}</span>
      <span className="mt-1 flex min-h-6 min-w-0 items-center gap-2 font-bold tabular-nums">{children}</span>
    </span>
  );
}

function SiteState({ state, title }: { state: "live" | "down" | "checking"; title?: string }) {
  return (
    <span className={cx("flex items-center gap-2", state === "live" ? "text-live" : state === "down" ? "text-down" : "font-semibold text-muted")} title={title}>
      <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", state === "live" ? "bg-live" : state === "down" ? "bg-down" : "animate-shimmer bg-line")} />
      {state === "live" ? "Live" : state === "down" ? "Problem" : "Checking"}
    </span>
  );
}

/** Each card checks its own website, so one slow site never holds up the page or the other cards. */
async function CardSite({ address }: { address: string }) {
  await requireUser();
  const health = await checkSite(address, requestNow());
  return health.live ? <SiteState state="live" /> : <SiteState state="down" title={health.problem ?? undefined} />;
}

/** Read-only: businesses are added and edited on the Businesses page. */
async function BusinessCards({ span }: { span: Span }) {
  await requireUser();
  const [book, live, settings] = await Promise.all([loadBook(), liveList(), getSettings()]);
  if (!book.businesses.length) return <EmptyState title="No businesses yet." />;
  const today = requestNow();
  const traffic = await loadAllTraffic(today, settings.timezone, span);
  const liveBySlug = new Map(live?.ok ? live.data.businesses.map((b) => [b.slug, b]) : []);
  const active = book.businesses.filter((b) => b.status === "active");
  const paused = book.businesses.filter((b) => b.status !== "active");

  const sites = book.businesses.reduce((n, b) => n + b.sites.length, 0);

  return (
    <section className="reveal">
      <Title>Your businesses</Title>
      <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {active.length} active business{active.length === 1 ? "" : "es"} with {sites} site{sites === 1 ? "" : "s"}
        </p>
        <SpanPills span={span} href={(s) => (s === SPANS[0] ? "/" : `/?days=${s}`)} />
      </div>
      {active.length ? (
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((b) => {
            const lb = liveBySlug.get(b.slug);
            const domain = b.sites[0]?.domain ?? (b.websiteUrl ? shortUrl(b.websiteUrl) : null);
            const address = mainAddress(b);
            const visits = traffic.get(b.id);
            return (
              <li key={b.slug}>
                <Link
                  href={businessHref(b.slug)}
                  className="shine lift group flex h-full flex-col rounded-3xl bg-wash p-6 hover:bg-mist"
                >
                  <span className="flex items-start justify-between gap-3 text-xl font-extrabold leading-tight tracking-[-0.02em]">
                    <span className="min-w-0">{b.name}</span>
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-base transition-[background-color,color,translate] duration-200 group-hover:translate-x-0.5 group-hover:bg-ink group-hover:text-paper"
                    >
                      →
                    </span>
                  </span>
                  {domain ? <span className="mt-1 truncate text-sm text-muted">{domain}</span> : null}
                  <span className="mt-auto grid grid-cols-2 gap-1.5 pt-5">
                    <CardStat label="Website">
                      {address ? (
                        <Suspense fallback={<SiteState state="checking" />}>
                          <CardSite address={address} />
                        </Suspense>
                      ) : (
                        <span className="font-semibold text-muted">None saved</span>
                      )}
                    </CardStat>
                    <CardStat label={`Visitors, ${span} days`}>
                      {visits ? (
                        <>
                          <CountUp value={visits.current.visitors} />
                          <Sparkline values={visits.days.map((d) => d.visitors)} />
                        </>
                      ) : (
                        <span className="font-semibold text-muted">—</span>
                      )}
                    </CardStat>
                    {lb ? (
                      <CardStat label="Leads, 30 days" wide>
                        <CountUp value={lb.last30.leads} />
                        <Delta current={lb.last30.leads} previous={lb.previous30.leads} />
                      </CardStat>
                    ) : null}
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
    </section>
  );
}
