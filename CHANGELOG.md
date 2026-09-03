# Changelog

## Phase 4 — Application Foundation

The shared UI system every later screen assembles from: design tokens, the
component library, overlays, the Availability Calendar, three role nav shells,
the live SH-02 notification panel, and the client/Realtime data layer.

- **Tokens** (`app/globals.css`) — `neutral-*` status tints added; the full
  docs/02 §9.2 type scale as utility classes (`.text-h1` … `.text-overline`);
  the calendar hatch texture and the three overlay-entrance keyframes (all
  collapsed by the existing `prefers-reduced-motion` rule).
- **Primitives** (`components/ui/`) — `button` reworked to the §10.1 spec (5
  variants incl. a never-filled-red `destructive`, 3 sizes, spinner keeps
  width); new `textarea`, `select`, `search-input`, `phone-input` (fixed +91),
  `badge` (`StatusBadge` maps the real DB enums — `PENDING_REVIEW` →
  "Pending approval" vs `REQUESTED` → "Pending", §25 — plus `VerifiedBadge`),
  `skeleton`, `empty-state` (neutral / positive / filtered tone), `tabs`
  (underline + counts, arrow-key roving), `table` (sticky header, sortable
  `TH`, 44px rows), `card` gains `MetricCard`.
- **Overlays** — `modal` (+ `ConfirmDialog`), `drawer`. `hooks/use-focus-trap`
  traps Tab, closes on Esc, restores focus to the trigger; `hooks/use-mounted`
  (`useSyncExternalStore`) is the SSR portal guard; body scroll locked while open.
- **Availability Calendar** (`components/ui/availability-calendar.tsx` +
  `lib/date.ts`) — the shared month grid (PB-05, VW-03/04). Cell states
  available / held (hatch) / booked / past; range selection that re-anchors
  rather than committing across a blocked day; arrow-key navigation; a legend.
  `lib/date.ts` works on `"YYYY-MM-DD"` strings (no tz drift); "today" is IST.
- **Formatting** (`lib/format.ts`) — ₹ Indian grouping, `15 Sep 2026` (month
  normalised to 3 letters so a runtime that renders "Sept" still matches §25),
  date ranges, and supplementary-only relative / countdown strings.
- **Client + Realtime data layer** — `hooks/use-notifications` (facade fetch +
  Realtime INSERT merge, RLS-scoped; optimistic `markRead`/`markAllRead`),
  `hooks/use-request-realtime` (Realtime `requests` → `router.refresh()` +
  callback). `lib/notifications.ts` maps `type` + related ids to a role-aware
  deep link and an icon.
- **Nav shells** (`components/nav/`) — `AppShell` composes: a 240px left rail
  (`lg+`, all roles, gold active bar), a sticky top bar (bell + account menu;
  a drawer menu for Publisher `< lg`), and a Viewer bottom tab bar (`< lg`,
  three items — no Shortlist, D9). The three role-group layouts and a new
  role-aware `/account` layout render it; `components/auth/role-bar.tsx` deleted.
- **SH-02** — `NotificationBell` (Viewer + Publisher only; Admin has no panel,
  docs/05) + `NotificationsDrawer`: reverse-chronological, `surface-2` tint +
  `gold-500` dot on unread, tap → mark read + deep link, "Mark all as read",
  `aria-label` always states the count. Live via `useNotifications()`.
- **Toasts** (`components/ui/toast.tsx`, mounted in the root layout) — queue
  with max 1 visible, ~4s auto-dismiss, `aria-live`; `useToast()` →
  `success` / `error` / `info`.
- **Nav-target stubs** — `components/phase-placeholder.tsx` + thin pages for
  `/requests`, `/account`, `/publisher/hoardings`, `/publisher/requests`,
  `/admin/inventory`, `/admin/activity` (+ Discover / Overview now placeholders)
  so the wired-up shells have no dead links until those phases land.

### Deviation from the plan

- **No TanStack Query.** Server Components already do the bulk of fetching; the
  interactive surface is narrow (the bell, live request refresh, one-shot form
  mutations). The two hand-rolled Realtime hooks + the existing `api` client
  cover it in less total code and add no dependency (the Worker bundle budget,
  RISK-1, stays the reason to be frugal). If a screen later needs cache
  fan-out / dedupe, revisit then.

### Tests

