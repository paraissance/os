/* What the Spendings page works out from a list of invoices (newest first). Pure, so it can be tested. */

type InvoiceRow = { billedOn: string; amount: number; status: string };

/** The totals across every paid invoice, and since when; the average counts only months with a paid invoice. */
export function invoiceTotals(list: InvoiceRow[]) {
  const paid = list.filter((i) => i.status === "paid");
  const total = Math.round(paid.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const months = new Set(paid.map((i) => i.billedOn.slice(0, 7))).size;
  const since = paid.map((i) => i.billedOn).sort()[0] ?? null;
  return { total, count: paid.length, monthly: months ? Math.round((total / months) * 100) / 100 : 0, since };
}
