import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-sections";
import { getRecord } from "@/lib/businesses";
import { BusinessForm, DeleteBusiness, FaqsEditor, LinksEditor, SitesEditor, SubscriptionsEditor } from "@/components/businesses/editors";
import { Title } from "@/components/dashboard/ui";
import { Alert, Badge, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Edit business" };

export default function EditBusinessPage(props: PageProps<"/businesses/[slug]/edit">) {
  return (
    <>
      <Link href="/businesses" className="mb-6 inline-block text-sm font-semibold underline decoration-1 underline-offset-4">
        ← All businesses
      </Link>
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <EditView params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const PARTS = [
  ["details", "Details"],
  ["websites", "Websites"],
  ["links", "Links"],
  ["questions", "Common questions"],
  ["subscriptions", "Subscriptions"],
] as const;

function Part({ id, title, intro, count, children }: { id: string; title: string; intro: string; count?: number; children: ReactNode }) {
  return (
    <section id={id} className="reveal scroll-mt-24">
      <Title count={count}>{title}</Title>
      <p className="-mt-2 mb-4 text-muted">{intro}</p>
      {children}
    </section>
  );
}

async function EditView({
  params,
  searchParams,
}: {
  params: PageProps<"/businesses/[slug]/edit">["params"];
  searchParams: PageProps<"/businesses/[slug]/edit">["searchParams"];
}) {
  await requireUser();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const record = await getRecord(slug);
  if (!record) notFound();

  return (
    <div className="space-y-14">
      <header className="animate-rise">
        <p className="label mb-3 text-muted">Editing</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            {record.name}
            {record.status === "paused" ? <Badge>Paused</Badge> : null}
          </h1>
          <Link href={businessHref(record.slug)} className={buttonClass("primary")}>
            See it on the dashboard →
          </Link>
        </div>
        <nav aria-label="Parts of this business" className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
          {PARTS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full bg-wash px-4 py-2 text-sm font-semibold transition-colors hover:bg-mist">
              {label}
            </a>
          ))}
        </nav>
        {sp.added ? (
          <div className="mt-6">
            <Alert tone="ok">Business added. Now add its websites, links, questions and subscriptions below.</Alert>
          </div>
        ) : null}
      </header>

      <Part id="details" title="Details" intro="The name, website and what the business is about.">
        <div className="rounded-3xl bg-wash p-5 sm:p-8">
          <BusinessForm business={record} />
        </div>
      </Part>

      <Part id="websites" title="Websites" count={record.sites.length} intro="Domain, hosting and SSL dates, and where to log in. JodyOS warns you 30 days before anything expires.">
        <SitesEditor businessId={record.id} sites={record.sites} />
      </Part>

      <Part id="links" title="Links" count={record.links.length} intro="Web pages, social profiles, login pages and tools.">
        <LinksEditor businessId={record.id} links={record.links} />
      </Part>

      <Part id="questions" title="Common questions" count={record.faqs.length} intro="What customers ask, with your answers.">
        <FaqsEditor businessId={record.id} faqs={record.faqs} />
      </Part>

      <Part
        id="subscriptions"
        title="Subscriptions"
        count={record.subscriptions.length}
        intro="Tools and services this business pays for. Tools every business shares are on the Businesses page."
      >
        <SubscriptionsEditor businessId={record.id} subscriptions={record.subscriptions} />
      </Part>

      <section className="reveal rounded-3xl bg-wash p-5 sm:p-8">
        <h2 className="text-xl font-extrabold">Delete this business</h2>
        <p className="mb-4 mt-1 text-muted">Removes it with its websites, links, questions and subscriptions. Export a backup first if you might want it back.</p>
        <DeleteBusiness business={record} />
      </section>
    </div>
  );
}
