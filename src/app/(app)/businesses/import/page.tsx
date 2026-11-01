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
      <PageHeader title="Import or export" />
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <ImportView />
      </Suspense>
    </>
  );
}

async function ImportView() {
  await requireUser();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="animate-rise rounded-3xl bg-wash p-5 sm:p-8">
        <Title>Import a file</Title>
        <ImportForm />
        <p className="mt-4 text-sm text-muted">Businesses in the file are added or replaced. The others stay as they are.</p>
      </section>
      <section className="animate-rise self-start rounded-3xl bg-wash p-5 sm:p-8">
        <Title>Export a backup</Title>
        <a href="/api/businesses/export" className={buttonClass("primary")} download>
          Download backup
        </a>
      </section>
    </div>
  );
}
