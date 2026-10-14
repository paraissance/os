import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { MIGRATIONS_FOLDER } from "@/lib/db";
import { AdminError, addAdmin, adminInput, listAdmins, ownerName, removeAdmin } from "@/lib/auth/admins";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, validateSessionToken } from "@/lib/auth/sessions";
import { users } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

const good = { email: "Second@Example.com", username: " Sam ", password: "a long enough password", confirm: "a long enough password" };

describe("super admin input", () => {
  it("needs a real email, a valid user name, a strong password and a matching confirmation", () => {
    expect(adminInput.parse(good)).toMatchObject({ email: "Second@Example.com", username: "sam" });
    const errors = (over: Partial<typeof good>) => {
      const r = adminInput.safeParse({ ...good, ...over });
      return r.success ? [] : r.error.issues.map((i) => i.path[0]);
    };
    expect(errors({ email: "not-an-email" })).toEqual(["email"]);
    expect(errors({ username: "  " })).toEqual(["username"]);
    expect(errors({ username: "sam smith" })).toEqual(["username"]);
    expect(errors({ password: "short", confirm: "short" })).toEqual(["password"]);
    expect(errors({ confirm: "something else entirely" })).toEqual(["confirm"]);
  });
});

describe("super admins (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let ownerId: string;

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const [u] = await ctx.db
      .insert(users)
      .values({ email: "owner@example.com", username: "jody", name: "Jody", passwordHash: "x", role: "owner" })
      .returning({ id: users.id });
    ownerId = u.id;
  });
  afterAll(() => ctx.close());

  it("adds a super admin who signs in with a username, is called by the owner's name, and is listed after the owner", async () => {
    expect(await ownerName()).toBe("Jody");
    const added = await addAdmin(adminInput.parse(good));
    expect(added).toMatchObject({ name: "Jody", username: "sam", email: "second@example.com" });
    const list = await listAdmins();
    expect(list.map((a) => [a.username, a.role])).toEqual([
      ["jody", "owner"],
      ["sam", "admin"],
    ]);
    expect(list[0]).not.toHaveProperty("passwordHash");
    const [row] = await ctx.db.select().from(users).where(eq(users.id, added.id));
    expect(await verifyPassword(good.password, row.passwordHash)).toBe(true);
  });

  it("migration 0005 renames admins that were named after their user name, and nobody else", async () => {
    const [old] = await ctx.db.insert(users).values({ email: "old@example.com", username: "jody1234", name: "jody1234", passwordHash: "x", role: "admin" }).returning({ id: users.id });
    const [named] = await ctx.db.insert(users).values({ email: "kept@example.com", username: "kept", name: "Kept Name", passwordHash: "x", role: "admin" }).returning({ id: users.id });
    const file = readFileSync(path.join(MIGRATIONS_FOLDER, "0005_admins_called_by_owner_name.sql"), "utf8");
    await ctx.db.execute(sql.raw(file));
    const names = await ctx.db.select({ id: users.id, name: users.name }).from(users);
    expect(names.find((n) => n.id === old.id)?.name).toBe("Jody");
    expect(names.find((n) => n.id === named.id)?.name).toBe("Kept Name");
    expect(names.filter((n) => n.name === "Jody").length).toBeGreaterThanOrEqual(2); // owner untouched
    await ctx.db.delete(users).where(eq(users.email, "old@example.com"));
    await ctx.db.delete(users).where(eq(users.email, "kept@example.com"));
  });

  it("refuses an email or a user name that is already used, whatever the capitals", async () => {
    await expect(addAdmin(adminInput.parse({ ...good, email: "SECOND@example.com", username: "other" }))).rejects.toMatchObject({ field: "email" });
    await expect(addAdmin(adminInput.parse({ ...good, email: "new@example.com", username: "JODY" }))).rejects.toMatchObject({ field: "username" });
    await expect(addAdmin(adminInput.parse({ ...good, email: "owner@example.com", username: "x-y-z" }))).rejects.toThrow(AdminError);
  });

  it("removes an added super admin and signs them out; never the owner or yourself", async () => {
    const sam = (await listAdmins()).find((a) => a.role === "admin")!;
    const { token } = await createSession(sam.id);
    expect(await validateSessionToken(token)).not.toBeNull();

    await expect(removeAdmin(ownerId, sam.id)).rejects.toThrow(/default super admin/);
    await expect(removeAdmin(sam.id, sam.id)).rejects.toThrow(/yourself/);

    expect((await removeAdmin(sam.id, ownerId)).email).toBe("second@example.com");
    expect(await validateSessionToken(token)).toBeNull();
    expect((await listAdmins()).map((a) => a.username)).toEqual(["jody"]);
    await expect(removeAdmin(sam.id, ownerId)).rejects.toThrow(/already removed/);
  });
});
