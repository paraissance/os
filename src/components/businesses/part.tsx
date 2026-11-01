import type { ReactNode } from "react";
import { Title } from "@/components/dashboard/ui";

/** One part of a business's pages: its title stays beside the content on wide screens, above it otherwise. */
export function Part({ id, title, intro, count, total, children }: { id?: string; title: string; intro: string; count?: number; total?: string; children: ReactNode }) {
  return (
    <section id={id} className="reveal grid scroll-mt-32 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-8">
      <div className="xl:sticky xl:top-36 xl:self-start">
        <Title count={count}>{title}</Title>
        <p className="-mt-2 text-sm leading-relaxed text-muted">{intro}</p>
        {total ? <p className="mt-3 text-sm font-semibold">{total}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