- `tests/unit/` +7 files, **126 unit tests** total: `format` (Indian grouping,
  IST day math, relative/countdown), `date` (grid is 42 cells Monday-first,
  month/year wrap, leap year), `badge` (every enum → label + tone, §25
  collision, unknown → neutral), `availability-calendar` (past/booked/held not
  selectable, range re-anchor across a booked day, keyboard focus), `overlays`
  (Modal aria, Esc, backdrop vs content, focus in + restore; ConfirmDialog;
  Drawer), `toast` (max 1 visible, queue drains after 4s, error = `role=alert`),
  `notifications` (role-aware href, icon fallback), `use-notifications`
  (initial load + unread count, live INSERT prepend + dedupe, optimistic
  markRead).
- `tests/e2e/live-auth-flow.spec.ts` updated for the new shell (asserts the
  primary nav + bell render, signs out via the account menu).
- lint / typecheck / `next build` / 15 e2e green.

## Phase 3 — Access Control & Tenant Isolation

RLS is proven to be the enforcement layer, and the thin `/api/v1` facade
pattern is established. No business logic in the route layer — it adds shape
and error ergonomics only.

- **`lib/api/facade.ts` `defineRoute({ auth, role, query, body, handler })`** —
  one builder: adopt/validate `X-Request-Id` → auth (401) → role (403
  `FORBIDDEN_ROLE`) → rate-limit (429 + `Retry-After`) → validate query (400
  `INVALID_FILTER`/`INVALID_PAGINATION`) + body (422 with the full `fields` map,
  §8.2) → run as the caller's JWT → `pgErrorToApiError` (§8.5/D7) → envelope →
  one PII-safe log line. (Consolidates the plan's `withAuth`/`withRole`/… HOFs
  into a config object.)
- **`lib/api/pagination.ts`** — `parsePagination` (bounds → `INVALID_PAGINATION`,
  a past-the-end page is a valid empty result), `paginationMeta` (§9.2 shape,
  note the `pageSize` → `page_size` casing shift).
- **`lib/api/ratelimit.ts`** — in-memory token-bucket SCAFFOLD (works for local
  dev / one isolate; Phase 11 backs it with Cloudflare KV + real numbers).
- **`lib/api/authz.ts`** — the §6.5 403-vs-404 discipline: `requireRow` turns
  zero-rows-under-RLS into `RESOURCE_NOT_FOUND` without deciding "exists vs not
  yours"; `forbidNotOwner` for the visible-but-refused case.
- **Full error taxonomy** — all of §8.3 + §8.4 (media, idempotency, OTP, jobs,
  pagination/filter) with safe `ERROR_MESSAGE` defaults in `lib/api/errors.ts`.
  `lib/db/errors.ts` slimmed to share them; added `PGRST116`→404, `PGRST301`→401.
- **`lib/log.ts`** — allow-list (not deny-list) structured logger (§35.3):
  `request_id`, method, path *template*, status, latency, `error_code`, `role`,
  `user_id` (UUID), `sqlstate`. A token / email / body has no field to go in.
- **`lib/api/client.ts`** — browser `apiFetch<T>()` / `api.get|post|patch|delete`,
  unwraps the envelope, throws `ApiClientError {code, requestId, status, …}`,
  fires `seeable:unauthorized` on 401 (`AuthProvider` re-checks the session).
- **Reference endpoints** proving the toolkit: `GET /api/v1/notifications`
  (paginated, RLS-scoped, `?unread=true`), `PATCH /api/v1/notifications/{id}`
  (`is_read` only — column grant + RLS; a non-owned id → 404), and
  `GET /api/v1/auth/me` refactored onto `defineRoute`.
- **Ops:** `scripts/provision-admin.mjs` + `npm run provision:admin` +
  `docs/runbooks/admin-provisioning.md` (there is no self-service ADMIN —
  `handle_new_user` downgrades forged roles; `profiles.role` is not in the
  column grant). `scripts/assert-no-secrets-in-bundle.mjs` + a CI step after
  build.

### Tests

- `tests/unit/facade.test.ts`, `log.test.ts`, `error-taxonomy.test.ts` — 62
  unit tests total (pagination bounds/meta math, `zodFields` reports every
  field, token bucket, 403/404 helpers, logger allow-list, every §8 code has a
  status + safe message).
