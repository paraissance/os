import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { moveBusinessAction } from "@/app/actions/businesses";
import { requireUser } from "@/lib/auth/current-user";
import { businessHref, editHref } from "@/lib/business-href";
import { loadBook } from "@/lib/businesses";
import { bookTotals, monthlyTotal, toolsFor, type BusinessBook, type BusinessRecord } from "@/lib/business-model";
import { requestNow } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { SubscriptionsEditor } from "@/components/businesses/editors";
import { HeroStats, Part, RenewalLine } from "@/components/dashboard/ui";
import { CountUp } from "@/components/motion/count-up";
import { Badge, PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Businesses" };

export default function BusinessesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="Businesses"
        description="Everything about each business, in one place. The order here is the order on the dashboard."
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
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        }
      >
        <BusinessList />
      </Suspense>
    </>
  );
}

function Totals({ book, today }: { book: BusinessBook; today: Date }) {
  const t = bookTotals(book, today);
  return (
    <HeroStats
      stats={[
        { label: t.active === 1 ? "Active business" : "Active businesses", value: <CountUp value={t.active} />, note: t.paused ? `${t.paused} paused` : null },
        { label: t.sites === 1 ? "Website" : "Websites", value: <CountUp value={t.sites} /> },
        { label: "A month in tools", value: t.monthly ? formatMoney(t.monthly, "USD") : "—", note: t.monthly ? null : "No prices saved yet" },
        {
          label: "Due soon",
          value: <CountUp value={t.due} />,
          note: t.due ? (
            <Link href="/" className="underline decoration-1 underline-offset-4 transition-colors hover:text-white">
              See them on the dashboard
            </Link>
          ) : t.datesSaved ? (
            "All clear"
          ) : (
            "No dates saved yet"
          ),
        },
      ]}
    />
  );
}

function MoveButton({ id, name, direction, disabled }: { id: string; name: string; direction: "up" | "down"; disabled: boolean }) {
  return (
    <form action={moveBusinessAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${name} ${direction}`}
        title={direction === "up" ? "Move earlier" : "Move later"}
        className="flex size-9 items-center justify-center rounded-full bg-paper text-sm font-bold transition-colors hover:bg-mist disabled:opacity-30"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function BusinessCard({ business: b, today, first, last }: { business: BusinessRecord; today: Date; first: boolean; last: boolean }) {
  const monthly = monthlyTotal(b.subscriptions);
  const domains = b.sites.map((s) => s.domain).join(", ");
  // Each count jumps straight to that part of the business's edit page.
  const parts = [
    ["websites", "Sites", b.sites.length],
    ["links", "Links", b.links.length],
    ["questions", "Q&A", b.faqs.length],
    ["subscriptions", "Tools", b.subscriptions.length],
  ] as const;
  return (
    <li className="flex flex-col rounded-3xl bg-wash p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-extrabold leading-tight tracking-[-0.02em]">
          <Link href={businessHref(b.slug)} className="decoration-1 underline-offset-4 hover:underline">
            {b.name}
          </Link>
        </h2>
        {b.status === "paused" ? <Badge>Paused</Badge> : null}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{b.tagline ?? "No description yet"}</p>
      {domains ? <p className="mt-1 truncate text-sm text-muted">{domains}</p> : null}

      <ul className="mt-5 grid grid-cols-4 gap-1.5">
        {parts.map(([part, label, n]) => (
          <li key={part}>
            <Link
              href={editHref(b.slug, part)}
              aria-label={`${b.name}: ${n} ${label}`}
              className="block rounded-2xl bg-paper py-2.5 text-center transition-colors duration-200 hover:bg-mist"
            >
              <span className="block text-xl font-extrabold leading-tight tabular-nums">{n}</span>
              <span className="block text-xs text-muted">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mb-5 mt-4 space-y-1">
        <RenewalLine record={b} today={today} />
        <p className="text-sm text-muted">{monthly ? `${formatMoney(monthly, "USD")} a month in tools` : toolsFor(b, []).length ? "Free tools only" : "No subscriptions yet"}</p>
      </div>

      <div className="mt-auto flex items-center gap-1.5">
        <Link href={editHref(b.slug)} className={buttonClass("primary", "min-h-9 px-4")}>
          Edit
        </Link>
        <Link href={businessHref(b.slug)} className={buttonClass("light", "min-h-9 px-4")}>
          Open
        </Link>
        <span className="ml-auto flex gap-1.5">
          <MoveButton id={b.id} name={b.name} direction="up" disabled={first} />
          <MoveButton id={b.id} name={b.name} direction="down" disabled={last} />
        </span>
      </div>
    </li>
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
      <div className="space-y-4">
        <Totals book={book} today={today} />
        <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
          {book.businesses.map((b, i) => (
            <BusinessCard key={b.id} business={b} today={today} first={i === 0} last={i === book.businesses.length - 1} />
          ))}
        </ul>
      </div>

      <Part
        id="shared-tools"
        title="Shared tools"
        intro="Things you pay for once that every business uses, like a scheduler or an AI tool. Each business's own tools are under its Edit."
        count={book.shared.length}
        total={book.shared.length ? `${formatMoney(monthlyTotal(book.shared), "USD")} a month` : undefined}
      >
        <SubscriptionsEditor businessId={null} subscriptions={book.shared} />
      </Part>
    </div>
  );
}
