import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { costByBusiness, monthlyTotal, spending } from "@/lib/business-model";
import { loadBook } from "@/lib/businesses";
import { requestNow } from "@/lib/clock";
import { formatMoney } from "@/lib/money";
import { SubscriptionsEditor } from "@/components/businesses/editors";
import { Bars, Rows, Sentence, Title } from "@/components/dashboard/ui";
import { PageHeader, Skeleton, StatusDot } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Spending" };

/**
 * Everything the businesses pay for, in one place: the totals, what's due
 * soon, and an editor per business (plus the tools they all share).
 */
export default function SpendingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Spending"
        description="What your businesses pay for: software, hosting, domains and services. Add each one once; JodyOS adds up the totals and reminds you before a payment is due."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SpendingBody />
      </Suspense>
    </>
  );
}

function dueWords(daysLeft: number) {
  if (daysLeft < 0) return `overdue by ${-daysLeft} day${daysLeft === -1 ? "" : "s"}`;
  if (daysLeft === 0) return "due today";
  return `due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

async function SpendingBody() {
  await requireUser();
  const [book, today] = [await loadBook(), requestNow()];
  const all = [...book.businesses.flatMap((b) => b.subscriptions), ...book.shared];
  const totals = spending(all, today);
  const byBusiness = costByBusiness(book);
  const names = new Map(book.businesses.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-14">
      {all.length ? (
        <Sentence>
          You pay <b>{formatMoney(totals.monthly, "USD")} a month</b> (<b>{formatMoney(totals.yearly, "USD", 0)} a year</b>) across{" "}
          <b>
            {totals.count} subscription{totals.count === 1 ? "" : "s"}
          </b>
          .
        </Sentence>
      ) : (
        <Sentence>
          Nothing saved yet. Add what each business pays for below, and the <b>monthly</b> and <b>yearly</b> totals add up here.
        </Sentence>
      )}

      {totals.upcoming.length ? (
        <section className="reveal">
          <Title count={totals.upcoming.length}>Due in the next 30 days</Title>
          <Rows>
            {totals.upcoming.map(({ sub, daysLeft }) => (
              <li key={sub.id} className="flex items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-lg font-bold">{sub.name}</span>
                  <span className="block text-sm text-muted">{sub.businessId ? (names.get(sub.businessId) ?? "") : "Shared by all businesses"}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold tabular-nums">{formatMoney(sub.amount, sub.currency)}</span>
                  <span className="flex items-center justify-end gap-1.5 text-sm text-muted">
                    <StatusDot tone={daysLeft < 0 ? "bad" : "warn"} />
                    {dueWords(daysLeft)}
                  </span>
                </span>
              </li>
            ))}
          </Rows>
        </section>
      ) : null}

      {totals.monthly > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-2">
          <section className="reveal">
            <Title note="per month">By business</Title>
            <div className="rounded-2xl bg-wash p-5">
              <Bars rows={byBusiness.map((r) => ({ label: r.name, value: r.monthly, display: formatMoney(r.monthly, "USD") }))} empty="No costs saved." />
            </div>
          </section>
          <section className="reveal">
            <Title note="per month">By kind</Title>
            <div className="rounded-2xl bg-wash p-5">
              <Bars rows={totals.byCategory.map((c) => ({ label: c.label, value: c.monthly, display: formatMoney(c.monthly, "USD") }))} empty="No costs saved." />
            </div>
          </section>
        </div>
      ) : null}

      {book.businesses.length ? (
        <section>
          <Title>What each business pays for</Title>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-10 lg:grid-cols-2">
            {book.businesses.map((b) => {
              const monthly = monthlyTotal(b.subscriptions);
              return (
                <div key={b.id} className="reveal">
                  <Title level={3} note={monthly > 0 ? `${formatMoney(monthly, "USD")} a month` : undefined}>
                    {b.name}
                  </Title>
                  <SubscriptionsEditor businessId={b.id} subscriptions={b.subscriptions} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="reveal">
        <Title note={book.shared.length ? `${formatMoney(monthlyTotal(book.shared), "USD")} a month` : undefined}>Shared by all businesses</Title>
        <p className="-mt-2 mb-4 text-muted">Things you pay for once that every business uses, like a scheduler or an AI tool.</p>
        <SubscriptionsEditor businessId={null} subscriptions={book.shared} />
      </section>
    </div>
  );
}
