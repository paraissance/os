import Link from "next/link";
import type { ReactNode } from "react";
import type { AttentionItem } from "@/lib/os-analytics";
import { linkify, shortUrl } from "@/lib/business-view";
import { StatusDot, cx } from "@/components/ui/primitives";

/*
 * Building blocks for the dashboard: big titles, plain sentences, large
 * numbers and simple lists. Black on white, rules instead of boxes.
 */

export function Title({ children, note, id, level = 2 }: { children: ReactNode; note?: ReactNode; id?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-2 border-ink pt-3">
      <H className="text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">{children}</H>
      {note ? <p className="font-mono text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/** A plain-language summary. Wrap the numbers in <b>. */
export function Sentence({ children }: { children: ReactNode }) {
  return <p className="max-w-4xl text-xl leading-snug sm:text-[1.75rem] sm:leading-[1.25] [&_b]:font-extrabold">{children}</p>;
}

export function Tiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid grid-cols-2 border-l border-t border-ink", className)}>{children}</div>;
}

export function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-ink p-4 sm:p-5">
      <p className="label">{label}</p>
      <p className="mt-3 whitespace-nowrap text-3xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-4xl">{value}</p>
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
    <li className="border-b border-hair">
      <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 py-3 hover:bg-wash">
        <span className="min-w-0">
          <span className="block font-bold group-hover:underline group-hover:underline-offset-4">{label}</span>
          <span className="block truncate text-sm text-muted">
            {note ? `${note} · ` : ""}
            <span className="font-mono text-xs">{shortUrl(url)}</span>
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg font-bold">
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

/** Label → value rows. Empty values show a dash. */
export function Facts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b border-hair py-2.5 text-[15px]">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-semibold">{v === null || v === undefined || v === "" ? <span className="font-normal text-subtle">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal bars: the longest value fills the row. */
export function Bars({ rows, empty }: { rows: { label: string; value: number; display?: string }[]; empty: string }) {
  if (!rows.length) return <Muted>{empty}</Muted>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 font-mono text-sm tabular-nums">{r.display ?? r.value.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-1 h-2 bg-wash" aria-hidden="true">
            <div className="h-full bg-ink" style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AttentionList({ items, empty }: { items: AttentionItem[]; empty: string }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-3 py-2 text-lg font-semibold">
        <StatusDot tone="ok" /> {empty}
      </p>
    );
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={`${item.title}-${item.href}`} className={cx("border-b", item.level === "critical" ? "border-ink" : "border-hair")}>
          <Link href={item.href} className="group flex gap-3 py-3">
            <span className="pt-2">
              <StatusDot tone={item.level === "critical" ? "bad" : "warn"} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-snug group-hover:underline group-hover:underline-offset-4">
                {item.level === "critical" ? <span className="sr-only">Urgent: </span> : null}
                {item.title}
              </span>
              <span className="block text-sm text-muted">{item.detail}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
