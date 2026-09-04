# SEEABLE Hoardings

A two-sided marketplace connecting hoarding **Publishers** (inventory owners) with **Viewers** (advertisers) for outdoor advertising space in Bengaluru. The MVP proves the core loop — list → discover → request → confirm — end to end, with no payment (settlement is offline).

- **Product spec:** [`docs/`](docs/) — PRD/BRD, module specs, architecture, database design, API spec, UI/UX (9 files).
- **Build roadmap:** [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) — 14 phases, every decision resolved.
- **Status:** Phase 11 (Security hardening & content protection finalization) complete — CSRF same-origin check on every mutating request (`lib/api/facade.ts`), CSP/HSTS/frame-ancestors/`Permissions-Policy` headers (`next.config.ts`, verified against a real `next start` with zero console violations), `npm audit` in CI + Dependabot, `/terms` + `/privacy` pages with disclaimers wired into signup/listing-submission/request-submission, Admin content-moderation criteria + a minimal dispute runbook, and a recorded (not implemented) design for restoring server-side watermarking. Full RLS/grants/`search_path`/Realtime/rate-limit coverage from earlier phases re-verified live rather than re-built — see CHANGELOG.md. Billboard inventory import complete (out-of-sequence — see CHANGELOG.md) — 62 of 68 real site-survey photos are live, public, watermarked inventory in Discover (`npm run verify:billboards` — 8/8 live); 5 held at DRAFT by design (3 digital-type, 2 outside the single-city scope), 1 excluded pending manual classification. Phase 10 (Shared systems) complete before it — analytics events (`SEARCH`, `FILTER_USED`, `HOARDING_VIEWED`, `REQUEST_STARTED/SUBMITTED/ACCEPTED/REJECTED`, `PAGE_VIEW`) wired client-side into discovery/detail/request flows; `admin_kpis()` + `GET /api/v1/admin/kpis` for the 7 `mvp-brd.md` §14 KPIs; in-transaction notification writes re-verified. Email dispatch and storage cleanup are deferred (both optional per the plan; no Resend-in-Postgres wiring decided yet). `npm run verify:analytics` — 10/10 live. Phase 9 (Admin platform) complete before that — AD-01 Overview (4 counts, deep-links), AD-02 Publishers & Inventory (segmented control, status tabs, verify/suspend/approve/reject/delist/relist), AD-03 Verification detail (document signed-URL), AD-04 Listing review, AD-05 Activity feed. Phase 12 (Testing & QA) next.

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
4. Migrations are in `supabase/migrations/` (Phase 1). Apply with `npm run db:push` (remote — needs `supabase link` first) or `npx supabase start && npx supabase db reset` (local Docker). The Phase 1 set is already applied to the shared dev project.
5. Regenerate DB types after a schema change: `npm run db:types` (local Docker) or `npm run db:types:remote` (needs `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN`).
6. Database tests: `npm run db:test` (pgTAP via `supabase test db`, needs Docker) — `supabase/tests/*.sql`.
7. Backups: `npm run db:backup` (see `scripts/db-backup.mjs` for the `SUPABASE_DB_URL` form).

### Deploying to Cloudflare

1. Create a Cloudflare account; in the dashboard create a **Pages/Workers** project (or let `npm run cf:deploy` create it).
2. Set the env vars in the Cloudflare project settings (mirror `.env.example`; `SUPABASE_SERVICE_ROLE_KEY` as an encrypted secret).
3. Add repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for CI deploys.
4. `npm run cf:preview` runs the Workers build + a local preview; `npm run cf:deploy` ships it.

**Bundle budget:** the Cloudflare Free plan caps the Worker at 3 MiB gzipped. The Phase 0 skeleton (with `@supabase/*`, `maplibre-gl`, `react-hook-form`, `zod`) measures **~1.6 MiB gzipped** — comfortable headroom. CI reports the size on every build.

## Scripts

