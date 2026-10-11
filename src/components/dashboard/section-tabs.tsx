"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { SECTIONS, businessHref, isSection, type SectionId } from "@/lib/business-sections";
import { cx } from "@/components/ui/primitives";

/**
 * The sections of one business. Every panel is already rendered on the
 * server, so switching is instant; the URL (`&s=`) is updated in place so a
 * reload or a shared link opens the same section. A black bar slides under
 * the open section, and the panel rises in.
 */
export function SectionTabs({ slug, panels }: { slug: string; panels: Record<SectionId, ReactNode> }) {
  const s = useSearchParams().get("s");
  const fromUrl: SectionId = isSection(s) ? s : "summary";
  const [active, setActive] = useState<SectionId>(fromUrl);
  // A link elsewhere on the page can change the section through the URL: follow it.
  const [lastUrl, setLastUrl] = useState<SectionId>(fromUrl);
  if (fromUrl !== lastUrl) {
    setLastUrl(fromUrl);
    setActive(fromUrl);
  }
  const tabs = useRef(new Map<SectionId, HTMLAnchorElement>());
  const tablist = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  // Place the sliding bar under the open section (and keep it there when the row resizes).
  useLayoutEffect(() => {
    const box = tablist.current;
    const measure = () => {
      const el = tabs.current.get(active);
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    if (!box) return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [active]);

  // On a phone the row scrolls sideways: keep the open section in view.
  useEffect(() => {
    const box = tablist.current;
    const el = tabs.current.get(active);
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [active]);

  function select(id: SectionId, focus = false) {
    setActive(id);
    window.history.replaceState(null, "", businessHref(slug, id));
    if (focus) tabs.current.get(id)?.focus();
  }

  function onClick(e: MouseEvent, id: SectionId) {
    // Keep ctrl/cmd/shift-click working as "open in a new tab".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    select(id);
  }

  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = SECTIONS.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    select(SECTIONS[next].id, true);
  }

  return (
    <>
      <div
        ref={tablist}
        role="tablist"
        aria-label="Sections"
        className="no-scrollbar relative mb-10 flex overflow-x-auto overflow-y-hidden border-b border-hair"
      >
        {SECTIONS.map((sec, i) => {
          const on = sec.id === active;
          return (
            <a
              key={sec.id}
              ref={(el) => {
                if (el) tabs.current.set(sec.id, el);
                else tabs.current.delete(sec.id);
              }}
              href={businessHref(slug, sec.id)}
              role="tab"
              id={`tab-${sec.id}`}
              aria-selected={on}
              aria-controls={`panel-${sec.id}`}
              tabIndex={on ? 0 : -1}
              onClick={(e) => onClick(e, sec.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                "shrink-0 whitespace-nowrap border-b-[3px] px-3 pb-3 pt-2 text-base font-bold transition-colors duration-200 sm:px-4 sm:text-lg",
                // Before the sliding bar is measured, the open tab draws its own underline.
                on && !bar ? "border-ink" : "border-transparent",
                on ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {sec.label}
            </a>
          );
        })}
        {bar ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 h-[3px] rounded-full bg-ink transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
            style={{ left: bar.left, width: bar.width }}
          />
        ) : null}
      </div>
      {SECTIONS.map((sec) => (
        <div
          key={sec.id}
          role="tabpanel"
          id={`panel-${sec.id}`}
          aria-labelledby={`tab-${sec.id}`}
          hidden={sec.id !== active}
          className="animate-rise"
        >
          {panels[sec.id]}
        </div>
      ))}
    </>
  );
}
