import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { AdminError, addAdmin, adminInput, listAdmins, removeAdmin } from "@/lib/auth/admins";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, validateSessionToken } from "@/lib/auth/sessions";
import { users } from "@/lib/db/schema";
import { useTestDatabase } from "./helpers/db";

const good = { email: "Second@Example.com", name: " Sam ", password: "a long enough password", confirm: "a long enough password" };

describe("super admin input", () => {
  it("needs a real email, a name, a strong password and a matching confirmation", () => {
    expect(adminInput.parse(good)).toMatchObject({ email: "Second@Example.com", name: "Sam" });
    const errors = (over: Partial<typeof good>) => {
      const r = adminInput.safeParse({ ...good, ...over });
      return r.success ? [] : r.error.issues.map((i) => i.path[0]);
    };
    expect(errors({ email: "not-an-email" })).toEqual(["email"]);
    expect(errors({ name: "  " })).toEqual(["name"]);
    expect(errors({ password: "short", confirm: "short" })).toEqual(["password"]);
    expect(errors({ confirm: "something else entirely" })).toEqual(["confirm"]);
  });
});

describe("super admins (database)", () => {
  let ctx: Awaited<ReturnType<typeof useTestDatabase>>;
  let ownerId: string;

  beforeAll(async () => {
    ctx = await useTestDatabase();
    const [u] = await ctx.db.insert(users).values({ email: "owner@example.com", name: "Jody", passwordHash: "x", role: "owner" }).returning({ id: users.id });
    ownerId = u.id;
  });
  afterAll(() => ctx.close());

  it("adds a super admin who can sign in, and lists the owner first", async () => {
    const added = await addAdmin(adminInput.parse(good));
    expect(added).toMatchObject({ name: "Sam", email: "second@example.com" });
    const list = await listAdmins();
    expect(list.map((a) => [a.name, a.role])).toEqual([
      ["Jody", "owner"],
      ["Sam", "admin"],
    ]);
    expect(list[0]).not.toHaveProperty("passwordHash");
    const [row] = await ctx.db.select().from(users).where(eq(users.id, added.id));
    expect(await verifyPassword(good.password, row.passwordHash)).toBe(true);
  });

  it("refuses an email that can already sign in, whatever its capitals", async () => {
    await expect(addAdmin(adminInput.parse({ ...good, email: "SECOND@example.com" }))).rejects.toThrow(AdminError);
    await expect(addAdmin(adminInput.parse({ ...good, email: "owner@example.com" }))).rejects.toThrow(/already/);
  });

  it("removes an added super admin and signs them out; never the owner or yourself", async () => {
    const sam = (await listAdmins()).find((a) => a.role === "admin")!;
    const { token } = await createSession(sam.id);
    expect(await validateSessionToken(token)).not.toBeNull();

    await expect(removeAdmin(ownerId, sam.id)).rejects.toThrow(/default super admin/);
    await expect(removeAdmin(sam.id, sam.id)).rejects.toThrow(/yourself/);

    expect((await removeAdmin(sam.id, ownerId)).email).toBe("second@example.com");
    expect(await validateSessionToken(token)).toBeNull();
    expect((await listAdmins()).map((a) => a.name)).toEqual(["Jody"]);
    await expect(removeAdmin(sam.id, ownerId)).rejects.toThrow(/already removed/);
  });
});
