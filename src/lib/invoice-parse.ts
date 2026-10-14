import type { InvoiceStatus } from "@/lib/db/schema";

/*
 * Reading invoices out of text pasted from a billing page. Copying a table
 * gives one row per line (cells split by tabs) or one cell per line,
 * so this finds every date and takes the amount and status that follow it,
 * up to the next date. Pure: no database here.
 */

export type ParsedInvoice = { billedOn: string; amount: number; currency: string; status: InvoiceStatus };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Oct 12, 2026", "October 12 2026", "12 Oct 2026" or "2026-10-12".
const DATE_RE =
  /\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/gi;
// The total comes straight after the date (a tab, spaces or a new line between), never later in the text.
const AMOUNT_RE = /^\s*(US\$|\$|€|£|USD|EUR|GBP)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;
const STATUS_RE = /\b(paid|unpaid|open|due|overdue|refunded|void|voided|failed)\b/i;

const CURRENCY: Record<string, string> = { $: "USD", "us$": "USD", usd: "USD", "€": "EUR", eur: "EUR", "£": "GBP", gbp: "GBP" };

const STATUS: Record<string, InvoiceStatus> = {
  paid: "paid",
  unpaid: "unpaid",
  open: "unpaid",
  due: "unpaid",
  overdue: "unpaid",
  failed: "unpaid",
  refunded: "refunded",
  void: "void",
  voided: "void",
};

function isoDate(y: number, m: number, d: number): string | null {
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const t = new Date(`${iso}T00:00:00Z`);
  // Rejects dates like Feb 31 that JavaScript would roll into March.
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso && y >= 2000 && y <= 2100 ? iso : null;
}

/** Every invoice found in the text, in the order given. Lines without a date and an amount are ignored. */
export function parseInvoices(text: string): ParsedInvoice[] {
  const found: { iso: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const iso = m[1]
      ? isoDate(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2]))
      : m[5]
        ? isoDate(Number(m[6]), MONTHS.indexOf(m[5].toLowerCase()) + 1, Number(m[4]))
        : isoDate(Number(m[7]), Number(m[8]), Number(m[9]));
    if (iso) found.push({ iso, start: m.index, end: m.index + m[0].length });
  }

  const out: ParsedInvoice[] = [];
  found.forEach((f, i) => {
    const rest = text.slice(f.end, found[i + 1]?.start ?? text.length);
    const amount = AMOUNT_RE.exec(rest);
    if (!amount) return;
    const value = Number(amount[2].replace(/,/g, ""));
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return;
    const status = STATUS_RE.exec(rest)?.[1].toLowerCase();
    out.push({
      billedOn: f.iso,
      amount: Math.round(value * 100) / 100,
      currency: CURRENCY[amount[1].toLowerCase()] ?? "USD",
      status: status ? STATUS[status] : "paid",
    });
  });
  return out;
}
