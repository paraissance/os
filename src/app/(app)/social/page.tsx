import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { BlotatoError, listChannels } from "@/lib/blotato";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { getModule } from "@/lib/modules";
import { getSettings } from "@/lib/settings";
import {
  PAGE_SIZE,
  brandPostPage,
  brandPosts,
  getSyncState,
  isRunning,
  isStale,
  linkedChannelOwners,
  listBrands,
  syncBlotato,
  type Brand,
} from "@/lib/social";
import {
  byPlatform,
  calendarDays,
  channelKey,
  dayKey,
  groupByDay,
  platformLabel,
  profileUrl,
  suggestChannels,
  topPosts,
  totals,
  type PostRow,
} from "@/lib/social-model";
import type { SocialPostStatus } from "@/lib/db/schema";
import { BrandAccountsForm, RemoveBrandButton } from "@/components/social/brand-accounts-form";
import { AutoRefresh, RefreshButton } from "@/components/social/refresh";
import { Rows, Sentence, Title } from "@/components/dashboard/ui";
import { Alert, Badge, PageHeader, Skeleton, buttonClass, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Social Media" };

// The background refresh from Blotato runs after the page is sent and can take a minute.
export const maxDuration = 300;

/**
 * Social Media: each linked brand's accounts, calendar, posts and numbers,
 * from JodyOS's copy of Blotato (refreshed in the background).
 * /social?b=<slug>&s=<status>&p=<page>; /social?add[=<slug>] links accounts.
 */
export default function SocialPage(props: PageProps<"/social">) {
  const later = getModule("social").planned;
  return (
    <>
      <PageHeader eyebrow="Business" title="Social Media" description="Each brand's accounts, calendar, posts and numbers, from Blotato." />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <SocialBody searchParams={props.searchParams} />
      </Suspense>
      <section className="reveal mt-16 rounded-2xl bg-wash p-5 sm:p-6">
        <h2 className="font-bold">Coming later</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
          {later.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

const STATUSES: SocialPostStatus[] = ["scheduled", "published", "failed"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const n = (v: number) => v.toLocaleString("en-US");

async function SocialBody({ searchParams }: { searchParams: PageProps<"/social">["searchParams"] }) {
  await requireUser();
  const sp = await searchParams;
  if (!envStatus().blotato) return <ConnectBlotato />;

  const now = requestNow();
  const [brands, state, { timezone }] = await Promise.all([listBrands(), getSyncState(), getSettings()]);
  const running = isRunning(state, now);
  const stale = isStale(state, now);
  // Older than 10 minutes: refresh from Blotato after the page is sent; it reloads itself when done.
  if (stale && !running) after(() => syncBlotato().then(() => undefined));
  const working = running || stale;

  const add = first(sp.add);
  const adding = add !== undefined || !brands.length;
  const current = brands.find((b) => b.business.slug === first(sp.b)) ?? brands[0];
  const status = STATUSES.find((s) => s === first(sp.s)) ?? null;
  const page = Math.max(1, Math.min(1000, Number.parseInt(first(sp.p) ?? "1", 10) || 1));

  return (
    <div className="space-y-10">
      <AutoRefresh active={working} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Brands" className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <Pill key={b.business.id} href={`/social?b=${b.business.slug}`} active={!adding && b.business.id === current?.business.id}>
              {b.business.name}
            </Pill>
          ))}
          <Pill href="/social?add" active={adding && !add}>
            + Add a brand
          </Pill>
        </nav>
        <span className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {state.lastSyncAt ? <span>Updated {formatRelative(new Date(state.lastSyncAt), now)}</span> : null}
          <RefreshButton busy={working} />
        </span>
      </div>
      {state.lastError ? <Alert>The last refresh from Blotato didn&apos;t work: {state.lastError}</Alert> : null}

      {adding ? (
        <Suspense fallback={<Skeleton className="h-96" />}>
          <Setup editSlug={add || null} brands={brands} />
        </Suspense>
      ) : current ? (
        <BrandView brand={current} now={now} timeZone={timezone} status={status} page={page} waiting={!state.lastSyncAt} />
      ) : null}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold transition-colors duration-200",
        active ? "bg-ink text-paper" : "bg-wash hover:bg-mist",
      )}
    >
      {children}
    </Link>
  );
}

