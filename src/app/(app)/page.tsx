import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ownerName } from "@/lib/auth/admins";
import { requireUser } from "@/lib/auth/current-user";
import type { BusinessRecord, BusinessSite } from "@/lib/business-model";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { greeting } from "@/lib/format";
import { listBusinesses, settle } from "@/lib/os-analytics";
import { requestOrigin } from "@/lib/request-origin";
import { getSettings } from "@/lib/settings";
import { checkSite } from "@/lib/site-check";
import { loadTraffic } from "@/lib/traffic";
import { embedCode } from "@/components/agents/agent-view";
import { AskBar } from "@/components/dashboard/ask-bar";
import { BusinessAbout, SiteSide, TrafficPanel, mainSite } from "@/components/dashboard/business-page";
import { BusinessTabBar } from "@/components/dashboard/business-tab-bar";
import { Overview } from "@/components/dashboard/overview";
import { Badge, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard: "All businesses" plus one tab per business (`/?b=<slug>`):
 * what it is, its website checked live, and the website's traffic.
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
  // Every super admin is greeted by the owner's name: this is Jody's OS.
  const [{ timezone }, owner] = await Promise.all([getSettings(), ownerName()]);
  const now = requestNow();
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(now);
  return (
    <header className="mb-6 animate-rise">
      <p className="label mb-3 text-muted">{date}</p>
      <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-7xl">
        {greeting(now, timezone)}, {(owner ?? user.name).split(" ")[0]}.
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

  const site = mainSite(record);
  const website = record.websiteUrl ?? site?.url ?? (site ? `https://${site.domain}` : null);
  const side = { record, site, timeZone: settings.timezone };

  return (
    <article aria-label={record.name} className="space-y-14">
      <header className="flex animate-rise flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <h2 className="flex min-w-0 flex-wrap items-center gap-3 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
          {record.name}
          {record.status === "paused" ? <Badge tone="neutral">Paused</Badge> : null}
        </h2>
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-12">
        <BusinessAbout record={record} />
        {website ? (
          // The page shows at once; the live check fills in when the site has answered.
          <Suspense fallback={<SiteSide {...side} health={null} />}>
            <LiveSite {...side} address={website} />
          </Suspense>
        ) : (
          <SiteSide {...side} health="none" />
        )}
      </div>

      <Suspense fallback={<Skeleton className="h-72" />}>
        <Traffic record={record} domain={site?.domain ?? null} timeZone={settings.timezone} />
      </Suspense>
    </article>
  );
}

async function LiveSite(props: { record: BusinessRecord; site: BusinessSite | null; timeZone: string; address: string }) {
  await requireUser();
  const health = await checkSite(props.address, requestNow());
  return <SiteSide {...props} health={health} />;
}

async function Traffic({ record, domain, timeZone }: { record: BusinessRecord; domain: string | null; timeZone: string }) {
  await requireUser();
  const now = requestNow();
  const [traffic, origin] = await Promise.all([loadTraffic(record.id, now, timeZone), requestOrigin()]);
  return <TrafficPanel traffic={traffic} now={now} domain={domain} code={embedCode(origin, record.slug)} />;
}