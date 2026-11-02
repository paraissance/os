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
  saveSubscriptionAction,
} from "@/app/actions/businesses";
import type { FormState } from "@/app/actions/form-state";
import { CATEGORIES, CYCLE_LABELS, LINK_KIND_LABELS } from "@/lib/business-input";
import { dayLabel, renewalSummary, type Business, type BusinessFaq, type BusinessLink, type BusinessSite, type Subscription } from "@/lib/business-model";
import { formatMoney } from "@/lib/money";
import { Alert, Badge, Button, Field, Input, Select, StatusDot, Textarea, buttonClass, cx } from "@/components/ui/primitives";

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

/** The rarely needed fields, folded away; `main` names the fields outside it, so an error on any other opens it. */
function More({ err, main, children }: { err: Record<string, string>; main: string[]; children: ReactNode }) {
  return (
    <details open={Object.entries(err).some(([name, error]) => error && !main.includes(name))} className="group/more">
      <summary className="cursor-pointer list-none text-sm font-semibold underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
        <span className="group-open/more:hidden">More details</span>
        <span className="hidden group-open/more:inline">Fewer details</span>
      </summary>
      <div className="mt-5 space-y-5">{children}</div>
    </details>
  );
}

/* ─── Business details ────────────────────────────────────────────── */

