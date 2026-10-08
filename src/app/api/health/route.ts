import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Liveness for uptime checks. Public, so it reports only up/down, nothing else. */
export async function GET() {
  await connection();
  try {
    const db = await getDb();
    await db.select({ one: sql<number>`1` }).from(users).limit(1);
    return Response.json({ ok: true, db: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
