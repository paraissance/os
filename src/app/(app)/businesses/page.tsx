import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { moveBusinessAction } from "@/app/actions/businesses";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref } from "@/lib/business-sections";
import { loadBook } from "@/lib/businesses";
import { mostUrgent, monthlyTotal, renewalWords, siteRenewals, toolsFor } from "@/lib/business-model";
import { requestNow } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { Badge, PageHeader, Skeleton, StatusDot, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Businesses" };

export default function BusinessesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Businesses"
        description="Everything about each business lives here in JodyOS: details, websites, links and common questions. Edit it here; see it on the dashboard. The order here is the order of the tabs."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/businesses/new" className={buttonClass("primary")}>
              + Add a business
            </Link>
            <Link href="/businesses/import" className={buttonClass("secondary")}>
              Import or export
            </Link>
          </div>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BusinessList />
      </Suspense>
    </>
  );
}

function MoveButton({ id, direction, disabled }: { id: string; direction: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveBusinessAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Move up" : "Move down"}
        className="flex size-9 items-center justify-center rounded-full bg-paper text-sm font-bold transition-colors hover:bg-mist disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

async function BusinessList() {
  await requireUser();
  const [book, today] = [await loadBook(), requestNow()];

  if (!book.businesses.length) {
    return (
      <div className="animate-rise rounded-3xl bg-wash p-8 text-center sm:p-12">
        <p className="text-2xl font-extrabold">No businesses yet.</p>
        <p className="mx-auto mt-2 max-w-md text-muted">Add your first one, or import a file with all of them at once.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/businesses/new" className={buttonClass("primary")}>
            + Add a business
          </Link>
          <Link href="/businesses/import" className={buttonClass("light")}>
            Import a file
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <ul className="stagger space-y-2">
        {book.businesses.map((b, i) => {
          const renewals = b.sites.flatMap((s) => siteRenewals(s, today));
          const worst = mostUrgent(renewals);
          const monthly = monthlyTotal(b.subscriptions);
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-wash px-5 py-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 text-lg font-bold leading-tight">
                  {b.name}
                  {b.status === "paused" ? <Badge>Paused</Badge> : null}
                </p>
                <p className="truncate text-sm text-muted">
                  {[b.tagline, b.sites.map((s) => s.domain).join(", ") || null].filter(Boolean).join(" · ") || "No details yet"}
                </p>
              </div>
              <div className="flex min-w-0 basis-56 flex-col gap-0.5 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <StatusDot tone={worst ? (worst.status === "expired" ? "bad" : "warn") : renewals.length ? "ok" : "neutral"} />
                  {worst
                    ? `${worst.label}: ${renewalWords(worst).toLowerCase()}`
                    : renewals.length
                      ? "Renewals all current"
                      : b.sites.length
                        ? "No renewal dates saved"
                        : "No websites yet"}
                </span>
                <span className="text-muted">
                  {monthly ? `${formatMoney(monthly, "USD")} a month in tools` : `${toolsFor(b, []).length ? "Free tools only" : "No subscriptions yet"}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MoveButton id={b.id} direction="up" disabled={i === 0} />
                <MoveButton id={b.id} direction="down" disabled={i === book.businesses.length - 1} />
                <Link href={businessHref(b.slug)} className={buttonClass("light", "min-h-9 px-4")}>
                  Open
                </Link>
                <Link href={`/businesses/${b.slug}/edit`} className={buttonClass("primary", "min-h-9 px-4")}>
                  Edit
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="reveal flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-wash px-5 py-4">
        <span className="text-muted">What each business pays for, and the tools they share, is on the Spending page.</span>
        <Link href="/spending" className={buttonClass("light", "min-h-9 px-4")}>
          Open Spending →
        </Link>
      </p>
    </div>
  );
}