function ConnectBlotato() {
  return (
    <div className="animate-rise rounded-3xl bg-wash p-6 sm:p-8">
      <p className="text-2xl font-extrabold">Connect Blotato.</p>
      <p className="mt-2 max-w-2xl text-muted">
        In Vercel, open the jodyos project → Settings → Environment Variables, add <code className="font-mono text-ink">BLOTATO_API_KEY</code> with your
        key from Blotato&apos;s Settings → API, and redeploy. Then pick the brands to show here.
      </p>
    </div>
  );
}

/* ─── Linking accounts ────────────────────────────────────────────── */

async function Setup({ editSlug, brands }: { editSlug: string | null; brands: Brand[] }) {
  let channels;
  try {
    channels = await listChannels();
  } catch (e) {
    if (e instanceof BlotatoError) return <Alert tone="bad">{e.message}</Alert>;
    throw e;
  }
  const [book, owners] = await Promise.all([loadBook(), linkedChannelOwners()]);
  if (!book.businesses.length) return <Alert>Add a business first, on the Businesses page.</Alert>;
  const names = new Map(book.businesses.map((b) => [b.id, b.name]));
  const editing = editSlug ? book.businesses.find((b) => b.slug === editSlug) : undefined;
  const linked = new Set(brands.map((b) => b.business.id));
  const initial = editing ?? book.businesses.find((b) => !linked.has(b.id)) ?? book.businesses[0];

  return (
    <section className="animate-rise space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{editing ? `${editing.name}: accounts` : "Add a brand"}</h2>
        <p className="mt-1 max-w-2xl text-muted">
          Pick the business, then tick its accounts in Blotato. The ones that look like it are ticked for you: check them, and tick any that were missed.
        </p>
      </div>
      <BrandAccountsForm
        initialId={initial.id}
        brands={book.businesses.map((b) => ({
          id: b.id,
          name: b.name,
          suggested: [...suggestChannels(b, channels)],
          linked: channels.filter((c) => owners.get(channelKey(c)) === b.id).map(channelKey),
        }))}
        channels={channels.map((c) => {
          const ownerId = owners.get(channelKey(c)) ?? null;
          return { key: channelKey(c), platform: c.platform, name: c.name, ownerId, ownerName: ownerId ? (names.get(ownerId) ?? null) : null };
        })}
      />
      {editing && linked.has(editing.id) ? <RemoveBrandButton businessId={editing.id} name={editing.name} /> : null}
    </section>
  );
}

/* ─── A brand ─────────────────────────────────────────────────────── */

