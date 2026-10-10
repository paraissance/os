import { percentChange } from "@/lib/os-analytics";
import { cx } from "@/components/ui/primitives";

/** "↑ 40%" / "↓ 20%" / "new" against the previous period. */
export function Delta({ current, previous, className }: { current: number; previous: number; className?: string }) {
  const change = percentChange(current, previous);
  const text = change === null ? "new" : change === 0 ? "±0%" : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}%`;
  const label =
    change === null ? "new this period" : change === 0 ? "no change" : `${change > 0 ? "up" : "down"} ${Math.abs(change)} percent`;
  return (
    <span className={cx("font-mono text-xs tabular-nums", change !== null && change < 0 ? "font-semibold" : "text-muted", className)}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label} versus the previous 30 days</span>
    </span>
  );
}

/** Daily bars in black. The summary in aria-label carries the numbers for screen readers. */
export function BarChart({ points, height = 120 }: { points: { date: string; leads: number }[]; height?: number }) {
  if (!points.length) return null;
  const max = Math.max(1, ...points.map((p) => p.leads));
  const total = points.reduce((s, p) => s + p.leads, 0);
  const peak = points.reduce((a, b) => (b.leads > a.leads ? b : a), points[0]);
  const gap = 2;
  const barW = 10;
  const width = points.length * (barW + gap) - gap;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-32 w-full"
        role="img"
        aria-label={`${total} leads over ${points.length} days. Busiest day ${peak.date} with ${peak.leads}.`}
      >
        <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} stroke="currentColor" strokeWidth="1" />
        {points.map((p, i) => {
          const h = p.leads === 0 ? 0 : Math.max(2, (p.leads / max) * (height - 4));
          return (
            <rect key={p.date} x={i * (barW + gap)} y={height - h} width={barW} height={h} fill="currentColor">
              <title>{`${p.date}: ${p.leads}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between font-mono text-[11px] text-subtle">
        <span>{points[0].date}</span>
        <span>peak {peak.leads}</span>
        <span>{points[points.length - 1].date}</span>
      </figcaption>
    </figure>
  );
}

/** Shown wherever business data would appear while the plugin isn't connected. */
export function OsAnalyticsSetup() {
  return (
    <div className="border border-ink p-5">
      <p className="font-semibold">Connect OS Analytics to see your businesses here.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li>Install OS Analytics 1.2.0 or later on the WordPress site that holds your businesses.</li>
        <li>In WordPress: OS Analytics → Settings → JodyOS connection → Generate key.</li>
        <li>
          In Vercel, add <code className="font-mono text-ink">OS_ANALYTICS_URL</code> (the endpoint shown there) and{" "}
          <code className="font-mono text-ink">OS_ANALYTICS_KEY</code> as Secret variables, then redeploy.
        </li>
      </ol>
    </div>
  );
}