| Script                                          | What it does                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                                   | Next dev server                                                         |
| `npm run build`                                 | Production build (`next build`)                                         |
| `npm run lint`                                  | ESLint (flat config)                                                    |
| `npm run typecheck`                             | `tsc --noEmit`                                                          |
| `npm run test`                                  | Vitest unit/integration tests                                           |
| `npm run test:e2e`                              | Playwright E2E (builds + serves the app)                                |
| `npm run format`                                | Prettier write                                                          |
| `npm run cf:build` / `cf:preview` / `cf:deploy` | OpenNext → Cloudflare                                                   |
| `npm run db:types`                              | Regenerate `lib/supabase/database.types.ts` from the local DB           |
| `npm run verify:authz [-- --api]`               | RLS / permission-matrix harness against the live project                |
| `npm run verify:inventory`                      | Inventory gates / visibility / edit-freeze harness against the live project |
| `npm run verify:discovery`                      | Discovery filters / INVENTORY-003 / disintermediation payload harness (live) |
| `npm run verify:requests`                       | Request Engine lifecycle + concurrency (RISK-4) harness against the live project |
| `npm run verify:publisher`                      | Publisher verification / OWNER-004 / suspended-UX / document isolation (live) |
| `npm run verify:admin`                          | Admin moderation — ADMIN-001..004, two-Admin race, audit rows (live)    |
| `npm run verify:analytics`                      | Analytics RLS shape + `admin_kpis()` vs. independent SQL + notification transactionality (live) |
| `npm run import:billboards [-- --dry-run \| --only=CODE,...]` | Idempotent import of `billboards/`'s 68 site-survey photos into real inventory |
| `npm run verify:billboards`                     | Billboard-import completeness, image URLs, search visibility, RLS (live) |
| `npm run check:bundle`                          | Assert no service-role material in the client bundle (post-build)       |
| `npm run provision:admin -- <email>`            | Promote an already-registered account to `ADMIN` (see `docs/runbooks/`) |

## Project structure

```
app/                    Next.js App Router
  (auth) (viewer) (publisher) (admin)   role-scoped route groups
  api/health/           uptime probe (bare JSON, no envelope)
  api/v1/               the thin REST facade
  terms/ privacy/       static ToS / Privacy pages (Phase 11)
components/
  ui/                   design-system primitives + Calendar + overlays (docs/02)
  nav/                  the three role nav shells — AppShell, rail, tabs, bell
  notifications/        SH-02 panel
hooks/                  client hooks — use-notifications, use-request-realtime, use-focus-trap
lib/
  supabase/             server + browser + admin (service-role) clients
  api/                  envelope, error taxonomy
  date.ts / format.ts   calendar-grid + ₹/date display helpers
  inventory/            listing schema, owner projection, watermark, media validation
  discovery/            Viewer-facing card / filter / detail shapes + client
  requests/             Request resource shapes, status labels, available_actions, client
  publisher/            profile / summary derivation / verification shapes + client
  admin/                dashboard / KPIs / queue / action-feed shapes, projections, client
  analytics/            fire-and-forget analytics_events emitter (Phase 10)
  env.ts / env.server.ts  zod-validated environment
components/inventory/   the Add Hoarding wizard, media uploader, map pin picker, PB-02 table
components/discovery/   VW-01 filters + grid, VW-02 map, VW-03 detail + carousel
components/requests/    VW-04 submit modal, VW-05 my-requests, PB-06 inbox, PB-07 drawer
components/publisher/   PB-01 dashboard, PB-08 verification form + banner, SH-01 account
components/admin/       AD-01..05 — overview, publishers & inventory, review drawers, activity
components/analytics/   PageViewTracker — mounted once in the root layout
components/legal/       shared shell for /terms and /privacy (Phase 11)
supabase/               config.toml, migrations/, seed.sql
tests/                  unit/ integration/ e2e/
docs/                   product & technical specification
docs/runbooks/          admin-provisioning, content-moderation, support-disputes,
                        watermarking-variant-a-design
billboards/             68 real site-survey photos — source for `npm run import:billboards`
```

## Key rules the code enforces

- **RLS is the enforcement layer.** Every data call runs as the caller's JWT. The service-role client (`lib/supabase/admin.ts`) bypasses RLS and is import-restricted by ESLint to the media pipeline and tooling only.
- **The core invariant:** no two overlapping requests both reach `CONFIRMED` on one hoarding — a Postgres `EXCLUDE USING gist` constraint under the `confirm_request()` function (Phase 1 / 7).
- **Disintermediation boundary:** a Viewer never sees a Publisher's phone/email/name — enforced by dedicated viewer-safe DB views, not UI hiding.
- **No payment, no SMS, no paid AI** anywhere in the MVP.
