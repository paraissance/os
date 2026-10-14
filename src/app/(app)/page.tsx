import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { greeting } from "@/lib/format";
import type { SectionId } from "@/lib/business-sections";
import { loadBook } from "@/lib/businesses";
import { getBusiness, listBusinesses, settle } from "@/lib/os-analytics";
import { getSettings } from "@/lib/settings";
import { AskBar } from "@/components/dashboard/ask-bar";
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
 * each with its own sections (`&s=<section>`). Business details come from
 * JodyOS's own records; live numbers from OS Analytics are added when it is
 * connected.
 */
export default function DashboardPage(props: PageProps<"/">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-6 h-32 w-full" />}>
        <Greeting />
      </Suspense>
      <AskBar />
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
    <header className="mb-6 animate-rise">
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

  return (
    <>
      <Suspense fallback={<TabBarSkeleton />}>
        <TabBar current={slug} />
      </Suspense>
      {slug ? (
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
  const [book, live] = await Promise.all([loadBook(), envStatus().osAnalytics ? settle(listBusinesses) : Promise.resolve(null)]);
  if (!book.businesses.length) return null;
  const leads = new Map(live?.ok ? live.data.businesses.map((x) => [x.slug, x.last30.leads]) : []);
  const ordered = [...book.businesses.filter((x) => x.status === "active"), ...book.businesses.filter((x) => x.status !== "active")];
  const items = ordered.map((x) => ({ slug: x.slug, name: x.name, leads: leads.get(x.slug) ?? null, active: x.status === "active" }));
  return <BusinessTabBar items={items} current={current} />;
}

function NotFoundCard({ slug }: { slug: string }) {
  return (
    <div className="animate-rise rounded-3xl bg-wash p-6 sm:p-8">
      <p className="text-2xl font-extrabold">There is no business called “{slug}”.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className={buttonClass("light")}>
          Back to all businesses
        </Link>
        <Link href="/businesses/new" className={buttonClass("primary")}>
          + Add a business
        </Link>
      </div>
    </div>
  );
}

async function BusinessTab({ slug }: { slug: string }) {
  await requireUser();
  const [book, settings] = await Promise.all([loadBook(), getSettings()]);
  const record = book.businesses.find((x) => x.slug === slug);
  if (!record) return <NotFoundCard slug={slug} />;

  // Live numbers are a bonus: a plugin outage never hides the business itself.
  const result = envStatus().osAnalytics ? await settle(() => getBusiness(slug)) : null;
  const live = result?.ok ? result.data : null;

  const page = { record, shared: book.shared, live, timeZone: settings.timezone, today: requestNow() };
  const panels: Partial<Record<SectionId, ReactNode>> = {
    summary: <SummarySection {...page} />,
    about: <AboutSection {...page} />,
    links: <LinksSection {...page} />,
    money: <MoneySection {...page} />,
    website: <WebsiteSection {...page} />,
    ...(live
      ? {
          marketing: <MarketingSection b={live} timeZone={settings.timezone} />,
          leads: <LeadsSection b={live} timeZone={settings.timezone} />,
        }
      : {}),
  };
  const website = record.websiteUrl ?? record.sites.find((s) => s.url)?.url ?? null;

  return (
    <article aria-label={record.name}>
      <header className="mb-8 flex animate-rise flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            {record.name}
            {record.status === "paused" ? <Badge tone="neutral">Paused</Badge> : null}
          </h2>
          {record.tagline ? <p className="mt-3 text-lg text-muted">{record.tagline}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {website ? (
            <a href={website} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
              Visit website <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          <Link href={`/businesses/${record.slug}/edit`} className={buttonClass("secondary")}>
            Edit details
          </Link>
        </div>
      </header>
      {result && !result.ok ? (
        <div className="mb-8">
          <Alert>Live numbers from OS Analytics are unavailable right now: {result.error.message}</Alert>
        </div>
      ) : null}
      <SectionTabs slug={record.slug} panels={panels} />
    </article>
  );
}