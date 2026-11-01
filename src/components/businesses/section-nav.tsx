"use client";

import { useEffect, useState } from "react";
import { cx, pillClass, pillRail } from "@/components/ui/primitives";

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
    <nav aria-label={label} className={cx(pillRail, "sticky top-[3.75rem] z-10 border border-hair lg:top-[4.25rem]")}>
      {parts.map((part) => (
        <a key={part.id} href={`#${part.id}`} aria-current={current === part.id ? "location" : undefined} className={pillClass(current === part.id)}>
          {part.label}
          {part.count ? <span className="text-xs tabular-nums">{part.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}
