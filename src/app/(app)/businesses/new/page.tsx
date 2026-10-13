import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { BusinessForm } from "@/components/businesses/editors";
import { PageHeader, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add a business" };

export default function NewBusinessPage() {
  return (
    <>
      <Link href="/businesses" className="mb-6 inline-block text-sm font-semibold underline decoration-1 underline-offset-4">
        ← All businesses
      </Link>
      <PageHeader
        title="Add a business"
        description="Start with the name and website. You can add its websites, links, common questions and subscriptions on the next page."
      />
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <NewForm />
      </Suspense>
    </>
  );
}

async function NewForm() {
  await requireUser();
  return (
    <div className="animate-rise rounded-3xl bg-wash p-5 sm:p-8">
      <BusinessForm />
    </div>
  );
}
