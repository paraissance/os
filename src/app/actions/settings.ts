"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { AdminError, addAdmin, adminInput, removeAdmin } from "@/lib/auth/admins";
import { requireSession } from "@/lib/auth/current-user";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { revokeOtherSessions } from "@/lib/auth/sessions";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { consumeRateLimit, minutesUntil } from "@/lib/rate-limit";
import { appSettingsSchema, getSettings, saveSettings } from "@/lib/settings";
import type { FormState } from "./form-state";

const profileSchema = appSettingsSchema.extend({
  name: z.string().trim().min(1, "Enter your name.").max(80),
});

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    aiModel: formData.get("aiModel"),
    aiEffort: formData.get("aiEffort"),
    aiInstructions: formData.get("aiInstructions") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const { name, ...next } = parsed.data;
  const before = await getSettings();
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== before[k]);
  if (name !== user.name) changed.push("name" as never);

  const db = await getDb();
  if (name !== user.name) {
    await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));
  }
  await saveSettings(next, user.id);
  await logActivity({
    action: "settings.updated",
    status: "success",
    userId: user.id,
    result: changed.length ? `Updated ${changed.join(", ")}` : "Saved with no changes",
    metadata: { fields: changed },
  });
  refresh();
  return { message: "Settings saved." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password.").max(500),
  password: z.string().max(500),
  confirm: z.string().max(500),
});

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, sessionId } = await requireSession();
  const limit = await consumeRateLimit(`password:user:${user.id}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) return { error: `Too many attempts. Try again in ${minutesUntil(limit.resetAt)} min.` };

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Fill in every field." };
  const { current, password, confirm } = parsed.data;

  const weak = validatePasswordStrength(password);
  if (weak) return { fieldErrors: { password: weak } };
  if (password !== confirm) return { fieldErrors: { confirm: "Passwords don't match." } };

  const db = await getDb();
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    await logActivity({ action: "auth.password_change_failed", status: "failure", userId: user.id, error: "Wrong current password" });
    return { fieldErrors: { current: "That isn't your current password." } };
  }

  await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, user.id));
  const signedOut = await revokeOtherSessions(user.id, sessionId);
  await logActivity({
    action: "auth.password_changed",
    status: "success",
    userId: user.id,
    result: `Password changed; ${signedOut} other session${signedOut === 1 ? "" : "s"} signed out`,
  });
  refresh();
  return { message: "Password changed. Other devices were signed out." };
}

export async function addAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const limit = await consumeRateLimit(`admin:add:${user.id}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) return { error: `Too many attempts. Try again in ${minutesUntil(limit.resetAt)} min.` };

  // Echo back only what is safe to re-display: never the passwords.
  const values = { email: String(formData.get("email") ?? "").slice(0, 254), name: String(formData.get("name") ?? "").slice(0, 80) };
  const parsed = adminInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  try {
    const added = await addAdmin(parsed.data);
    await logActivity({ action: "auth.admin_added", status: "success", userId: user.id, result: `Added super admin ${added.name} (${added.email})` });
    refresh();
    return { message: `${added.name} is now a super admin and can sign in with ${added.email}.` };
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message, fieldErrors: { email: e.message }, values };
    throw e;
  }
}

export async function removeAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That super admin was already removed." };
  try {
    const removed = await removeAdmin(id.data, user.id);
    await logActivity({ action: "auth.admin_removed", status: "success", userId: user.id, result: `Removed super admin ${removed.email}` });
    refresh();
    return { message: `Removed ${removed.email}.` };
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
}
