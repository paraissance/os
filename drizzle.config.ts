import { defineConfig } from "drizzle-kit";

// `npm run db:generate` turns schema changes into a new SQL migration in ./drizzle.
// It never connects to a database; `npm run db:migrate` applies migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
});
