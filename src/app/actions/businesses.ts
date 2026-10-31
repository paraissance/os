"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/current-user";
import {
  businessInput,
  describeIssues,
  faqInput,
  fieldErrors,
  importFileSchema,
  linkInput,
  siteInput,
  subscriptionInput,
} from "@/lib/business-input";
import {
  BusinessError,
  createBusiness,
  deleteBusiness,
  deletePart,
  importBook,
  moveBusiness,
  saveFaq,
  saveLink,
  saveSite,
  saveSubscription,
  updateBusiness,
  type PartKind,
} from "@/lib/businesses";
import type { FormState } from "./form-state";

const uuid = z.uuid();
const optionalId = (v: FormDataEntryValue | null) => (typeof v === "string" && v ? v : null);

function fields(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
}

/** Known, user-facing failures become a message; anything else is a bug and is rethrown. */
function failure(err: unknown): FormState {
  if (err instanceof BusinessError) return err.field ? { error: err.message, fieldErrors: { [err.field]: err.message } } : { error: err.message };
  throw err;
}

function idOrError(value: FormDataEntryValue | null) {
  const id = optionalId(value);
  if (id !== null && !uuid.safeParse(id).success) return { bad: true as const };
  return { id };
}

/* ─── Business ────────────────────────────────────────────────────── */

export async function saveBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { id, bad } = idOrError(formData.get("id"));
  if (bad) return { error: "That business couldn't be found." };
  const parsed = businessInput.safeParse(fields(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  let saved;
  try {
    saved = id ? await updateBusiness(id, parsed.data) : await createBusiness(parsed.data);
  } catch (err) {
    return failure(err);
  }
  await logActivity({
    action: id ? "business.updated" : "business.created",
    status: "success",
    userId: user.id,
    result: `${id ? "Updated" : "Added"} ${saved.name}`,
    metadata: { slug: saved.slug },
  });
  // A new business, or a new short name, lives at a new address.
  if (!id || formData.get("slugBefore") !== saved.slug) redirect(`/businesses/${saved.slug}/edit${id ? "" : "?added=1"}`);
  refresh();
  return { message: "Saved." };
}

export async function deleteBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const { id, bad } = idOrError(formData.get("id"));
  if (bad || !id) return { error: "That business couldn't be found." };
  const removed = await deleteBusiness(id);
  if (removed) {
    await logActivity({ action: "business.deleted", status: "success", userId: user.id, result: `Deleted ${removed.name}` });
  }
  redirect("/businesses");
}

export async function moveBusinessAction(formData: FormData): Promise<void> {
  await requireUser();
  const { id, bad } = idOrError(formData.get("id"));
  const direction = formData.get("direction");
  if (bad || !id || (direction !== "up" && direction !== "down")) return;
  await moveBusiness(id, direction);
  refresh();
}

/* ─── Parts: links, questions, websites, subscriptions ────────────── */

const LABEL: Record<PartKind, string> = { link: "link", faq: "question", site: "website", subscription: "subscription" };

async function savePart(kind: PartKind, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const owner = idOrError(formData.get("businessId"));
  const part = idOrError(formData.get("id"));
  if (owner.bad || part.bad) return { error: "That item couldn't be found." };
  const values = fields(formData);
  const businessId = kind === "subscription" && values.shared === "on" ? null : owner.id;
  if (!businessId && kind !== "subscription") return { error: "That business couldn't be found." };

  try {
    let name: string;
    if (kind === "link") {
      const p = linkInput.safeParse(values);
      if (!p.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
      name = (await saveLink(businessId!, part.id, p.data)).label;
    } else if (kind === "faq") {
      const p = faqInput.safeParse(values);
      if (!p.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
      name = (await saveFaq(businessId!, part.id, p.data)).question;
    } else if (kind === "site") {
      const p = siteInput.safeParse(values);
      if (!p.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
      name = (await saveSite(businessId!, part.id, p.data)).domain;
    } else {
      const p = subscriptionInput.safeParse(values);
      if (!p.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(p.error) };
      name = (await saveSubscription(businessId, part.id, p.data)).name;
    }
    await logActivity({
      action: `business.${kind}_${part.id ? "updated" : "added"}`,
      status: "success",
      userId: user.id,
      result: `${part.id ? "Updated" : "Added"} ${LABEL[kind]}: ${name}`,
    });
  } catch (err) {
    return failure(err);
  }
  refresh();
  return { message: "Saved." };
}

export async function saveLinkAction(_prev: FormState, formData: FormData) {
  return savePart("link", formData);
}
export async function saveFaqAction(_prev: FormState, formData: FormData) {
  return savePart("faq", formData);
}
export async function saveSiteAction(_prev: FormState, formData: FormData) {
  return savePart("site", formData);
}
export async function saveSubscriptionAction(_prev: FormState, formData: FormData) {
  return savePart("subscription", formData);
}

export async function deletePartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const kind = formData.get("kind");
  const { id, bad } = idOrError(formData.get("id"));
  if (bad || !id || typeof kind !== "string" || !(kind in LABEL)) return { error: "That item couldn't be found." };
  const removed = await deletePart(kind as PartKind, id);
  if (removed) {
    await logActivity({ action: `business.${kind}_deleted`, status: "success", userId: user.id, result: `Deleted a ${LABEL[kind as PartKind]}` });
  }
  refresh();
  return { message: "Deleted." };
}

/* ─── Import ──────────────────────────────────────────────────────── */

const MAX_IMPORT_BYTES = 900_000;

export async function importBusinessesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .json file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "That file is too big (over 900 KB)." };

  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const parsed = importFileSchema.safeParse(json);
  if (!parsed.success) {
    return { error: ["The file couldn't be imported:", ...describeIssues(parsed.error, json)].join("\n") };
  }

  let summary;
  try {
    summary = await importBook(parsed.data);
  } catch (err) {
    return failure(err);
  }
  const parts = [
    summary.created.length ? `added ${summary.created.length}` : null,
    summary.updated.length ? `updated ${summary.updated.length}` : null,
    summary.shared !== null ? `${summary.shared} shared subscription${summary.shared === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  await logActivity({
    action: "business.imported",
    status: "success",
    userId: user.id,
    result: `Imported businesses: ${parts.join(", ") || "nothing new"}`,
    metadata: { created: summary.created, updated: summary.updated, shared: summary.shared },
  });
  refresh();
  return {
    message: `Imported. ${[
      summary.created.length ? `Added: ${summary.created.join(", ")}.` : null,
      summary.updated.length ? `Updated: ${summary.updated.join(", ")}.` : null,
      summary.shared !== null ? `Shared tools: ${summary.shared}.` : null,
    ]
      .filter(Boolean)
      .join(" ")}`,
  };
}
