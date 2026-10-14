import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { dayLabel } from "@/lib/business-model";
import type { InvoiceSource, InvoiceStatus } from "@/lib/db/schema";
import { listInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { Sentence } from "@/components/dashboard/ui";
import { PasteInvoices, RemoveInvoice } from "@/components/spending/invoice-forms";
import { Badge, PageHeader, Skeleton, cx } from "@/components/ui/primitives";

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
      <section>
        <h2 className="mb-5 text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">Claude Code Console</h2>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <InvoicesTab searchParams={props.searchParams} />
        </Suspense>
      </section>
    </>
  );
}

const STATUS_WORDS: Record<InvoiceStatus, string> = { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded", void: "Void" };

async function InvoicesTab({ searchParams }: { searchParams: PageProps<"/spending">["searchParams"] }) {
  await requireUser();
  const { tab } = await searchParams;
  const current = TABS.find((t) => t.slug === tab) ?? TABS[0];
  const list = await listInvoices(current.source);
  const paid = list.filter((i) => i.status === "paid");
  const currency = list[0]?.currency ?? "USD";
  const total = paid.reduce((s, i) => s + i.amount, 0);
  const oldest = list.at(-1);

  return (
    <div className="space-y-8">
      <nav aria-label="Claude spendings" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={`/spending?tab=${t.slug}`}
            aria-current={t === current ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-semibold transition-colors duration-200",
              t === current ? "bg-ink text-paper" : "bg-wash hover:bg-mist",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {list.length ? (
        <Sentence>
          <b>{formatMoney(total, currency)} paid</b> on{" "}
          <b>
            {paid.length} invoice{paid.length === 1 ? "" : "s"}
          </b>{" "}
          since {dayLabel(oldest?.billedOn ?? null)}. The last one was <b>{formatMoney(list[0].amount, list[0].currency)}</b> on {dayLabel(list[0].billedOn)}.
        </Sentence>
      ) : (
        <p className="animate-rise text-lg text-muted">No {current.label} invoices yet. Paste them below.</p>
      )}

      {list.length ? (
        <div className="animate-rise overflow-x-auto rounded-2xl bg-wash">
          <table className="w-full min-w-[28rem] text-left text-[15px]">
            <thead>
              <tr className="border-b border-paper text-sm text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Total
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b border-paper last:border-b-0">
                  <td className="px-5 py-3 font-semibold">{dayLabel(i.billedOn)}</td>
                  <td className="px-5 py-3 tabular-nums">{formatMoney(i.amount, i.currency)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={i.status === "unpaid" ? "bad" : "neutral"}>{STATUS_WORDS[i.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RemoveInvoice id={i.id} source={current.source} label={`${dayLabel(i.billedOn)}, ${formatMoney(i.amount, i.currency)}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-2xl bg-wash p-5 sm:p-6">
        <PasteInvoices
          key={current.source}
          source={current.source}
          hint={`Open ${current.where}, select the rows, copy and paste them here. Invoices already here are skipped.`}
        />
      </div>
    </div>
  );
}
