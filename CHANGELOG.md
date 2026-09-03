# Changelog

## Phase 1 — Database Schema, Constraints, Functions, pg_cron & Data Layer

Full PostgreSQL schema per `database-design.md` §40–§42, applied to the live
Supabase project (`cqafgkjgowdhodzqvqua`) and recorded in
`supabase_migrations.schema_migrations`.

- **14 migrations** (`supabase/migrations/20260903120000_*` … `_121200_*`):
  extensions → 11 tables → indexes → helpers → views → triggers → request-engine
  functions → inventory/admin functions → publisher/media/dashboard functions →
  RLS → grants → Realtime → pg_cron → `hoarding_types` seed.
- **The core invariant** (`requests_no_overlapping_confirmed`, `EXCLUDE USING
  gist`) ships in the first table migration, under `confirm_request()`.
  Verified: overlapping `CONFIRMED` → `23P01`; adjacent ranges accepted;
  `LIVE`/`COMPLETED` still occupy the predicate.
- **Decision D7 — SEEABLE_CODE:** every `SECURITY DEFINER` function attaches
  `DETAIL='SEEABLE_CODE=<CODE>'` to business raises. `lib/db/errors.ts`
  (`pgErrorToApiError`) reads it, with a SQLSTATE + constraint-name fallback.
  §8.4 codes the DB layer can raise added to `lib/api/errors.ts`.
- **Two NEW viewer-safe views** (`public_hoarding_listings`,
  `public_hoarding_detail`) — the disintermediation boundary. They project
  `business_name` + a verified flag only; no `profiles` join, no contact
  column. Verified: a Viewer JWT reading them sees no phone/email/name.
- **Decision D13 — pg_cron:** `seeable-expire-requests` & `-expiring-soon`
  (*/15), `-transition-live` (daily). No GitHub Actions job workflows.
- **Decision D14 — Realtime:** `notifications` + `requests` added to
  `supabase_realtime`, `replica identity full`.
- **Decision D16 — IST:** `promote_confirmed_to_live()`,
  `mark_request_completed()`, and the request past-date check compare against
  `(now() AT TIME ZONE 'Asia/Kolkata')::date`.
- **Grants hardened for Supabase's auto-ACL default:** `grants` migration
  `REVOKE ALL … FROM anon, authenticated` then re-grants exactly §41.11.
  `hoarding_media` is SELECT-granted column-by-column (Postgres ignores a
  column REVOKE under a table-level GRANT) so `original_storage_path` is
  unreadable by any client role. Scheduled-job functions: no client EXECUTE.
- **DB types** regenerated from the live schema → `lib/supabase/database.types.ts`.
- **Tests:** `tests/unit/db-errors.test.ts` (mapper, runs in CI);
  `supabase/tests/01_*` + `02_*` pgTAP (38 assertions, run via
  `npm run db:test` / `supabase test db`). Verified against the live project:
  15/15 structural + 28/28 functional integration checks + 38/38 pgTAP.
- `scripts/db-backup.mjs` — weekly logical backup (roles/schema/data split).

### Deviations from `database-design.md` §41 (all additive, documented in-file)

- `publisher_inbox` / `viewer_request_list` are `security_invoker = false`.
  With `= true` (as §41.9 writes them) the JOIN to `profiles`/`hoardings` is
  re-filtered by those tables' RLS and the view returns **zero rows** for its
  intended user. The explicit `= auth.uid()` predicate is the boundary.
- `is_hoarding_available()` is `SECURITY DEFINER` (§41.4 omits it) — a Viewer
  has no RLS grant on `hoarding_availability_blocks` and must still get a
  correct answer (matches IMPLEMENTATION-PLAN.md §Phase 1 step 7).
- `submit_hoarding_for_review()` splits "Verified AND not Suspended" and
  `delist`/`relist` split existence-vs-state, so the facade returns
  `PUBLISHER_NOT_VERIFIED` vs `PUBLISHER_SUSPENDED` etc.
- Added `default_expiring_soon_window()` and `hoarding_missing_attribute_keys()`
  helpers (D8 tunability; INVENTORY-001 error `details`).

### Open items carried forward

- `hoarding_types.required_attribute_keys` is `database-design.md` §42.1's
  reconstruction, not verified against `mvp-prd.md` §8 / `api-specification.md`
  §39.4 — reconcile before onboarding real Publishers (a data `UPDATE`, not a
  migration).
- `pgtap` extension left installed on the remote project (test-only, harmless).
- Local `supabase db reset` / `supabase test db` need Docker Desktop (not yet
  installed on the dev machine); the remote project is the source of truth.

## Phase 0 — Project Foundation

- Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui scaffold.
- Supabase clients: server (`@supabase/ssr`), browser, and service-role
  (`admin.ts`, import-restricted via ESLint).
- API foundation: standard response envelope (`{success, data, meta, request_id}`),
  error taxonomy, `route()` wrapper — `api-specification.md` §7/§8.
- `GET /api/health` — bare-JSON uptime probe (§29).
- Design tokens from `docs/02` wired into Tailwind (`app/globals.css`).
- Environment contract: `.env.example`, zod-validated `lib/env.ts` /
  `lib/env.server.ts`.
- OpenNext → Cloudflare adapter (`open-next.config.ts`, `wrangler.jsonc`,
  `cf:*` scripts).
- Supabase project structure (`supabase/config.toml`, `migrations/`, `seed.sql`).
- Testing: Vitest (unit) + Playwright (E2E) with smoke tests.
- CI: GitHub Actions — lint / typecheck / test / build / e2e / Worker bundle size.
- **RISK-1 retired:** skeleton Worker bundle measures ~1.6 MiB gzipped
  (Cloudflare Free ceiling: 3 MiB).

### Pinned deviations from `@latest`

- `typescript` pinned to `6.0.3` — `typescript-eslint` does not support TS 7 yet.
- `eslint` pinned to `^9` — `eslint-plugin-react` (bundled by `eslint-config-next`)
  is not ESLint 10 compatible yet.
