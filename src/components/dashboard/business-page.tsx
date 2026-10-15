import Link from "next/link";
import type { BusinessRecord, BusinessSite } from "@/lib/business-model";
import { editHref } from "@/lib/business-href";
import { dayLabel } from "@/lib/business-model";
import { knowledgeSections } from "@/lib/business-view";
import { formatRelative } from "@/lib/format";
import type { SiteHealth } from "@/lib/site-health";
import type { Traffic } from "@/lib/traffic-model";
import { CopyButton } from "@/components/agents/embed-tools";
import { BarChart, Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { buttonClass, cx } from "@/components/ui/primitives";
import { Facts, Linked, Muted, Out, Tile, Tiles, Title } from "./ui";

/*
 * One business on the dashboard: what it is (left), its website at a glance
 * with a live check (right), and the website's traffic below. Nothing else.
 */

/** The website a business is mainly known by: the one its address points to, else the first. */
export function mainSite(record: BusinessRecord): BusinessSite | null {
  const host = (url: string | null) => {
    try {
      return url ? new URL(url).hostname.replace(/^www\./, "") : null;
    } catch {
      return null;
    }
  };
  const main = host(record.websiteUrl);
  return record.sites.find((s) => s.domain.replace(/^www\./, "") === main || host(s.url) === main) ?? record.sites[0] ?? null;
}

/* ─── About ───────────────────────────────────────────────────────── */

export function BusinessAbout({ record }: { record: BusinessRecord }) {
  const [first, ...rest] = knowledgeSections(record.about);
  return (
    <section className="animate-rise">
      <Title level={3}>About</Title>
      {first ? (
        <>
          <div className="max-w-prose space-y-3 text-[17px] leading-relaxed">
            {first.lines.map((line, i) => (
              <p key={i}>
                <Linked text={line} />
              </p>
            ))}
          </div>
          {rest.length ? (
            <details className="group/more mt-5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
                <span className="group-open/more:hidden">Read more</span>
                <span className="hidden group-open/more:inline">Show less</span>
              </summary>
              <div className="mt-5 max-w-prose animate-fade space-y-6">
                {rest.map((s, i) => (
                  <div key={i}>
                    {s.heading ? <h4 className="label mb-2 text-muted">{s.heading}</h4> : null}
                    <div className="space-y-2 text-[15px] leading-relaxed">
                      {s.lines.map((line, j) => (
                        <p key={j}>
                          <Linked text={line} />
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-wash px-5 py-4">
          <Muted>Nothing written about {record.name} yet.</Muted>
          <Link href={editHref(record.slug, "details")} className={buttonClass("primary", "min-h-9 px-4")}>
            Write about it
          </Link>
        </div>
      )}
    </section>
  );
}

/* ─── The website, at a glance ────────────────────────────────────── */

/** Green and gently pulsing when live, red when there's a problem, grey while checking. */
function Light({ state }: { state: "live" | "down" | "checking" }) {
  return (
    <span className="relative flex size-4 shrink-0" aria-hidden="true">
      {state === "live" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-40" /> : null}
      <span className={cx("relative inline-flex size-4 rounded-full", state === "live" ? "bg-live" : state === "down" ? "bg-down" : "animate-shimmer bg-line")} />
    </span>
  );
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** `health` is null while the check runs, "none" when no website is saved. */
function Status({ health, timeZone }: { health: SiteHealth | null | "none"; timeZone: string }) {
  if (health === "none") {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-wash p-6">
        <Light state="checking" />
        <p className="text-lg font-bold">No website saved</p>
      </div>
    );
  }
  const state = health === null ? "checking" : health.live ? "live" : "down";
  const time = health ? new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(health.checkedAt)) : null;
  const facts = health
    ? [health.live && health.ms !== null ? `Answered in ${seconds(health.ms)}` : null, health.sslUntil ? `SSL until ${dayLabel(health.sslUntil)}` : null, `checked at ${time}`]
    : [];
  return (
    <section aria-label="Website status" aria-live="polite" className="rounded-3xl bg-wash p-6">
      <div className="flex items-center gap-3">
        <Light state={state} />
        <p className={cx("text-2xl font-extrabold tracking-[-0.02em]", state === "live" ? "text-live" : state === "down" ? "text-down" : "text-muted")}>
          {state === "live" ? "Live and working" : state === "down" ? "Site has a problem" : "Checking the site…"}
        </p>
      </div>
      {health && !health.live ? <p className="mt-3 text-[17px] font-semibold text-down">{health.problem}</p> : null}
      {facts.length ? <p className="mt-2 text-sm text-muted">{facts.filter(Boolean).join(" · ")}</p> : null}
      {health?.note ? <p className="mt-2 text-sm text-muted">{health.note}</p> : null}
    </section>
  );
}

/**
 * Right of the About text: the live check, then what the site is for, its
 * domain and where it's hosted. While the check runs, `health` is null and
 * the host isn't known yet.
 */
export function SiteSide({ record, site, health, timeZone }: { record: BusinessRecord; site: BusinessSite | null; health: SiteHealth | null | "none"; timeZone: string }) {
  const address = record.websiteUrl ?? site?.url ?? (site ? `https://${site.domain}` : null);
  let domain = site?.domain ?? null;
  if (!domain && address) {
    try {
      domain = new URL(address).hostname.replace(/^www\./, "");
    } catch {
      domain = null;
    }
  }
  const host = health && health !== "none" ? (health.host ?? site?.hostingProvider ?? site?.platform ?? null) : null;

  return (
    <div className="stagger space-y-3">
      <Status health={health} timeZone={timeZone} />
      <Facts
        rows={[
          ["What it's for", record.tagline],
          [
            "Domain",
            domain ? (
              <>
                {address ? <Out href={address}>{domain}</Out> : domain}
                {site?.registrar ? <span className="block text-sm font-normal text-muted">Registered at {site.registrar}</span> : null}
              </>
            ) : null,
          ],
          [
            "Hosted on",
            health === null ? (
              <>
                <span className="inline-block h-4 w-24 animate-shimmer rounded-full bg-mist align-middle" aria-hidden="true" />
                <span className="sr-only">Checking</span>
              </>
            ) : (
              host
            ),
          ],
        ]}
      />
    </div>
  );
}

/* ─── Traffic ─────────────────────────────────────────────────────── */

export function TrafficPanel({ traffic, now, domain, code }: { traffic: Traffic; now: Date; domain: string | null; code: string }) {
  if (!traffic.lastVisitAt) {
    return (
      <section className="reveal">
        <Title level={3}>Website traffic</Title>
        <div className="space-y-4 rounded-2xl bg-wash p-5">
          <p className="max-w-2xl text-[15px] leading-relaxed">
            No visits counted yet. JodyOS counts them with the agent line: once it&apos;s on {domain ?? "the website"}, every page view shows here within a minute.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-paper px-4 py-3 font-mono text-sm">{code}</code>
            <CopyButton text={code} />
          </div>
        </div>
      </section>
    );
  }
  const { last30, previous30, today } = traffic;
  return (
    <section className="reveal space-y-4">
      <Title level={3} note={`last 30 days · last visit ${formatRelative(traffic.lastVisitAt, now)}`}>
        Website traffic
      </Title>
      <Tiles className="sm:grid-cols-3">
        <Tile label="Visitors" value={<CountUp value={last30.visitors} />}>
          <Delta current={last30.visitors} previous={previous30.visitors} />
        </Tile>
        <Tile label="Page views" value={<CountUp value={last30.views} />}>
          <Delta current={last30.views} previous={previous30.views} />
        </Tile>
        <Tile label="Today" value={<CountUp value={today.visitors} />}>
          {today.visitors === 1 ? "visitor" : "visitors"}, {today.views.toLocaleString("en-US")} page {today.views === 1 ? "view" : "views"}
        </Tile>
      </Tiles>
      <BarChart points={traffic.days.map((d) => ({ date: d.date, value: d.visitors }))} unit="visitors" />
    </section>
  );
}
