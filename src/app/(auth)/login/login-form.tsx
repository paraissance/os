"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="pt-2 text-center text-sm text-subtle">
        First time here?{" "}
        <Link href="/setup" className="text-accent underline-offset-4 hover:underline">
          Run setup
        </Link>
      </p>
    </form>
  );
}
