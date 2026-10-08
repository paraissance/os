import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { AI_EFFORTS, AI_MODELS, DEFAULT_MODEL, isKnownModel } from "@/lib/ai/models";

const APP_SETTINGS_KEY = "app";

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const appSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, "Unknown time zone"),
  aiModel: z.enum(AI_MODELS.map((m) => m.id) as [string, ...string[]]),
  aiEffort: z.enum(AI_EFFORTS),
  aiInstructions: z.string().max(4000),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export function defaultSettings(): AppSettings {
  const configured = env().AI_MODEL;
  return {
    timezone: "UTC",
    aiModel: configured && isKnownModel(configured) ? configured : DEFAULT_MODEL,
    aiEffort: "medium",
    aiInstructions: "",
  };
}

/** Stored values merged over defaults; anything invalid falls back to its default. */
export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, APP_SETTINGS_KEY)).limit(1);
  const defaults = defaultSettings();
  if (!row || typeof row.value !== "object" || row.value === null) return defaults;
  const merged: Record<string, unknown> = { ...defaults };
  const stored = row.value as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof AppSettings)[]) {
    const field = appSettingsSchema.shape[key].safeParse(stored[key]);
    if (field.success) merged[key] = field.data;
  }
  return merged as AppSettings;
}

export async function saveSettings(next: AppSettings, userId: string) {
  const value = appSettingsSchema.parse(next);
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: APP_SETTINGS_KEY, value, updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedBy: userId, updatedAt: new Date() },
    });
  return value;
}
