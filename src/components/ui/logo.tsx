import { cx } from "./primitives";

/** The JodyOS name, written in Cookie: no mark, just the word. "OS" is its own span so the folded sidebar can stack it under "Jody". */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-script text-[34px] leading-none text-ink", className)}>
      Jody<span>OS</span>
    </span>
  );
}
