import type { BusinessRecord, BusinessSite } from "@/lib/business-model";
import { businessHref } from "@/lib/business-href";
import { dayLabel, quickLinks } from "@/lib/business-model";
import { knowledgeSections } from "@/lib/business-view";
import { costPer, funnelTotals, type CampaignFunnel } from "@/lib/meta-ads-model";
import { formatMoney } from "@/lib/money";
import type { SiteHealth } from "@/lib/site-health";
import { SPANS, type Span, type Traffic } from "@/lib/traffic-model";
import { CopyButton } from "@/components/agents/embed-tools";
import { BarChart, Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { cx } from "@/components/ui/primitives";
import { Facts, LinkPills, Linked, Muted, Out, SpanPills, Tile, Tiles, Title } from "./ui";

/*
 * One business on the dashboard: its magic links, what it is (left), its
 * website at a glance with a live check (right), and the website's traffic
 * and Facebook ads below. Nothing else.
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

/** The address to open a business at: its own, else its main website's. */
export function mainAddress(record: BusinessRecord): string | null {
  const site = mainSite(record);
  return record.websiteUrl ?? site?.url ?? (site ? `https://${site.domain}` : null);
}

/* ─── Magic links ─────────────────────────────────────────────────── */

const MAGIC_LINKS_SHOWN = 8;

/** One tap to the business's site, where it's edited, its logins, tools and profiles. Changed on the Businesses page, not here. */
export function BusinessMagicLinks({ record }: { record: BusinessRecord }) {
  const links = quickLinks(record);
  const more = links.slice(MAGIC_LINKS_SHOWN);
  return (
    <section className="animate-rise rounded-3xl bg-wash p-6">
      <Title>Magic links</Title>
      {links.length ? <LinkPills links={links.slice(0, MAGIC_LINKS_SHOWN)} /> : <Muted>No links saved yet.</Muted>}
      {more.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-muted">{more.length} more</summary>
          <LinkPills links={more} className="mt-3" />
        </details>
      ) : null}
    </section>
  );
}

/* ─── About ───────────────────────────────────────────────────────── */

