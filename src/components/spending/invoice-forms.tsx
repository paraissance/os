"use client";

import { startTransition, useActionState } from "react";
import { addInvoicesAction, deleteInvoiceAction } from "@/app/actions/invoices";
import type { InvoiceSource } from "@/lib/db/schema";
import { Alert, Button, Field, Textarea } from "@/components/ui/primitives";

/** Paste the invoice list from a billing page; only new invoices are added. */
export function PasteInvoices({ source, hint }: { source: InvoiceSource; hint: string }) {
  const [state, action, pending] = useActionState(addInvoicesAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <input type="hidden" name="source" value={source} />
      <Field label="Paste invoices" htmlFor={`paste-${source}`} hint={hint}>
        <Textarea
          id={`paste-${source}`}
          name="text"
          rows={4}
          maxLength={50_000}
          placeholder={"Oct 1, 2026   $20.00   Paid\nSep 1, 2026   $20.00   Paid"}
          defaultValue={state?.values?.text}
          className="font-mono text-sm"
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add invoices"}
        </Button>
      </div>
    </form>
  );
}

/** A plain button that asks first. */
export function RemoveInvoice({ id, source, label }: { id: string; source: InvoiceSource; label: string }) {
  const [, run, pending] = useActionState(deleteInvoiceAction, undefined);
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove the invoice of ${label}`}
      onClick={() => {
        if (!window.confirm(`Remove the invoice of ${label}?`)) return;
        const data = new FormData();
        data.set("id", id);
        data.set("source", source);
        startTransition(() => run(data));
      }}
      className="min-h-8 rounded-full px-3 text-sm font-semibold text-muted transition-colors hover:bg-ink hover:text-paper"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
