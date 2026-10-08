import Link from "next/link";
import { ArrowRight, Hourglass } from "lucide-react";
import { getModule, PHASES } from "@/lib/modules";
import { Badge, PageHeader, Panel, buttonClass } from "@/components/ui/primitives";
import { NAV_ICONS } from "@/components/shell/nav-icons";

/**
 * Honest placeholder for a module that isn't built yet: what it will do and
 * which phase delivers it. No sample data, no fake numbers.
 */
export function ModulePlaceholder({ id }: { id: string }) {
  const mod = getModule(id);
  const Icon = NAV_ICONS[mod.id];
  return (
    <>
      <PageHeader
        eyebrow={`Phase ${mod.phase} · ${PHASES[mod.phase]}`}
        title={mod.label}
        description={mod.summary}
        action={<Badge tone="warn">Not built yet</Badge>}
      />
      <Panel className="overflow-hidden animate-fade-up">
        <div className="grid gap-0 md:grid-cols-[1fr_1.3fr]">
          <div className="relative flex flex-col justify-between gap-6 border-b border-line p-6 md:border-b-0 md:border-r">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-white/[0.04]">
              <Icon className="size-6 text-accent" aria-hidden="true" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <Hourglass className="size-4 text-warn" aria-hidden="true" />
                Arrives in Phase {mod.phase}: {PHASES[mod.phase]}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Nothing here is connected yet, so this page shows the plan rather than placeholder data.
              </p>
            </div>
            <Link href="/command" className={buttonClass("secondary", "self-start")}>
              Plan it with Jody Core <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-subtle">Planned capabilities</h2>
            <ul className="mt-4 space-y-3">
              {mod.planned.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </>
  );
}
