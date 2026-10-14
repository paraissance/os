import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { invoices, type InvoiceSource } from "@/lib/db/schema";
import type { ParsedInvoice } from "@/lib/invoice-parse";

/* The invoices on the Spendings page: listed per tab, added from a paste, removed one by one. */

export type Invoice = typeof invoices.$inferSelect;

export async function listInvoices(source: InvoiceSource): Promise<Invoice[]> {
  const db = await getDb();
  return db.select().from(invoices).where(eq(invoices.source, source)).orderBy(desc(invoices.billedOn), desc(invoices.createdAt));
}

/** Adds the invoices that aren't there yet (same date and amount = same invoice). Returns how many were new. */
export async function addInvoices(source: InvoiceSource, list: ParsedInvoice[]): Promise<number> {
  if (!list.length) return 0;
  const db = await getDb();
  const added = await db
    .insert(invoices)
    .values(list.map((i) => ({ ...i, source })))
    .onConflictDoNothing()
    .returning({ id: invoices.id });
  return added.length;
}

export async function deleteInvoice(id: string, source: InvoiceSource): Promise<boolean> {
  const db = await getDb();
  const removed = await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.source, source)))
    .returning({ id: invoices.id });
  return removed.length > 0;
}
