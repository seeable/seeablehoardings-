# SEEABLE Hoardings

A two-sided marketplace connecting hoarding **Publishers** (inventory owners) with **Viewers** (advertisers) for outdoor advertising space in Bengaluru. The MVP proves the core loop — list → discover → request → confirm — end to end, with no payment (settlement is offline).

- **Product spec:** [`docs/`](docs/) — PRD/BRD, module specs, architecture, database design, API spec, UI/UX (9 files).
- **Build roadmap:** [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) — 14 phases, every decision resolved.
- **Status:** Phase 0 (project foundation) complete.

## Stack

| Layer                 | Choice                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend              | Next.js 16 (App Router) + TypeScript, Tailwind v4, shadcn/ui, React Hook Form, Zod                                                                             |
| Data / Auth / Storage | Supabase (PostgreSQL + Auth + Storage + Realtime) — called **directly** from client/server; a thin `/api/v1` facade adds the response envelope + error mapping |
| Scheduled jobs        | `pg_cron` inside Postgres                                                                                                                                      |
| Hosting               | Cloudflare Pages/Workers via the OpenNext adapter (`@opennextjs/cloudflare`)                                                                                   |
| Maps                  | MapLibre GL JS + MapTiler tiles                                                                                                                                |
| Testing               | Vitest (unit) + Playwright (E2E)                                                                                                                               |
| CI/CD                 | GitHub Actions → Cloudflare                                                                                                                                    |

The whole MVP runs on free tiers. See [`docs/seeable_free_first_techstack.md`](docs/seeable_free_first_techstack.md).

## Local development

**Prerequisites:** Node 20+ (22 recommended — see `.nvmrc`), npm 10+. Docker Desktop is only needed for a local Supabase DB (`supabase start`).

```bash
npm install
cp .env.example .env.local     # then fill in real Supabase values (see below)
npm run dev                    # http://localhost:3000
```

Until you create a Supabase project, `.env.local` ships with placeholder values so the app still builds — `/api/health` will report `degraded`, which is expected.

### Connecting Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Project Settings → API → copy the **Project URL**, the **anon/publishable key**, and the **service_role key**.
3. Put them in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   SUPABASE_PROJECT_REF=<ref>
   ```
4. Migrations land in `supabase/migrations/` in Phase 1. Apply them with `npx supabase db push` (remote) or `npx supabase start && npx supabase db reset` (local Docker).

### Deploying to Cloudflare

1. Create a Cloudflare account; in the dashboard create a **Pages/Workers** project (or let `npm run cf:deploy` create it).
2. Set the env vars in the Cloudflare project settings (mirror `.env.example`; `SUPABASE_SERVICE_ROLE_KEY` as an encrypted secret).
3. Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for CI deploys.
4. `npm run cf:preview` runs the Workers build + a local preview; `npm run cf:deploy` ships it.

**Bundle budget:** the Cloudflare Free plan caps the Worker at 3 MiB gzipped. The Phase 0 skeleton (with `@supabase/*`, `maplibre-gl`, `react-hook-form`, `zod`) measures **~1.6 MiB gzipped** — comfortable headroom. CI reports the size on every build.

## Scripts

| Script                                          | What it does                                                  |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                                   | Next dev server                                               |
| `npm run build`                                 | Production build (`next build`)                               |
| `npm run lint`                                  | ESLint (flat config)                                          |
| `npm run typecheck`                             | `tsc --noEmit`                                                |
| `npm run test`                                  | Vitest unit/integration tests                                 |
| `npm run test:e2e`                              | Playwright E2E (builds + serves the app)                      |
| `npm run format`                                | Prettier write                                                |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext → Cloudflare                                         |
| `npm run db:types`                              | Regenerate `lib/supabase/database.types.ts` from the local DB |

## Project structure

```
app/                    Next.js App Router
  (auth) (viewer) (publisher) (admin)   role-scoped route groups
  api/health/           uptime probe (bare JSON, no envelope)
  api/v1/               the thin REST facade
components/ui/          shadcn/ui primitives (design system: docs/02)
lib/
  supabase/             server + browser + admin (service-role) clients
  api/                  envelope, error taxonomy
  env.ts / env.server.ts  zod-validated environment
modules/                per-domain logic (auth, inventory, requests, ...)
supabase/               config.toml, migrations/, seed.sql
tests/                  unit/ integration/ e2e/
docs/                   product & technical specification
```

## Key rules the code enforces

- **RLS is the enforcement layer.** Every data call runs as the caller's JWT. The service-role client (`lib/supabase/admin.ts`) bypasses RLS and is import-restricted by ESLint to the media pipeline and tooling only.
- **The core invariant:** no two overlapping requests both reach `CONFIRMED` on one hoarding — a Postgres `EXCLUDE USING gist` constraint under the `confirm_request()` function (Phase 1 / 7).
- **Disintermediation boundary:** a Viewer never sees a Publisher's phone/email/name — enforced by dedicated viewer-safe DB views, not UI hiding.
- **No payment, no SMS, no paid AI** anywhere in the MVP.
