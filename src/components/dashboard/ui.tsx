import Link from "next/link";
import type { ReactNode } from "react";
import type { AttentionItem } from "@/lib/os-analytics";
import { renewalSummary, type BusinessRecord } from "@/lib/business-model";
import { linkify, shortUrl } from "@/lib/business-view";
import { StatusDot, cx } from "@/components/ui/primitives";

/*
 * Building blocks for the dashboard: big titles, plain sentences, large
 * numbers on soft cards and simple lists. Space separates things; there are
 * no boxes drawn around them.
 */

export function Title({
  children,
  note,
  count,
  id,
}: {
  children: ReactNode;
  note?: ReactNode;
  count?: number;
  id?: string;
}) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
        {children}
        {count ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-ink px-2 py-0.5 text-sm font-bold tabular-nums text-paper">
            {count}
          </span>
        ) : null}
      </h2>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}

/** A titled part of a long page: the title stays beside the content on wide screens, above it otherwise. */
export function Part({ id, title, intro, count, total, children }: { id?: string; title: string; intro?: string; count?: number; total?: string; children: ReactNode }) {
  return (
    <section id={id} className="reveal grid scroll-mt-32 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-8">
      <div className="xl:sticky xl:top-36 xl:self-start">
        <Title count={count}>{title}</Title>
        {intro ? <p className="-mt-2 text-sm leading-relaxed text-muted">{intro}</p> : null}
        {total ? <p className="mt-3 text-sm font-semibold">{total}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** The dark card of big numbers at the top of a page. */
export function HeroStats({ title, stats }: { title?: ReactNode; stats: { label: string; value: ReactNode; note?: ReactNode }[] }) {
  return (
    <section className="hero animate-rise rounded-3xl p-6 sm:p-8">
      {title ? <h2 className="label mb-6 text-white/70">{title}</h2> : null}
      <dl className={cx("grid grid-cols-2 gap-x-6 gap-y-8", stats.length === 3 ? "sm:grid-cols-3" : "@5xl:grid-cols-4")}>
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 @5xl:border-l @5xl:border-white/15 @5xl:pl-6 @5xl:first:border-l-0 @5xl:first:pl-0">
            <dt className="text-sm font-semibold text-white/70">{s.label}</dt>
            {/* Scales with the room there is, so a figure like $12,345.67 fits its column, down to the smallest phone. */}
            <dd className="mt-2 whitespace-nowrap text-[clamp(1.125rem,6.5cqw,2.25rem)] font-extrabold leading-tight tabular-nums tracking-[-0.03em]">{s.value}</dd>
            {s.note ? <dd className="mt-1 text-sm text-white/70">{s.note}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Tiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("stagger grid grid-cols-2 gap-3", className)}>{children}</div>;
}

export function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-wash p-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 whitespace-nowrap text-3xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-4xl">{value}</p>
      <div className="mt-1 min-h-5 text-sm text-muted">{children}</div>
    </div>
  );
}

/** How a business's renewals stand: a dot and a few words. `urgentOnly` stays quiet unless something is due. */
export function RenewalLine({ record, today, urgentOnly = false, className }: { record: BusinessRecord; today: Date; urgentOnly?: boolean; className?: string }) {
  const { tone, text } = renewalSummary(record, today);
  if (urgentOnly && tone !== "warn" && tone !== "bad") return null;
  return (
    <span className={cx("flex items-center gap-2 text-sm font-semibold", className)}>
      <StatusDot tone={tone} />
      {text}
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="py-2 text-base text-muted">{children}</p>;
}

/** A link that leaves JodyOS: new tab, no referrer. */
export function Out({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx("underline decoration-1 underline-offset-4 hover:decoration-2", className)}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Links as white pills that wrap; each opens in a new tab. */
export function LinkPills({ links, className }: { links: { label: string; url: string }[]; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap gap-2", className)}>
      {links.map((l) => (
        <li key={`${l.label} ${l.url}`}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-paper px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 hover:bg-ink hover:text-paper"
          >
            {l.label} <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Prose with its URLs made clickable. */
export function Linked({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        "url" in part ? (
          <a key={i} href={part.url} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-1 underline-offset-4">
            {shortUrl(part.url)}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** A list on one soft card, rows split by thin white lines; rows rise in one after another. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cx("stagger rounded-3xl bg-wash px-6 py-1 [&>li]:border-b [&>li]:border-paper [&>li]:py-4 [&>li:last-child]:border-b-0", className)}>
      {children}
    </ul>
  );
}

/** Label → value rows on a soft card. Empty values show a dash. */
export function Facts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="rounded-3xl bg-wash px-6 py-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 border-b border-paper py-3 text-[15px] last:border-b-0">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-semibold">{v === null || v === undefined || v === "" ? <span className="font-normal text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Urgent items are filled black; everything else sits on a soft card. */
export function AttentionList({ items, empty }: { items: AttentionItem[]; empty: string }) {
  if (!items.length) {
    return (
      <p className="flex animate-rise items-center gap-3 rounded-3xl bg-wash px-6 py-5 text-lg font-semibold">
        <StatusDot tone="ok" /> {empty}
      </p>
    );
  }
  return (
    <ul className="stagger space-y-2">
      {items.map((item) => {
        const urgent = item.level === "critical";
        return (
          <li key={`${item.title}-${item.href}`}>
            <Link
              href={item.href}
              className={cx(
                "group flex items-center gap-4 rounded-3xl px-6 py-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5",
                urgent ? "bg-ink text-paper hover:bg-ink/85" : "bg-wash hover:bg-mist",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-snug">
                  {urgent ? <span className="sr-only">Urgent: </span> : null}
                  {item.title}
                </span>
                <span className={cx("block text-sm", urgent ? "text-paper/80" : "text-muted")}>{item.detail}</span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-xl font-bold transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
