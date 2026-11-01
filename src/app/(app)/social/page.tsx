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
import { getSettings } from "@/lib/settings";
import { STATS_DAYS, brandPosts, getSyncState, isRunning, isStale, linkedChannelOwners, listBrands, syncBlotato, type Brand } from "@/lib/social";
import { channelKey, groupByDay, platformLabel, profileUrl, suggestChannels, totals, type PostRow } from "@/lib/social-model";
import { CAMPAIGNS } from "@/lib/routines";
import { BrandAccountsForm, RemoveBrandButton } from "@/components/social/brand-accounts-form";
import { RunCampaign } from "@/components/social/run-campaign";
import { AutoRefresh, RefreshButton } from "@/components/social/refresh";
import { Out, Rows, Title } from "@/components/dashboard/ui";
import { Alert, Badge, PageHeader, Skeleton, buttonClass, cx, pillClass, pillTrack } from "@/components/ui/primitives";

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
  return (
    <>
      <PageHeader title="Social Media" />
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-3xl" />}>
        <SocialBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const first =(v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const n = (v: number) => v.toLocaleString("en-US");
/** For a narrow tile: 1,234,567 wouldn't fit, 1.2M does. */
const short = (v: number) => (v < 1_000_000 ? n(v) : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v));

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
    <div className="space-y-3">
      <AutoRefresh active={working} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Brands" className={pillTrack}>
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
    <Link href={href} aria-current={active ? "page" : undefined} className={pillClass(active)}>
      {children}
    </Link>
  );
}

function ConnectBlotato() {
  return (
    <div className="animate-rise rounded-3xl bg-wash p-6 sm:p-8">
      <p className="text-2xl font-extrabold">Connect Blotato.</p>
      <p className="mt-2 text-muted">
        Add <code className="font-mono text-ink">BLOTATO_API_KEY</code> in Vercel, then redeploy.
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
      <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{editing ? `${editing.name}: accounts` : "Add a brand"}</h2>
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
const LIST_LIMIT = 5;

async function BrandView({ brand, now, timeZone, waiting }: { brand: Brand; now: Date; timeZone: string; waiting: boolean }) {
  const { scheduled, published, failed } = await brandPosts(brand.accounts, now);
  const t = totals(published);
  const today = dayKey(now, timeZone);
  // One day only: today's posts, or the next day that has some.
  const next = groupByDay(scheduled, timeZone)[0] ?? null;
  const todayCount = next?.key === today ? next.posts.length : 0;
  const slug = brand.business.slug;

  return (
    <article aria-label={brand.business.name} className="space-y-3">
      <header className="hero flex animate-rise flex-wrap items-center justify-between gap-4 rounded-3xl p-6 sm:p-8">
        <h2 className="min-w-0 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-5xl">{brand.business.name}</h2>
        <Link href={`/social?add=${slug}`} className={buttonClass("hero")}>
          Change accounts
        </Link>
      </header>

      {/* The accounts, the numbers and the sections below share one six-column grid, so their edges line up. */}
      <ul aria-label="Accounts" className={cx("stagger", SIX_COLUMNS)}>
        {brand.accounts.map((a) => (
          <AccountCell key={a.id} account={a} />
        ))}
      </ul>

      {waiting ? <Alert>Getting the posts from Blotato…</Alert> : null}

      <section className="pt-7">
        <Title>Last {STATS_DAYS} days</Title>
        <div className={cx("stagger", SIX_COLUMNS)}>
          <Stat label="Scheduled today" value={todayCount} />
          <Stat label="Published" value={t.posts} />
          <Stat label="Views" value={t.views} />
          <Stat label="Likes" value={t.likes} />
          <Stat label="Comments" value={t.comments} />
          <Stat label="Failed" value={failed.length} dark={failed.length > 0} />
        </div>
      </section>

      {envStatus().campaignRoutine && Object.hasOwn(CAMPAIGNS, slug) ? <RunCampaign brand={slug} /> : null}

      <section className="reveal pt-7">
        <Title
          count={next?.posts.length}
          note={
            <Out href={BLOTATO_CALENDAR} className="font-semibold text-ink">
              Full calendar
            </Out>
          }
        >
          {!next || next.key === today ? "Scheduled today" : `Next up: ${dayTitle(next.key)}`}
        </Title>
        {next ? (
          <Rows>
            {next.posts.slice(0, LIST_LIMIT).map((p) => (
              <PostItem key={p.id} post={p} timeZone={timeZone} timeOnly />
            ))}
          </Rows>
        ) : (
          <p className="rounded-3xl bg-wash px-6 py-5 text-muted">Nothing scheduled.</p>
        )}
      </section>

      {failed.length ? (
        <section className="reveal pt-7">
          <Title count={failed.length}>Failed</Title>
          <Rows>
            {failed.slice(0, LIST_LIMIT).map((p) => (
              <PostItem key={p.id} post={p} timeZone={timeZone} />
            ))}
          </Rows>
        </section>
      ) : null}
    </article>
  );
}

const SIX_COLUMNS = "grid grid-cols-2 gap-3 sm:grid-cols-3 @5xl:grid-cols-6";

/** One account in a cell the same size as the rest: the platform on top, the name under it. */
function AccountCell({ account }: { account: Brand["accounts"][number] }) {
  const url = profileUrl(account);
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
        {platformLabel(account.platform)}
        {url ? <span aria-hidden="true">↗</span> : null}
      </span>
      <span className="mt-1 block truncate text-[13px] font-semibold" title={account.name}>
        {account.name}
      </span>
    </>
  );
  return (
    <li>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full rounded-2xl bg-wash p-4 transition-colors duration-200 hover:bg-mist">
          {body}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <div className="h-full rounded-2xl bg-wash p-4">{body}</div>
      )}
    </li>
  );
}

function Stat({ label, value, dark = false }: { label: string; value: number; dark?: boolean }) {
  return (
    <div className={cx("min-w-0 rounded-2xl p-4", dark ? "bg-ink text-paper" : "bg-wash")}>
      <p className={cx("text-sm font-semibold", dark ? "text-paper/80" : "text-muted")}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-[-0.03em]" title={n(value)}>
        {short(value)}
      </p>
    </div>
  );
}

function PostItem({ post, timeZone, timeOnly = false }: { post: PostRow; timeZone: string; timeOnly?: boolean }) {
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Badge>{platformLabel(post.platform)}</Badge>
        <span className="text-sm tabular-nums text-muted">{when(post.postTime, timeZone, !timeOnly)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-[15px] leading-relaxed">{post.text || <span className="text-muted">(no text)</span>}</p>
      {post.errorMessage ? <p className="mt-1.5 text-sm">{post.errorMessage}</p> : null}
    </li>
  );
}
