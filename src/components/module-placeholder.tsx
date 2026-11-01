import Link from "next/link";
import { getModule } from "@/lib/modules";
import { Badge, PageHeader, buttonClass } from "@/components/ui/primitives";
import { Rows, Title } from "./dashboard/ui";

/**
 * Honest placeholder for a module that isn't built yet: what it will do and
 * which phase delivers it. No sample data, no fake numbers.
 */
export function ModulePlaceholder({ id }: { id: string }) {
  const mod = getModule(id);
  return (
    <>
      <PageHeader
        title={mod.label}
        description={mod.summary}
        action={<Badge tone="neutral">Not built yet</Badge>}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="hero animate-rise self-start rounded-3xl p-6 sm:p-8">
          <p className="text-3xl font-extrabold leading-tight tracking-[-0.03em]">Arrives in Phase {mod.phase}.</p>
          <Link href="/command" className={buttonClass("hero", "mt-6")}>
            Plan it with Jody Core →
          </Link>
        </div>
        <section>
          <Title>Planned</Title>
          <Rows>
            {mod.planned.map((item, i) => (
              <li key={item} className="flex gap-4 text-[15px] leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
                {item}
              </li>
            ))}
          </Rows>
        </section>
      </div>
    </>
  );
}
