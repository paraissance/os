"use client";

import { startTransition, useActionState, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  deleteBusinessAction,
  deletePartAction,
  importBusinessesAction,
  saveBusinessAction,
  saveFaqAction,
  saveLinkAction,
  saveSiteAction,
  saveSiteEditLinkAction,
  saveSubscriptionAction,
} from "@/app/actions/businesses";
import type { FormState } from "@/app/actions/form-state";
import { CATEGORIES, CYCLE_LABELS, LINK_KIND_LABELS } from "@/lib/business-input";
import type { Business, BusinessFaq, BusinessLink, BusinessSite, Subscription } from "@/lib/business-model";
import { formatMoney } from "@/lib/money";
import { Alert, Badge, Button, Field, Input, Select, Textarea, buttonClass, cx } from "@/components/ui/primitives";

/*
 * Editing a business. Every form submits through onSubmit + startTransition
 * (not <form action>), so a validation error never wipes what was typed.
 * Saved rows come back from the server through refresh().
 */

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function useForm(action: Action, onSaved?: () => void) {
  const [state, run, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.message && !result.error) onSaved?.();
    return result;
  }, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, pending, onSubmit, err: state?.fieldErrors ?? {} };
}

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="bad"><span className="whitespace-pre-line">{state.error}</span></Alert>;
  if (state?.message) return <Alert tone="ok">{state.message}</Alert>;
  return null;
}

const v = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));

/* ─── Business details ────────────────────────────────────────────── */

