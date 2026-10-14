import type { Metadata } from "next";
import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { Badge, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Others" };

/** The main menu has six places; everything else is one click away here. */
const MAIN = new Set(["dashboard", "businesses", "social", "spending", "settings"]);
const READY = MODULES.filter((m) => m.phase === 1 && !MAIN.has(m.id));
const LATER = MODULES.filter((m) => m.phase > 1);

const DESCRIPTIONS: Record<string, string> = {
  command: "Talk to Jody Core: plan, draft and think things through. Shortcut: Ctrl+K.",
  activity: "Everything that happened in JodyOS, newest first.",
  integrations: "What JodyOS is connected to, and what each connection needs.",
};

export default function OthersPage() {
  return (
    <>
      <PageHeader eyebrow="More" title="Others" description="Tools that work today, and what's coming next." />

      <section className="mb-14">
        <h2 className="mb-4 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">Ready to use</h2>
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
          {READY.map((m) => (
            <li key={m.id}>
              <Link
                href={m.href}
                className="group flex h-full flex-col rounded-2xl bg-wash p-6 transition-[background-color,transform] duration-200 hover:-translate-y-1 hover:bg-mist"
              >
                <span className="flex items-start justify-between gap-3 text-xl font-extrabold tracking-[-0.02em]">
                  {m.label}
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-base transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-ink group-hover:text-paper"
                  >
                    →
                  </span>
                </span>
                <span className="mt-2 text-[15px] leading-relaxed text-muted">{DESCRIPTIONS[m.id] ?? m.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="reveal">
        <h2 className="mb-1 text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">Coming later</h2>
        <p className="mb-4 text-muted">Planned, not built yet. Open one to see what it will do.</p>
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LATER.map((m) => (
            <li key={m.id}>
              <Link href={m.href} className="group flex h-full flex-col rounded-2xl border border-hair p-5 transition-colors duration-200 hover:bg-wash">
                <span className="flex items-center justify-between gap-3 font-bold">
                  {m.label}
                  <Badge>Phase {m.phase}</Badge>
                </span>
                <span className="mt-1.5 text-sm leading-relaxed text-muted">{m.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
