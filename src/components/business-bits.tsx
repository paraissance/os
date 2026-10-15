import { formatDay, percentChange } from "@/lib/os-analytics";
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
export function BarChart({ points, unit, height = 120 }: { points: { date: string; value: number }[]; unit: string; height?: number }) {
  if (!points.length) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
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
        aria-label={`${total} ${unit} over ${points.length} days. Busiest day ${formatDay(peak.date)} with ${peak.value}.`}
      >
        {points.map((p, i) => {
          const h = p.value === 0 ? 2 : Math.max(4, (p.value / max) * height);
          return (
            <rect
              key={p.date}
              x={i * (barW + gap)}
              y={height - h}
              width={barW}
              height={h}
              rx={2}
              fill="currentColor"
              opacity={p.value === 0 ? 0.15 : 1}
              className="animate-grow-y [transform-box:fill-box] [transform-origin:bottom]"
              style={{ animationDelay: `${i * 18}ms` }}
            >
              <title>{`${formatDay(p.date)}: ${p.value} ${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-3 flex justify-between text-xs text-muted">
        <span>{formatDay(points[0].date)}</span>
        <span className="font-semibold text-ink">Best day: {peak.value}</span>
        <span>{formatDay(points[points.length - 1].date)}</span>
      </figcaption>
    </figure>
  );
}
