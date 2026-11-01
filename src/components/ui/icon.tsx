import type { ReactNode } from "react";
import { cx } from "./primitives";

/** A 24×24 line icon; `children` are its shapes. */
export function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("size-5 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/** Jody Core's mark. */
export function SparkIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9L11 3z" />
      <path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </Icon>
  );
}
