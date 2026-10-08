/**
 * The JodyOS mark. Each placement passes its own `gradientId`: a gradient
 * defined inside a hidden copy (e.g. the closed mobile drawer) doesn't paint
 * for other copies that reference the same id.
 */
export function LogoMark({ className = "size-8", gradientId }: { className?: string; gradientId: string }) {
  const id = `jodyos-logo-${gradientId}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0d121e" />
      <circle
        cx="32"
        cy="32"
        r="19"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="4"
        strokeDasharray="88 32"
        strokeLinecap="round"
        transform="rotate(-40 32 32)"
      />
      <circle cx="32" cy="32" r="6.5" fill={`url(#${id})`} />
    </svg>
  );
}

export function Wordmark({ gradientId }: { gradientId: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark gradientId={gradientId} />
      <span className="text-[15px] font-semibold tracking-tight">
        Jody<span className="text-gradient">OS</span>
      </span>
    </span>
  );
}
