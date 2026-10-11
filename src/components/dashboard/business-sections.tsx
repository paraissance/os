import type { ReactNode } from "react";
import {
  dayCount,
  daysUntil,
  detailAttention,
  formatMoney,
  percentChange,
  type BusinessDetail,
} from "@/lib/os-analytics";
import {
  businessLinks,
  compactMoney,
  cycleLabel,
  formatDay,
  formatWhen,
  funnelSteps,
  humanize,
  knowledgeSections,
  leadStatusLabel,
  renewalPhrase,
} from "@/lib/business-view";
import { BarChart, Delta } from "@/components/business-bits";
import { CountUp } from "@/components/motion/count-up";
import { Badge, cx, type Tone } from "@/components/ui/primitives";
import { AttentionList, Bars, Facts, LinkRow, Linked, Muted, Out, Rows, Sentence, Tile, Tiles, Title as BaseTitle } from "./ui";

/*
 * The seven sections of a business tab. Each one leads with a plain
 * sentence, then the detail on soft cards. Everything comes from one
 * OS Analytics call.
 */

type Props = { b: BusinessDetail; timeZone: string; today: Date };

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

/* ─── Summary ─────────────────────────────────────────────────────── */

export function SummarySection({ b, timeZone, today }: Props) {
  const k = b.last30;
  const p = b.previous30;
  const money = (v: number, d?: number) => formatMoney(v, b.currency, d);
  const showLoans = k.loanVolume > 0 || p.loanVolume > 0;
  const attention = detailAttention(b, today);
  const comingUp = [
    ...b.appointments.slice(0, 3).map((a) => ({ what: `Appointment${a.name ? ` with ${a.name}` : ""}`, when: a.at })),
    ...(b.publisher?.upcoming.slice(0, 3) ?? []).map((post) => ({ what: `${post.label} post${post.title ? `: ${post.title}` : ""}`, when: post.scheduledAt })),
  ].sort((x, y) => (x.when ?? "").localeCompare(y.when ?? ""));

  return (
    <div className="space-y-12">
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
        ) : (
          "No marketing spend recorded."
        )}
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

      <Grid wide>
        <div className="space-y-12">
          <Block>
            <Title count={attention.length}>Needs attention</Title>
            <AttentionList items={attention} empty="Nothing needs you here." />
          </Block>
          <Block>
            <Title note="last 30 days">Leads per day</Title>
            <BarChart points={b.trend} />
          </Block>
        </div>
        <div className="space-y-12">
          <Block>
            <Title count={b.tasks.pending + b.tasks.inProgress}>To do</Title>
            {b.tasks.open.length ? (
              <Rows>
                {b.tasks.open.map((t, i) => (
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
            ) : (
              <Muted>No open tasks.</Muted>
            )}
          </Block>
          <Block>
            <Title>Coming up</Title>
            {comingUp.length ? (
              <Rows>
                {comingUp.map((c, i) => (
                  <li key={i}>
                    <p className="font-bold">{c.what}</p>
                    <p className="text-sm text-muted">{formatWhen(c.when, timeZone) ?? "No time set"}</p>
                  </li>
                ))}
              </Rows>
            ) : (
              <Muted>No appointments or posts scheduled.</Muted>
            )}
          </Block>
        </div>
      </Grid>
    </div>
  );
}

/* ─── About ───────────────────────────────────────────────────────── */

export function AboutSection({ b }: Props) {
  const a = b.about;
  const sections = knowledgeSections(a?.knowledge ?? null);
  const tagline = a?.tagline ?? b.tagline;

  return (
    <div className="space-y-12">
      {tagline ? (
        <Sentence>
          <b>{a?.name ?? b.name}</b>: {tagline}.
        </Sentence>
      ) : null}
      {!a ? <Muted>OS Analytics has no business profile for {b.name} yet.</Muted> : null}

      <Grid wide>
        <Block>
          <Title>What it is</Title>
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

        <div className="space-y-12">
          <Block>
            <Title count={a?.questions.length}>Common questions</Title>
            {a?.questions.length ? (
              <div className="stagger space-y-2">
                {a.questions.map((q) => (
                  <details key={q.question} className="group/q rounded-2xl bg-wash px-5 py-4 open:bg-mist">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-bold leading-snug [&::-webkit-details-marker]:hidden">
                      {q.question}
                      <span aria-hidden="true" className="mt-0.5 shrink-0 text-xl transition-transform duration-300 group-open/q:rotate-45">
                        +
                      </span>
                    </summary>
                    {q.answer ? <p className="mt-2 animate-fade whitespace-pre-line text-[15px] leading-relaxed">{q.answer}</p> : null}
                    {q.link ? (
                      <p className="mt-2 text-sm font-semibold">
                        <Out href={q.link.url}>{q.link.label}</Out>
                      </p>
                    ) : null}
                  </details>
                ))}
              </div>
            ) : (
              <Muted>None saved.</Muted>
            )}
          </Block>

          {a?.greeting || a?.note ? (
            <Block>
              <Title>Website chat assistant</Title>
              <div className="rounded-2xl bg-wash p-5">
                {a.greeting ? (
                  <p className="w-fit max-w-full whitespace-pre-line rounded-2xl rounded-tl-sm bg-ink px-4 py-3 text-[15px] leading-relaxed text-paper">
                    {a.greeting}
                  </p>
                ) : null}
                {a.note ? <p className="mt-3 text-sm text-muted">Small print: {a.note}</p> : null}
              </div>
            </Block>
          ) : null}
        </div>
      </Grid>
    </div>
  );
}

/* ─── Links ───────────────────────────────────────────────────────── */

export function LinksSection({ b }: Props) {
  const groups = businessLinks(b);
  if (!groups.length) return <Muted>No links saved for {b.name} yet.</Muted>;
  const count = groups.reduce((s, g) => s + g.links.length, 0);

  return (
    <div className="space-y-12">
      <Sentence>
        <b>{plural(count, "link")}</b> for {b.name}, in one place.
      </Sentence>
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

export function MoneySection({ b, today }: Props) {
  const sp = b.spending;
  const subs = [...(sp?.subscriptions ?? [])].sort((x, y) => y.monthly - x.monthly || x.name.localeCompare(y.name));
  const campaigns = b.campaigns.filter((c) => c.budget > 0 || c.spend > 0);
  const money = (v: number, d?: number) => formatMoney(v, b.currency, d);

  return (
    <div className="space-y-12">
      <Sentence>
        {sp ? (
          <>
            Software and tools cost <b>{formatMoney(sp.monthlyTotal, "USD")} a month</b> (<b>{formatMoney(sp.yearlyTotal, "USD", 0)}</b> a
            year) across <b>{plural(sp.activeSubscriptions, "subscription")}</b>, shared tools included.{" "}
          </>
        ) : (
          "Subscriptions aren't tracked in OS Analytics yet. "
        )}
        Marketing in the last 30 days: <b>{money(b.last30.spend, 0)}</b>.
      </Sentence>

      {sp ? (
        <Tiles className="sm:grid-cols-3">
          <Tile label="Each month" value={<CountUp value={sp.monthlyTotal} currency="USD" />} />
          <Tile label="Each year" value={<CountUp value={sp.yearlyTotal} currency="USD" digits={0} />} />
          <Tile label="Subscriptions" value={<CountUp value={sp.activeSubscriptions} />} />
        </Tiles>
      ) : null}

      <Grid>
        <Block>
          <Title note="per month">By category</Title>
          <Bars
            rows={(sp?.byCategory ?? []).map((c) => ({ label: c.label, value: c.monthly, display: formatMoney(c.monthly, "USD") }))}
            empty="No subscriptions."
          />
        </Block>
        <Block>
          <Title note="next 30 days">Renewing soon</Title>
          {sp?.upcomingRenewals.length ? (
            <Rows>
              {sp.upcomingRenewals.map((r) => {
                const d = daysUntil(r.nextRenewal, today);
                const when = d === null ? "" : d < 0 ? " · overdue" : d === 0 ? " · today" : ` · in ${dayCount(d)}`;
                return (
                  <li key={`${r.name}-${r.nextRenewal}`} className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block font-bold">{r.name}</span>
                      <span className="block text-sm text-muted">
                        {formatDay(r.nextRenewal)}
                        {when}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatMoney(r.amount, r.currency)} {cycleLabel(r.cycle)}
                    </span>
                  </li>
                );
              })}
            </Rows>
          ) : (
            <Muted>Nothing renews in the next 30 days.</Muted>
          )}
        </Block>
      </Grid>

      <Block>
        <Title count={subs.length}>Every subscription</Title>
        {subs.length ? (
          <Rows>
            {subs.map((s, i) => (
              <li key={`${s.name}-${s.businessId}-${i}`} className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-bold leading-snug">
                    {s.name}
                    {s.shared ? <Badge>Shared</Badge> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {[s.categoryLabel, s.account, s.nextRenewal ? `renews ${formatDay(s.nextRenewal)}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {s.notes ? <p className="mt-1 whitespace-pre-line text-sm">{s.notes}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end">
                  <p className="text-base font-bold tabular-nums">
                    {formatMoney(s.amount, s.currency)} <span className="text-sm font-normal text-muted">{cycleLabel(s.cycle)}</span>
                  </p>
                  {s.cycle !== "monthly" && s.monthly > 0 ? <p className="text-xs text-muted">{formatMoney(s.monthly, s.currency)} a month</p> : null}
                  {s.loginUrl ? (
                    <Out href={s.loginUrl} className="text-sm font-semibold">
                      Log in
                    </Out>
                  ) : null}
                </div>
              </li>
            ))}
          </Rows>
        ) : (
          <Muted>No subscriptions recorded for {b.name}.</Muted>
        )}
      </Block>

      <Block>
        <Title note="spent of budget">Campaigns</Title>
        {campaigns.length ? (
          <Rows>
            {campaigns.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 font-bold">{c.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {money(c.spend, 0)}
                    {c.budget > 0 ? ` of ${money(c.budget, 0)}` : ""}
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
        ) : (
          <Muted>No campaign spending recorded.</Muted>
        )}
      </Block>
    </div>
  );
}

/* ─── Website ─────────────────────────────────────────────────────── */

export function WebsiteSection({ b }: Props) {
  const site = b.site;
  const byItem = new Map(b.renewals.map((r) => [r.item, r]));
  const items = [
    ["domain", "Domain", site?.registrar],
    ["hosting", "Hosting", site?.hostingProvider],
    ["ssl", "SSL certificate", site?.sslProvider],
  ] as const;
  const login = (url: string | null) => (url ? <Out href={url}>Log in</Out> : null);
  const siteHref = b.siteUrl ?? (site?.domain && /^[a-z0-9.-]+$/i.test(site.domain) ? `https://${site.domain}` : null);

  return (
    <div className="space-y-12">
      <Tiles className="sm:grid-cols-3">
        {items.map(([key, label, provider]) => {
          const r = byItem.get(key);
          const expired = r?.status === "expired";
          return (
            <div key={key} className={cx("min-w-0 rounded-2xl p-5", expired ? "bg-ink text-paper" : "bg-wash")}>
              <p className={cx("text-sm font-semibold", expired ? "text-paper/80" : "text-muted")}>{label}</p>
              <p className="mt-2 text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">{r ? renewalPhrase(r) : "No date saved"}</p>
              <p className={cx("mt-1 text-sm", expired ? "text-paper/80" : "text-muted")}>
                {[r ? formatDay(r.date) : null, provider].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          );
        })}
      </Tiles>

      {site ? (
        <Grid>
          <Block>
            <Title>Domain</Title>
            <Facts
              rows={[
                ["Address", site.domain && siteHref ? <Out href={siteHref}>{site.domain}</Out> : site.domain],
                ["Registrar", site.registrar],
                ["Account", site.registrarAccount],
                ["Login", login(site.registrarLoginUrl)],
                ["Auto-renew", site.domainAutoRenew ? "On" : "Off"],
                ["Expires", formatDay(site.domainExpiry)],
                ["Nameservers", site.nameservers.length ? <span className="font-mono text-sm">{site.nameservers.join(", ")}</span> : null],
              ]}
            />
          </Block>
          <Block>
            <Title>Hosting</Title>
            <Facts
              rows={[
                ["Provider", site.hostingProvider],
                ["Plan", site.hostingPlan],
                ["Account", site.hostingAccount],
                ["Login", login(site.hostingLoginUrl)],
                ["Expires", formatDay(site.hostingExpiry)],
                ["Server IP", site.serverIp ? <span className="font-mono text-sm">{site.serverIp}</span> : null],
              ]}
            />
          </Block>
          <Block>
            <Title>Security and software</Title>
            <Facts
              rows={[
                ["SSL", site.sslProvider],
                ["SSL expires", formatDay(site.sslExpiry)],
                ["WordPress", site.wpVersion],
                ["PHP", site.phpVersion],
                ["Theme", site.activeTheme],
                ["Last backup", formatDay(site.lastBackupAt)],
                ["Reminders", `${site.warnDays} days before anything expires`],
              ]}
            />
          </Block>
          <Block>
            <Title>Notes</Title>
            {site.notes ? (
              <p className="whitespace-pre-line rounded-2xl bg-wash p-5 text-[17px] leading-relaxed">
                <Linked text={site.notes} />
              </p>
            ) : (
              <Muted>No notes.</Muted>
            )}
            {site.importantLinks.length ? (
              <>
                <h4 className="mb-1 mt-8 text-lg font-bold">Saved links</h4>
                <ul className="stagger">
                  {site.importantLinks.map((l) => (
                    <LinkRow key={l.url} label={l.label} url={l.url} />
                  ))}
                </ul>
              </>
            ) : null}
          </Block>
        </Grid>
      ) : (
        <Muted>No website details saved for {b.name}. Add them on the Sites page in OS Analytics.</Muted>
      )}
    </div>
  );
}

/* ─── Marketing ───────────────────────────────────────────────────── */

export function MarketingSection({ b, timeZone }: Props) {
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

export function LeadsSection({ b, timeZone }: Props) {
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
