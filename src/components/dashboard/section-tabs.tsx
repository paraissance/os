"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { SECTIONS, businessHref, isSection, type SectionId } from "@/lib/business-sections";
import { cx } from "@/components/ui/primitives";

/**
 * The sections of one business. Every panel is already rendered on the
 * server, so switching is instant; the URL (`&s=`) is updated in place so a
 * reload or a shared link opens the same section.
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

  // On a phone the row scrolls sideways: keep the open section in view.
  useEffect(() => {
    const box = tablist.current;
    const el = tabs.current.get(active);
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
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
        className="relative mb-10 flex overflow-x-auto overflow-y-hidden border-b-2 border-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                "shrink-0 whitespace-nowrap border-b-4 px-3 pb-2.5 pt-2 text-base font-bold first:pl-0 sm:px-4 sm:text-lg sm:first:pl-0",
                on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {sec.label}
            </a>
          );
        })}
      </div>
      {SECTIONS.map((sec) => (
        <div key={sec.id} role="tabpanel" id={`panel-${sec.id}`} aria-labelledby={`tab-${sec.id}`} hidden={sec.id !== active}>
          {panels[sec.id]}
        </div>
      ))}
    </>
  );
}
