# JodyOS

A private, modular AI operating system: one dashboard and one AI coordinator (Jody Core) for every brand, website, social channel, analytics account, tool and automation.

**Status: Phase 1 (Foundation) plus Businesses.** The app shell, sign-in, database, settings, activity log and a basic AI chat work today. The **dashboard** has a tab for every business: summary, about, links, money and subscriptions, and websites with renewal reminders, each in plain words. Businesses are stored and edited in JodyOS (add one by one, or import a file); the OS Analytics WordPress plugin (1.3.0+) can optionally add live leads and marketing numbers. Websites, social, analytics, tasks, automations, agents and memory show their plan and the phase that delivers them; none of them shows sample data.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the stack, data model, deployment plan and phase plan.

## Run it locally

Requirements: Node.js 22. No database install is needed: without `DATABASE_URL`, JodyOS uses an embedded Postgres (PGlite) stored in `.data/pglite`.

```bash
npm install
cp .env.example .env.local        # then set SETUP_TOKEN (and ANTHROPIC_API_KEY for the AI)
npm run dev
```

Open http://localhost:3000. You'll be sent to sign in; go to **/setup**, enter the `SETUP_TOKEN`, and create the owner account. Then delete `SETUP_TOKEN` from your environment.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then TypeScript |
| `npm test` | Unit and database tests (in-memory Postgres, no network) |
| `npm run check` | Lint, type check and test |
| `npm run db:generate` | Write a new SQL migration after changing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (to `DATABASE_URL`, or the local PGlite database) |

## Environment variables

| Variable | Needed | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string. Unset locally to use PGlite. Required on Vercel. |
| `SETUP_TOKEN` | Once | Proves you own the deployment when creating the owner account. 24+ characters. Remove after setup. |
| `ANTHROPIC_API_KEY` | For AI | Enables Jody Core. Without it the AI shows as offline. |
| `AI_MODEL` | Optional | Default model until one is picked in Settings (`claude-opus-5-5` by default). |
| `OS_ANALYTICS_URL` | Optional | Live leads and marketing numbers: the JodyOS connector endpoint from the OS Analytics plugin (Settings → JodyOS connection), e.g. `https://YOUR-SITE/wp-json/jdy/v1/os`. |
| `OS_ANALYTICS_KEY` | Optional | The connection key generated on that same card. Read-only; revoke it there at any time. |
| `PGLITE_DATA_DIR` | Optional | Local database folder (default `.data/pglite`). |

Secrets live only in environment variables. They are never sent to the browser, written to the activity log, or returned by an API.

## Deploy (GitHub + Vercel)

1. Push this repository to GitHub.
2. In Vercel: **Add New > Project**, import the repository. The framework is detected; `vercel.json` sets the build command to run database migrations, then `next build`.
3. **Storage > Create Database > Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`.
4. Add `SETUP_TOKEN` and `ANTHROPIC_API_KEY` under **Settings > Environment Variables**.
5. Deploy, open `/setup` on the production URL, create the owner account, then remove `SETUP_TOKEN` and redeploy.

Every push to `main` deploys production; other branches get preview deployments. GitHub Actions runs lint, type check, tests and a build on every push and pull request.
