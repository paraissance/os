"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { removeBrandAction, saveBrandAccountsAction } from "@/app/actions/social";
import { PLATFORM_LABELS, platformLabel } from "@/lib/social-model";
import { Alert, Badge, Button, Field, Select } from "@/components/ui/primitives";

export type ChannelOption = { key: string; platform: string; name: string; ownerId: string | null; ownerName: string | null };
export type BrandOption = { id: string; name: string; suggested: string[]; linked: string[] };

const ORDER = Object.keys(PLATFORM_LABELS);

/**
 * Pick a business and tick its accounts in Blotato. When the business has no
 * accounts yet, the ones that look like it are ticked for you.
 */
export function BrandAccountsForm({ brands, channels, initialId }: { brands: BrandOption[]; channels: ChannelOption[]; initialId: string }) {
  const startFor = (id: string) => {
    const b = brands.find((x) => x.id === id);
    return new Set(b?.linked.length ? b.linked : (b?.suggested ?? []));
  };
  const [businessId, setBusinessId] = useState(initialId);
  const [checked, setChecked] = useState(() => startFor(initialId));
  const [state, run, pending] = useActionState(saveBrandAccountsAction, undefined);
  const brand = brands.find((b) => b.id === businessId);
  const suggested = new Set(brand?.suggested ?? []);

  const groups = [...new Set(channels.map((c) => c.platform))]
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map((platform) => ({ platform, channels: channels.filter((c) => c.platform === platform) }));

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {state?.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <div className="max-w-sm">
        <Field label="Business" htmlFor="brand-business">
          <Select
            id="brand-business"
            name="businessId"
            value={businessId}
            onChange={(e) => {
              setBusinessId(e.target.value);
              setChecked(startFor(e.target.value));
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.linked.length ? " (on Social Media)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <fieldset key={g.platform} className="rounded-2xl bg-wash p-4">
            <legend className="sr-only">{platformLabel(g.platform)}</legend>
            <p aria-hidden="true" className="mb-2 text-sm font-extrabold">
              {platformLabel(g.platform)}
            </p>
            <ul className="space-y-1">
              {g.channels.map((c) => {
                const elsewhere = c.ownerId && c.ownerId !== businessId ? c.ownerName : null;
                return (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-paper">
                      <input
                        type="checkbox"
                        name="channel"
                        value={c.key}
                        checked={checked.has(c.key)}
                        onChange={(e) => {
                          const next = new Set(checked);
                          if (e.target.checked) next.add(c.key);
                          else next.delete(c.key);
                          setChecked(next);
                        }}
                        className="mt-1 size-4 shrink-0 accent-black"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
                          <span className="break-all">{c.name}</span>
                          {suggested.has(c.key) ? <Badge>Looks like it</Badge> : null}
                        </span>
                        {elsewhere ? <span className="block text-xs text-muted">Now with {elsewhere}: ticking moves it here</span> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-sm text-muted">{checked.size} ticked</span>
        <Button type="submit" disabled={pending || !checked.size}>
          {pending ? "Saving…" : "Save accounts"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveBrandButton({ businessId, name }: { businessId: string; name: string }) {
  const [state, run, pending] = useActionState(removeBrandAction, undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Take ${name} off Social Media? Its posts stay in Blotato.`)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="businessId" value={businessId} />
      {state?.error ? <span className="text-sm font-semibold">{state.error}</span> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Removing…" : `Take ${name} off Social Media`}
      </Button>
    </form>
  );
}
