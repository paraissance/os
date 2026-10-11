import { PLUGIN_MIN_VERSION, formatDay, percentChange } from "@/lib/os-analytics";
import { cx } from "@/components/ui/primitives";

/** "↑ 40%" / "↓ 20%" / "new" against the previous period, as a small pill. */
export function Delta({ current, previous, className }: { current: number; previous: number; className?: string }) {
  const change = percentChange(current, previous);
  const text = change === null ? "new" : change === 0 ? "same" : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}%`;
  const label =
    change === null ? "new this period" : change === 0 ? "no change" : `${change > 0 ? "up" : "down"} ${Math.abs(change)} percent`;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
        change !== null && change < 0 ? "bg-ink text-paper" : "bg-mist text-ink",
        className,
      )}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label} versus the previous 30 days</span>
    </span>
  );
}

/** Daily bars that grow up one after another. The summary in aria-label carries the numbers for screen readers. */
export function BarChart({ points, height = 120 }: { points: { date: string; leads: number }[]; height?: number }) {
  if (!points.length) return null;
  const max = Math.max(1, ...points.map((p) => p.leads));
  const total = points.reduce((s, p) => s + p.leads, 0);
  const peak = points.reduce((a, b) => (b.leads > a.leads ? b : a), points[0]);
  const gap = 3;
  const barW = 9;
  const width = points.length * (barW + gap) - gap;
  return (
    <figure className="rounded-2xl bg-wash p-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-36 w-full"
        role="img"
        aria-label={`${total} leads over ${points.length} days. Busiest day ${peak.date} with ${peak.leads}.`}
      >
        {points.map((p, i) => {
          const h = p.leads === 0 ? 2 : Math.max(4, (p.leads / max) * height);
          return (
            <rect
              key={p.date}
              x={i * (barW + gap)}
              y={height - h}
              width={barW}
              height={h}
              rx={2}
              fill="currentColor"
              opacity={p.leads === 0 ? 0.15 : 1}
              className="animate-grow-y [transform-box:fill-box] [transform-origin:bottom]"
              style={{ animationDelay: `${i * 18}ms` }}
            >
              <title>{`${p.date}: ${p.leads}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-3 flex justify-between text-xs text-muted">
        <span>{formatDay(points[0].date)}</span>
        <span className="font-semibold text-ink">Best day: {peak.leads}</span>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}

/** Shown wherever business data would appear while the plugin isn't connected. */
export function OsAnalyticsSetup() {
  return (
    <div className="animate-rise rounded-2xl bg-wash p-6">
      <p className="text-lg font-bold">Connect OS Analytics to see your businesses here.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted">
        <li>Install OS Analytics {PLUGIN_MIN_VERSION} or later on the WordPress site that holds your businesses.</li>
        <li>In WordPress: OS Analytics → Settings → JodyOS connection → Generate key.</li>
        <li>
          In Vercel, add <code className="font-mono text-ink">OS_ANALYTICS_URL</code> (the endpoint shown there) and{" "}
          <code className="font-mono text-ink">OS_ANALYTICS_KEY</code> as Secret variables, then redeploy.
        </li>
      </ol>
    </div>
  );
}
