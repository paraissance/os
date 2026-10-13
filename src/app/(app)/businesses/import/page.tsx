import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { ImportForm } from "@/components/businesses/editors";
import { Title } from "@/components/dashboard/ui";
import { PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Import or export businesses" };

export default function ImportPage() {
  return (
    <>
      <Link href="/businesses" className="mb-6 inline-block text-sm font-semibold underline decoration-1 underline-offset-4">
        ← All businesses
      </Link>
      <PageHeader
        title="Import or export"
        description="Bring in many businesses at once from a file, or download everything as a backup."
      />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <ImportView />
      </Suspense>
    </>
  );
}

async function ImportView() {
  await requireUser();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="animate-rise">
        <Title>Import a file</Title>
        <div className="rounded-3xl bg-wash p-5 sm:p-8">
          <ImportForm />
        </div>
        <ul className="mt-5 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Businesses are matched by their short name. New ones are added; ones you already have are updated.</li>
          <li>For a business in the file, its websites, links, questions and subscriptions are replaced by the file&apos;s.</li>
          <li>Businesses that aren&apos;t in the file are left alone.</li>
          <li>Nothing changes if the file has a mistake: you&apos;ll see what to fix.</li>
        </ul>
      </section>
      <section className="reveal">
        <Title>Export a backup</Title>
        <div className="rounded-3xl bg-wash p-5 sm:p-8">
          <p className="text-[15px] leading-relaxed">
            Download every business, website, link, question and subscription as one file. You can import it again later, here or into a new
            JodyOS.
          </p>
          <a href="/api/businesses/export" className={buttonClass("primary", "mt-5")} download>
            Download backup
          </a>
        </div>
      </section>
    </div>
  );
}
