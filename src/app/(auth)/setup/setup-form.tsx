"use client";

import { useActionState } from "react";
import { setupAction } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupAction, undefined);
  const err = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Field label="Setup token" htmlFor="setupToken" error={err.setupToken} hint="The SETUP_TOKEN value from your environment.">
        <Input id="setupToken" name="setupToken" type="password" autoComplete="off" required />
      </Field>
      <Field label="Your name" htmlFor="name" error={err.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={err.password} hint="At least 12 characters. A passphrase works well.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create owner account →"}
      </Button>
    </form>
  );
}