export function BusinessAbout({ record }: { record: BusinessRecord }) {
  const [first, ...rest] = knowledgeSections(record.about);
  return (
    <section className="animate-rise rounded-3xl bg-wash p-6 sm:p-8">
      <Title>About</Title>
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
                    {s.heading ? <h3 className="label mb-2 text-muted">{s.heading}</h3> : null}
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
        <Muted>Nothing written yet.</Muted>
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

/** `health` is null while the check runs, "none" when no website is saved. */
function Status({ health }: { health: SiteHealth | null | "none" }) {
  if (health === "none") {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-wash p-6">
        <Light state="checking" />
        <p className="text-lg font-bold">No website saved</p>
      </div>
    );
  }
  const state = health === null ? "checking" : health.live ? "live" : "down";
  return (
    <section aria-label="Website status" aria-live="polite" title={health?.note ?? undefined} className="rounded-3xl bg-wash p-6">
      <div className="flex items-center gap-3">
        <Light state={state} />
        <p className={cx("text-2xl font-extrabold tracking-[-0.02em]", state === "live" ? "text-live" : state === "down" ? "text-down" : "text-muted")}>
          {state === "live" ? "Live and working" : state === "down" ? "Site has a problem" : "Checking the site…"}
        </p>
      </div>
      {health && !health.live ? <p className="mt-3 text-[17px] font-semibold text-down">{health.problem}</p> : null}
      {health?.sslUntil ? <p className="mt-2 text-sm text-muted">SSL until {dayLabel(health.sslUntil)}</p> : null}
    </section>
  );
}

/**
 * Right of the About text: the live check, then what the site is for, its
 * domain and where it's hosted. While the check runs, `health` is null and
 * the host isn't known yet.
 */
export function SiteSide({ record, site, health }: { record: BusinessRecord; site: BusinessSite | null; health: SiteHealth | null | "none" }) {
  const address = mainAddress(record);
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
      <Status health={health} />
      <Facts
        rows={[
          ["What it's for", record.tagline],
          [
            "Domain",
            domain ? address ? <Out href={address}>{domain}</Out> : domain : null,
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

export function TrafficPanel({ traffic, span, slug, domain, code }: { traffic: Traffic; span: Span; slug: string; domain: string | null; code: string }) {
  if (!traffic.lastVisitAt) {
    return (
      <section className="reveal">
        <Title>Website traffic</Title>
        <div className="space-y-4 rounded-3xl bg-wash p-6">
          <p className="text-[15px]">No visits yet. Put this line on {domain ?? "the website"} to start counting:</p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-paper px-4 py-3 font-mono text-sm">{code}</code>
            <CopyButton text={code} />
          </div>
        </div>
      </section>
    );
  }
  const { current, previous, today } = traffic;
  return (
    <section className="reveal space-y-4">
      <Title note={<SpanPills span={span} href={(s) => `${businessHref(slug)}${s === SPANS[0] ? "" : `&days=${s}`}`} />}>
        Website traffic
      </Title>
      <Tiles className="sm:grid-cols-3">
        <Tile label="Visitors" value={<CountUp value={current.visitors} />}>
          <Delta current={current.visitors} previous={previous.visitors} days={span} />
        </Tile>
        <Tile label="Page views" value={<CountUp value={current.views} />}>
          <Delta current={current.views} previous={previous.views} days={span} />
        </Tile>
        <Tile label="Visitors today" value={<CountUp value={today.visitors} />} />
      </Tiles>
      <BarChart points={traffic.days.map((d) => ({ date: d.date, value: d.visitors }))} unit="visitors" />
    </section>
  );
}

/* ─── Facebook ads ────────────────────────────────────────────────── */

const count = (n: number) => Math.round(n).toLocaleString("en-US");
const money = (n: number | null, currency: string) => (n === null ? "–" : formatMoney(n, currency, n < 100 ? 2 : 0));

/** Each campaign from ad to site visit to conversion, over the period the traffic shows. `ads` is an error line when Facebook didn't answer. */
export function AdsPanel({ ads, span }: { ads: { campaigns: CampaignFunnel[]; currency: string } | string; span: Span }) {
  if (typeof ads === "string" || !ads.campaigns.length) {
    return (
      <section className="reveal">
        <Title note={`last ${span} days`}>Facebook ads</Title>
        <Muted>{typeof ads === "string" ? ads : `No ad spend in the last ${span} days.`}</Muted>
      </section>
    );
  }
  const { campaigns, currency } = ads;
  const t = funnelTotals(campaigns);
  return (
    <section className="reveal space-y-4">
      <Title note={`last ${span} days`}>Facebook ads</Title>
      <Tiles className="sm:grid-cols-4">
        <Tile label="Spent" value={<CountUp value={t.spend} currency={currency} digits={0} />} />
        <Tile label="Link clicks" value={<CountUp value={t.clicks} />}>
          {money(costPer(t.spend, t.clicks), currency)} each
        </Tile>
        <Tile label="Site visits" value={<CountUp value={t.visits} />}>
          {money(costPer(t.spend, t.visits), currency)} each
        </Tile>
        <Tile label="Conversions" value={<CountUp value={t.conversions} />}>
          {t.conversions ? `${money(costPer(t.spend, t.conversions), currency)} each` : null}
        </Tile>
      </Tiles>
      <div className="overflow-x-auto rounded-3xl bg-wash p-2 sm:p-4">
        <table className="w-full min-w-[40rem] text-left text-[15px] tabular-nums">
          <thead className="text-sm text-muted">
            <tr>
              <th className="p-3 font-semibold">Campaign</th>
              <th className="p-3 text-right font-semibold">Spent</th>
              <th className="p-3 text-right font-semibold">Clicks</th>
              <th className="p-3 text-right font-semibold">Site visits</th>
              <th className="p-3 text-right font-semibold">Conversions</th>
              <th className="p-3 text-right font-semibold">Per conversion</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="max-w-xs truncate p-3 font-semibold" title={c.name}>
                  {c.name}
                </td>
                <td className="p-3 text-right">{money(c.spend, currency)}</td>
                <td className="p-3 text-right">{count(c.clicks)}</td>
                <td className="p-3 text-right">{count(c.visits)}</td>
                <td className="p-3 text-right" title={c.byType.map((b) => `${count(b.count)} ${b.label}`).join(", ") || undefined}>
                  {count(c.conversions)}
                </td>
                <td className="p-3 text-right">{money(costPer(c.spend, c.conversions), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
