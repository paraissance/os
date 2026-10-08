import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * One query-builder type for both drivers. Postgres (production) and PGlite
 * (local development and tests: real Postgres compiled to WASM, no install)
 * expose the same Drizzle query builder. App code must stick to the builder:
 * the raw `db.execute()` result shape differs between the two drivers.
 */
export type Database = PostgresJsDatabase<typeof schema>;

type DbGlobal = typeof globalThis & {
  __jodyosDb?: Promise<Database>;
};

const g = globalThis as DbGlobal;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

async function connect(): Promise<Database> {
  const { DATABASE_URL, PGLITE_DATA_DIR } = env();

  if (DATABASE_URL) {
    // prepare:false keeps this compatible with transaction poolers (Neon, Supabase).
    const client = postgres(DATABASE_URL, { max: 5, idle_timeout: 20, prepare: false });
    return drizzlePostgres(client, { schema });
  }

  // Local development: an embedded Postgres in .data/, migrated on first use.
  const [{ PGlite }, { drizzle: drizzlePglite }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  // Local-only path: keep it out of the deploy bundle's file tracing.
  const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), PGLITE_DATA_DIR);
  // PGlite creates only the last folder of the path, so make the parents first.
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Database;
}

/** The shared database handle (one per server process, survives dev hot reloads). */
export function getDb(): Promise<Database> {
  g.__jodyosDb ??= connect().catch((err) => {
    g.__jodyosDb = undefined; // let the next request retry
    throw err;
  });
  return g.__jodyosDb;
}

/** Tests swap in an in-memory database. */
export function setDbForTests(db: Database | undefined) {
  g.__jodyosDb = db ? Promise.resolve(db) : undefined;
}

export { schema };
