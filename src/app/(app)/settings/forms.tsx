"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { addAdminAction, changePasswordAction, removeAdminAction, saveSettingsAction } from "@/app/actions/settings";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";

type Initial = {
  name: string;
  timezone: string;
  aiModel: string;
  aiEffort: string;
  aiInstructions: string;
};

export function SettingsForm({
  initial,
  email,
  timeZones,
  models,
  efforts,
}: {
  initial: Initial;
  email: string;
  timeZones: string[];
  models: { id: string; label: string }[];
  efforts: string[];
}) {
  const [state, action, pending] = useActionState(saveSettingsAction, undefined);
  // Controlled fields, submitted via onSubmit rather than <form action>: the
  // automatic post-action form reset would put each <select> back on the
  // option it was first rendered with, hiding what was just saved.
  const [values, setValues] = useState(initial);
  const set = (key: keyof Initial) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const err = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5 p-5">
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={err.name}>
          <Input id="name" name="name" value={values.name} onChange={set("name")} autoComplete="name" required maxLength={80} />
        </Field>
        <Field label="Email" htmlFor="email" hint="Sign-in email. Not editable yet.">
          <Input id="email" value={email} readOnly disabled />
        </Field>
      </div>
      <Field label="Time zone" htmlFor="timezone" error={err.timezone} hint="Used for dates, greetings and what Jody Core calls today.">
        <Select id="timezone" name="timezone" value={values.timezone} onChange={set("timezone")}>
          {timeZones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Model" htmlFor="aiModel" error={err.aiModel}>
          <Select id="aiModel" name="aiModel" value={values.aiModel} onChange={set("aiModel")}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Effort" htmlFor="aiEffort" error={err.aiEffort} hint="Higher effort thinks longer and costs more.">
          <Select id="aiEffort" name="aiEffort" value={values.aiEffort} onChange={set("aiEffort")}>
            {efforts.map((e) => (
              <option key={e} value={e}>
                {e[0].toUpperCase() + e.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Standing instructions"
        htmlFor="aiInstructions"
        error={err.aiInstructions}
        hint="Added to every conversation, e.g. how you like answers written. Up to 4,000 characters."
      >
        <Textarea id="aiInstructions" name="aiInstructions" value={values.aiInstructions} onChange={set("aiInstructions")} maxLength={4000} rows={5} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-5">
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <Field label="Current password" htmlFor="current" error={err.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="new-password" error={err.password} hint="At least 12 characters.">
        <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={err.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

/** Add a super admin: they sign in with the user name and password (or a code sent to the email) and can use all of JodyOS. */
export function AddAdminForm() {
  const [state, action, pending] = useActionState(addAdminAction, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <Field label="Email" htmlFor="admin-email" error={err.email} hint="Sign-in codes are sent here.">
        <Input id="admin-email" name="email" type="email" autoComplete="off" required maxLength={254} defaultValue={state?.values?.email} />
      </Field>
      <Field label="User name" htmlFor="admin-username" error={err.username} hint="They sign in with this. Letters, numbers, dots, dashes or underscores.">
        <Input id="admin-username" name="username" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={32} defaultValue={state?.values?.username} />
      </Field>
      <Field label="Password" htmlFor="admin-password" error={err.password} hint="12 characters or more.">
        <PasswordInput id="admin-password" name="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Field label="Confirm password" htmlFor="admin-confirm" error={err.confirm}>
        <PasswordInput id="admin-confirm" name="confirm" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add super admin"}
      </Button>
    </form>
  );
}

/** A plain button, not a form: before the page is interactive a click does nothing, and it always asks first. */
export function RemoveAdminButton({ id, name }: { id: string; name: string }) {
  const [state, run, pending] = useActionState(removeAdminAction, undefined);
  const remove = () => {
    if (!window.confirm(`Remove ${name}? They are signed out and can't sign in again.`)) return;
    const data = new FormData();
    data.set("id", id);
    startTransition(() => run(data));
  };
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="min-h-9 rounded-full bg-paper px-3.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-paper"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error ? (
        <span className="text-xs font-semibold" role="alert">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