function when(d: Date, timeZone: string, withDay = true) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "Wednesday 15 October" for a day key that is already in the owner's time zone. */
function dayTitle(key: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00Z`));
}

async function BrandView({
  brand,
  now,
  timeZone,
  status,
  page,
  waiting,
}: {
  brand: Brand;
  now: Date;
  timeZone: string;
  status: SocialPostStatus | null;
  page: number;
  waiting: boolean;
}) {
  const [{ scheduled, published, failed }, list] = await Promise.all([brandPosts(brand.accounts, now), brandPostPage(brand.accounts, status, page)]);
  const t = totals(published);
  const days = calendarDays(scheduled, now, timeZone, 14);
  const inStrip = new Set(days.map((d) => d.key));
  const soon = scheduled.filter((p) => inStrip.has(dayKey(p.postTime, timeZone)));
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const platforms = byPlatform(published);
  const top = topPosts(published, 5);
  const slug = brand.business.slug;

  return (
    <article aria-label={brand.business.name} className="space-y-14">
      <header className="animate-rise space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-5xl">{brand.business.name}</h2>
          <Link href={`/social?add=${slug}`} className={buttonClass("secondary", "min-h-9 px-4")}>
            Change accounts
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2">
          {brand.accounts.map((a) => {
            const url = profileUrl(a);
            const inner = (
              <>
                <span className="text-muted">{platformLabel(a.platform)}</span> <span className="font-semibold">{a.name}</span>
              </>
            );
            return (
              <li key={a.id}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-wash px-3.5 py-1.5 text-sm transition-colors hover:bg-mist">
                    {inner} <span aria-hidden="true">↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-wash px-3.5 py-1.5 text-sm">{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      </header>

      {waiting ? (
        <Alert>Getting the posts from Blotato. The first time takes about a minute; this page fills in by itself.</Alert>
      ) : (
        <Sentence>
          <b>
            {n(scheduled.length)} post{scheduled.length === 1 ? "" : "s"}
          </b>{" "}
          {scheduled.length === 1 ? "is" : "are"} in the calendar. <b>{n(t.posts)}</b> went out in the last 30 days and were seen <b>{n(t.views)} times</b>
          {failed.length ? (
            <>
              ; <b>{n(failed.length)} failed</b>
            </>
          ) : null}
          .
        </Sentence>
      )}

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="In the calendar" value={scheduled.length} />
        <Stat label="Published · 30 days" value={t.posts} />
        <Stat label="Views · 30 days" value={t.views} />
        <Stat label="Likes · 30 days" value={t.likes} />
        <Stat label="Comments · 30 days" value={t.comments} />
        <Stat label="Failed · 30 days" value={failed.length} dark={failed.length > 0} />
      </div>

      <section className="reveal">
        <Title note="next 14 days">Calendar</Title>
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((d) => (
            <li key={d.key}>
              <a
                href={d.count ? `#day-${d.key}` : undefined}
                className={cx("flex h-full flex-col justify-between rounded-xl bg-wash p-2 sm:p-3", d.count > 0 && "transition-colors hover:bg-mist")}
              >
                <span className="text-[11px] font-semibold text-muted sm:text-xs">{d.label}</span>
                <span className="mt-1 text-lg font-extrabold tabular-nums sm:text-2xl">{d.count || "·"}</span>
                <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ink" style={{ width: `${(d.count / maxDay) * 100}%` }} />
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="reveal">
          <Title count={soon.length} note="next 14 days">
            Scheduled
          </Title>
          {soon.length ? (
            <div className="space-y-6">
              {groupByDay(soon.slice(0, 80), timeZone).map((g) => (
                <div key={g.key} id={`day-${g.key}`} className="scroll-mt-24">
                  <h3 className="mb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-muted">{dayTitle(g.key)}</h3>
                  <Rows>
                    {g.posts.map((p) => (
                      <PostItem key={p.id} post={p} timeZone={timeZone} timeOnly />
                    ))}
                  </Rows>
                </div>
              ))}
              {soon.length > 80 ? <p className="text-sm text-muted">And {soon.length - 80} more: see All posts below.</p> : null}
            </div>
          ) : (
            <p className="rounded-2xl bg-wash px-5 py-4 text-muted">Nothing scheduled for the next 14 days.</p>
          )}
        </section>

        <div className="space-y-12">
          <section className="reveal">
            <Title note="last 30 days">By platform</Title>
            {platforms.length ? (
              <Rows>
                {platforms.map((p) => (
                  <li key={p.platform}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{platformLabel(p.platform)}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {n(p.posts)} post{p.posts === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {n(p.views)} views · {n(p.likes)} likes · {n(p.comments)} comments
                    </p>
                  </li>
                ))}
              </Rows>
            ) : (
              <p className="rounded-2xl bg-wash px-5 py-4 text-muted">Nothing published in the last 30 days.</p>
            )}
          </section>

          <section className="reveal">
            <Title note="most seen, last 30 days">Top posts</Title>
            {top.length ? (
              <Rows>
                {top.map((p) => (
                  <PostItem key={p.id} post={p} timeZone={timeZone} />
                ))}
              </Rows>
            ) : (
              <p className="rounded-2xl bg-wash px-5 py-4 text-muted">No views or likes recorded yet.</p>
            )}
          </section>
        </div>
      </div>

      <section id="all" className="reveal scroll-mt-24">
        <Title count={list.total}>All posts</Title>
        <nav aria-label="Filter posts" className="mb-4 flex flex-wrap gap-2">
          {[null, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={`/social?b=${slug}${s ? `&s=${s}` : ""}#all`}
              aria-current={status === s ? "page" : undefined}
              className={cx("rounded-full px-4 py-2 text-sm font-semibold transition-colors", status === s ? "bg-ink text-paper" : "bg-wash hover:bg-mist")}
            >
              {s ? s[0].toUpperCase() + s.slice(1) : "All"}
            </Link>
          ))}
        </nav>
        {list.rows.length ? (
          <Rows>
            {list.rows.map((p) => (
              <PostItem key={p.id} post={p} timeZone={timeZone} showStatus />
            ))}
          </Rows>
        ) : (
          <p className="rounded-2xl bg-wash px-5 py-4 text-muted">No posts here.</p>
        )}
        {list.total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            {page > 1 ? (
              <Link href={`/social?b=${slug}${status ? `&s=${status}` : ""}&p=${page - 1}#all`} className={buttonClass("light", "min-h-9 px-4")}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Page {page} of {Math.ceil(list.total / PAGE_SIZE)}
            </span>
            {page * PAGE_SIZE < list.total ? (
              <Link href={`/social?b=${slug}${status ? `&s=${status}` : ""}&p=${page + 1}#all`} className={buttonClass("light", "min-h-9 px-4")}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </section>
    </article>
  );
}

function Stat({ label, value, dark = false }: { label: string; value: number; dark?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-2xl p-5", dark ? "bg-ink text-paper" : "bg-wash")}>
      <p className={cx("text-sm font-semibold", dark ? "text-paper/80" : "text-muted")}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-[-0.03em]">{n(value)}</p>
    </div>
  );
}

const STATUS_WORDS: Record<SocialPostStatus, string> = { scheduled: "Scheduled", published: "Published", failed: "Failed" };

function PostItem({ post, timeZone, timeOnly = false, showStatus = false }: { post: PostRow; timeZone: string; timeOnly?: boolean; showStatus?: boolean }) {
  const m = post.metrics;
  const numbers = m ? [m.views !== undefined && `${n(m.views)} views`, m.likes !== undefined && `${n(m.likes)} likes`, m.comments !== undefined && `${n(m.comments)} comments`].filter(Boolean) : [];
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Badge>{platformLabel(post.platform)}</Badge>
          {showStatus ? <Badge tone={post.status === "failed" ? "bad" : "neutral"}>{STATUS_WORDS[post.status]}</Badge> : null}
          {post.accountName ? <span className="truncate font-semibold">{post.accountName}</span> : null}
        </span>
        <span className="text-sm tabular-nums text-muted">{when(post.postTime, timeZone, !timeOnly)}</span>
      </div>
      <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed">{post.text || <span className="text-muted">(no text)</span>}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {post.mediaCount ? <span>{post.mediaCount === 1 ? "1 image or video" : `${post.mediaCount} images or videos`}</span> : null}
        {numbers.length ? <span className="font-semibold text-ink">{numbers.join(" · ")}</span> : null}
        {post.postUrl ? (
          <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-1 underline-offset-4">
            Open post ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        {post.errorMessage ? <span className="text-ink">Why it failed: {post.errorMessage}</span> : null}
      </div>
    </li>
  );
}
