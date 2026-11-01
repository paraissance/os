import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { dayLabel } from "@/lib/business-model";
import type { InvoiceSource, InvoiceStatus } from "@/lib/db/schema";
import { invoiceTotals, paidByMonth } from "@/lib/invoice-model";
import { listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { Bars, HeroStats, Title } from "@/components/dashboard/ui";
import { PasteInvoices, RemoveInvoice } from "@/components/spending/invoice-forms";
import { Badge, PageHeader, Skeleton, pillClass, pillTrack } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Spendings" };

/** What is paid to Claude: the Chat & Code subscription and the Console API, each from its invoices. */
const TABS: { source: InvoiceSource; slug: string; label: string; where: string }[] = [
  { source: "claude", slug: "chat-code", label: "Chat & Code", where: "claude.ai → Settings → Billing → Invoices" },
  { source: "console", slug: "console-api", label: "Console API", where: "console.anthropic.com → Settings → Billing → Invoice history" },
];

export default function SpendingsPage(props: PageProps<"/spending">) {
  return (
    <>
      <PageHeader eyebrow="Money" title="Spendings" />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <InvoicesTab searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const STATUS_WORDS: Record<InvoiceStatus, string> = { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded", void: "Void" };

async function InvoicesTab({ searchParams }: { searchParams: PageProps<"/spending">["searchParams"] }) {
  await requireUser();
  const { tab } = await searchParams;
  const current = TABS.find((t) => t.slug === tab) ?? TABS[0];
  const list = await listInvoices(current.source);
  const currency = list[0]?.currency ?? "USD";
  const totals = invoiceTotals(list);
  const months = paidByMonth(list);
  const paste = (
    <div className="rounded-3xl bg-wash p-6">
      <PasteInvoices
        key={current.source}
        source={current.source}
        hint={`Open ${current.where}, select the rows, copy and paste them here. Invoices already here are skipped.`}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <nav aria-label="Claude spendings" className={pillTrack}>
        {TABS.map((t) => (
          <Link key={t.slug} href={`/spending?tab=${t.slug}`} aria-current={t === current ? "page" : undefined} className={pillClass(t === current)}>
            {t.label}
          </Link>
        ))}
      </nav>

      {list.length ? (
        <>
          <HeroStats
            title={`Claude Code Console · ${current.label}`}
            stats={[
              { label: "Paid in total", value: formatMoney(totals.total, currency), note: `since ${dayLabel(list.at(-1)?.billedOn ?? null)}` },
              { label: totals.count === 1 ? "Invoice" : "Invoices", value: totals.count },
              { label: "Average a month", value: formatMoney(totals.monthly, currency) },
              { label: "Last invoice", value: formatMoney(list[0].amount, list[0].currency), note: dayLabel(list[0].billedOn) },
            ]}
          />

          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-10 pt-7 xl:grid-cols-6">
            <section className="min-w-0 xl:col-span-4">
              <Title count={list.length}>Invoices</Title>
              <div className="animate-rise overflow-x-auto rounded-3xl bg-wash">
                <table className="w-full min-w-[28rem] text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-paper text-sm text-muted">
                      <th scope="col" className="px-6 py-3 font-semibold">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-right font-semibold">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 font-semibold">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => (
                      <tr key={i.id} className="border-b border-paper transition-colors duration-200 last:border-b-0 hover:bg-paper/40">
                        <td className="whitespace-nowrap px-6 py-3 font-semibold">{dayLabel(i.billedOn)}</td>
                        <td className="px-6 py-3 text-right font-semibold tabular-nums">{formatMoney(i.amount, i.currency)}</td>
                        <td className="px-6 py-3">
                          <Badge tone={i.status === "unpaid" ? "bad" : "neutral"}>{STATUS_WORDS[i.status]}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <RemoveInvoice id={i.id} source={current.source} label={`${dayLabel(i.billedOn)}, ${formatMoney(i.amount, i.currency)}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="min-w-0 space-y-10 xl:col-span-2">
              <section>
                <Title note="paid">By month</Title>
                <div className="rounded-3xl bg-wash p-6">
                  <Bars rows={months.map((m) => ({ label: m.label, value: m.total, display: formatMoney(m.total, currency) }))} empty="Nothing paid yet." />
                </div>
              </section>
              <section>
                <Title>Add invoices</Title>
                {paste}
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="pt-4">
          <Title>No {current.label} invoices yet</Title>
          {paste}
        </div>
      )}
    </div>
  );
}
