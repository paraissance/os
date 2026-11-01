@AGENTS.md

# JodyOS: notes for coding agents

- Brief and plan: `docs/ARCHITECTURE.md`. Build one phase at a time; Phase 1 (Foundation) is done.
- Next.js 16 with Cache Components: request-time data (session, DB) lives in components wrapped in `<Suspense>`. Read the session with `requireUser()` / `requireSession()` from `src/lib/auth/current-user.ts` in every section, Server Action and Route Handler; the proxy is only an optimistic redirect.
- Use `requestNow()` (`src/lib/clock.ts`) for "now" in Server Components, after the session read.
- Database: Drizzle query builder only (no raw `db.execute` result parsing: the Postgres and PGlite drivers return different shapes). Schema change: edit `src/lib/db/schema.ts`, then `npm run db:generate`, and commit the SQL.
- No fake integrations or sample data. Unbuilt modules use `ModulePlaceholder`; integration status comes from real configuration.
- Log user-visible actions with `logActivity()`. Never put secrets in logs, responses or the client bundle.
- Design: black and white in a light and a dark theme. Colours only from the tokens in `globals.css` (`bg-paper` is the page and insets, `bg-wash` a card). Use the shared parts: `pillTrack`/`pillClass`, `HeroStats`, `Part`, the `hero` utility with `buttonClass("hero" | "heroSoft")`. Dense grids go by the content's width (`@5xl:`), not the window's, because the open sidebar takes room. A class passed to `buttonClass` that changes its size needs `!` (`min-h-9! px-4!`), or the base wins.
- Before committing: `npm run check` and `npm run build`.
- Windows: Node and Git live in `%LOCALAPPDATA%\Programs\xad-tools` (not on PATH).
