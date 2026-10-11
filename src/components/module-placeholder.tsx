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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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
          <h2 className="mb-3 text-xl font-extrabold tracking-[-0.02em]">Planned</h2>
          <ol className="stagger space-y-2">
            {mod.planned.map((item, i) => (
              <li key={item} className="flex gap-4 rounded-2xl bg-wash px-5 py-4 text-[15px] leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
