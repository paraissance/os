"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";
import type { FormState } from "@/app/actions/form-state";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { SwitchTo } from "../auth-panels";

/**
 * Sign in with a code: type your email, get 6 digits by email, type them in.
 * `ready` is false until email sending is configured on the server: the form
 * still shows, with a note, and asking for a code says it can't be sent yet.
 */
export function CodeForm({ ready }: { ready: boolean }) {
  const params = useSearchParams();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [asked, ask, asking] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await requestCodeAction(prev, formData);
    if (result?.message && result.values?.email) setSentTo(result.values.email);
    return result;
  }, undefined);
  const [checked, check, checking] = useActionState(verifyCodeAction, undefined);

  if (!sentTo) {
    return (
      <form action={ask} className="space-y-5" noValidate>
        {asked?.error ? <Alert tone="bad">{asked.error}</Alert> : null}
        <Field label="Email" htmlFor="code-email" error={asked?.fieldErrors?.email}>
          <Input id="code-email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={asked?.values?.email} />
        </Field>
        <Button type="submit" className="min-h-12 w-full" disabled={asking}>
          {asking ? "Sending…" : "Send code →"}
        </Button>
        {ready ? null : (
          <p className="text-sm text-muted">
            Codes can&apos;t be emailed until email sending is switched on. Until then,{" "}
            <SwitchTo mode="login" className="font-semibold text-ink underline decoration-1 underline-offset-4">
              sign in with your password
            </SwitchTo>
            .
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-5">
      {asked?.error ? <Alert tone="bad">{asked.error}</Alert> : asked?.message ? <Alert tone="ok">{asked.message}</Alert> : null}
      <form action={check} className="space-y-5" noValidate>
        <input type="hidden" name="email" value={sentTo} />
        <input type="hidden" name="next" value={params.get("next") ?? "/"} />
        {checked?.error ? <Alert tone="bad">{checked.error}</Alert> : null}
        <Field label="6-digit code" htmlFor="code-digits" error={checked?.fieldErrors?.code}>
          <Input
            id="code-digits"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className="text-center text-2xl font-bold tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" className="min-h-12 w-full" disabled={checking}>
          {checking ? "Checking…" : "Sign in →"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={() => setSentTo(null)} className="font-semibold underline decoration-1 underline-offset-4">
          Use a different email
        </button>
        <form action={ask}>
          <input type="hidden" name="email" value={sentTo} />
          <button type="submit" disabled={asking} className="font-semibold underline decoration-1 underline-offset-4 disabled:opacity-50">
            {asking ? "Sending…" : "Send a new code"}
          </button>
        </form>
      </div>
    </div>
  );
}
