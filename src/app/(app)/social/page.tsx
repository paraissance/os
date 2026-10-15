import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { BlotatoError, listChannels } from "@/lib/blotato";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { envStatus } from "@/lib/env";
import { dayKey, formatRelative } from "@/lib/format";
import { getModule } from "@/lib/modules";
import { getSettings } from "@/lib/settings";
import { STATS_DAYS, brandPosts, getSyncState, isRunning, isStale, linkedChannelOwners, listBrands, syncBlotato, type Brand } from "@/lib/social";
import { byPlatform, channelKey, groupByDay, platformLabel, profileUrl, suggestChannels, topPosts, totals, type PostRow } from "@/lib/social-model";
import { BrandAccountsForm, RemoveBrandButton } from "@/components/social/brand-accounts-form";
import { AutoRefresh, RefreshButton } from "@/components/social/refresh";
import { Rows, Sentence, Title } from "@/components/dashboard/ui";
import { Alert, Badge, PageHeader, Skeleton, buttonClass, cx } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Social Media" };

// The background refresh from Blotato runs after the page is sent and can take a minute.
export const maxDuration = 300;

/**
 * Social Media: each linked brand's accounts, one day of its schedule and
 * the last 7 days' numbers, from JodyOS's copy of Blotato (refreshed in the
 * background). Anything more is a link to Blotato.
 * /social?b=<slug>; /social?add[=<slug>] links accounts.
 */
export default function SocialPage(props: PageProps<"/social">) {
  const later = getModule("social").planned;
  return (
    <>
      <PageHeader eyebrow="Business" title="Social Media" description="Each brand's accounts, today's schedule and the last 7 days, from Blotato." />
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

const first =(v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
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
        <BrandView brand={current} now={now} timeZone={timezone} waiting={!state.lastSyncAt} />
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

/** Everything beyond today's schedule and the last 7 days lives in Blotato. */
const BLOTATO_CALENDAR = "https://my.blotato.com/calendar";

function BlotatoLink() {
  return (
    <a href={BLOTATO_CALENDAR} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "min-h-9 px-4")}>
      Full calendar in Blotato <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

async function BrandView({ brand, now, timeZone, waiting }: { brand: Brand; now: Date; timeZone: string; waiting: boolean }) {
  const { scheduled, published, failed } = await brandPosts(brand.accounts, now);
  const t = totals(published);
  const today = dayKey(now, timeZone);
  // One day only: today's posts, or the next day that has some.
  const next = groupByDay(scheduled, timeZone)[0] ?? null;
  const todayCount = next?.key === today ? next.posts.length : 0;
  const platforms = byPlatform(published);
  const top = topPosts(published, 5);
  const slug = brand.business.slug;
  const week = `last ${STATS_DAYS} days`;

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
            {n(todayCount)} post{todayCount === 1 ? "" : "s"}
          </b>{" "}
          {todayCount === 1 ? "is" : "are"} scheduled today. <b>{n(t.posts)}</b> went out in the {week} and were seen <b>{n(t.views)} times</b>
          {failed.length ? (
            <>
              ; <b>{n(failed.length)} failed</b>
            </>
          ) : null}
          .
        </Sentence>
      )}

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Scheduled today" value={todayCount} />
        <Stat label={`Published · ${STATS_DAYS} days`} value={t.posts} />
        <Stat label={`Views · ${STATS_DAYS} days`} value={t.views} />
        <Stat label={`Likes · ${STATS_DAYS} days`} value={t.likes} />
        <Stat label={`Comments · ${STATS_DAYS} days`} value={t.comments} />
        <Stat label={`Failed · ${STATS_DAYS} days`} value={failed.length} dark={failed.length > 0} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="reveal">
          <Title count={next?.posts.length} note={next && next.key !== today ? "nothing more today" : undefined}>
            {!next || next.key === today ? "Scheduled today" : `Next up: ${dayTitle(next.key)}`}
          </Title>
          {next ? (
            <Rows>
              {next.posts.map((p) => (
                <PostItem key={p.id} post={p} timeZone={timeZone} timeOnly />
              ))}
            </Rows>
          ) : (
            <p className="rounded-2xl bg-wash px-5 py-4 text-muted">Nothing scheduled.</p>
          )}
          <div className="mt-4">
            <BlotatoLink />
          </div>
        </section>

        <div className="space-y-12">
          <section className="reveal">
            <Title note={week}>By platform</Title>
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
              <p className="rounded-2xl bg-wash px-5 py-4 text-muted">Nothing published in the {week}.</p>
            )}
          </section>

          <section className="reveal">
            <Title note={`most seen, ${week}`}>Top posts</Title>
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

      {failed.length ? (
        <section className="reveal">
          <Title count={failed.length} note={week}>
            Failed
          </Title>
          <Rows>
            {failed.map((p) => (
              <PostItem key={p.id} post={p} timeZone={timeZone} />
            ))}
          </Rows>
        </section>
      ) : null}
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

function PostItem({ post, timeZone, timeOnly = false }: { post: PostRow; timeZone: string; timeOnly?: boolean }) {
  const m = post.metrics;
  const numbers = m ? [m.views !== undefined && `${n(m.views)} views`, m.likes !== undefined && `${n(m.likes)} likes`, m.comments !== undefined && `${n(m.comments)} comments`].filter(Boolean) : [];
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Badge>{platformLabel(post.platform)}</Badge>
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
