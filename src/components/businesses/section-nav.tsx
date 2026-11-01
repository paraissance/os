"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui/primitives";

/** Jump pills for a long page: they stay in view, and the section being read is the filled one. */
export function SectionNav({ label, parts }: { label: string; parts: { id: string; label: string; count?: number }[] }) {
  const [current, setCurrent] = useState(parts[0]?.id);
  const ids = parts.map((p) => p.id).join(" ");

  useEffect(() => {
    // A thin band a third of the way down the screen: the section crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCurrent(entry.target.id);
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    for (const id of ids.split(" ")) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav
      aria-label={label}
      className="no-scrollbar sticky top-[3.75rem] z-10 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-hair bg-wash p-1 lg:top-[4.25rem]"
    >
      {parts.map((part) => (
        <a
          key={part.id}
          href={`#${part.id}`}
          aria-current={current === part.id ? "location" : undefined}
          className={cx(
            "flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-200",
            current === part.id ? "bg-ink text-paper" : "text-muted hover:text-ink",
          )}
        >
          {part.label}
          {part.count ? <span className="text-xs tabular-nums opacity-70">{part.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}
