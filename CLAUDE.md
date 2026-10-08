@AGENTS.md

# JodyOS: notes for coding agents

- Brief and plan: `docs/ARCHITECTURE.md`. Build one phase at a time; Phase 1 (Foundation) is done.
- Next.js 16 with Cache Components: request-time data (session, DB) lives in components wrapped in `<Suspense>`. Read the session with `requireUser()` / `requireSession()` from `src/lib/auth/current-user.ts` in every section, Server Action and Route Handler; the proxy is only an optimistic redirect.
- Use `requestNow()` (`src/lib/clock.ts`) for "now" in Server Components, after the session read.
- Database: Drizzle query builder only (no raw `db.execute` result parsing: the Postgres and PGlite drivers return different shapes). Schema change: edit `src/lib/db/schema.ts`, then `npm run db:generate`, and commit the SQL.
- No fake integrations or sample data. Unbuilt modules use `ModulePlaceholder`; integration status comes from real configuration.
- Log user-visible actions with `logActivity()`. Never put secrets in logs, responses or the client bundle.
- Before committing: `npm run check` and `npm run build`.
- Windows: Node and Git live in `%LOCALAPPDATA%\Programs\xad-tools` (not on PATH).
