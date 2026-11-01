import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { dayLabel } from "@/lib/business-model";
import type { InvoiceSource, InvoiceStatus } from "@/lib/db/schema";
import { invoiceTotals } from "@/lib/invoice-model";
import { listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { HeroStats, Title } from "@/components/dashboard/ui";
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
      <PageHeader title="Spendings" />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <InvoicesTab searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

const STATUS_WORDS: Record<InvoiceStatus, string> = { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded", void: "Void" };

const LATEST = 6;

async function InvoicesTab({ searchParams }: { searchParams: PageProps<"/spending">["searchParams"] }) {
  await requireUser();
  const { tab, all } = await searchParams;
  const current = TABS.find((t) => t.slug === tab) ?? TABS[0];
  const list = await listInvoices(current.source);
  const currency = list[0]?.currency ?? "USD";
  const totals = invoiceTotals(list);
  const shown = all ? list : list.slice(0, LATEST);
  const paste = (
    <details open={!list.length} className="rounded-3xl bg-wash p-6">
      <summary className="cursor-pointer font-semibold">Add invoices</summary>
      <div className="mt-4">
        <PasteInvoices key={current.source} source={current.source} hint={`Copy them from ${current.where}.`} />
      </div>
    </details>
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
            stats={[
              { label: "Paid in total", value: formatMoney(totals.total, currency), note: totals.since ? `since ${dayLabel(totals.since)}` : "nothing paid yet" },
              { label: "Average a month", value: formatMoney(totals.monthly, currency) },
              { label: "Last invoice", value: formatMoney(list[0].amount, list[0].currency), note: dayLabel(list[0].billedOn) },
            ]}
          />

          <section className="min-w-0 pt-7">
            <Title
              count={list.length}
              note={
                list.length > LATEST ? (
                  <Link href={`/spending?tab=${current.slug}${all ? "" : "&all=1"}`} className="font-semibold text-ink underline decoration-1 underline-offset-4">
                    {all ? "Show fewer" : "Show all"}
                  </Link>
                ) : null
              }
            >
              Invoices
            </Title>
            {/* relative: keeps the screen-reader-only heading inside the scroller, or it stretches the page on a phone. */}
            <div className="relative animate-rise overflow-x-auto rounded-3xl bg-wash">
              <table className="w-full text-left text-[15px] [&_td]:px-3 sm:[&_td]:px-6">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => (
                    <tr key={i.id} className="border-b border-paper transition-colors duration-200 last:border-b-0 hover:bg-paper/40">
                      <td className="whitespace-nowrap py-3 font-semibold">{dayLabel(i.billedOn)}</td>
                      <td className="py-3 text-right font-semibold tabular-nums">{formatMoney(i.amount, i.currency)}</td>
                      <td className="py-3">{i.status === "paid" ? null : <Badge tone={i.status === "unpaid" ? "bad" : "neutral"}>{STATUS_WORDS[i.status]}</Badge>}</td>
                      <td className="py-2 text-right">
                        <RemoveInvoice id={i.id} source={current.source} label={`${dayLabel(i.billedOn)}, ${formatMoney(i.amount, i.currency)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="pt-4">{paste}</div>
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
