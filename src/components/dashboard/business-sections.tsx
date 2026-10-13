import Link from "next/link";
import type { ReactNode } from "react";
import {
  dayLabel,
  linkGroups,
  mostUrgent,
  recordAttention,
  renewalLabel,
  renewalWords,
  siteRenewals,
  sortAttention,
  spending,
  toolsFor,
  upcomingDates,
  type BusinessRecord,
  type BusinessSite,
  type Subscription,
} from "@/lib/business-model";
import { CYCLE_LABELS } from "@/lib/business-input";
import { formatMoney, liveAttention, percentChange, type BusinessDetail } from "@/lib/os-analytics";
import {
  compactMoney,
  cycleLabel,
  formatDay,
  formatWhen,
  funnelSteps,
  humanize,
  knowledgeSections,
  leadStatusLabel,
} from "@/lib/business-view";
import { BarChart, Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { Badge, buttonClass, cx, type Tone } from "@/components/ui/primitives";
import { AttentionList, Bars, Facts, LinkRow, Linked, Muted, Out, Rows, Sentence, Tile, Tiles, Title as BaseTitle } from "./ui";

/*
 * The sections of a business tab. Each one leads with a plain sentence,
 * then the detail on soft cards. Details come from the owner's own records
 * in JodyOS; when OS Analytics is connected, live numbers (leads,
 * marketing) are added on top.
 */

/** Everything one business tab shows. */
export type BusinessPage = {
  record: BusinessRecord;
  shared: Subscription[];
  live: BusinessDetail | null;
  timeZone: string;
  today: Date;
};

type LiveProps = { b: BusinessDetail; timeZone: string };

/** Section titles sit under the business name (h2). */
function Title(props: Omit<Parameters<typeof BaseTitle>[0], "level">) {
  return <BaseTitle {...props} level={3} />;
}

/** A block of a section that rises in as it scrolls into view. */
function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("reveal", className)}>{children}</section>;
}

function plural(n: number, word: string, many = `${word}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? word : many}`;
}

function changeWords(current: number, previous: number) {
  const c = percentChange(current, previous);
  if (c === null) return ", none the 30 days before";
  if (c === 0) return ", the same as the 30 days before";
  return `, ${c > 0 ? "up" : "down"} ${Math.abs(c)}% on the 30 days before`;
}

function Grid({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-12", wide ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : "lg:grid-cols-2")}>
      {children}
    </div>
  );
}

/** "Edit websites" and the like: straight to that part of the edit page. */
function EditLink({ slug, part, children }: { slug: string; part: string; children: ReactNode }) {
  return (
    <Link href={`/businesses/${slug}/edit#${part}`} className={buttonClass("secondary", "min-h-9 px-4")}>
      {children}
    </Link>
  );
}

/** An empty part: what's missing, and the button that adds it. */
function Empty({ slug, part, text, action }: { slug: string; part: string; text: string; action: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-wash px-5 py-4">
      <p className="text-muted">{text}</p>
      <Link href={`/businesses/${slug}/edit#${part}`} className={buttonClass("primary", "min-h-9 px-4")}>
        {action}
      </Link>
    </div>
  );
}

/* ─── Summary ─────────────────────────────────────────────────────── */

