/* What the Spendings page works out from a list of invoices (newest first). Pure, so it can be tested. */

type InvoiceRow = { billedOn: string; amount: number; status: string };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** Paid totals by calendar month, newest first, at most `limit` of them. */
export function paidByMonth(list: InvoiceRow[], limit = 6): { key: string; label: string; total: number }[] {
  const months = new Map<string, number>();
  for (const i of list) {
    if (i.status !== "paid") continue;
    const key = i.billedOn.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + i.amount);
  }
  return [...months]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([key, total]) => ({ key, label: MONTH.format(new Date(`${key}-01T00:00:00Z`)), total: Math.round(total * 100) / 100 }));
}

/** The totals across every paid invoice, and since when; the average counts only months with a paid invoice. */
export function invoiceTotals(list: InvoiceRow[]) {
  const paid = list.filter((i) => i.status === "paid");
  const total = Math.round(paid.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const months = new Set(paid.map((i) => i.billedOn.slice(0, 7))).size;
  const since = paid.map((i) => i.billedOn).sort()[0] ?? null;
  return { total, count: paid.length, monthly: months ? Math.round((total / months) * 100) / 100 : 0, since };
}
