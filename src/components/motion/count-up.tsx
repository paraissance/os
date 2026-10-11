"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { formatMoney } from "@/lib/money";

/**
 * A number that counts up from zero the first time it comes into view.
 * The server renders the real value; screen readers always get the real
 * value; nothing moves for anyone who prefers reduced motion.
 */
export function CountUp({ value, currency, digits }: { value: number; currency?: string; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) =>
    currency !== undefined ? formatMoney(n, currency, digits ?? (Number.isInteger(value) ? 0 : 2)) : Math.round(n).toLocaleString("en-US");
  const final = format(value);

  const animate = () => typeof window !== "undefined" && value !== 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Start at zero before the first paint after hydration.
  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    if (node && animate()) node.nodeValue = format(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency, digits]);

  useEffect(() => {
    const el = ref.current;
    const node = el?.firstChild;
    if (!el || !node || !animate()) return;
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 900);
        node.nodeValue = format(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.nodeValue = final;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency, digits]);

  return (
    <>
      <span ref={ref} aria-hidden="true">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
