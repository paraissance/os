import type { ComponentProps, ReactNode } from "react";

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-ink px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-paper hover:text-ink",
  secondary: "bg-paper text-ink hover:bg-ink hover:text-paper",
  ghost: "border-transparent px-0 underline decoration-1 underline-offset-4 hover:decoration-2",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

const fieldBase =
  "w-full border border-ink bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-subtle focus:outline-2 focus:-outline-offset-2 focus:outline-ink disabled:border-hair disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, "min-h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-28 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "min-h-11", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm font-semibold" role="alert">
          ✕ {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("border border-ink bg-paper", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="label">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-10 border-b-2 border-ink pb-6">
      {eyebrow ? <p className="label mb-3 text-muted">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-6xl">{title}</h1>
        {action}
      </div>
      {description ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{description}</p> : null}
    </header>
  );
}

/**
 * Status in black and white: the word carries the meaning; "strong" tones
 * (failures, live) are inverted so they still stand out without colour.
 */
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

const strong: Tone[] = ["bad", "accent"];

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "label inline-flex items-center gap-1.5 border px-1.5 py-px whitespace-nowrap",
        strong.includes(tone) ? "border-ink bg-ink text-paper" : tone === "neutral" ? "border-hair text-muted" : "border-ink text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A small square: filled = good or live, outlined = waiting or off, crossed = failed. */
export function StatusDot({ tone = "neutral" }: { tone?: Tone }) {
  if (tone === "bad") {
    return (
      <span className="inline-block size-2.5 shrink-0 bg-ink text-[9px] leading-[10px] text-paper" aria-hidden="true">
        <svg viewBox="0 0 10 10" className="size-2.5">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
    );
  }
  const filled = tone === "ok" || tone === "accent";
  return <span className={cx("inline-block size-2.5 shrink-0 border border-ink", filled && "bg-ink")} aria-hidden="true" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("bg-wash", className)} aria-hidden="true" />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10">
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      className={cx(
        "px-4 py-3 text-sm leading-relaxed",
        tone === "bad" ? "bg-ink font-medium text-paper" : "border-l-4 border-ink bg-wash text-ink",
      )}
      role="status"
    >
      {children}
    </div>
  );
}