export function BusinessForm({ business }: { business?: Business }) {
  const { state, pending, onSubmit, err } = useForm(saveBusinessAction);
  const [name, setName] = useState(business?.name ?? "");
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Status state={state} />
      {business ? (
        <>
          <input type="hidden" name="id" value={business.id} />
          <input type="hidden" name="slugBefore" value={business.slug} />
        </>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="name" error={err.name}>
          <Input id="name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Done For You Leads" />
        </Field>
        <Field
          label="Short name"
          htmlFor="slug"
          error={err.slug}
          hint={business ? "Used in the dashboard address. Changing it changes the link." : "Optional. Made from the name if you leave it empty."}
        >
          <Input id="slug" name="slug" defaultValue={business?.slug ?? ""} maxLength={60} placeholder="dfu-leads" />
        </Field>
      </div>
      <Field label="One-line description" htmlFor="tagline" error={err.tagline}>
        <Input id="tagline" name="tagline" defaultValue={v(business?.tagline)} maxLength={200} placeholder="Real estate lead generation" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Website" htmlFor="websiteUrl" error={err.websiteUrl}>
          <Input id="websiteUrl" name="websiteUrl" defaultValue={v(business?.websiteUrl)} placeholder="example.com" inputMode="url" />
        </Field>
        <Field label="Status" htmlFor="status" error={err.status}>
          <Select id="status" name="status" defaultValue={business?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Main button text" htmlFor="ctaLabel" error={err.ctaLabel} hint="What the website asks visitors to do.">
          <Input id="ctaLabel" name="ctaLabel" defaultValue={v(business?.ctaLabel)} maxLength={80} placeholder="Book a call" />
        </Field>
        <Field label="Main button link" htmlFor="ctaUrl" error={err.ctaUrl}>
          <Input id="ctaUrl" name="ctaUrl" defaultValue={v(business?.ctaUrl)} placeholder="example.com/contact" inputMode="url" />
        </Field>
      </div>
      <Field
        label="About the business"
        htmlFor="about"
        error={err.about}
        hint='Plain text, one fact per line. Start a line with "# " to begin a new section, like "# Services".'
      >
        <Textarea id="about" name="about" defaultValue={v(business?.about)} rows={10} maxLength={20000} />
      </Field>
      <Field label="Private notes" htmlFor="notes" error={err.notes} hint="Only you see these.">
        <Textarea id="notes" name="notes" defaultValue={v(business?.notes)} rows={3} maxLength={5000} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : business ? "Save details" : "Add business"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteBusiness({ business }: { business: Business }) {
  const [state, run, pending] = useActionState(deleteBusinessAction, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!window.confirm(`Delete ${business.name}, with its websites, links, questions and subscriptions? This can't be undone.`)) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Status state={state} />
      <input type="hidden" name="id" value={business.id} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Deleting…" : `Delete ${business.name}`}
      </Button>
    </form>
  );
}

/* ─── A list of rows, each editable in place ──────────────────────── */

function DeleteButton({ kind, id, what }: { kind: string; id: string; what: string }) {
  const [, run, pending] = useActionState(deletePartAction, undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Delete ${what}?`)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="min-h-9 rounded-full px-3 text-sm font-semibold text-muted transition-colors hover:bg-ink hover:text-paper">
        {pending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}

function PartForm({
  action,
  hidden,
  submitLabel,
  onDone,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  submitLabel: string;
  onDone: () => void;
  children: (err: Record<string, string>) => ReactNode;
}) {
  const { state, pending, onSubmit, err } = useForm(action, onDone);
  return (
    <form onSubmit={onSubmit} className="animate-rise space-y-4 rounded-2xl bg-paper p-5">
      <Status state={state?.message ? undefined : state} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      {children(err)}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type Row = { id: string; summary: ReactNode; what: string };

function ItemList({
  kind,
  noun,
  rows,
  empty,
  action,
  hidden,
  fields,
  valuesFor,
}: {
  kind: "link" | "faq" | "site" | "subscription";
  noun: string;
  rows: Row[];
  empty: string;
  action: Action;
  hidden: Record<string, string>;
  fields: (values: Record<string, string>, err: Record<string, string>) => ReactNode;
  valuesFor: (id: string | null) => Record<string, string>;
}) {
  const [editing, setEditing] = useState<string | null>(null); // row id, "new" or null
  const close = () => setEditing(null);
  return (
    <div className="space-y-3">
      {rows.length ? (
        <ul className="stagger overflow-hidden rounded-2xl bg-wash">
          {rows.map((row) =>
            editing === row.id ? (
              <li key={row.id} className="p-2">
                <PartForm action={action} hidden={{ ...hidden, id: row.id }} submitLabel="Save" onDone={close}>
                  {(err) => fields(valuesFor(row.id), err)}
                </PartForm>
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b border-paper px-5 py-3.5 last:border-b-0">
                <div className="min-w-0 flex-1">{row.summary}</div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className="min-h-9 rounded-full bg-paper px-3.5 text-sm font-semibold transition-colors hover:bg-mist"
                  >
                    Edit
                  </button>
                  <DeleteButton kind={kind} id={row.id} what={row.what} />
                </div>
              </li>
            ),
          )}
        </ul>
      ) : editing !== "new" ? (
        <p className="rounded-2xl bg-wash px-5 py-4 text-muted">{empty}</p>
      ) : null}
      {editing === "new" ? (
        <div className="rounded-2xl bg-wash p-2">
          <PartForm action={action} hidden={hidden} submitLabel={`Add ${noun}`} onDone={close}>
            {(err) => fields(valuesFor(null), err)}
          </PartForm>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={buttonClass("secondary")}>
          + Add {noun}
        </button>
      )}
    </div>
  );
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

/* ─── Links ───────────────────────────────────────────────────────── */

/**
 * A business's links. With `only`, it lists and adds just that kind (the
 * Social Media page uses it for social accounts, one editor per business).
 */
export function LinksEditor({ businessId, links, only }: { businessId: string; links: BusinessLink[]; only?: BusinessLink["kind"] }) {
  const byId = new Map(links.map((l) => [l.id, l]));
  const uid = useId();
  const fid = (field: string) => `${uid}-${field}`;
  const social = only === "social";
  return (
    <ItemList
      kind="link"
      noun={social ? "account" : "link"}
      empty={social ? "No social media accounts saved yet." : "No links yet. Add pages, social profiles, login pages and tools."}
      action={saveLinkAction}
      hidden={{ businessId }}
      rows={links.map((l) => ({
        id: l.id,
        what: `the link "${l.label}"`,
        summary: (
          <>
            <p className="flex flex-wrap items-center gap-2 font-bold">
              {l.label} {only ? null : <Badge>{LINK_KIND_LABELS[l.kind]}</Badge>}
            </p>
            <p className="truncate text-sm text-muted">
              {l.note ? `${l.note} · ` : ""}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-4 hover:text-ink">
                {shortUrl(l.url)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </>
        ),
      }))}
      valuesFor={(id) => {
        const l = id ? byId.get(id) : undefined;
        return { label: v(l?.label), url: v(l?.url), kind: l?.kind ?? only ?? "page", note: v(l?.note) };
      }}
      fields={(values, err) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor={fid("label")} error={err.label}>
              <Input id={fid("label")} name="label" defaultValue={values.label} required maxLength={120} placeholder="Instagram" />
            </Field>
            <Field label="Type" htmlFor={fid("kind")} error={err.kind}>
              <Select id={fid("kind")} name="kind" defaultValue={values.kind}>
                {Object.entries(LINK_KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Web address" htmlFor={fid("url")} error={err.url}>
            <Input id={fid("url")} name="url" defaultValue={values.url} required placeholder="instagram.com/yourbusiness" inputMode="url" />
          </Field>
          <Field label="Note" htmlFor={fid("note")} error={err.note} hint={social ? "Optional, like the @handle." : "Optional, like which account it is."}>
            <Input id={fid("note")} name="note" defaultValue={values.note} maxLength={200} />
          </Field>
        </>
      )}
    />
  );
}

/* ─── Common questions ────────────────────────────────────────────── */

export function FaqsEditor({ businessId, faqs }: { businessId: string; faqs: BusinessFaq[] }) {
  const byId = new Map(faqs.map((f) => [f.id, f]));
  return (
    <ItemList
      kind="faq"
      noun="question"
      empty="No common questions yet."
      action={saveFaqAction}
      hidden={{ businessId }}
      rows={faqs.map((f) => ({
        id: f.id,
        what: "this question",
        summary: (
          <>
            <p className="font-bold">{f.question}</p>
            {f.answer ? <p className="line-clamp-2 text-sm text-muted">{f.answer}</p> : null}
          </>
        ),
      }))}
      valuesFor={(id) => {
        const f = id ? byId.get(id) : undefined;
        return { question: v(f?.question), answer: v(f?.answer), linkLabel: v(f?.linkLabel), linkUrl: v(f?.linkUrl) };
      }}
      fields={(values, err) => (
        <>
          <Field label="Question" htmlFor="faq-question" error={err.question}>
            <Input id="faq-question" name="question" defaultValue={values.question} required maxLength={300} />
          </Field>
          <Field label="Answer" htmlFor="faq-answer" error={err.answer}>
            <Textarea id="faq-answer" name="answer" defaultValue={values.answer} rows={4} maxLength={5000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link text" htmlFor="faq-link-label" error={err.linkLabel} hint="Optional.">
              <Input id="faq-link-label" name="linkLabel" defaultValue={values.linkLabel} maxLength={80} placeholder="Learn more" />
            </Field>
            <Field label="Link" htmlFor="faq-link-url" error={err.linkUrl}>
              <Input id="faq-link-url" name="linkUrl" defaultValue={values.linkUrl} inputMode="url" />
            </Field>
          </div>
        </>
      )}
    />
  );
}

/* ─── Websites ────────────────────────────────────────────────────── */

const SITE_FIELDS = [
  "domain", "url", "platform", "editUrl", "registrar", "registrarAccount", "registrarLoginUrl", "domainExpiry", "hostingProvider",
  "hostingPlan", "hostingAccount", "hostingLoginUrl", "hostingExpiry", "sslProvider", "sslExpiry", "serverIp", "nameservers",
  "lastBackup", "notes",
] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-base font-extrabold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SitesEditor({ businessId, sites }: { businessId: string; sites: BusinessSite[] }) {
  const byId = new Map(sites.map((s) => [s.id, s]));
  return (
    <ItemList
      kind="site"
      noun="website"
      empty="No websites yet. Add the domain, hosting and SSL details and where to log in."
      action={saveSiteAction}
      hidden={{ businessId }}
      rows={sites.map((s) => ({
        id: s.id,
        what: `the website ${s.domain}`,
        summary: (
          <>
            <p className="font-bold">{s.domain}</p>
            <p className="truncate text-sm text-muted">
              {[s.platform, s.hostingProvider && `hosted on ${s.hostingProvider}`, s.registrar && `domain at ${s.registrar}`].filter(Boolean).join(" · ") ||
                "No details yet"}
            </p>
          </>
        ),
      }))}
      valuesFor={(id) => {
        const s = id ? byId.get(id) : undefined;
        const out: Record<string, string> = Object.fromEntries(SITE_FIELDS.map((k) => [k, v(s?.[k])]));
        out.domainAutoRenew = s?.domainAutoRenew ? "on" : "";
        return out;
      }}
      fields={(values, err) => {
        const text = (name: (typeof SITE_FIELDS)[number], label: string, props: { placeholder?: string; hint?: string; type?: string; url?: boolean } = {}) => (
          <Field label={label} htmlFor={`site-${name}`} error={err[name]} hint={props.hint}>
            <Input
              id={`site-${name}`}
              name={name}
              type={props.type ?? "text"}
              defaultValue={values[name]}
              placeholder={props.placeholder}
              inputMode={props.url ? "url" : undefined}
            />
          </Field>
        );
        return (
          <div className="space-y-8">
            <Group title="Website">
              <div className="grid gap-4 sm:grid-cols-3">
                {text("domain", "Domain", { placeholder: "example.com" })}
                {text("url", "Address", { placeholder: "example.com", url: true })}
                {text("platform", "Built with", { placeholder: "WordPress, Kajabi…" })}
              </div>
              {text("editUrl", "Edit link", {
                url: true,
                hint: "Where you edit this website, like its Claude Code session or the WordPress admin. Websites with an edit link are listed on the Websites page.",
              })}
            </Group>
            <Group title="Domain">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("registrar", "Registrar", { placeholder: "GoDaddy" })}
                {text("registrarAccount", "Account", { hint: "Which login, not the password." })}
                {text("registrarLoginUrl", "Login page", { url: true })}
                {text("domainExpiry", "Renews on", { type: "date" })}
              </div>
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name="domainAutoRenew" defaultChecked={values.domainAutoRenew === "on"} className="size-4 accent-black" />
                Auto-renew is on
              </label>
            </Group>
            <Group title="Hosting">
              <div className="grid gap-4 sm:grid-cols-2">
                {text("hostingProvider", "Provider", { placeholder: "Bluehost" })}
                {text("hostingPlan", "Plan")}
                {text("hostingAccount", "Account", { hint: "Which login, not the password." })}
                {text("hostingLoginUrl", "Login page", { url: true })}
                {text("hostingExpiry", "Renews on", { type: "date" })}
                {text("serverIp", "Server IP")}
              </div>
            </Group>
            <Group title="Security and backups">
              <div className="grid gap-4 sm:grid-cols-3">
                {text("sslProvider", "SSL from", { placeholder: "Let's Encrypt" })}
                {text("sslExpiry", "SSL renews on", { type: "date" })}
                {text("lastBackup", "Last backup", { type: "date" })}
              </div>
            </Group>
            <Group title="Other">
              <Field label="Nameservers" htmlFor="site-nameservers" error={err.nameservers} hint="One per line.">
                <Textarea id="site-nameservers" name="nameservers" defaultValue={values.nameservers} rows={2} />
              </Field>
              <Field label="Notes" htmlFor="site-notes" error={err.notes}>
                <Textarea id="site-notes" name="notes" defaultValue={values.notes} rows={3} />
              </Field>
            </Group>
          </div>
        );
      }}
    />
  );
}

/* ─── Subscriptions ───────────────────────────────────────────────── */

/**
 * The tools a business pays for. With no businessId this edits the tools
 * shared by every business. The Spendings page shows one per business, so
 * field ids are unique per editor.
 */
export function SubscriptionsEditor({ businessId, subscriptions }: { businessId: string | null; subscriptions: Subscription[] }) {
  const byId = new Map(subscriptions.map((s) => [s.id, s]));
  const uid = useId();
  const fid = (field: string) => `${uid}-${field}`;
  return (
    <ItemList
      kind="subscription"
      noun="subscription"
      empty={businessId ? "No subscriptions for this business yet." : "No shared tools yet."}
      action={saveSubscriptionAction}
      hidden={businessId ? { businessId } : { shared: "on" }}
      rows={subscriptions.map((s) => ({
        id: s.id,
        what: s.name,
        summary: (
          <>
            <p className="flex flex-wrap items-center gap-2 font-bold">
              {s.name}
              {!s.businessId && businessId ? <Badge>Shared</Badge> : null}
            </p>
            <p className="truncate text-sm text-muted">
              {[
                `${formatMoney(s.amount, s.currency)} ${CYCLE_LABELS[s.billingCycle].toLowerCase()}`,
                CATEGORIES[s.category as keyof typeof CATEGORIES] ?? "Other",
                s.nextRenewal && `renews ${s.nextRenewal}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ),
      }))}
      valuesFor={(id) => {
        const s = id ? byId.get(id) : undefined;
        return {
          name: v(s?.name),
          category: s?.category ?? "other",
          amount: s ? String(s.amount) : "",
          billingCycle: s?.billingCycle ?? "monthly",
          currency: s?.currency ?? "USD",
          nextRenewal: v(s?.nextRenewal),
          loginUrl: v(s?.loginUrl),
          account: v(s?.account),
          notes: v(s?.notes),
          shared: s && !s.businessId ? "on" : "",
        };
      }}
      fields={(values, err) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tool or service" htmlFor={fid("name")} error={err.name}>
              <Input id={fid("name")} name="name" defaultValue={values.name} required maxLength={120} placeholder="Canva" />
            </Field>
            <Field label="Category" htmlFor={fid("category")} error={err.category}>
              <Select id={fid("category")} name="category" defaultValue={values.category}>
                {Object.entries(CATEGORIES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price" htmlFor={fid("amount")} error={err.amount}>
              <Input id={fid("amount")} name="amount" defaultValue={values.amount} inputMode="decimal" placeholder="29.99" />
            </Field>
            <Field label="Billed" htmlFor={fid("cycle")} error={err.billingCycle}>
              <Select id={fid("cycle")} name="billingCycle" defaultValue={values.billingCycle}>
                {Object.entries(CYCLE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Currency" htmlFor={fid("currency")} error={err.currency}>
              <Input id={fid("currency")} name="currency" defaultValue={values.currency} maxLength={3} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Next payment" htmlFor={fid("renewal")} error={err.nextRenewal}>
              <Input id={fid("renewal")} name="nextRenewal" type="date" defaultValue={values.nextRenewal} />
            </Field>
            <Field label="Login page" htmlFor={fid("login")} error={err.loginUrl}>
              <Input id={fid("login")} name="loginUrl" defaultValue={values.loginUrl} inputMode="url" />
            </Field>
          </div>
          <Field label="Account" htmlFor={fid("account")} error={err.account} hint="Which login, not the password.">
            <Input id={fid("account")} name="account" defaultValue={values.account} maxLength={200} />
          </Field>
          <Field label="Notes" htmlFor={fid("notes")} error={err.notes}>
            <Textarea id={fid("notes")} name="notes" defaultValue={values.notes} rows={2} maxLength={2000} />
          </Field>
          {businessId ? (
            <label className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="shared" defaultChecked={values.shared === "on"} className="size-4 accent-black" />
              Shared by all businesses
            </label>
          ) : null}
        </>
      )}
    />
  );
}

/* ─── Websites page ───────────────────────────────────────────────── */

export type SiteChoice = { id: string; label: string; editUrl: string | null };

/** Pick one of the businesses' websites and paste where it's edited. The link box follows the website picked. */
export function WebsiteLinkForm({ sites }: { sites: SiteChoice[] }) {
  const firstFree = sites.find((s) => !s.editUrl) ?? sites[0];
  const [siteId, setSiteId] = useState(firstFree?.id ?? "");
  const [url, setUrl] = useState(firstFree?.editUrl ?? "");
  const { state, pending, onSubmit, err } = useForm(saveSiteEditLinkAction);
  const current = sites.find((s) => s.id === siteId);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Status state={state} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Field label="Website" htmlFor="weblink-site" error={err.siteId}>
          <Select
            id="weblink-site"
            name="siteId"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setUrl(sites.find((s) => s.id === e.target.value)?.editUrl ?? "");
            }}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.editUrl ? " (listed)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Edit link" htmlFor="weblink-url" error={err.editUrl} hint="Where you edit it, like its Claude Code session. Leave it empty to take the website off this page.">
          <Input id="weblink-url" name="editUrl" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="claude.ai/code/session_…" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || (!url.trim() && !current?.editUrl)}>
          {pending ? "Saving…" : current?.editUrl && !url.trim() ? "Take off this page" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/* ─── Import ──────────────────────────────────────────────────────── */

/**
 * Pick or drop a JodyOS businesses file. With `submitOnPick` the import
 * starts as soon as a file is chosen (used on the empty dashboard).
 */
export function ImportForm({ submitOnPick = false }: { submitOnPick?: boolean }) {
  const { state, pending, onSubmit } = useForm(importBusinessesAction);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  function picked(files: FileList | null) {
    const file = files?.[0];
    setFileName(file?.name ?? null);
    if (file && submitOnPick) form.current?.requestSubmit();
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <Status state={state} />
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!input.current || !e.dataTransfer.files.length) return;
          input.current.files = e.dataTransfer.files;
          picked(e.dataTransfer.files);
        }}
        className={cx(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-paper px-5 py-8 text-center transition-[border-color,background-color,transform] duration-200 hover:border-ink",
          dragging ? "scale-[1.01] border-ink bg-wash" : fileName ? "border-ink" : "border-line",
        )}
      >
        <span className="text-lg font-bold">{pending ? "Importing…" : (fileName ?? (dragging ? "Drop it here" : "Choose or drop a .json file"))}</span>
        <span className="text-sm text-muted">
          {pending ? "Adding your businesses." : fileName ? (submitOnPick ? "One moment." : "Ready to import.") : "A JodyOS businesses file, up to 900 KB."}
        </span>
        <input
          ref={input}
          type="file"
          name="file"
          accept="application/json,.json"
          required
          className="sr-only"
          onChange={(e) => picked(e.target.files)}
        />
      </label>
      {submitOnPick ? null : (
        <Button type="submit" disabled={pending || !fileName}>
          {pending ? "Importing…" : "Import"}
        </Button>
      )}
    </form>
  );
}