/**
 * Applies pending SQL migrations from ./drizzle.
 *  - DATABASE_URL set   -> that Postgres database (production / Vercel build).
 *  - DATABASE_URL unset -> the local PGlite database in PGLITE_DATA_DIR.
 * Run with `npm run db:migrate`. Stop `npm run dev` first when using PGlite:
 * the embedded database allows one process at a time.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const migrationsFolder = path.join(process.cwd(), "drizzle");
const url = process.env.DATABASE_URL?.trim();

async function main() {
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await migrate(drizzle(client), { migrationsFolder });
      console.log("Migrations applied to Postgres.");
    } finally {
      await client.end();
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel. Add a Postgres database and redeploy.");
  }

  const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR?.trim() || ".data/pglite");
  mkdirSync(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log(`Migrations applied to local PGlite database (${path.relative(process.cwd(), dataDir)}).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  // Message only: a connection error can embed the database URL.
  const message = err instanceof Error ? err.message : String(err);
  console.error("Migration failed:", message.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1[redacted]@"));
  process.exit(1);
});