export function BusinessForm({ business }: { business?: Business }) {
  const { state, pending, onSubmit, err } = useForm(saveBusinessAction);
  const [name, setName] = useState(business?.name ?? "");
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {business ? (
        <>
          <input type="hidden" name="id" value={business.id} />
          <input type="hidden" name="slugBefore" value={business.slug} />
        </>
      ) : null}
      <Field label="Business name" htmlFor="name" error={err.name}>
        <Input id="name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Done For You Leads" />
      </Field>
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
      <Field label="About the business" htmlFor="about" error={err.about} hint='Start a line with "# " for a new section.'>
        <Textarea id="about" name="about" defaultValue={v(business?.about)} rows={10} maxLength={20000} />
      </Field>
      <More err={err} main={["name", "tagline", "websiteUrl", "status", "about"]}>
        <Field label="Short name" htmlFor="slug" error={err.slug} hint={business ? "Changing it changes the link." : "Made from the name if empty."}>
          <Input id="slug" name="slug" defaultValue={business?.slug ?? ""} maxLength={60} placeholder="dfu-leads" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Button text" htmlFor="ctaLabel" error={err.ctaLabel}>
            <Input id="ctaLabel" name="ctaLabel" defaultValue={v(business?.ctaLabel)} maxLength={80} placeholder="Book a call" />
          </Field>
          <Field label="Button link" htmlFor="ctaUrl" error={err.ctaUrl}>
            <Input id="ctaUrl" name="ctaUrl" defaultValue={v(business?.ctaUrl)} placeholder="example.com/contact" inputMode="url" />
          </Field>
        </div>
        <Field label="Private notes" htmlFor="notes" error={err.notes}>
          <Textarea id="notes" name="notes" defaultValue={v(business?.notes)} rows={3} maxLength={5000} />
        </Field>
      </More>
      {/* Docked to the card's bottom edge (its padding is cancelled here) so Save stays in reach, with the result beside it, not off-screen at the top. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 space-y-2 rounded-b-3xl border-t border-hair bg-wash/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:-mb-8 sm:px-8">
        <Status state={state} />
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : business ? "Save details" : "Add business"}
          </Button>
        </div>
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
      <Button type="submit" variant="light" disabled={pending}>
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
      <button type="submit" disabled={pending} className="shine shine-on-ink min-h-9 rounded-full px-3 text-sm font-semibold text-muted transition-colors hover:bg-ink hover:text-paper">
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

/** `group` puts a small heading above the first row of each run of rows that share it. */
type Row = { id: string; summary: ReactNode; what: string; group?: string };

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
        <ul className="stagger overflow-hidden rounded-3xl bg-wash">
          {rows.flatMap((row, i) => [
            row.group && row.group !== rows[i - 1]?.group ? (
              <li key={`group-${row.group}`} className="label border-b border-paper px-6 pb-2 pt-5 text-muted">
                {row.group}
              </li>
            ) : null,
            editing === row.id ? (
              <li key={row.id} className="p-2">
                <PartForm action={action} hidden={{ ...hidden, id: row.id }} submitLabel="Save" onDone={close}>
                  {(err) => fields(valuesFor(row.id), err)}
                </PartForm>
              </li>
            ) : (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-paper px-6 py-4 transition-colors duration-200 last:border-b-0 hover:bg-paper/40">
                <div className="min-w-0 flex-1 basis-60">{row.summary}</div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className="shine min-h-9 rounded-full bg-paper px-3.5 text-sm font-semibold transition-colors hover:bg-mist"
                  >
                    Edit
                  </button>
                  <DeleteButton kind={kind} id={row.id} what={row.what} />
                </div>
              </li>
            ),
          ])}
        </ul>
      ) : editing !== "new" ? (
        <p className="rounded-3xl bg-wash px-6 py-5 text-muted">{empty}</p>
      ) : null}
      {editing === "new" ? (
        <div className="rounded-3xl bg-wash p-2">
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

const LINK_KINDS_IN_ORDER = Object.keys(LINK_KIND_LABELS);

/** A business's links, grouped by type. */
export function LinksEditor({ businessId, links }: { businessId: string; links: BusinessLink[] }) {
  const byId = new Map(links.map((l) => [l.id, l]));
  const uid = useId();
  const fid = (field: string) => `${uid}-${field}`;
  const grouped = [...links].sort((a, b) => LINK_KINDS_IN_ORDER.indexOf(a.kind) - LINK_KINDS_IN_ORDER.indexOf(b.kind));
  return (
    <ItemList
      kind="link"
      noun="link"
      empty="No links yet."
      action={saveLinkAction}
      hidden={{ businessId }}
      rows={grouped.map((l) => ({
        id: l.id,
        what: `the link "${l.label}"`,
        group: LINK_KIND_LABELS[l.kind],
        summary: (
          <>
            <p className="font-bold">{l.label}</p>
            <p className="truncate text-sm text-muted">
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
        return { label: v(l?.label), url: v(l?.url), kind: l?.kind ?? "page", note: v(l?.note) };
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
          <Field label="Note" htmlFor={fid("note")} error={err.note}>
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
      empty="No questions yet."
      action={saveFaqAction}
      hidden={{ businessId }}
      rows={faqs.map((f) => ({
        id: f.id,
        what: "this question",
        summary: (
          <>
            <p className="font-bold">{f.question}</p>
            {f.answer ? <p className="line-clamp-1 text-sm text-muted">{f.answer}</p> : null}
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
          <More err={err} main={["question", "answer"]}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link text" htmlFor="faq-link-label" error={err.linkLabel}>
                <Input id="faq-link-label" name="linkLabel" defaultValue={values.linkLabel} maxLength={80} placeholder="Learn more" />
              </Field>
              <Field label="Link" htmlFor="faq-link-url" error={err.linkUrl}>
                <Input id="faq-link-url" name="linkUrl" defaultValue={values.linkUrl} inputMode="url" />
              </Field>
            </div>
          </More>
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

function RenewalNote({ site, today }: { site: BusinessSite; today: string }) {
  const { tone, text } = renewalSummary({ sites: [site] }, new Date(today));
  return (
    <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
      <StatusDot tone={tone} />
      {text}
    </p>
  );
}

export function SitesEditor({ businessId, sites, today }: { businessId: string; sites: BusinessSite[]; today: string }) {
  const byId = new Map(sites.map((s) => [s.id, s]));
  return (
    <ItemList
      kind="site"
      noun="website"
      empty="No websites yet."
      action={saveSiteAction}
      hidden={{ businessId }}
      rows={sites.map((s) => ({
        id: s.id,
        what: `the website ${s.domain}`,
        summary: (
          <>
            <p className="font-bold">{s.domain}</p>
            <RenewalNote site={s} today={today} />
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
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {text("domain", "Domain", { placeholder: "example.com" })}
              {text("url", "Address", { placeholder: "example.com", url: true })}
            </div>
            {text("editUrl", "Edit link", { url: true })}
            <div className="grid gap-4 sm:grid-cols-3">
              {text("domainExpiry", "Domain renews on", { type: "date" })}
              {text("hostingExpiry", "Hosting renews on", { type: "date" })}
              {text("sslExpiry", "SSL renews on", { type: "date" })}
            </div>
            <More err={err} main={["domain", "url", "editUrl", "domainExpiry", "hostingExpiry", "sslExpiry"]}>
              <Group title="Domain">
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("registrar", "Registrar", { placeholder: "GoDaddy" })}
                  {text("registrarAccount", "Account", { hint: "Which login, not the password." })}
                </div>
                {text("registrarLoginUrl", "Login page", { url: true })}
                <label className="flex items-center gap-2 text-[15px]">
                  <input type="checkbox" name="domainAutoRenew" defaultChecked={values.domainAutoRenew === "on"} className="size-4 accent-ink" />
                  Auto-renew is on
                </label>
              </Group>
              <Group title="Hosting">
                <div className="grid gap-4 sm:grid-cols-2">
                  {text("hostingProvider", "Provider", { placeholder: "Bluehost" })}
                  {text("hostingPlan", "Plan")}
                  {text("hostingAccount", "Account", { hint: "Which login, not the password." })}
                  {text("hostingLoginUrl", "Login page", { url: true })}
                  {text("serverIp", "Server IP")}
                </div>
              </Group>
              <Group title="Other">
                <div className="grid gap-4 sm:grid-cols-3">
                  {text("platform", "Built with", { placeholder: "WordPress, Kajabi…" })}
                  {text("sslProvider", "SSL from", { placeholder: "Let's Encrypt" })}
                  {text("lastBackup", "Last backup", { type: "date" })}
                </div>
                <Field label="Nameservers" htmlFor="site-nameservers" error={err.nameservers}>
                  <Textarea id="site-nameservers" name="nameservers" defaultValue={values.nameservers} rows={2} />
                </Field>
                <Field label="Notes" htmlFor="site-notes" error={err.notes}>
                  <Textarea id="site-notes" name="notes" defaultValue={values.notes} rows={3} />
                </Field>
              </Group>
            </More>
          </div>
        );
      }}
    />
  );
}

/* ─── Subscriptions ───────────────────────────────────────────────── */

/**
 * The tools a business pays for. With no businessId this edits the tools
 * shared by every business. Field ids are unique per editor, so several can
 * share a page.
 */
export function SubscriptionsEditor({ businessId, subscriptions }: { businessId: string | null; subscriptions: Subscription[] }) {
  const byId = new Map(subscriptions.map((s) => [s.id, s]));
  const uid = useId();
  const fid = (field: string) => `${uid}-${field}`;
  return (
    <ItemList
      kind="subscription"
      noun="subscription"
      empty={businessId ? "No subscriptions yet." : "No shared tools yet."}
      action={saveSubscriptionAction}
      hidden={businessId ? { businessId } : { shared: "on" }}
      rows={subscriptions.map((s) => ({
        id: s.id,
        what: s.name,
        summary: (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {s.name}
                {!s.businessId && businessId ? <Badge>Shared</Badge> : null}
              </p>
              {s.nextRenewal ? <p className="truncate text-sm text-muted">Renews {dayLabel(s.nextRenewal)}</p> : null}
            </div>
            <p className="shrink-0 text-right font-extrabold tabular-nums">
              {formatMoney(s.amount, s.currency)}
              <span className="block text-xs font-normal text-muted">{CYCLE_LABELS[s.billingCycle].toLowerCase()}</span>
            </p>
          </div>
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
          <Field label="Tool or service" htmlFor={fid("name")} error={err.name}>
            <Input id={fid("name")} name="name" defaultValue={values.name} required maxLength={120} placeholder="Canva" />
          </Field>
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
            <Field label="Next payment" htmlFor={fid("renewal")} error={err.nextRenewal}>
              <Input id={fid("renewal")} name="nextRenewal" type="date" defaultValue={values.nextRenewal} />
            </Field>
          </div>
          <More err={err} main={["name", "amount", "billingCycle", "nextRenewal"]}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor={fid("category")} error={err.category}>
                <Select id={fid("category")} name="category" defaultValue={values.category}>
                  {Object.entries(CATEGORIES).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency" htmlFor={fid("currency")} error={err.currency}>
                <Input id={fid("currency")} name="currency" defaultValue={values.currency} maxLength={3} />
              </Field>
              <Field label="Login page" htmlFor={fid("login")} error={err.loginUrl}>
                <Input id={fid("login")} name="loginUrl" defaultValue={values.loginUrl} inputMode="url" />
              </Field>
              <Field label="Account" htmlFor={fid("account")} error={err.account} hint="Which login, not the password.">
                <Input id={fid("account")} name="account" defaultValue={values.account} maxLength={200} />
              </Field>
            </div>
            <Field label="Notes" htmlFor={fid("notes")} error={err.notes}>
              <Textarea id={fid("notes")} name="notes" defaultValue={values.notes} rows={2} maxLength={2000} />
            </Field>
            {businessId ? (
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name="shared" defaultChecked={values.shared === "on"} className="size-4 accent-ink" />
                Shared by all businesses
              </label>
            ) : null}
          </More>
        </>
      )}
    />
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
          "shine flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-paper px-5 py-8 text-center transition-[border-color,background-color,scale] duration-200 hover:border-ink",
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