import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { loadBook } from "@/lib/businesses";
import { getModule } from "@/lib/modules";
import { WebsiteLinkForm } from "@/components/businesses/editors";
import { Title } from "@/components/dashboard/ui";
import { PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Websites" };

/**
 * The websites the owner works on: every website with an edit link, to
 * visit or to open where it's edited. Deploy and health status come later.
 */
export default function WebsitesPage() {
  const later = getModule("websites").planned;
  return (
    <>
      <PageHeader eyebrow="Business" title="Websites" description="The websites you work on. Visit one, or open the place where you edit it." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <WebsitesBody />
      </Suspense>
      <section className="reveal mt-16 rounded-2xl bg-wash p-5 sm:p-6">
        <h2 className="font-bold">Coming later</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
          {later.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function OutButton({ href, children, variant }: { href: string; children: string; variant: "light" | "primary" }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, "min-h-10 px-5")}>
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

async function WebsitesBody() {
  await requireUser();
  const book = await loadBook();
  const all = book.businesses.flatMap((b) => b.sites.map((site) => ({ site, business: b })));
  const listed = all.filter((x) => x.site.editUrl);

  if (!all.length) {
    return (
      <div className="animate-rise rounded-3xl bg-wash p-8">
        <p className="text-2xl font-extrabold">No websites saved yet.</p>
        <p className="mt-2 text-muted">Add a business with its website first.</p>
        <Link href="/businesses" className={buttonClass("primary", "mt-5")}>
          Go to Businesses
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-14">
      {listed.length ? (
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          {listed.map(({ site, business }) => (
            <li key={site.id} className="flex flex-col gap-5 rounded-2xl bg-wash p-6">
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="animate-rise rounded-2xl bg-wash px-5 py-4 text-lg">
          No websites here yet. Pick one below and paste the link where you edit it.
        </p>
      )}

      <section className="reveal">
        <Title>{listed.length ? "Add or change a website" : "Add a website"}</Title>
        <div className="rounded-2xl bg-wash p-5 sm:p-6">
          <WebsiteLinkForm sites={all.map(({ site, business }) => ({ id: site.id, label: `${site.domain} · ${business.name}`, editUrl: site.editUrl }))} />
        </div>
      </section>
    </div>
  );
}
