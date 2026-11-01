import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { loadBook } from "@/lib/businesses";
import { envStatus } from "@/lib/env";
import { AskClaude } from "@/components/websites/ask-claude";
import { PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Websites" };

/**
 * The websites the owner works on: every website with an edit link (set on
 * the business's edit page), to visit, open where it's edited, or ask Claude
 * to change.
 */
export default function WebsitesPage() {
  return (
    <>
      <PageHeader eyebrow="Business" title="Websites" description="The websites you work on. Visit one, or open the place where you edit it." />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <WebsitesBody />
      </Suspense>
    </>
  );
}

function OutButton({ href, children, variant }: { href: string; children: string; variant: "light" | "primary" }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, "min-h-9! px-4!")}>
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

async function WebsitesBody() {
  await requireUser();
  const book = await loadBook();
  const listed = book.businesses.flatMap((b) => b.sites.map((site) => ({ site, business: b }))).filter((x) => x.site.editUrl);
  const routine = envStatus().siteRoutine;

  if (!listed.length) {
    return (
      <div className="animate-rise rounded-3xl bg-wash p-8">
        <p className="text-2xl font-extrabold">No websites here yet.</p>
        <p className="mt-2 text-muted">A website shows here once it has an edit link: add one in Businesses → Edit → Websites.</p>
        <Link href="/businesses" className={buttonClass("primary", "mt-5")}>
          Go to Businesses
        </Link>
      </div>
    );
  }

  return (
    <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
      {listed.map(({ site, business }) => (
        <li key={site.id} className="flex flex-col gap-5 rounded-3xl bg-wash p-6">
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold tracking-[-0.02em]">{site.domain}</p>
            <p className="truncate text-sm text-muted">{[business.name, site.platform].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <OutButton href={site.url ?? `https://${site.domain}`} variant="light">
              Visit
            </OutButton>
            <OutButton href={site.editUrl!} variant="primary">
              Edit website
            </OutButton>
          </div>
          {routine ? <AskClaude siteId={site.id} domain={site.domain} /> : null}
        </li>
      ))}
    </ul>
  );
}
