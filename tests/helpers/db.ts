import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER, setDbForTests, type Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/** A fresh in-memory Postgres with every migration applied, installed as the app database. */
export async function useTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  setDbForTests(db as unknown as Database);
  return {
    db: db as unknown as Database,
    async close() {
      setDbForTests(undefined);
      await client.close();
    },
  };
}
