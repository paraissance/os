import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { loadBook } from "@/lib/businesses";
import { getModule } from "@/lib/modules";
import { LinksEditor } from "@/components/businesses/editors";
import { Sentence, Title } from "@/components/dashboard/ui";
import { PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Social Media" };

/**
 * Every business's social media accounts (its links of the "social" kind),
 * added and edited right here. Posting and scheduling come in a later phase.
 */
export default function SocialPage() {
  const later = getModule("social").planned;
  return (
    <>
      <PageHeader eyebrow="Business" title="Social Media" description="Every business's social media accounts in one place. Click an address to open the account." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SocialBody />
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

async function SocialBody() {
  await requireUser();
  const book = await loadBook();

  if (!book.businesses.length) {
    return (
      <div className="animate-rise rounded-3xl bg-wash p-8">
        <p className="text-2xl font-extrabold">Add a business first.</p>
        <Link href="/businesses/new" className={buttonClass("primary", "mt-4")}>
          + Add a business
        </Link>
      </div>
    );
  }

  const rows = book.businesses.map((b) => ({ b, accounts: b.links.filter((l) => l.kind === "social") }));
  const total = rows.reduce((n, r) => n + r.accounts.length, 0);
  const covered = rows.filter((r) => r.accounts.length).length;

  return (
    <div className="space-y-14">
      <Sentence>
        {total ? (
          <>
            <b>
              {total} account{total === 1 ? "" : "s"}
            </b>{" "}
            saved for{" "}
            <b>
              {covered} of your {book.businesses.length} businesses
            </b>
            .
          </>
        ) : (
          <>No social media accounts saved yet. Add each business&apos;s pages and profiles below.</>
        )}
      </Sentence>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-10 lg:grid-cols-2">
        {rows.map(({ b, accounts }) => (
          <section key={b.id} className="reveal">
            <Title count={accounts.length}>{b.name}</Title>
            <LinksEditor businessId={b.id} links={accounts} only="social" />
          </section>
        ))}
      </div>
    </div>
  );
}
