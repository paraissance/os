import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-href";
import { monthlyTotal } from "@/lib/business-model";
import { getRecord } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { BusinessForm, DeleteBusiness, FaqsEditor, LinksEditor, SitesEditor, SubscriptionsEditor } from "@/components/businesses/editors";
import { Part } from "@/components/businesses/part";
import { SectionNav } from "@/components/businesses/section-nav";
import { mainAddress } from "@/components/dashboard/business-page";
import { Alert, Badge, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Edit business" };

export default function EditBusinessPage(props: PageProps<"/businesses/[slug]/edit">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] rounded-3xl" />}>
      <EditView params={props.params} searchParams={props.searchParams} />
    </Suspense>
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
  const today = requestNow();
  const website = mainAddress(record);
  const monthly = monthlyTotal(record.subscriptions);

  return (
    <div className="space-y-10">
      <header className="hero animate-rise rounded-3xl p-6 sm:p-10">
        <Link href="/businesses" className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
          ← All businesses
        </Link>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="label mb-3 text-white/70">Editing</p>
            <h1 className="flex flex-wrap items-center gap-3 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              {record.name}
              {record.status === "paused" ? <Badge>Paused</Badge> : null}
            </h1>
            {record.tagline ? <p className="mt-3 text-lg text-white/70">{record.tagline}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={businessHref(record.slug)} className={buttonClass("hero")}>
              See it on the dashboard →
            </Link>
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" className={buttonClass("heroSoft")}>
                Visit website <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {sp.added ? <Alert tone="ok">Business added. Now add its websites, links, questions and subscriptions below.</Alert> : null}

      <SectionNav
        label="Parts of this business"
        parts={[
          { id: "details", label: "Details" },
          { id: "websites", label: "Websites", count: record.sites.length },
          { id: "links", label: "Links", count: record.links.length },
          { id: "questions", label: "Questions", count: record.faqs.length },
          { id: "subscriptions", label: "Subscriptions", count: record.subscriptions.length },
        ]}
      />

      <Part id="details" title="Details" intro="The name, website and what the business is about.">
        <div className="rounded-3xl bg-wash p-5 sm:p-8">
          <BusinessForm business={record} />
        </div>
      </Part>

      <Part id="websites" title="Websites" count={record.sites.length} intro="Domain, hosting and SSL dates, and where to log in. JodyOS warns you 30 days before anything expires.">
        <SitesEditor businessId={record.id} sites={record.sites} today={today.toISOString()} />
      </Part>

      <Part id="links" title="Links" count={record.links.length} intro="Web pages, social profiles, login pages and tools. They become this business's magic links.">
        <LinksEditor businessId={record.id} links={record.links} />
      </Part>

      <Part id="questions" title="Questions" count={record.faqs.length} intro="What customers ask, with your answers.">
        <FaqsEditor businessId={record.id} faqs={record.faqs} />
      </Part>

      <Part
        id="subscriptions"
        title="Subscriptions"
        count={record.subscriptions.length}
        total={monthly ? `${formatMoney(monthly, "USD")} a month` : undefined}
        intro="Tools and services this business pays for. Tools every business shares are on the Businesses page."
      >
        <SubscriptionsEditor businessId={record.id} subscriptions={record.subscriptions} />
      </Part>

      <Part title="Delete" intro="Removes it with its websites, links, questions and subscriptions. Export a backup first if you might want it back.">
        <div className="rounded-3xl bg-wash p-5 sm:p-8">
          <DeleteBusiness business={record} />
        </div>
      </Part>
    </div>
  );
}
