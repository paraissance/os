import { describe, expect, it } from "vitest";
import { invoiceTotals } from "@/lib/invoice-model";

const list = [
  { billedOn: "2026-10-15", amount: 5, status: "paid" },
  { billedOn: "2026-10-01", amount: 10.1, status: "paid" },
  { billedOn: "2026-09-01", amount: 10.2, status: "paid" },
  { billedOn: "2026-08-01", amount: 99, status: "unpaid" },
];

describe("invoices", () => {
  it("averages over the months that had a paid invoice", () => {
    // The unpaid August invoice doesn't move "paid since" back.
    expect(invoiceTotals(list)).toEqual({ total: 25.3, count: 3, monthly: 12.65, since: "2026-09-01" });
    expect(invoiceTotals([])).toEqual({ total: 0, count: 0, monthly: 0, since: null });
  });
});
