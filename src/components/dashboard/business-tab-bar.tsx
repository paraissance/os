"use client";

import Link, { useLinkStatus } from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { businessHref, isSection } from "@/lib/business-sections";
import { cx } from "@/components/ui/primitives";

export type TabItem = { slug: string; name: string; leads: number; active: boolean };

/** A thin bar under the clicked tab while its page loads. */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cx("absolute inset-x-0 bottom-0 h-1 bg-current transition-opacity", pending ? "animate-pulse opacity-100" : "opacity-0")}
    />
  );
}

const tab =
  "relative inline-flex min-h-11 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-4 text-[15px] font-bold leading-tight transition-[background-color,color,transform] duration-200 active:scale-[0.96]";

/**
 * One tab per business plus "All businesses". Switching business keeps the
 * section that is open (Money stays Money), so businesses compare quickly.
 * On a phone the tabs are one row you swipe; wider screens wrap them.
 */
export function BusinessTabBar({ items, current }: { items: TabItem[]; current: string | null }) {
  const s = useSearchParams().get("s");
  const section = isSection(s) ? s : undefined;
  const list = useRef<HTMLUListElement>(null);
  const activeTab = useRef<HTMLAnchorElement>(null);

  // Bring the open business into view when the row scrolls sideways (phones).
  useEffect(() => {
    const box = list.current;
    const el = activeTab.current;
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [current]);

  return (
    <nav aria-label="Businesses" className="mb-10">
      <ul ref={list} className="no-scrollbar stagger relative flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        <li className="shrink-0">
          <Link
            href="/"
            scroll={false}
            ref={current === null ? activeTab : undefined}
            aria-current={current === null ? "page" : undefined}
            className={cx(tab, current === null ? "bg-ink text-paper" : "bg-wash hover:bg-mist")}
          >
            All businesses
            <Pending />
          </Link>
        </li>
        {items.map((b) => {
          const on = b.slug === current;
          return (
            <li key={b.slug} className="shrink-0">
              <Link
                href={businessHref(b.slug, section)}
                scroll={false}
                ref={on ? activeTab : undefined}
                aria-current={on ? "page" : undefined}
                className={cx(
                  tab,
                  on ? "bg-ink text-paper" : b.active ? "bg-wash hover:bg-mist" : "border border-dashed border-line text-muted hover:bg-wash",
                )}
              >
                {b.name}
                <span
                  className={cx(
                    "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    on ? "bg-paper/20 text-paper" : b.active ? "bg-paper text-muted" : "text-muted",
                  )}
                >
                  {b.active ? b.leads : "paused"}
                  {b.active ? <span className="sr-only"> leads in the last 30 days</span> : null}
                </span>
                <Pending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
