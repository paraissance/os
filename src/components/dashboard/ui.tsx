import Link from "next/link";
import type { ReactNode } from "react";
import type { AttentionItem } from "@/lib/os-analytics";
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
  level = 2,
}: {
  children: ReactNode;
  note?: ReactNode;
  count?: number;
  id?: string;
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <H className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
        {children}
        {count ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-ink px-2 py-0.5 text-sm font-bold tabular-nums text-paper">
            {count}
          </span>
        ) : null}
      </H>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </div>
  );
}

/** A plain-language summary. Wrap the numbers in <b>. */
export function Sentence({ children }: { children: ReactNode }) {
  return <p className="max-w-4xl animate-rise text-xl leading-snug sm:text-[1.75rem] sm:leading-[1.3] [&_b]:font-extrabold">{children}</p>;
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

/** A big clickable row: label, optional note, and the address it goes to. */
export function LinkRow({ label, url, note }: { label: string; url: string; note?: string | null }) {
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group -mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors duration-200 hover:bg-wash"
      >
        <span className="min-w-0">
          <span className="block font-bold">{label}</span>
          <span className="block truncate text-sm text-muted">
            {note ? `${note} · ` : ""}
            {shortUrl(url)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-wash text-base font-bold transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-ink group-hover:text-paper"
        >
          ↗
        </span>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
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
    <ul className={cx("stagger rounded-2xl bg-wash px-5 [&>li]:border-b [&>li]:border-paper [&>li]:py-3.5 [&>li:last-child]:border-b-0", className)}>
      {children}
    </ul>
  );
}

/** Label → value rows on a soft card. Empty values show a dash. */
export function Facts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="rounded-2xl bg-wash px-5 py-1">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-3 border-b border-paper py-3 text-[15px] last:border-b-0">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-semibold">{v === null || v === undefined || v === "" ? <span className="font-normal text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal bars that grow in: the longest value fills the row. */
export function Bars({ rows, empty }: { rows: { label: string; value: number; display?: string }[]; empty: string }) {
  if (!rows.length) return <Muted>{empty}</Muted>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3.5">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{r.display ?? r.value.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">
            <div
              className="h-full origin-left animate-grow-x rounded-full bg-ink"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, animationDelay: `${Math.min(i, 8) * 60}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Urgent items are filled black; everything else sits on a soft card. */
export function AttentionList({ items, empty }: { items: AttentionItem[]; empty: string }) {
  if (!items.length) {
    return (
      <p className="flex animate-rise items-center gap-3 rounded-2xl bg-wash px-5 py-4 text-lg font-semibold">
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
                "group flex items-center gap-4 rounded-2xl px-5 py-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5",
                urgent ? "bg-ink text-paper hover:bg-[#262626]" : "bg-wash hover:bg-mist",
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
