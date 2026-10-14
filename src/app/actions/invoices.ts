"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/current-user";
import { INVOICE_SOURCES } from "@/lib/db/schema";
import { parseInvoices } from "@/lib/invoice-parse";
import { addInvoices, deleteInvoice } from "@/lib/invoices";
import type { FormState } from "./form-state";

const sourceSchema = z.enum(INVOICE_SOURCES);
const LABEL = { claude: "Chat & Code", console: "Console API" } as const;

/** Pasted text in, invoices out: only the new ones are added. */
export async function addInvoicesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const source = sourceSchema.safeParse(formData.get("source"));
  if (!source.success) return { error: "Choose where these invoices are from." };
  const text = String(formData.get("text") ?? "").slice(0, 50_000);
  const found = parseInvoices(text);
  if (!found.length) {
    return {
      error: 'No invoices found. Paste lines with a date and a total, like "Oct 1, 2026  $20.00  Paid".',
      values: { text: text.slice(0, 5000) },
    };
  }
  const added = await addInvoices(source.data, found);
  await logActivity({ action: "spending.invoices_added", status: "success", userId: user.id, result: `${LABEL[source.data]}: ${added} invoice${added === 1 ? "" : "s"} added` });
  refresh();
  const already = found.length - added;
  return {
    message: `${added ? `Added ${added} invoice${added === 1 ? "" : "s"}` : "Nothing new"}${already ? `; ${already} ${already === 1 ? "was" : "were"} already here` : ""}.`,
  };
}

export async function deleteInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = z.uuid().safeParse(formData.get("id"));
  const source = sourceSchema.safeParse(formData.get("source"));
  if (!id.success || !source.success) return { error: "That invoice couldn't be found." };
  if (await deleteInvoice(id.data, source.data)) {
    await logActivity({ action: "spending.invoice_deleted", status: "success", userId: user.id, result: `${LABEL[source.data]}: removed an invoice` });
  }
  refresh();
  return { message: "Removed." };
}
