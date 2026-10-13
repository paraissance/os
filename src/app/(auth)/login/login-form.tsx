"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="login-email">
        <Input id="login-email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="login-password">
        <PasswordInput id="login-password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="min-h-12 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in →"}
      </Button>
    </form>
  );
}
