import { cx } from "./primitives";

/** The JodyOS name, written in Cookie: no mark, just the word. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cx("font-script text-[34px] leading-none text-ink", className)}>JodyOS</span>;
}
