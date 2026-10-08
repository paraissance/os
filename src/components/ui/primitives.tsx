import type { ComponentProps, ReactNode } from "react";

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 min-h-10 px-4";

const buttonVariants = {
  primary:
    "bg-gradient-to-r from-accent-strong to-violet text-ink-950 hover:brightness-110 shadow-[0_8px_24px_-12px_rgb(34_211_238/0.6)]",
  secondary: "border border-line-strong bg-white/[0.04] text-fg hover:bg-white/[0.08]",
  ghost: "text-muted hover:text-fg hover:bg-white/[0.05]",
  danger: "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
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
  "w-full rounded-xl border border-line-strong bg-ink-900/80 px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle transition-colors focus:border-accent/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, "min-h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-28 resize-y leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "min-h-11 appearance-auto", className)} {...props} />;
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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("panel", className)} {...props} />;
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
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
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

const tones = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-bad",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-line-strong bg-white/[0.04] text-muted",
  accent: "border-accent/30 bg-accent/10 text-accent",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const dotTones = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-info", neutral: "bg-subtle", accent: "bg-accent" } as const;

export function StatusDot({ tone = "neutral", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2.5 shrink-0" aria-hidden="true">
      {pulse ? <span className={cx("absolute inset-0 rounded-full opacity-60 animate-ping", dotTones[tone])} /> : null}
      <span className={cx("relative inline-flex size-2.5 rounded-full", dotTones[tone])} />
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("rounded-lg bg-white/[0.05] animate-pulse-soft", className)} />;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-subtle">{icon}</div> : null}
      <p className="font-medium text-fg">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={cx("rounded-xl border px-4 py-3 text-sm leading-relaxed", tones[tone])} role="status">
      {children}
    </div>
  );
}
