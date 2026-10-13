"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/ui/password-input";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Field label="Setup token" htmlFor="setup-token" error={err.setupToken} hint="The SETUP_TOKEN value from your Vercel settings.">
        <PasswordInput id="setup-token" name="setupToken" autoComplete="off" required />
      </Field>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="setup-name" error={err.name}>
          <Input id="setup-name" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
        </Field>
        <Field label="Email" htmlFor="setup-email" error={err.email}>
          <Input id="setup-email" name="email" type="email" autoComplete="username" required defaultValue={state?.values?.email} />
        </Field>
        <Field label="Password" htmlFor="setup-password" error={err.password} hint="12 characters or more.">
          <PasswordInput id="setup-password" name="password" autoComplete="new-password" required minLength={12} />
        </Field>
        <Field label="Confirm password" htmlFor="setup-confirm" error={err.confirm}>
          <PasswordInput id="setup-confirm" name="confirm" autoComplete="new-password" required />
        </Field>
      </div>
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create owner account →"}
      </Button>
    </form>
  );
}
