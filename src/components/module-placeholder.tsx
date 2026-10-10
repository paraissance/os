import Link from "next/link";
import { getModule, PHASES } from "@/lib/modules";
import { Badge, PageHeader, buttonClass } from "@/components/ui/primitives";

/**
 * Honest placeholder for a module that isn't built yet: what it will do and
 * which phase delivers it. No sample data, no fake numbers.
 */
export function ModulePlaceholder({ id }: { id: string }) {
  const mod = getModule(id);
  return (
    <>
      <PageHeader
        eyebrow={`Phase ${mod.phase} — ${PHASES[mod.phase]}`}
        title={mod.label}
        description={mod.summary}
        action={<Badge tone="neutral">Not built yet</Badge>}
      />
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-2xl font-bold leading-tight tracking-[-0.02em]">
            Arrives in Phase {mod.phase}.
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Nothing here is connected yet, so this page shows the plan instead of placeholder data.
          </p>
          <Link href="/command" className={buttonClass("secondary", "mt-6")}>
            Plan it with Jody Core →
          </Link>
        </div>
        <div>
          <h2 className="label border-b border-ink pb-2">Planned</h2>
          <ol>
            {mod.planned.map((item, i) => (
              <li key={item} className="flex gap-4 border-b border-hair py-3 text-[15px] leading-relaxed">
                <span className="w-6 shrink-0 font-mono text-xs leading-6 text-subtle">{String(i + 1).padStart(2, "0")}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
