import type { CSSProperties, ComponentProps, ReactNode } from "react";

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-[#262626]",
  secondary: "bg-wash text-ink hover:bg-mist",
  ghost: "rounded-none px-0 underline decoration-1 underline-offset-4 hover:decoration-2 active:scale-100",
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
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink transition-colors placeholder:text-subtle hover:border-ink focus:border-ink focus:outline-2 focus:-outline-offset-2 focus:outline-ink disabled:border-hair disabled:text-muted";

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

/** A soft grey surface. No outline: space separates panels. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("animate-rise overflow-hidden rounded-2xl bg-wash", className)} {...props} />;
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
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-[-0.02em]">{title}</h2>
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
    <header className="mb-10 animate-rise">
      {eyebrow ? <p className="label mb-3 text-muted">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-6xl">{title}</h1>
        {action}
      </div>
      {description ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{description}</p> : null}
    </header>
  );
}

/**
 * Status in black and white: the word carries the meaning; "strong" tones
 * (failures, live) are filled black so they still stand out without colour.
 */
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";

const strong: Tone[] = ["bad", "accent"];

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "label inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5",
        strong.includes(tone) ? "bg-ink text-paper" : tone === "neutral" ? "bg-mist text-muted" : "bg-ink/10 text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A small dot: filled = good or live, ring = waiting or off, black with a cross = failed. */
export function StatusDot({ tone = "neutral" }: { tone?: Tone }) {
  if (tone === "bad") {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center rounded-full bg-ink text-paper" aria-hidden="true">
        <svg viewBox="0 0 10 10" className="size-2">
          <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  const filled = tone === "ok" || tone === "accent";
  return <span className={cx("inline-block size-2.5 shrink-0 rounded-full border-2 border-ink", filled && "bg-ink")} aria-hidden="true" />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cx("animate-shimmer bg-mist", !className?.includes("rounded") && "rounded-2xl", className)} style={style} aria-hidden="true" />
  );
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
        "animate-rise rounded-2xl px-5 py-4 text-sm leading-relaxed",
        tone === "bad" ? "bg-ink font-medium text-paper" : "bg-mist text-ink",
      )}
      role="status"
    >
      {children}
    </div>
  );
}
