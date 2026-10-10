/** The JodyOS mark: a black square holding a white J, plus the wordmark. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" fill="currentColor" />
      <path
        d="M36 14h10v26c0 7.2-5.2 12-12.6 12C26.4 52 21 47.6 20 40.6l9.6-1.8c.4 2.8 2 4.4 4.2 4.4 2.6 0 2.2-1.6 2.2-4.2z"
        fill="#fff"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark />
      <span className="text-[17px] font-extrabold tracking-[-0.03em]">JodyOS</span>
    </span>
  );
}
