import "server-only";
import { asc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, validatePasswordStrength } from "./password";
import { normalizeEmail } from "./tokens";
import { usernameSchema } from "./usernames";

/*
 * Super admins: everyone who can sign in. The owner (made at setup) is the
 * default one and stays; the others are added and removed in Settings.
 * Removing one deletes their sessions with them, so they're signed out at once.
 */

export class AdminError extends Error {
  constructor(
    message: string,
    /** The form field the problem belongs to, if any. */
    readonly field?: "email" | "username",
  ) {
    super(message);
  }
}

export const adminInput = z
  .object({
    email: z.email("Enter a valid email address.").max(254),
    username: usernameSchema,
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
    .select({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
  return [...rows.filter((u) => u.role === "owner"), ...rows.filter((u) => u.role !== "owner")];
}

/** The default super admin's name ("Jody"): what JodyOS calls everyone. Null before setup. */
export async function ownerName(): Promise<string | null> {
  const db = await getDb();
  const [owner] = await db.select({ name: users.name }).from(users).where(eq(users.role, "owner")).limit(1);
  return owner?.name ?? null;
}

/** A new super admin is called by the owner's name (Jody); the user name is only what they sign in with. */
export async function addAdmin(input: AdminInput) {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const taken = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, input.username)));
  if (taken.some((t) => t.email === email)) throw new AdminError("That email can already sign in.", "email");
  if (taken.some((t) => t.username === input.username)) throw new AdminError("That user name is taken.", "username");
  const name = (await ownerName()) ?? input.username;
  const [row] = await db
    .insert(users)
    .values({ email, username: input.username, name, passwordHash: await hashPassword(input.password), role: "admin" })
    .returning({ id: users.id, name: users.name, username: users.username, email: users.email });
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