- **`scripts/verify-authz.mjs`** (`npm run verify:authz [-- --api]`) — the
  standing §6.6 matrix + §6.5 split against the live project, **both** via
  direct `supabase.from()`/`.rpc()` and via the facade. **31/31 pass**, incl.:
  self role-escalation blocked by the column grant; Publisher B can't
  read/edit/submit Publisher A's draft (RISK-6); Admin can't browse `requests`
  but can read all hoardings; Viewer can't confirm; notification recipient
  isolation via facade + direct; anon → 401 envelope with `X-Request-Id`; a
  well-formed client `X-Request-Id` is adopted; **Realtime**: a Viewer's
  `requests` subscription never delivers another user's row.
- Bundle scan: 19 client files, no service-role material. lint / typecheck /
  build / 5 e2e / live auth-flow all green.

## Phase 2 — Authentication (Supabase Auth, direct)

Users register and sign in entirely through Supabase Auth from the client
(api-specification.md §5.2 — no custom password system). One thin endpoint
exposes role + gates; everything else is `supabase.auth.*` directly.

- **`GET /api/v1/auth/me`** — the single source of identity + role + computed
  gates (`can_submit_listings`, `can_create_requests`, …), `Cache-Control: no-store`.
  `lib/auth/session.ts#getSessionUser()` (React `cache()`-deduped) backs it and
  every server component; `lib/auth/gates.ts#computeGates()` is pure + unit-tested.
- **`proxy.ts`** (Next 16's renamed `middleware.ts`) — `@supabase/ssr` session
  refresh on every request, CSRF `Origin`-vs-`Host` check on POST/PUT/PATCH/DELETE
  (Decision D3), and coarse route guards (`/login` for signed-out on protected
  paths; `/post-login` for signed-in on auth pages). `lib/auth/guard.ts#requireRole()`
  does the per-role check in each shell layout — wrong role → silent redirect to
  that role's own home, never a 403 page (docs/07 §22).
- **`app/auth/callback`** — OAuth + email-link PKCE exchange → role home.
  **`app/auth/signout`** — POST, clears the cookie. **`app/post-login`** — reads
  the profile (which `proxy.ts` can't) and routes by role.
- **Google OAuth = Viewer only** (your decision). `signInWithOAuth` can't set a
  role at signup, so a Google account lands as `VIEWER` via `handle_new_user`'s
  default. Publishers sign up with email + password + the role selector.
  Migration `20260904090000` makes `handle_new_user` read Google's `name` claim
  and `on conflict do nothing`.
- **Screens** (functional, design-token styled — Phase 4 swaps in the full
  `docs/02` system): AUTH-01 landing, AUTH-02 login (generic error, show/hide
  password), AUTH-03 signup (2-step: role radiogroup → form, live strength
  meter), AUTH-04 forgot + reset. Minimal `components/ui/` primitives
  (Button/Input/Field/Card/PasswordInput). `AuthProvider` client context mirrors
  `/me` off `onAuthStateChange` (powers Phase 4's bell). Stub role homes
  (`/discover`, `/publisher/dashboard`, `/publisher/verify`, `/admin/overview`).
- **MVP scope calls (documented in `lib/validation/auth.ts`):**
  - Email + password only — no phone-as-credential (Decision D5, no SMS). The
    sign-up "Mobile" field is an optional contact detail on the profile.
  - Route groups: `(viewer)` is unprefixed (`/discover`); `(publisher)` and
    `(admin)` carry a URL prefix (`/publisher/*`, `/admin/*`).
- **Hosted Supabase project changes made** (revert both for production):
  `mailer_autoconfirm = true` (demo: signup returns a session immediately,
  api-spec §5.12 "OTP off" branch) and `uri_allow_list = http://localhost:3000/**`.
- **Tests:** `tests/unit/auth.test.ts` (16 — zod schemas, `ADMIN` rejected
  client-side, `computeGates` matrix, helpers). `tests/e2e/smoke.spec.ts`
  rewritten (landing/login/signup render, protected-route redirect).
  `tests/e2e/live-auth-flow.spec.ts` — full signup→discover / signout→home /
  bad-password→error / login→discover, opt-in via `SEEABLE_E2E_LIVE=1`.
  Verified live: 8/8 auth integration checks (handle_new_user rows, forged
  `role:ADMIN` → `VIEWER`, OAuth name fallback, RLS self-read, `/me` 401) +
  the live E2E round trip. lint/typecheck/build green; 34 unit + 5 e2e pass.

### You still need to do

- **Supabase dashboard → Authentication → URL Configuration → Redirect URLs:**
  localhost is set; add your deployed `…/auth/callback` when you ship to
  Cloudflare, and consider re-enabling email confirmation for production.

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
