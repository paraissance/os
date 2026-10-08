"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
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

export async function revokeOtherSessionsAction(): Promise<FormState> {
  const { user, sessionId } = await requireSession();
  const removed = await revokeOtherSessions(user.id, sessionId);
  await logActivity({
    action: "auth.sessions_revoked",
    status: "success",
    userId: user.id,
    result: `Signed out ${removed} other session${removed === 1 ? "" : "s"}`,
  });
  refresh();
  return { message: removed ? `Signed out ${removed} other session${removed === 1 ? "" : "s"}.` : "No other sessions." };
}