export function SummarySection({ record, shared, live, timeZone, today }: BusinessPage) {
  const tools = spending(toolsFor(record, shared), today);
  const renewals = record.sites.flatMap((s) => siteRenewals(s, today));
  const worst = mostUrgent(renewals);
  const attention = sortAttention([...recordAttention(record, shared, today), ...(live ? liveAttention(live) : [])]);
  const due = upcomingDates(record, shared, today).slice(0, 6);
  const next = due.find((d) => d.daysLeft >= 0);
  const linkCount = linkGroups(record, shared).reduce((n, g) => n + g.links.length, 0);

  return (
    <div className="space-y-12">
      {live ? <LiveStory b={live} /> : null}

      <Sentence>
        <b>{plural(record.sites.length, "website")}</b> and <b>{plural(linkCount, "saved link")}</b>
        {tools.count ? (
          <>
            , plus <b>{plural(tools.count, "paid tool")}</b>
            {tools.monthly > 0 ? (
              <>
                {" "}
                costing <b>{formatMoney(tools.monthly, "USD")} a month</b>
              </>
            ) : null}
          </>
        ) : null}
        .{" "}
        {worst ? (
          <>
            {worst.label}
            {record.sites.length > 1 ? ` (${worst.domain})` : ""}: <b>{renewalWords(worst).toLowerCase()}</b>.
          </>
        ) : renewals.length ? (
          "Every renewal is up to date."
        ) : record.sites.length ? (
          "Add the renewal dates to get reminders before anything expires."
        ) : null}
      </Sentence>

      <Tiles className="sm:grid-cols-4">
        <Tile label="Websites" value={<CountUp value={record.sites.length} />}>
          {record.sites.map((s) => s.domain).join(", ") || "none yet"}
        </Tile>
        <Tile label="Tools a month" value={<CountUp value={tools.monthly} currency="USD" />}>
          {plural(tools.count, "subscription")}
        </Tile>
        <Tile label="Saved links" value={<CountUp value={linkCount} />}>
          pages, logins and profiles
        </Tile>
        <Tile label="Next due" value={next ? (next.daysLeft === 0 ? "Today" : plural(next.daysLeft, "day")) : "—"}>
          {next ? next.what : "nothing in the next 90 days"}
        </Tile>
      </Tiles>

      <Grid wide>
        <div className="space-y-12">
          <Block>
            <Title count={attention.length}>Needs attention</Title>
            <AttentionList items={attention} empty="Nothing needs you here." />
          </Block>
          {live ? (
            <Block>
              <Title note="last 30 days">Leads per day</Title>
              <BarChart points={live.trend} />
            </Block>
          ) : null}
        </div>
        <div className="space-y-12">
          <Block>
            <Title note="next 90 days">Coming up</Title>
            {due.length ? (
              <Rows>
                {due.map((d, i) => (
                  <li key={i}>
                    <Link href={d.href} className="group flex items-baseline justify-between gap-4">
                      <span className="min-w-0 font-bold group-hover:underline group-hover:underline-offset-4">{d.what}</span>
                      <span className={cx("shrink-0 text-sm tabular-nums", d.daysLeft < 0 ? "font-bold" : "text-muted")}>
                        {d.daysLeft < 0 ? "overdue" : d.daysLeft === 0 ? "today" : dayLabel(d.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </Rows>
            ) : (
              <Muted>No renewals or payments in the next 90 days.</Muted>
            )}
          </Block>
          {live?.tasks.open.length ? (
            <Block>
              <Title count={live.tasks.pending + live.tasks.inProgress}>To do</Title>
              <Rows>
                {live.tasks.open.map((t, i) => (
                  <li key={`${t.title}-${i}`}>
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {t.title}
                      {t.overdue ? <Badge tone="bad">Overdue</Badge> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {[t.status === "in_progress" ? "In progress" : "Not started", t.assignee, t.dueAt ? `due ${formatWhen(t.dueAt, timeZone)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </Rows>
            </Block>
          ) : null}
          {record.notes ? (
            <Block>
              <Title>Notes</Title>
              <p className="whitespace-pre-line rounded-2xl bg-wash p-5 text-[15px] leading-relaxed">
                <Linked text={record.notes} />
              </p>
            </Block>
          ) : null}
        </div>
      </Grid>
    </div>
  );
}

/** The last 30 days from OS Analytics, when it is connected. */
function LiveStory({ b }: { b: BusinessDetail }) {
  const k = b.last30;
  const p = b.previous30;
  const money = (v: number, d?: number) => formatMoney(v, b.currency, d);
  const showLoans = k.loanVolume > 0 || p.loanVolume > 0;
  return (
    <div className="space-y-6">
      <Sentence>
        <b>{plural(k.leads, "lead")}</b> in the last 30 days{changeWords(k.leads, p.leads)}.{" "}
        {k.won ? (
          <>
            <b>{k.won} won</b> ({k.conversionRate}% of leads).{" "}
          </>
        ) : (
          "None won yet. "
        )}
        {k.spend > 0 ? (
          <>
            <b>{money(k.spend, 0)}</b> spent on marketing
            {k.leads ? (
              <>
                , <b>{money(k.costPerLead)}</b> per lead
              </>
            ) : null}
            .
          </>
        ) : null}
      </Sentence>
      <Tiles className="sm:grid-cols-3">
        <Tile label="Leads" value={<CountUp value={k.leads} />}>
          <Delta current={k.leads} previous={p.leads} />
        </Tile>
        <Tile label="Won" value={<CountUp value={k.won} />}>
          {k.conversionRate}% of leads
        </Tile>
        <Tile label="Appointments" value={<CountUp value={k.appointments} />}>
          <Delta current={k.appointments} previous={p.appointments} />
        </Tile>
        <Tile label="Spent on marketing" value={<CountUp value={k.spend} currency={b.currency} digits={0} />}>
          <Delta current={k.spend} previous={p.spend} />
        </Tile>
        <Tile label="Cost per lead" value={k.leads ? <CountUp value={k.costPerLead} currency={b.currency} /> : "—"}>
          {p.leads ? `was ${money(p.costPerLead)}` : null}
        </Tile>
        {showLoans ? (
          <Tile label="Loan volume" value={compactMoney(k.loanVolume, b.currency)}>
            <Delta current={k.loanVolume} previous={p.loanVolume} />
          </Tile>
        ) : (
          <Tile label="Clients" value={<CountUp value={b.clientsAllTime} />}>
            all time
          </Tile>
        )}
      </Tiles>
    </div>
  );
}

/* ─── About ───────────────────────────────────────────────────────── */

export function AboutSection({ record }: BusinessPage) {
  const sections = knowledgeSections(record.about);
  const nothing = !record.tagline && !sections.length && !record.faqs.length;

  return (
    <div className="space-y-12">
      {record.tagline ? (
        <Sentence>
          <b>{record.name}</b>: {record.tagline}.
        </Sentence>
      ) : null}
      {record.ctaUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          <a href={record.ctaUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
            {record.ctaLabel ?? "Main call to action"} <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <span className="text-sm text-muted">What the website asks visitors to do.</span>
        </div>
      ) : null}
      {nothing ? <Empty slug={record.slug} part="details" text={`Nothing written about ${record.name} yet.`} action="Write about it" /> : null}

      <Grid wide>
        <Block>
          <Title note={<EditLink slug={record.slug} part="details">Edit</EditLink>}>What it is</Title>
          {sections.length ? (
            <div className="stagger space-y-3">
              {sections.map((s, i) => (
                <div key={i} className="rounded-2xl bg-wash p-5">
                  {s.heading ? <h4 className="label mb-2 text-muted">{s.heading}</h4> : null}
                  <ul className="space-y-2 text-[17px] leading-relaxed">
                    {s.lines.map((line, j) => (
                      <li key={j}>
                        <Linked text={line} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <Muted>No description saved.</Muted>
          )}
        </Block>

        <Block>
          <Title count={record.faqs.length} note={<EditLink slug={record.slug} part="questions">Edit</EditLink>}>
            Common questions
          </Title>
          {record.faqs.length ? (
            <div className="stagger space-y-2">
              {record.faqs.map((q) => (
                <details key={q.id} className="group/q rounded-2xl bg-wash px-5 py-4 open:bg-mist">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-bold leading-snug [&::-webkit-details-marker]:hidden">
                    {q.question}
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-xl transition-transform duration-300 group-open/q:rotate-45">
                      +
                    </span>
                  </summary>
                  {q.answer ? <p className="mt-2 animate-fade whitespace-pre-line text-[15px] leading-relaxed">{q.answer}</p> : null}
                  {q.linkUrl ? (
                    <p className="mt-2 text-sm font-semibold">
                      <Out href={q.linkUrl}>{q.linkLabel ?? "Learn more"}</Out>
                    </p>
                  ) : null}
                </details>
              ))}
            </div>
          ) : (
            <Muted>None saved.</Muted>
          )}
        </Block>
      </Grid>
    </div>
  );
}

/* ─── Links ───────────────────────────────────────────────────────── */

export function LinksSection({ record, shared, live }: BusinessPage) {
  const groups = linkGroups(record, shared, live?.adminLinks);
  if (!groups.length) return <Empty slug={record.slug} part="links" text={`No links saved for ${record.name} yet.`} action="Add links" />;
  const count = groups.reduce((s, g) => s + g.links.length, 0);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Sentence>
          <b>{plural(count, "link")}</b> for {record.name}, in one place.
        </Sentence>
        <EditLink slug={record.slug} part="links">
          Edit links
        </EditLink>
      </div>
      <Grid>
        {groups.map((g) => (
          <Block key={g.id}>
            <Title count={g.links.length}>{g.title}</Title>
            <ul className="stagger">
              {g.links.map((l) => (
                <LinkRow key={l.url} label={l.label} url={l.url} note={l.note} />
              ))}
            </ul>
            {g.id === "logins" ? (
              <p className="mt-3 text-sm text-muted">Only the login pages are saved. Passwords stay in your password manager.</p>
            ) : null}
          </Block>
        ))}
      </Grid>
    </div>
  );
}

/* ─── Money ───────────────────────────────────────────────────────── */

export function MoneySection({ record, shared, live, today }: BusinessPage) {
  const all = toolsFor(record, shared);
  const sp = spending(all, today);
  const subs = [...all].sort((x, y) => y.amount - x.amount || x.name.localeCompare(y.name));
  const campaigns = live?.campaigns.filter((c) => c.budget > 0 || c.spend > 0) ?? [];

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Sentence>
          {sp.count ? (
            <>
              Tools and services cost <b>{formatMoney(sp.monthly, "USD")} a month</b> (<b>{formatMoney(sp.yearly, "USD", 0)}</b> a year) across{" "}
              <b>{plural(sp.count, "subscription")}</b>
              {shared.length ? ", shared tools included" : ""}.
            </>
          ) : (
            <>No subscriptions saved for {record.name} yet.</>
          )}
          {live ? (
            <>
              {" "}
              Marketing in the last 30 days: <b>{formatMoney(live.last30.spend, live.currency, 0)}</b>.
            </>
          ) : null}
        </Sentence>
        <EditLink slug={record.slug} part="subscriptions">
          Edit subscriptions
        </EditLink>
      </div>

      {sp.count ? (
        <Tiles className="sm:grid-cols-3">
          <Tile label="Each month" value={<CountUp value={sp.monthly} currency="USD" />} />
          <Tile label="Each year" value={<CountUp value={sp.yearly} currency="USD" digits={0} />} />
          <Tile label="Subscriptions" value={<CountUp value={sp.count} />} />
        </Tiles>
      ) : (
        <Empty slug={record.slug} part="subscriptions" text="Add the tools and services this business pays for to see the monthly cost." action="Add a subscription" />
      )}

      {sp.count ? (
        <>
          <Grid>
            <Block>
              <Title note="per month">By category</Title>
              <div className="rounded-2xl bg-wash p-5">
                <Bars rows={sp.byCategory.map((c) => ({ label: c.label, value: c.monthly, display: formatMoney(c.monthly, "USD") }))} empty="Only free or one-time tools." />
              </div>
            </Block>
            <Block>
              <Title note="next 30 days">Renewing soon</Title>
              {sp.upcoming.length ? (
                <Rows>
                  {sp.upcoming.map(({ sub, daysLeft }) => (
                    <li key={sub.id} className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0">
                        <span className="block font-bold">{sub.name}</span>
                        <span className="block text-sm text-muted">
                          {dayLabel(sub.nextRenewal)} · {daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : `in ${plural(daysLeft, "day")}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney(sub.amount, sub.currency)} {cycleLabel(sub.billingCycle)}
                      </span>
                    </li>
                  ))}
                </Rows>
              ) : (
                <Muted>Nothing renews in the next 30 days.</Muted>
              )}
            </Block>
          </Grid>

          <Block>
            <Title count={subs.length}>Every subscription</Title>
            <Rows>
              {subs.map((s) => (
                <li key={s.id} className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-lg font-bold leading-snug">
                      {s.name}
                      {s.businessId ? null : <Badge>Shared</Badge>}
                    </p>
                    <p className="text-sm text-muted">
                      {[humanCategory(s.category), s.account, s.nextRenewal ? `next payment ${dayLabel(s.nextRenewal)}` : null].filter(Boolean).join(" · ")}
                    </p>
                    {s.notes ? <p className="mt-1 whitespace-pre-line text-sm">{s.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end">
                    <p className="text-base font-bold tabular-nums">
                      {formatMoney(s.amount, s.currency)} <span className="text-sm font-normal text-muted">{CYCLE_LABELS[s.billingCycle].toLowerCase()}</span>
                    </p>
                    {s.loginUrl ? (
                      <Out href={s.loginUrl} className="text-sm font-semibold">
                        Log in
                      </Out>
                    ) : null}
                  </div>
                </li>
              ))}
            </Rows>
          </Block>
        </>
      ) : null}

      {campaigns.length ? (
        <Block>
          <Title note="spent of budget">Campaigns</Title>
          <Rows>
            {campaigns.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 font-bold">{c.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(c.spend, live!.currency, 0)}
                    {c.budget > 0 ? ` of ${formatMoney(c.budget, live!.currency, 0)}` : ""}
                  </span>
                </div>
                {c.budget > 0 ? (
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                    <div className="h-full origin-left animate-grow-x rounded-full bg-ink" style={{ width: `${Math.min(100, (c.spend / c.budget) * 100)}%` }} />
                  </div>
                ) : null}
              </li>
            ))}
          </Rows>
        </Block>
      ) : null}
    </div>
  );
}

function humanCategory(category: string) {
  return humanize(category === "ai" ? "AI" : category);
}

/* ─── Website ─────────────────────────────────────────────────────── */

function SiteBlock({ site, today }: { site: BusinessSite; today: Date }) {
  const renewals = new Map(siteRenewals(site, today).map((r) => [r.item, r]));
  const items = [
    ["domain", site.registrar],
    ["hosting", site.hostingProvider],
    ["ssl", site.sslProvider],
  ] as const;
  const login = (url: string | null) => (url ? <Out href={url}>Log in</Out> : null);
  const address = site.url ?? `https://${site.domain}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 className="text-2xl font-extrabold tracking-[-0.02em]">
          <Out href={address} className="no-underline hover:underline">
            {site.domain}
          </Out>
        </h4>
        {site.platform ? <Badge>{site.platform}</Badge> : null}
      </div>
      <Tiles className="sm:grid-cols-3">
        {items.map(([item, provider]) => {
          const r = renewals.get(item);
          const expired = r?.status === "expired";
          return (
            <div key={item} className={cx("min-w-0 rounded-2xl p-5", expired ? "bg-ink text-paper" : "bg-wash")}>
              <p className={cx("text-sm font-semibold", expired ? "text-paper/80" : "text-muted")}>{renewalLabel(item)}</p>
              <p className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">{r ? renewalWords(r) : "No date saved"}</p>
              <p className={cx("mt-1 text-sm", expired ? "text-paper/80" : "text-muted")}>{[r ? dayLabel(r.date) : null, provider].filter(Boolean).join(" · ") || "—"}</p>
            </div>
          );
        })}
      </Tiles>
      <Grid>
        <Facts
          rows={[
            ["Registrar", site.registrar],
            ["Account", site.registrarAccount],
            ["Login", login(site.registrarLoginUrl)],
            ["Auto-renew", site.domainAutoRenew ? "On" : "Off"],
            ["Nameservers", site.nameservers ? <span className="whitespace-pre-line font-mono text-sm">{site.nameservers}</span> : null],
          ]}
        />
        <Facts
          rows={[
            ["Hosting", [site.hostingProvider, site.hostingPlan].filter(Boolean).join(" · ") || null],
            ["Account", site.hostingAccount],
            ["Login", login(site.hostingLoginUrl)],
            ["Server IP", site.serverIp ? <span className="font-mono text-sm">{site.serverIp}</span> : null],
            ["Last backup", dayLabel(site.lastBackup)],
          ]}
        />
      </Grid>
      {site.notes ? (
        <p className="whitespace-pre-line rounded-2xl bg-wash p-5 text-[15px] leading-relaxed">
          <Linked text={site.notes} />
        </p>
      ) : null}
    </div>
  );
}

export function WebsiteSection({ record, today }: BusinessPage) {
  if (!record.sites.length) {
    return (
      <Empty
        slug={record.slug}
        part="websites"
        text={`No websites saved for ${record.name}. Add the domain, hosting and SSL dates, and JodyOS will warn you before anything expires.`}
        action="Add a website"
      />
    );
  }
  return (
    <div className="space-y-14">
      <div className="flex justify-end">
        <EditLink slug={record.slug} part="websites">
          Edit websites
        </EditLink>
      </div>
      {record.sites.map((site) => (
        <Block key={site.id}>
          <SiteBlock site={site} today={today} />
        </Block>
      ))}
    </div>
  );
}

/* ─── Marketing ───────────────────────────────────────────────────── */

export function MarketingSection({ b, timeZone }: LiveProps) {
  const steps = funnelSteps(b.funnel);
  const pub = b.publisher;
  const money = (v: number, d?: number) => formatMoney(v, b.currency, d);
  const n = (v: number) => v.toLocaleString("en-US");

  return (
    <div className="space-y-12">
      <Block>
        <Title note="last 30 days">From first look to lead</Title>
        <ol className={cx("stagger grid grid-cols-2 gap-3", steps.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
          {steps.map((s, i) => (
            <li key={s.key} className="relative min-w-0 rounded-2xl bg-wash p-5">
              <p className="text-sm font-semibold text-muted">
                {i + 1}. {s.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-4xl">
                <CountUp value={s.value} />
              </p>
              <p className="mt-1 text-sm text-muted">{i === 0 ? "views" : s.rate === null ? "—" : `${s.rate}% of ${s.of}`}</p>
            </li>
          ))}
        </ol>
      </Block>

      <Grid>
        <Block>
          <Title note="last 4 weeks">Social media</Title>
          {b.social.length ? (
            <Rows>
              {b.social.map((s) => (
                <li key={s.platform}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-lg font-bold">{s.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{n(s.followers)} followers</span>
                  </div>
                  <p className="text-sm text-muted">
                    {n(s.posts)} posts · {n(s.impressions)} seen · {n(s.clicks)} clicks · {n(s.engagements)} engagements · {n(s.leads)} leads
                  </p>
                </li>
              ))}
            </Rows>
          ) : (
            <Muted>No social stats entered for the last 4 weeks.</Muted>
          )}
        </Block>

        <Block>
          <Title note="most leads">Best posts</Title>
          {b.topPosts.length ? (
            <Rows>
              {b.topPosts.map((post, i) => (
                <li key={`${post.url ?? post.title}-${i}`}>
                  <p className="font-bold leading-snug">
                    {post.url ? <Out href={post.url}>{post.title ?? "Untitled post"}</Out> : (post.title ?? "Untitled post")}
                  </p>
                  <p className="text-sm text-muted">{[humanize(post.platform), formatWhen(post.publishedAt, timeZone)].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {n(post.leads)} leads · {n(post.clicks)} clicks · {n(post.reach)} reach
                  </p>
                </li>
              ))}
            </Rows>
          ) : (
            <Muted>No posts recorded yet.</Muted>
          )}
        </Block>

        <Block>
          <Title>Social Publisher</Title>
          {pub ? (
            <div className="space-y-4">
              <p className="rounded-2xl bg-wash p-5 text-lg leading-snug [&_b]:font-extrabold">
                <b>{plural(pub.queued, "post")}</b> waiting
                {pub.next ? (
                  <>
                    , next <b>{formatWhen(pub.next, timeZone)}</b>
                  </>
                ) : null}
                . <b>{n(pub.published)}</b> published
                {pub.failed ? (
                  <>
                    , <b>{n(pub.failed)} failed</b>
                  </>
                ) : null}
                .
              </p>
              {pub.upcoming.length ? (
                <Rows>
                  {pub.upcoming.map((u, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0">
                        <span className="block font-semibold">{u.title ?? "Untitled post"}</span>
                        <span className="block text-sm text-muted">{u.label}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">{formatWhen(u.scheduledAt, timeZone)}</span>
                    </li>
                  ))}
                </Rows>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span className="text-muted">Posts to:</span>
                {pub.accounts.length ? pub.accounts.map((a) => <Badge key={`${a.platform}-${a.label}`}>{a.label}</Badge>) : "no accounts connected"}
              </div>
              <p className="text-[15px]">
                <span className="text-muted">Library: </span>
                {plural(pub.library.total, "post")} ready ({n(pub.library.images)} with images, {n(pub.library.videos)} videos),{" "}
                {n(pub.library.unused)} not used yet.
              </p>
            </div>
          ) : (
            <Muted>Social Publisher isn&apos;t set up for this business.</Muted>
          )}
        </Block>

        <Block>
          <Title note="active first">Campaigns</Title>
          {b.campaigns.length ? (
            <Rows>
              {b.campaigns.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {c.name}
                    <Badge tone={c.status === "active" ? "accent" : "neutral"}>{c.status}</Badge>
                  </p>
                  <p className="text-sm text-muted">
                    {[c.channel && humanize(c.channel), c.objective && humanize(c.objective), c.startDate && `from ${formatDay(c.startDate)}`, c.endDate && `to ${formatDay(c.endDate)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {money(c.spend, 0)} spent · {n(c.clicks)} clicks · {n(c.leads)} leads · {n(c.conversions)} won
                  </p>
                </li>
              ))}
            </Rows>
          ) : (
            <Muted>No campaigns.</Muted>
          )}
        </Block>
      </Grid>
    </div>
  );
}

