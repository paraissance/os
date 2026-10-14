import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseInvoices } from "@/lib/invoice-parse";
import { addInvoices, deleteInvoice, listInvoices } from "@/lib/invoices";
import { useTestDatabase } from "./helpers/db";

describe("reading pasted invoices", () => {
  it("reads a copied table, one row per line with tabs, skipping the header", () => {
    const text = "Date\tTotal\tStatus\tActions\nOct 3, 2026\t$12.50 \tPaid\tDownload PDF\nSep 3, 2026\t$1,204.00\tRefunded\tDownload PDF\n";
    expect(parseInvoices(text)).toEqual([
      { billedOn: "2026-10-03", amount: 12.5, currency: "USD", status: "paid" },
      { billedOn: "2026-09-03", amount: 1204, currency: "USD", status: "refunded" },
    ]);
  });

  it("reads one cell per line, as some browsers copy tables", () => {
    const text = "Date\nTotal\nStatus\nAug 30, 2026\n$40.00\nPaid\nDownload PDF\nJul 30, 2026\n$40.00\nOpen\nDownload PDF";
    expect(parseInvoices(text).map((i) => [i.billedOn, i.amount, i.status])).toEqual([
      ["2026-08-30", 40, "paid"],
      ["2026-07-30", 40, "unpaid"],
    ]);
  });

  it("understands other date and money styles, and leaves out what isn't an invoice", () => {
    const text = [
      "2026-06-01 €9.99 Paid",
      "1 May 2026 £20 Void",
      "April 15 2026 USD 5.5",
      "Feb 31, 2026 $10.00 Paid", // not a real date
      "Jan 5, 2026 no amount here",
      "Total spent: $999.00",
    ].join("\n");
    expect(parseInvoices(text)).toEqual([
      { billedOn: "2026-06-01", amount: 9.99, currency: "EUR", status: "paid" },
      { billedOn: "2026-05-01", amount: 20, currency: "GBP", status: "void" },
      { billedOn: "2026-04-15", amount: 5.5, currency: "USD", status: "paid" },
    ]);
    expect(parseInvoices("")).toEqual([]);
  });
});

describe("invoices (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  beforeAll(async () => (ctx = await useTestDatabase()));
  afterAll(() => ctx.close());

  it("adds only new invoices, keeps each tab separate, newest first", async () => {
    const list = parseInvoices("Oct 3, 2026 $12.50 Paid\nSep 3, 2026 $12.50 Paid");
    expect(await addInvoices("claude", list)).toBe(2);
    expect(await addInvoices("claude", [...list, ...parseInvoices("Nov 3, 2026 $14.00 Paid")])).toBe(1);
    expect(await addInvoices("console", list)).toBe(2);

    const claude = await listInvoices("claude");
    expect(claude.map((i) => [i.billedOn, i.amount])).toEqual([
      ["2026-11-03", 14],
      ["2026-10-03", 12.5],
      ["2026-09-03", 12.5],
    ]);
    expect(await addInvoices("claude", [])).toBe(0);
  });

  it("removes one invoice, only from its own tab", async () => {
    const [newest] = await listInvoices("claude");
    expect(await deleteInvoice(newest.id, "console")).toBe(false);
    expect(await deleteInvoice(newest.id, "claude")).toBe(true);
    expect((await listInvoices("claude")).length).toBe(2);
    expect((await listInvoices("console")).length).toBe(2);
  });
});
