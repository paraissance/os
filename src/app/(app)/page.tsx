import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { greeting } from "@/lib/format";
import type { SectionId } from "@/lib/business-sections";
import { getBusiness, listBusinesses, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { BusinessTabBar } from "@/components/dashboard/business-tab-bar";
import {
  AboutSection,
  LeadsSection,
  LinksSection,
  MarketingSection,
  MoneySection,
  SummarySection,
  WebsiteSection,
} from "@/components/dashboard/business-sections";
import { Overview } from "@/components/dashboard/overview";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { Alert, Badge, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard: "All businesses" plus one tab per business (`/?b=<slug>`),
 * each with its own sections (`&s=<section>`). Business data comes live from
 * OS Analytics on every request.
 */
export default function DashboardPage(props: PageProps<"/">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-8 h-32 w-full" />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<TabBarSkeleton />}>
        <Body searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function TabBarSkeleton() {
  return (
    <div className="mb-10 flex gap-2" aria-hidden="true">
      {[8, 10, 9, 11].map((w, i) => (
        <Skeleton key={i} className="h-11 rounded-full" style={{ width: `${w}rem` }} />
      ))}
    </div>
  );
}

async function Greeting() {
  const user = await requireUser();
  const { timezone } = await getSettings();
  const now = requestNow();
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  return (
    <header className="mb-8 animate-rise">
      <p className="label mb-3 text-muted">{date}</p>
      <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
        {greeting(now, timezone)}, {user.name.split(" ")[0]}.
      </h1>
      <p className="mt-3 text-lg text-muted">Here&apos;s how your businesses are doing.</p>
    </header>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await requireUser();
  const { b } = await searchParams;
  const slug = typeof b === "string" && b ? b : null;
  const connected = envStatus().osAnalytics;

  return (
    <>
      {connected ? (
        <Suspense fallback={<TabBarSkeleton />}>
          <TabBar current={slug} />
        </Suspense>
      ) : null}
      {connected && slug ? (
        <Suspense key={slug} fallback={<Skeleton className="h-[40rem]" />}>
          <BusinessTab slug={slug} />
        </Suspense>
      ) : (
        <Overview />
      )}
    </>
  );
}

async function TabBar({ current }: { current: string | null }) {
  await requireUser();
  const result = await settle(listBusinesses);
  const all = result.ok ? result.data.businesses : [];
  const items = [...all.filter((x) => x.active), ...all.filter((x) => !x.active)].map((x) => ({
    slug: x.slug,
    name: x.name,
    leads: x.last30.leads,
    active: x.active,
  }));
  return <BusinessTabBar items={items} current={current} />;
}

async function BusinessTab({ slug }: { slug: string }) {
  await requireUser();
  const [result, settings] = await Promise.all([settle(() => getBusiness(slug)), getSettings()]);
  if (!result.ok) return <Alert tone="bad">{result.error.message}</Alert>;
  const b = result.data;
  if (!b) {
    return (
      <div className="animate-rise rounded-2xl bg-wash p-6">
        <p className="text-2xl font-extrabold">There is no business called “{slug}”.</p>
        <Link href="/" className="mt-3 inline-block font-semibold underline decoration-1 underline-offset-4">
          Back to all businesses
        </Link>
      </div>
    );
  }

  const props = { b, timeZone: settings.timezone, today: requestNow() };
  const panels: Record<SectionId, ReactNode> = {
    summary: <SummarySection {...props} />,
    about: <AboutSection {...props} />,
    links: <LinksSection {...props} />,
    money: <MoneySection {...props} />,
    website: <WebsiteSection {...props} />,
    marketing: <MarketingSection {...props} />,
    leads: <LeadsSection {...props} />,
  };

  return (
    <article aria-label={b.name}>
      <header className="mb-8 flex animate-rise flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            {b.name}
            {!b.active ? <Badge tone="neutral">Paused</Badge> : null}
          </h2>
          {b.tagline ? <p className="mt-3 text-lg text-muted">{b.tagline}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {b.siteUrl ? (
            <a href={b.siteUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
              Visit website <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          {b.adminLinks.dashboard ? (
            <a href={b.adminLinks.dashboard} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
              Open in OS Analytics <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </header>
      <SectionTabs slug={b.slug} panels={panels} />
    </article>
  );
}