/* ─── Leads ───────────────────────────────────────────────────────── */

const STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["appointment", "Appointment"],
  ["approved", "Approved"],
  ["closed", "Closed"],
  ["lost", "Lost"],
] as const;

function statusTone(status: string): Tone {
  if (status === "closed" || status === "approved") return "accent";
  if (status === "lost") return "neutral";
  return "ok";
}

export function LeadsSection({ b, timeZone }: LiveProps) {
  const pl = b.pipeline;
  const total = STAGES.reduce((s, [k]) => s + pl[k], 0);
  const where: [string, { label: string; value: number }[], boolean][] = [
    ["Platform", b.audience.platform, true],
    ["Region", b.audience.region, false],
    ["Device", b.audience.device, true],
    ["Age", b.audience.age, false],
  ];

  return (
    <div className="space-y-12">
      <Sentence>
        <b>{plural(total, "lead")}</b> all time. <b>{pl.new}</b> new and not contacted yet
        {pl.appointment ? (
          <>
            , <b>{pl.appointment}</b> with an appointment
          </>
        ) : null}
        {pl.closed ? (
          <>
            , <b>{pl.closed}</b> closed
          </>
        ) : null}
        .
      </Sentence>

      <Block>
        <Title note="all time">Pipeline</Title>
        {total ? (
          <>
            <div className="flex h-4 w-full gap-1" aria-hidden="true">
              {STAGES.map(([k], i) =>
                pl[k] ? (
                  <span
                    key={k}
                    style={{ width: `${(pl[k] / total) * 100}%`, animationDelay: `${i * 70}ms` }}
                    className={cx("origin-left animate-grow-x rounded-full", i % 2 === 0 ? "bg-ink" : "bg-line")}
                  />
                ) : null,
              )}
            </div>
            <dl className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {STAGES.map(([k, label]) => (
                <div key={k} className="rounded-2xl bg-wash px-4 py-3">
                  <dt className="text-sm font-semibold text-muted">{label}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums">
                    <CountUp value={pl[k]} />
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <Muted>No leads recorded yet.</Muted>
        )}
      </Block>

      <Grid wide>
        <Block>
          <Title note="newest first">Newest leads</Title>
          {b.recentLeads.length ? (
            <Rows>
              {b.recentLeads.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-bold"
                    >
                      {(l.name ?? "?").trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {l.name ?? <span className="font-normal text-muted">No name</span>}
                        <Badge tone={statusTone(l.status)}>{leadStatusLabel(l.status)}</Badge>
                      </p>
                      <p className="text-sm text-muted">
                        {[l.source && humanize(l.source), l.platform && humanize(l.platform), l.place].filter(Boolean).join(" · ") || "Source unknown"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-sm tabular-nums text-muted">{formatWhen(l.createdAt, timeZone) ?? "—"}</p>
                </li>
              ))}
            </Rows>
          ) : (
            <Muted>No leads yet.</Muted>
          )}
        </Block>

        <div className="space-y-12">
          <Block>
            <Title count={b.appointments.length}>Appointments</Title>
            {b.appointments.length ? (
              <Rows>
                {b.appointments.map((a, i) => (
                  <li key={i}>
                    <p className="font-bold">{formatWhen(a.at, timeZone) ?? "No time set"}</p>
                    <p className="text-sm text-muted">{a.name ?? "Lead name not saved"}</p>
                  </li>
                ))}
              </Rows>
            ) : (
              <Muted>No appointments booked.</Muted>
            )}
          </Block>
          <Block>
            <Title>Tasks</Title>
            <dl className="stagger grid grid-cols-3 gap-3">
              {(
                [
                  ["Open", b.tasks.pending + b.tasks.inProgress],
                  ["Overdue", b.tasks.overdue],
                  ["Done", b.tasks.completed],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className={cx("rounded-2xl px-4 py-3", label === "Overdue" && value > 0 ? "bg-ink text-paper" : "bg-wash")}>
                  <dt className={cx("text-sm font-semibold", label === "Overdue" && value > 0 ? "text-paper/80" : "text-muted")}>{label}</dt>
                  <dd className="text-2xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {b.tasks.failed ? <p className="mt-3 text-sm font-semibold">{plural(b.tasks.failed, "automation")} failed.</p> : null}
          </Block>
        </div>
      </Grid>

      <Block>
        <Title note="last 30 days">Where leads come from</Title>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {where.map(([title, rows, tidy]) => (
            <div key={title} className="rounded-2xl bg-wash p-5">
              <h4 className="mb-3 font-bold">{title}</h4>
              <Bars rows={rows.map((r) => ({ label: tidy ? humanize(r.label) : r.label, value: r.value }))} empty="No data yet." />
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}
