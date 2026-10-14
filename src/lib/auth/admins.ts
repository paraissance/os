import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, validatePasswordStrength } from "./password";
import { normalizeEmail } from "./tokens";

/*
 * Super admins: everyone who can sign in. The owner (made at setup) is the
 * default one and stays; the others are added and removed in Settings.
 * Removing one deletes their sessions with them, so they're signed out at once.
 */

export class AdminError extends Error {}

export const adminInput = z
  .object({
    email: z.email("Enter a valid email address.").max(254),
    name: z.string().trim().min(1, "Enter a user name.").max(80),
    password: z.string().max(500),
    confirm: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    const weak = validatePasswordStrength(v.password);
    if (weak) ctx.addIssue({ code: "custom", path: ["password"], message: weak });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });
export type AdminInput = z.infer<typeof adminInput>;

/** The owner first, then the others in the order they were added. Never the password hash. */
export async function listAdmins() {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
  return [...rows.filter((u) => u.role === "owner"), ...rows.filter((u) => u.role !== "owner")];
}

export async function addAdmin(input: AdminInput) {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (taken) throw new AdminError("That email can already sign in.");
  const [row] = await db
    .insert(users)
    .values({ email, name: input.name, passwordHash: await hashPassword(input.password), role: "admin" })
    .returning({ id: users.id, name: users.name, email: users.email });
  return row;
}

/** Removes a super admin the owner added. The owner can't be removed, and nobody removes themselves. */
export async function removeAdmin(id: string, actorId: string) {
  const db = await getDb();
  const [target] = await db.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new AdminError("That super admin was already removed.");
  if (target.role === "owner") throw new AdminError("The default super admin can't be removed.");
  if (target.id === actorId) throw new AdminError("You can't remove yourself.");
  await db.delete(users).where(eq(users.id, id));
  return target;
}
