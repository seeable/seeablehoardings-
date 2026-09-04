# Changelog

## Phase 13 — Deployment, Launch Prep & Operations

Production infrastructure: staging-gated migration pipeline (dry-run before
production, pre-deployment backup), `pg_cron` job monitoring (staleness alert
if `expire-requests` stalls > 15 min), backup/restore procedures (weekly export,
monthly restore test), and production limits + upgrade triggers. Free-tier
headroom matrix (DB size, storage, egress, MAU, Realtime) with automatic
escalation rules documented. Launch inventory gate: 50+ approved listings
seeded across all hoarding types + geographic zones, Admin verified before
go-live. First Admin provisioned separately (no public signup). Uptime probe +
staleness monitoring live. Comprehensive on-call runbooks: troubleshooting
decision tree, degradation scenarios (Supabase down, pg_cron stalled), and
full rollback procedure (revert app code, restore DB if necessary).

## Phase 12 — Testing & QA

Deterministic test seed: ~60 listings across all 6 hoarding types (Bus Queue
Shelter, Gantry, Unipole/Billboard, Cantilever, Metro Pillar, Wall Wrap),
2+ Publishers (verified + pending), multiple Viewers, and requests in every
lifecycle state (PENDING, CONFIRMED, EXPIRED, REJECTED) with availability
blocks for date-conflict testing. Loads on `supabase db reset`.

Critical-flow E2E suite (Playwright, 6 flows): (1) Viewer discover → filter →
detail → request → Publisher accepts → Confirmed (Realtime); (2) Concurrent
date conflict (A + B request same dates → A confirmed → B fails); (3) Publisher
onboarding (signup → verification → listing wizard → Admin approval → live);
(4) Rejection workflow (Admin rejects → Publisher edits → resubmits → approved);
(5) SLA expiry (request past deadline → pg_cron expires → Realtime notifications);
(6) Suspended Publisher (listings hidden, Confirmed requests unaffected).
`npm run test:e2e` wired into CI. Integration test framework ready for 22 rule-ID
traceability coverage.

## Phase 11 — Security Hardening & Content Protection Finalization

Most of this phase's DB-layer requirements (full RLS coverage, `search_path`
pinning on every `SECURITY DEFINER` function, column grants blocking role
escalation and `original_storage_path` reads, the exclusion constraint,
`VIEWER-002`'s unique index, `hoarding-private`'s zero storage policies, the
Realtime publication scoped to exactly `notifications`+`requests`, and
100%-coverage rate limiting on every mutating endpoint) turned out to already
be satisfied by earlier phases' own discipline — re-verified against the
**live** project via direct SQL this phase, not re-implemented. What was
actually missing:

- **CSRF — `lib/api/facade.ts`**: a same-origin check (`Origin`, falling back
  to `Referer`) on every mutating request, ahead of auth. New `FORBIDDEN_ORIGIN`
  error code. **Finding while verifying it live:** Next.js 16 already refuses
  a mutating request whose `Origin` is present but doesn't match the host —
  in both `next dev` and a real `next start`, not just `allowedDevOrigins`'
  documented dev-only scope. This project's own check is what actually closes
  the gap: a request with **no** `Origin`/`Referer` at all sails past Next's
  built-in guard untouched, and Next's own rejection doesn't return this
  API's documented error envelope. Verified against a live `next start`
  server for POST/PATCH/DELETE, with and without a matching Origin.
- **Security headers — `next.config.ts`**: CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, HSTS, and a `Permissions-Policy` that
  grants only `geolocation=(self)` (the Discover "near me" filter). **Caught
  before shipping, not after:** the first CSP (`script-src 'self'`, no
  `'unsafe-inline'`) built and lint/typechecked clean but broke React
  hydration in a real `next start` — Next.js stamps inline scripts into every
  page for hydration/streaming data, and the strict directive silently
  blocked them (`Minified React error #412`, invisible without opening a
  browser console). Next's own CSP guide's nonce-based fix requires **every**
  page to render dynamically, which would pull `/terms`, `/privacy`, and this
  app's other static routes off Cloudflare's CDN cache — too large a
  trade-off for this phase to make unasked. Took Next's own documented
  fallback instead (`'unsafe-inline'` on `script-src`, kept static); the
  residual risk is bounded by this codebase having zero
  `dangerouslySetInnerHTML` calls. Re-verified with zero console CSP
  violations across `/`, `/login`, `/signup`, `/terms`, `/privacy`, and an
  authenticated `/discover` (real billboard photos, MapLibre, Supabase
  Storage images all still loading) under a real `next start`.
- **`npm audit` in CI + `.github/dependabot.yml`**: informational, not a
  merge gate — surfaced a real finding (`adm-zip` <0.6.0 via
  `@opennextjs/cloudflare`'s `rclone.js`, `GHSA-xcpc-8h2w-3j85`) whose only
  fix is a downgrade npm's own tooling calls breaking; left for a deliberate
  human call rather than auto-applied.
- **`/terms` and `/privacy`** (new static pages) plus a one-line disclaimer
  at signup, final listing submission, and request submission — copy
  grounded in `mvp-brd.md` §12/§17's own already-agreed offline-settlement
  and no-recourse-dispute language, and in what this schema actually stores
  (cross-checked against `database-design.md` and `lib/analytics/client.ts`),
  not generic boilerplate.
- **`docs/runbooks/content-moderation.md`** and **`support-disputes.md`**:
  criteria mapped to the Admin actions that already exist
  (`approve_listing`/`reject_listing`/`delist_hoarding`/`suspend_publisher`),
  plus an honest statement of what doesn't exist yet (no report button, no
  refunds, no formal appeals) rather than implying a support surface this
  MVP doesn't have.
- **`docs/runbooks/watermarking-variant-a-design.md`**: recorded, not
  implemented, per the plan's own "(Post-MVP hook)... design recorded"
  scope. Notes that the billboard-import script's `sharp`+SVG watermark
  (`scripts/import-billboards.mjs`) is a working Variant A reference — it
  runs under plain Node.js, which is exactly why it *can't* run as-is inside
  `POST /api/v1/hoardings/{id}/media`'s Cloudflare Workers runtime (no native
  addons); sketches the Supabase-Edge-Function path instead.
- **Test infra fix — `vitest.config.ts`**: aliased `server-only` to an empty
  stub. The real package throws when `window` exists, which jsdom (this
  project's test environment) always provides, so any test importing
  `lib/api/facade.ts` (which pulls in `lib/auth/session.ts`) failed outright
  — nothing had ever unit-tested the facade directly before this phase's new
  CSRF tests were the first to try. `tests/unit/facade.test.ts` (+6 tests)
  and new `tests/unit/security-headers.test.ts` (4 tests) exercise the real
  `defineRoute()` handler and the real `next.config.ts` `headers()` function,
  not re-typed expectations.
- **Not done, deliberately**: Cloudflare KV/Durable-Object-backed rate
  limiting (the existing in-memory scaffold already meets the functional
  requirement; swapping the store is an infra decision, not a code gap);
  MapTiler key domain-restriction (a dashboard setting, not repo-controlled);
  migrating the live media pipeline to Variant A (the plan's own
  "post-MVP hook," not this phase's).

## Billboard Inventory Import (out-of-sequence — ahead of Phase 11)

A user-directed addition, not part of the phased roadmap: importing the 68
real site-survey photos in `billboards/` (`SH-BB-001..063`, `SH-DB-001..003`,
`SH-BS-001`, `SH-SP-001`) as genuine, publicly-visible inventory — "a primary
MVP requirement," not seed/test data.

- **Metadata — extracted, not invented.** The photos carry a real "GPS Map
  Camera" app overlay burned into the pixels: locality, full address, exact
  lat/long, timestamp. `scripts/extract-billboard-metadata.py` (one-time,
  Python + `rapidocr-onnxruntime`, both dev-only) OCRs it into
  `scripts/billboard-metadata.json`. Getting a clean read took three passes —
  naive per-line regex → anchoring on the "GPS Map Camera" label (broke when
  background signage shared its Y-range) → the fix: every genuine overlay
  line sits at the same narrow X-position band (~0.31 or ~0.36 of image
  width, empirically) in the bottom third of the frame, regardless of what
  else is in the photo. 5 of 68 extractions were still wrong in a way regex
  couldn't catch (a brand name or vehicle plate reading as the "locality") —
  found by eye, corrected by hand, both values kept in the JSON for audit.
  Result: 49 codes with clean Karnataka geodata, 17 photos with no overlay at
  all (genuine — confirmed visually, not a parsing failure) so they carry no
  location, and 2 (`SH-BB-061/063`) with real coordinates that turn out to be
  in Tamil Nadu (Hosur), outside the platform's stated single-city scope.
  `SH-SP-001` matches no `hoarding_types` code — excluded, flagged for manual
  classification, exactly as instructed rather than guessed.
- **DB — `20260911120000_inventory_code_uniqueness`**: a partial unique index
  on `attributes->>'inventory_code'` — the durable, DB-enforced idempotency
  key `hoardings` never had a business-key column for.
- **DB — `20260911120100_service_role_grants` (a real pre-existing bug,
  found here, not introduced here):** `service_role` held only
  `TRUNCATE/TRIGGER/REFERENCES` on every public table — never
  `SELECT/INSERT/UPDATE/DELETE`. RLS bypass and Postgres GRANTs are
  orthogonal; this meant `lib/supabase/admin.ts`'s `createAdminClient()`
  could never actually read or write a table directly. Every existing use
  happened to go through a `SECURITY DEFINER` RPC (runs as the function's
  owner, immune to the caller's own grants) or Supabase Storage's own
  permission model — so this had never been exercised end-to-end until this
  import script became the first tooling to call `admin.from(...)` directly.
  **The existing `POST /api/v1/hoardings/{id}/media` route was very likely
  broken in production the same way.** Fixed by granting `service_role` the
  privileges every Supabase project's service role is meant to have, plus
  matching `ALTER DEFAULT PRIVILEGES` so future migrations inherit it. Confirmed
  before/after via `information_schema.role_table_grants`. Applied only after
  explicit confirmation (a live-database privilege change).
- **Import — `scripts/import-billboards.mjs`** (idempotent, `npm run
  import:billboards`, `--dry-run` / `--only=CODE,...` supported): validates
  the folder (68/68 files, 0 unsupported/duplicate/missing), classifies by
  prefix (`BB→UNIPOLE_BILLBOARD`, `DB→DIGITAL_BILLBOARD`,
  `BS→BUS_QUEUE_SHELTER`), creates one house Publisher
  (`inventory@seeable.internal`, business name "SEEABLE Inventory",
  pre-verified — there is no real Publisher to own showcase inventory yet),
  then per code: inserts `hoardings` (title = "`<Type>` — `<code>`",
  `attributes.inventory_code` = the exact business code, `price`/`lat`/`lng`
  left `NULL` unless the OCR'd overlay supplied them — **never a fabricated
  location or price**), server-side watermarks the photo (`sharp` + a tiled
  SVG "SEEABLE" overlay — Node has no `<canvas>`, so this reproduces
  `lib/inventory/watermark.ts`'s client-side design rather than reusing its
  code), uploads to `hoarding-public` at the same
  `{hoarding_id}/{media_id}-watermarked.jpg` path the real upload route uses,
  and inserts the `hoarding_media` row as `WATERMARKED`.
  - **Publish decision, not a rubber stamp:** the normal path to `APPROVED`
    (`submit_hoarding_for_review()`) hard-requires price + lat/lng — a gate
    this import cannot honestly satisfy for every code. Sanctioned as
    "migration / seed / provisioning tooling" per `admin.ts`'s own
    doc-comment, so it writes `hoardings` directly via the service role
    (same class of operation as the `hoarding_types` reference-data
    migration) and flips `DRAFT → APPROVED` with a direct `UPDATE` — not by
    calling `approve_listing()`, because that RPC's `admin_actions` audit
    row exists to record a human moderation decision, and attributing one to
    an Admin who never reviewed these would be dishonest. `approved_by`
    stays `NULL`.
  - **62 of 67 importable codes published** (63 `UNIPOLE_BILLBOARD` + 1
    `BUS_QUEUE_SHELTER`, minus the 2 Tamil Nadu sites). **5 held back at
    `DRAFT` by design** — 3 `DIGITAL_BILLBOARD` (taxonomy-only at MVP,
    `mvp-brd.md` §5.1 — `search_available_hoardings()` already excludes
    `is_digital` types regardless of approval status) and the 2 Tamil Nadu
    sites (real coordinates, but outside the platform's single-city scope —
    held for a product decision, not silently published or silently
    dropped). Still fully visible/manageable in Admin's "All" inventory tab
    either way.
- **Frontend — `lib/format.ts#joinLocationParts`**: a general fix, not
  billboard-specific — a location line built from
  `[address_text, locality, city]` could repeat a segment back-to-back (a
  central-Bengaluru site's OCR'd locality often reads as "Bengaluru" too,
  same as `city`). Collapses immediate repeats only; a same-named place
  further down the list still shows. `HoardingCard` + `DetailView`'s price
  line now render **"Details coming soon"** (not a bare "—") when `price` is
  `null` — the first real case of a searchable listing with no price, since
  the self-serve gate normally forces one.
- **Verify — `scripts/verify-billboards.mjs`** (`npm run verify:billboards`,
  live, re-runnable): all 67 importable codes present exactly once, every
  hoarding has a `WATERMARKED` media row, a sample of public image URLs
  actually resolve (200, `image/*`), `search_available_hoardings()` returns
  exactly the 62 published codes (no `DRAFT` leakage, exact `total_count`
  match), an anon caller cannot `approve_listing()` directly. 8/8 live.
  Verified the full path by hand too: started the dev server, signed in as a
  real Viewer, screenshotted `/discover` (62 real watermarked photos,
  "Details coming soon" pricing, inventory codes in the card titles) and a
  detail page — not just checked via API.
- **Tests:** `tests/unit/format.test.ts` +4 (`joinLocationParts`). 212 unit
  tests, lint/typecheck/build/`check:bundle` green.
- **Not done:** `SH-SP-001` (excluded, needs a human to classify it — no
  existing `hoarding_types` code fits); the 2 Tamil Nadu sites are not
  published pending a product decision on the platform's single-city scope.

## Phase 10 — Shared Systems: Analytics, Audit, Optional Email

The remainder of the async backbone. Notification delivery (Realtime, Phase 4)
and the scheduling jobs (`pg_cron`, Phase 1) already existed; this phase is
analytics events + the KPI query set + confirming the audit trail — plus a
deliberate scope call on the two pieces the plan itself marks optional.

- **Confirmed, not rebuilt** (`database-design.md` §44 / `mvp-brd.md` §14):
  `notify_request_created()` inserts both `REQUEST_CREATED` rows in the single
  `INSERT ... VALUES (...), (...)` of its own `AFTER INSERT` trigger — one
  transaction with the request itself, no separate write to fail out-of-band.
  `notify_expiring_soon_requests()` is idempotent via a `not exists` guard
  against `notifications` before it inserts. Both re-verified live in
  `verify-analytics.mjs` (ANALYTICS-005) rather than taken on faith.
- **DB — `20260910120000_kpis`**: `admin_kpis()`, a second `SECURITY DEFINER`
  admin-only aggregate alongside `admin_dashboard_summary()` (kept separate so
  a change to one can't reshape the other) — the seven `mvp-brd.md` §14 KPIs:
  publishers onboarded/verified and live approved listings reuse the same
  counts as AD-01; new here are `viewer_accounts`, `request_to_confirmation_rate`,
  `median_publisher_response_hours` (straight off `requests.confirmed_at` /
  `.rejected_at` — both already set in the same transaction as the decision by
  Phase 7's `confirm_request()` / `reject_request()`, so no join to
  `request_status_history` needed), and `repeat_viewers` / `repeat_publishers`
  (an actor with more than one request/listing of their own — usage read
  literally, not yet defined against tenure). Caught live: `percentile_cont()`
  returns `double precision`, and Postgres has no `round(double precision, int)`
  overload — the first deploy failed at call time, not at migration time; fixed
  with an explicit `::numeric` cast before rounding.
- **Backend**: `GET /api/v1/admin/kpis` — same thin-facade, `no-store` pattern
  as `/admin/dashboard`. `lib/admin/{types,projection,client}.ts` gain
  `AdminKpis` / `kpisFromRow` / `getAdminKpis`.
- **Frontend — `lib/analytics/client.ts`**: a fire-and-forget
  `emitAnalyticsEvent()` (never throws, failure is swallowed — analytics is
  best-effort, not a business path) wired into `SEARCH` + `FILTER_USED`
  (discovery), `HOARDING_VIEWED` (detail), `REQUEST_STARTED` / `_SUBMITTED`
  (submit modal), `REQUEST_ACCEPTED` / `_REJECTED` (publisher drawer), and
  `PAGE_VIEW` via a new `<PageViewTracker>` mounted once in the root layout.
  The discovery UI has no free-text search box — `SEARCH` fires on every
  result-fetch, `FILTER_USED` on the user's own filter-bar interaction, so the
  two events stay distinct without inventing UI that doesn't exist.
- **Live bug found and fixed in verification, not in the shipped client**:
  `analytics_events` is deliberately write-only for non-Admins (`insert: any`,
  `select: is_admin()`). PostgREST's implicit `RETURNING` under
  `Prefer: return=representation` re-checks the new row against the *SELECT*
  policy, so a non-Admin insert with that header fails RLS on the return, not
  the write. `lib/analytics/client.ts` never calls `.select()`, so supabase-js
  sends no `Prefer` header (PostgREST's real default is `return=minimal`) and
  is unaffected — this only broke `verify-analytics.mjs`'s own `rest()` helper,
  which defaults every call to `return=representation` (correct for every
  other table this script family touches, wrong for this one). Fixed by
  requesting `return=minimal` for that one insert.
- **Deferred, per explicit product decision** — email dispatch (`pg_net` →
  Resend) and the weekly storage-cleanup job. Both are optional in the plan's
  own Definition of Done ("the marketplace works fully without them"), and
  both need infrastructure this repo doesn't own the decision on: a live
  `RESEND_API_KEY` (added to Supabase Edge Function Secrets, not this repo) and
  a way for a `pg_cron` function to read it (Vault vs. a GUC) that hasn't been
  chosen; the cleanup job means a `pg_net` call to the Storage REST API with
  the service-role key living inside SQL. Custom SMTP for Supabase Auth itself
  is separately not configured (no verified sending domain yet). Nothing in
  this phase depends on either — `pg_net` was already installed guarded in
  Phase 1, and `RESEND_API_KEY` / `EMAIL_FROM` were already stubbed in
  `.env.example`; both stay unused until that infra decision is made.
- **Tests**: `tests/unit/analytics.test.ts` (5 — insert shape, anon `user_id`,
  default `properties`, never throws on a failed insert or a thrown client).
  `tests/unit/admin.test.ts` +3 (`kpisFromRow` mapping, null confirmation
  rate, null median). `scripts/verify-analytics.mjs` — 10/10 live: a Viewer can
  insert but not read back an `analytics_events` row (an Admin can); a non-Admin
  calling `admin_kpis()` is refused `ADMIN_ONLY`; every KPI figure cross-checked
  against an independently-written raw-SQL query over the same tables (not the
  migration's own SQL restated); seeded repeat-usage and response-time data
  land in the expected range; `REQUEST_CREATED` still fires two rows through
  the real PostgREST + trigger path. lint / typecheck / build / 208 unit tests
  green; `check:bundle` clean.

## Phase 9 — Admin Platform

The internal moderation console — AD-01..05. Every state-transition function
(`verify_publisher`, `reject_publisher_verification`, `suspend`/`unsuspend`,
`approve`/`reject_listing`, `delist`/`relist_hoarding`, `admin_dashboard_summary`)
and the `admin_actions` audit trail already existed from Phase 1; this phase is
the thin `/api/v1/admin/*` facade and the five screens.

- **DB — `20260909120000_admin_platform`**:
  - `admin_dashboard_summary()` recreated with the AD-01 metrics —
    `pending_verifications`, `live_campaigns`, `active_publishers`,
    `live_in_search_listings` — alongside every field it already returned.
    `requests` has no Admin SELECT policy (RISK / D10), so the LIVE-campaign
    count can *only* come from this `SECURITY DEFINER` aggregate.
  - `suspend_publisher` / `unsuspend_publisher` gain an "already in that state"
    guard → `409 PUBLISHER_VERIFICATION_STATE_CONFLICT` on a repeat call
    (api-spec §26.5) instead of a silent no-op UPDATE. Happy path unchanged.
- **Backend** (`lib/admin/`): thin facades, `auth: "ADMIN"` (three-layer —
  facade → route → the function's own `is_admin()`):
  - `GET /api/v1/admin/dashboard` — §24.4 shape + the AD-01 extras, `no-store`.
  - `GET /api/v1/admin/hoardings` — the approval queue *and* the full inventory
    table. `approval_status` repeatable (default `PENDING_REVIEW`), `delisted`,
    `publisher_id`, `type`, `site_intelligence_complete`; oldest-first; carries
    `review_flags` + `media_summary` + the full AD-04 review payload.
  - `POST /api/v1/admin/hoardings/{id}/delist` · `/relist`.
  - `GET /api/v1/admin/publishers` · `/{id}` — verification queue + full inventory
    table, `listing_counts`, Admin-only contact fields, `suspended_by` label.
  - `POST /api/v1/admin/publishers/{id}/verify` · `/reject-verification` ·
    `/suspend` · `/unsuspend`.
  - `GET /api/v1/admin/publishers/{id}/verification-document` — mints a 5-minute
    signed URL via `get_verification_document_path()` (the authz boundary) + the
    service role (the `publisher-private` bucket has no policy). Path added to the
    eslint service-role allowlist.
  - `GET /api/v1/admin/actions` — the AD-05 feed; `action_type` repeatable;
    `describeAction` renders each row as a plain past-tense sentence.
  - Existing `approve` / `reject` unchanged.
  - **Deliberately not built** (approved restrictions): `GET /admin/requests`,
    `POST /admin/requests/{id}/accept|reject`, `PATCH /admin/hoardings/{id}`,
    `bulk-approve`, any Admin account-management endpoint.
- **Frontend** (`components/admin/`, desktop-only — a narrow viewport gets a
  plain notice):
  - **AD-01** `OverviewView` — four counts; the three with a working
    destination deep-link into AD-02 pre-filtered; "Live campaigns" has none.
    Zero shows as "0".
  - **AD-02** `PublishersInventoryView` — a `Publishers | Listings` segmented
    control, per-sub-view status tabs, data tables. Publisher rows: Review →
    AD-03, Suspend (a `Modal` spelling out ADMIN-002 + an optional reason),
    Un-suspend (`ConfirmDialog`). Listing rows: Review → AD-04. `?view=` / `?tab=`
    in the URL (page wrapped in `<Suspense>`).
  - **AD-03** `PublisherVerificationDrawer` — business info + full contact +
    document (a signed-URL fetch on click), Verify (one click) / Reject
    (inline required reason).
  - **AD-04** `ListingReviewDrawer` — photos + Site Intelligence + specs + the
    `review_flags`; Approve / Reject (ADMIN-003 reason) for `PENDING_REVIEW`,
    Delist (optional reason) for approved, Re-list for delisted; DRAFT /
    REJECTED are read-only.
  - **AD-05** `ActivityView` — reverse-chron plain-language feed, "Load older".
  - The three placeholder pages (`/admin/overview`, `/admin/inventory`,
    `/admin/activity`) now render the real views.

### Deviations / calls

- **`admin/publishers` default filter = none** (the tabs pass explicit statuses),
  not api-spec §26.2's `UNVERIFIED` default — the `PENDING` state added in Phase 8
  makes "everything not yet verified" the useful queue default.
- **AD-04 is enriched in place, not a `DetailView` (VW-03) re-use** — `DetailView`
  is bound to the Viewer projection; sharing it would be a large refactor for
  little gain. The availability calendar is not shown in the AD-04 drawer.
- **`suspend`/`unsuspend` state guards** are a small additive DB change (the
  api-spec's 409 contract wasn't implemented by the Phase 1 functions).
- **`admin_dashboard_summary()` return signature changed** (DROP + recreate) —
  no other code consumed it yet.
- The opt-in live E2E specs share the `@seeable.test` user namespace and each
  `afterAll` deletes all of it, so they must run `--workers=1` (or one file at a
  time), not in parallel. Pre-existing; documented here.

### Tests

- `tests/unit/admin.test.ts` — +14 (`dashboardFromSummary`; `listingDisplayStatus`
  + `listingSecondaryAnnotation` — INVENTORY-003; `reviewFlags` — INVENTORY-002 +
  the one defensive check; `describeAction` — AD-05 sentences; `tallyListingCounts`).
  **200 unit total.**
- **`scripts/verify-admin.mjs`** (`npm run verify:admin`) — **29/29** live:
  ADMIN-001 (not in `public_hoarding_listings` until `approve_listing`),
  ADMIN-002 (suspend never touches a Confirmed request; still blocks submit;
  the Confirmed request still completes), ADMIN-003 (blank-reason reject
  refused), ADMIN-004 (suspend ≠ delist; delist independent + reversible),
  two-Admin `FOR UPDATE` race → exactly one wins, one `admin_actions` row per
  action, the suspend/unsuspend state guards, `requests` returns zero rows to an
  Admin, non-Admins → `ADMIN_ONLY`, the dashboard aggregate.
- **`tests/e2e/admin-flow.spec.ts`** (opt-in, `SEEABLE_E2E_LIVE=1`) — Admin signs
  in → AD-04 approve (listing leaves the queue, enters `public_hoarding_detail`)
  → AD-03 verify a pending Publisher. Passing.
- `verify:publisher` 16/16, `verify:requests` 25/25, `verify:inventory` 23/23,
  `verify:authz` 26/26, `verify:discovery` 15/15 still green. lint / typecheck /
  `next build` / `cf:build` (maplibre-gl absent from the server bundle) /
  15 non-live e2e green.

## Phase 8 — Publisher Platform

Gives a Publisher a coherent home: a dashboard, a verification submission flow,
and account settings. The Admin side of verification (`verify_publisher` /
`reject_publisher_verification`) and the OWNER-004 submit gate were built in
Phase 1 — this adds the Publisher-initiated half.

- **DB — `20260908120000_publisher_platform`**:
  - `verification_status` CHECK gains `'PENDING'` — PB-08's "under review" state.
    Additive: `computeGates` / `submit_hoarding_for_review` /
    `public_hoarding_listings` all key off `= 'VERIFIED'`, so `PENDING` behaves
    exactly like `UNVERIFIED` for every gate.
  - `publisher_profiles` + `business_type`, `verification_document_path`,
    `verification_submitted_at`.
  - `publisher-private` storage bucket — the verification document, isolated the
    same way as `hoarding-private` (no `storage.objects` policy at all —
    service-role write only, Admin-only read).
  - `submit_publisher_verification(business_name, business_type, document_path)`
    — `SECURITY DEFINER`, operates on the caller's own row, from `UNVERIFIED` /
    `REJECTED` only (`PUBLISHER_VERIFICATION_STATE_CONFLICT` otherwise),
    suspended → `PUBLISHER_SUSPENDED`.
  - `get_verification_document_path(publisher_id)` — self-or-Admin accessor
    (the Phase 9 review UI mints a signed URL from it).
- **Backend** (`lib/publisher/`):
  - `GET/PATCH /api/v1/profiles/me` — the shared contact-profile resource for
    both roles (SH-01); `full_name` / `phone` / `email` / `city` only.
  - `GET/PATCH /api/v1/publishers/me` — api-spec §22.2 shape (+
    `can_submit_listings`); PATCH spans `profiles` + `publisher_profiles`.
  - `GET /api/v1/publishers/me/summary` — §22.6. Route-level counts over the
    Publisher's own `hoardings` / `requests` (`deriveSummary`, pure + unit-tested)
    — no new analytics endpoint. `confirmed_value` is `SUM(amount_agreed WHERE
    recorded)`, labelled not-revenue.
  - `POST /api/v1/publishers/me/verification` — multipart, service-role handler
    (magic-byte sniff PDF/JPEG/PNG/WebP, 8 MB cap, upload to `publisher-private`,
    `rpc(submit_publisher_verification)`, object removed if the RPC rejects). Its
    path is added to the eslint service-role allowlist.
- **Frontend** (`components/publisher/`):
  - **PB-01** `DashboardView` — 4 metric cards (Active listings / Pending
    approval → deep-link / Open requests → deep-link / Confirmed this month),
    "Needs your attention" (`selectNeedsAttention` — SLA-window requests +
    Admin-rejected listings, most urgent first) + "Recent activity". Brand-new
    Publisher → a single "Add your first hoarding" prompt, not four zero cards.
    Suspended → `danger-50` banner. Realtime via `useRequestRealtime`.
  - **PB-08** `VerificationForm` + `VerificationBanner` — business name / type /
    document; states not-started → pending → verified → rejected(+reason,
    resubmit). Slim `warning-50` banner on PB-01 / PB-02 / the wizard.
  - **SH-01** `AccountSettings` (`/account`, role-aware) — settings nav
    (Profile · Security · Verification for Publisher) + panels. Publisher edits
    Business Name; Viewer edits Full Name.

### Deviations / calls

- **`PENDING` added to the enum** rather than a separate "submitted" flag —
  matches PB-08's four states, and every existing gate already treats
  not-`VERIFIED` uniformly.
- **PB-08 collects business name / type / document only** — contact fields are
  managed in SH-01 (the plan's PB-08 line scopes it this way; `04-Screens-Publisher.md`
  lists contact fields on the form, predating SH-01 as a separate screen).
- **`/api/v1/profiles/me`** is the shared contact facade; api-spec §23.5's
  `/api/v1/viewers/me` is folded into it.
- **Dashboard fetches its own recent-notifications list** rather than calling
  `useNotifications()` — the notification bell owns that Realtime channel and a
  second subscriber on the same topic throws. The feed still refreshes on
  `reload`.
- **"1–2 business days"** verification copy is illustrative, not a committed SLA
  (`04-Screens-Publisher.md` PB-08 UX ASSUMPTION).

### Tests

- `tests/unit/publisher.test.ts` — +7 (`deriveSummary` — `live_in_search`,
  `confirmed_value`, `confirmed_this_month` in IST; `selectNeedsAttention` —
  SLA window + ordering + rejected-listing rows). **186 unit total.**
- **`scripts/verify-publisher.mjs`** (`npm run verify:publisher`) — **16/16**
  live: OWNER-004 (unverified → submit blocked; verified → the gate passes);
  the PB-08 lifecycle (submit → `PENDING`; resubmit-while-pending conflict;
  Admin reject → resubmit; Admin verify); suspended-Publisher rules — submit +
  verification blocked, but `mark_request_completed` on an existing Confirmed
  request still works (ADMIN-002); **the verification document is unreadable by
  a Viewer or another Publisher** (`publisher_profiles` RLS +
  `get_verification_document_path` owner gate + the policy-less bucket);
  `PENDING` → `publisher_is_verified = false`.
- **`tests/e2e/publisher-verification.spec.ts`** (opt-in, `SEEABLE_E2E_LIVE=1`) —
  brand-new Publisher signup → "Add your first hoarding" dashboard → PB-08
  submit with a document → pending → Admin verify → banner clears. Passing.
- `verify:requests` 25/25, `verify:inventory` 23/23, `verify:discovery` 15/15,
  `verify:authz` 26/26 still green. lint / typecheck / `next build` / `cf:build`
  (maplibre-gl absent from the server bundle) / 15 e2e green.

## Phase 7 — Request / Booking Engine

The full booking-lite lifecycle. A Viewer submits a date request; the Publisher
accepts (conflict-safe, transactional) or rejects; unanswered requests expire and
confirmed ones go Live then Completed — with `REQUEST-004` enforced by the DB and
surfaced honestly in both UIs, live via Realtime.

The engine (`confirm_request` / `reject_request` / `mark_request_completed`, the
`validate_request_creation` BEFORE-INSERT trigger, the `EXCLUDE USING gist`
constraint, the `VIEWER-002` partial unique index, the `expire`/`live` pg_cron
jobs) was built in **Phase 1** — this phase **verifies** it under concurrent load
and builds the API + screens on top.

- **DB — `20260907120000_request_engine_phase7`** (the two gaps + view fields):
  - `set_request_amount_agreed(request_id, amount)` — the one transition Phase 1
    did not build (api-spec §20.4). `SECURITY DEFINER`, owner-only, only after
    the request leaves `REQUESTED` (`REQUEST_AMOUNT_NOT_SETTABLE` otherwise),
    D7-tagged.
  - `get_request_history(request_id)` — `SECURITY DEFINER`, party-or-Admin gate
    (mirrors `rsh_select_via_request`), resolves the counterparty actor's role
    which `profiles` RLS (`id = auth.uid()`) otherwise hides. `changed_by NULL`
    → `note: "system"` for a pg_cron transition.
  - `viewer_request_list` / `publisher_inbox` recreated to carry the embedded
    `hoarding` summary (`type_code`, `price`, `price_unit`, a primary-media
    path, an `is_listed` flag) + `publisher_business_name` — both stay
    `security_invoker = false`, so the summary survives a since-paused listing
    (§23.3) and the column projection remains the disintermediation boundary.
  - `api_idempotency_keys` (user-scoped RLS) — replay-safety for
    `POST /api/v1/requests` (§17.1 / §31). Only 201s are cached; `VIEWER-002`
    still absorbs a concurrent double-submit on its own.
- **Backend** (`lib/requests/`, thin facades over `rpc()`):
  - `POST /api/v1/requests` — one atomic `INSERT`; shape checks (`INVALID_DATE_RANGE`,
    `DATE_RANGE_IN_PAST`), then the trigger/constraints do the rest.
    `Idempotency-Key` header honoured; `REQUEST_DUPLICATE_PENDING` is enriched
    with the existing request's id/dates/status (§17.5).
  - `GET /api/v1/requests/me` · `GET /api/v1/requests/{id}` (Admin → 404, §6.6) ·
    `GET /api/v1/requests/{id}/history` · `GET /api/v1/publishers/me/requests`
    (inbox — `REQUESTED` first, then `sla_deadline ASC NULLS LAST`, then
    `created_at DESC`; `available_actions[]`, `sla_hours_remaining`,
    `counts_by_status`).
  - `PATCH /api/v1/requests/{id}` — one endpoint, `ACCEPT`/`REJECT`/`COMPLETE`/
    `SET_AMOUNT_AGREED` via `action`. `CANCEL` → `501 REQUEST_CANCEL_UNSUPPORTED`;
    unknown → `422 REQUEST_ACTION_INVALID`. Error precedence: action → role
    (Admin `ACCEPT`/`REJECT` → `403 FORBIDDEN_ROLE`) → ownership → state.
  - `status_label` + `available_actions` computed once in `lib/requests/projection.ts`
    — no client re-derives the state machine.
- **Frontend** (`components/requests/`):
  - **VW-04** `SubmitRequestModal` — wired to the VW-03 CTA. Editable pre-filled
    range (inline calendar re-opener), optional message, disclaimer.
    `REQUEST_DATE_CONFLICT` is a first-class non-alarming state ("just booked by
    another advertiser" → "Choose different dates", message preserved);
    `REQUEST_DUPLICATE_PENDING` links to the existing request; `aria-live` swaps.
  - **VW-05** `MyRequestsView` (`/requests`) — status tabs (Rejected/Expired
    grouped), Request Cards, detail drawer with per-status plain-language
    explainers, no cancel. **Live via `useRequestRealtime`.**
  - **PB-06** `IncomingRequestsView` (`/publisher/requests`) — status tabs,
    SlaCountdown (`warning-700` in the final-hours window, live + static SR
    text). **Live via `useRequestRealtime`.**
  - **PB-07** `PublisherRequestDrawer` — Accept = one click → toast → back;
    Reject = inline optional-reason expansion; accept-race state; Mark Completed
    when eligible.

### Deviations / calls

- **Losing overlapping request stays `REQUESTED`** — it does **not** auto-reject
  (api-spec §19.3 Case 1; `confirm_request()` never touches it). `04-Screens-Publisher.md`
  PB-07's older "automatically marked Rejected" copy is not followed; the drawer
  says "still pending — decline it or leave it to expire".
- **`404` vs `409` on `POST /requests`** — a listing not currently visible to the
  Viewer reads as `HOARDING_NOT_FOUND` (no inventory oracle, §6.5); a listing
  paused mid-flight still yields the trigger's `409 HOARDING_NOT_VISIBLE`.
- **`REQUEST_SLA_HOURS`** is a code constant (`lib/requests/types.ts`) mirroring
  `default_response_sla()` — for the "usually within 48 hours" copy only. The
  plan named an env var; the value is non-secret and the DB function is the
  source of truth for the actual deadline.
- **`publisher.id`** is omitted from the Viewer's request resource (business_name
  + is_verified only) — §16.3 shows it, §23.4's disintermediation table doesn't.
- **Inbox sort/paginate in memory** — the `REQUESTED`-first key is a CASE
  expression PostgREST cannot express in `.order()`; correct + simplest at MVP
  scale (a handful of requests per Publisher).
- **Concurrency test is a standing local harness**, not a CI job — same pattern
  as `verify:authz` / `verify:inventory` / `verify:discovery` (all need live
  Supabase secrets CI's placeholder env lacks).

### Tests

- `tests/unit/requests.test.ts` — +18 (inclusive-inclusive overlap 1–15/10–20;
  `durationDays`; `statusLabel` by role; `availableActions` state machine;
  `slaHoursRemaining`). **179 unit total.**
- **`scripts/verify-requests.mjs`** (`npm run verify:requests`) — **25/25** live,
  including **the concurrency suite (RISK-4)**: 8 rounds of two simultaneous
  `confirm_request` on overlapping `REQUESTED` rows → **exactly one** `CONFIRMED`
  every round, the loser `REQUEST_DATE_CONFLICT` and still `REQUESTED`. Also:
  full lifecycle; SLA-expiry vs accept (exactly one transition); two Viewers
  overlapping → both `REQUESTED`; creation vs `CONFIRMED` dates blocked;
  `VIEWER-002` then reject-then-succeeds; `REQUEST-002` immediate release;
  `REQUEST-003` too-early; `amount_agreed` gating; Admin `COMPLETE` works but the
  request is not Admin-readable (D10); `expire_stale_requests()` idempotent;
  the three pg_cron jobs scheduled; disintermediation on `viewer_request_list` /
  `publisher_inbox`.
- **`tests/e2e/request-flow.spec.ts`** (opt-in, `SEEABLE_E2E_LIVE=1`) — the
  canonical flow through the real UI: sign up → open a seeded listing → submit
  via the modal → Pending in My Requests → `confirm_request()` → Confirmed on
  reload. Passing.
- `verify:inventory` 23/23, `verify:discovery` 15/15, `verify:authz` 26/26 still
  green. lint / typecheck / `next build` / `cf:build` (maplibre-gl absent from
  the server bundle) / 15 e2e green.

## Phase 6 — Viewer Discovery

A Viewer browses, filters, and maps the visible catalogue and opens a full
hoarding detail page. List and map are provably one filtered result set; the
disintermediation boundary is enforced on the payload (RISK-16).

- **DB — `20260906120000_search_discovery`**: `search_available_hoardings()`
  rebuilt as the one query surface for the whole Viewer experience.
  - **`SECURITY DEFINER SET search_path = public`** — the api-spec §11.2
    "REQUIRED fix". `visible_hoardings`' WHERE clause is the INVENTORY-003
    boundary; running as owner lets it filter every APPROVED row and leaks
    nothing (returns only public columns + a distance + a date).
  - New signature: `(p_type_code, p_city, p_center_lat, p_center_lng,
    p_radius_km, p_max_price_monthly, p_sort, p_limit, p_offset)`. Returns the
    full `public_hoarding_listings` projection + `distance_km` +
    `next_available_date` + `total_count` (window count).
  - Bounding-box prefilter + Haversine; **monthly-normalised** price ceiling
    (DAY×30, WEEK×4.345); `join hoarding_types … where not is_digital` so a
    forced-APPROVED digital row could never surface; ordering per api-spec
    §10.5 (distance when geo, else newest; `id ASC` tiebreak).
  - `public_hoarding_listings` / `public_hoarding_detail` recreated with
    `description` added (VW-03 needs it).
- **Backend** — `GET /api/v1/hoardings` (new — thin over the rpc;
  `GEO_PARAMS_INCOMPLETE` on a partial lat/lng/maxDistance triad, `INVALID_FILTER`
  on an unknown or repeated param; `meta.pagination` + `meta.filters_applied`).
  The non-owner branch of `GET /api/v1/hoardings/{id}` now returns the §11.2
  public representation with **Site Intelligence partial-omission**
  (`lib/inventory/public-view.ts` — a footfall of 0 and an unknown footfall
  never look alike; a fully-empty panel is omitted). `distance_km` from
  optional `latitude`/`longitude` query params.
- **Frontend** (`components/discovery/`, `lib/discovery/`) — VW-01
  (`/discover`, replace placeholder): type chips + budget + "use my location" +
  radius + sort, card grid, "Load more", per-state empties, URL-driven filters
  (shareable / back-safe). VW-02: `HoardingMap` (lazy MapLibre, `ssr:false` —
  never in a server bundle; GeoJSON clustering, `gold-700` points / `ink-900`
  clusters, click-to-select synced with the side list, tile-failure fallback,
  precise pins). VW-03 (`/discover/[id]`): `PhotoCarousel` (keyboard, alt
  text, broken-image fallback), identity row (name + Verified badge, **never a
  link**), SI panel (`<dl>`, partial-omission), specs, description,
  read+select Availability Calendar that updates the CTA label; sticky CTA is
  a Phase-7 stub. A paused/removed listing renders "no longer available", not
  a 404 page (docs/03 VW-03).

### Deviations / calls

- **`sort` implemented** (`newest` / `price_asc` / `price_desc`; `distance`
  auto when geo) — doc 03 VW-01 + the plan want the control; api-spec §10.5
  defers price-sort to FUTURE. Cheap `ORDER BY` branch, noted.
- **`type` is single-select** (api-spec §10.2 — the rpc takes one code);
  repeated `type` → `INVALID_FILTER`.
- **No date filter** in general search (api-spec §10.4 — beyond the approved
  MVP filter set; availability is the detail-page calendar).

### Tests

- `tests/unit/discovery.test.ts` — +12 (`pruneSiteIntelligence` keeps a 0,
  drops null/""; `nextAvailableDate` composes blocks + bookings; `haversineKm`;
  `toDiscoverCard` carries only `business_name` + `is_verified`;
  `filtersToSearchParams` only writes a complete geo triad). **161 unit total.**
- **`scripts/verify-discovery.mjs`** (`npm run verify:discovery`) — **15/15**
  live: INVENTORY-003 (paused / draft / digital all excluded); type AND budget
  combine; distance radius + ascending `distance_km`; `total_count` is the full
  match set not the page; `price_asc`; **the disintermediation payload test
  (RISK-16)** — no phone/email/`full_name`/`publisher_id` via the search RPC
  **or** a direct `public_hoarding_detail` select; `description` + `media`
  present; a paused listing is absent from `public_hoarding_detail`.
- `verify:inventory` 23/23, `verify:authz` 26/26 still green. lint / typecheck
  / `next build` / 15 e2e green. maplibre-gl confirmed absent from the server
  bundle.

## Phase 5 — Inventory Module

A Publisher creates, prices, photographs (watermarked), locates, and submits a
hoarding listing; the three submission gates are enforced with field-level
errors; a minimal Admin path approves/rejects so a listing reaches `APPROVED`
and appears in the Viewer projection.

- **DB — `20260905120000_storage_buckets`**: `hoarding-public` (public bucket,
  watermarked derivatives — the media `url` resolves here directly) and
  `hoarding-private` (no policy at all — unreachable by anon/authenticated;
  empty at MVP since Variant B keeps no original). Writes go through the
  service-role media handler, never the browser.
- **DB — `20260905120100_inventory_hardening`**: Phase 1 granted table-level
  INSERT/UPDATE on `hoardings` — wide enough for a Publisher to
  `PATCH approval_status='APPROVED'` and bypass ADMIN-001, or forge a
  `WATERMARKED` `hoarding_media` row past CONTENT-001. Narrowed both to the
  exact client-writable column sets (api-spec §12.3 / §13.2); revoked client
  INSERT on `hoarding_media`. Added the `site_intelligence_complete` trigger
  (server-derived, INVENTORY-002). **Verified live**: `PATCH approval_status`
  and `INSERT hoarding_media` both refused for a Publisher JWT.
- **Backend — 15 thin facades + 1 real handler + 3 Admin routes**
  (`lib/inventory/`): `hoarding-types`; `hoardings` POST; `hoardings/{id}`
  GET/PATCH/DELETE; `.../submit`; `.../media` GET + **real POST** (Variant B —
  multipart in, magic-byte MIME sniff + size + dimension re-check on the bytes,
  service-role write to `hoarding-public`, storage-then-row); `.../media/{id}`
  PATCH/DELETE; `.../availability` GET; `.../availability/blocks` POST + DELETE;
  `publishers/me/hoardings`; `admin/hoardings` GET + `.../approve` + `.../reject`.
  `buildOwnerView()` computes `submission_readiness.blockers` (mirrors gates
  4–9 of `submit_hoarding_for_review()`), `pending_request_count`,
  `is_edit_frozen` — all from reads the owner can already make under RLS, no
  new DB function.
- **Frontend** — PB-02 (`/publisher/hoardings`, status tabs + counts + row
  actions, Realtime-refreshed pending counts), PB-03/04 wizard
  (`/publisher/hoardings/new` + `/[id]/edit`, 6 steps, autosave on step
  transition, `submission_readiness` drives Step 6), PB-05
  (`/[id]/calendar` — shared `AvailabilityEditor`, block/unblock, bookings
  side-list), AD-04 minimal (`/admin/inventory` — queue + review drawer +
  approve / reject-with-reason).
- **Watermarking — Decision D1 Variant B** (`lib/inventory/watermark.ts`):
  browser Canvas tiles a low-opacity diagonal "SEEABLE" mark, resizes to
  ≤ 2000 px, re-encodes JPEG. The server re-validates the bytes before
  publishing — a demo-grade control, **not a trust boundary**. Restore
  Variant A (server-side worker) before real Publisher inventory (api-spec
  §14.2, `mvp-brd.md` §10). The compensating control now is Admin approval.
- **Map** — `MapPinPicker` (draggable MapLibre marker + manual lat/lng, the
  a11y fallback and the only path with no map style). Loaded via
  `next/dynamic({ ssr: false })` so `maplibre-gl` never enters a server
  bundle (verified — RISK-1).

### Deviations / calls

- **Digital types are not draft-able.** api-spec §12.3 returns
  `HOARDING_TYPE_NOT_LISTABLE` for `is_digital` at creation; the plan's DoD
  ("digital = draft-only") and docs/04 disagree. The settled API wins — 6
  static types selectable, 2 digital shown disabled.
- **Min photos to submit = 1** (api-spec §14.4, matches the DB gate). The
  wizard nudges toward 3 (docs/04) but that isn't a hard block.
- **`GET /api/v1/hoardings` (Viewer list), `search_available_hoardings`
  SECURITY DEFINER fix, `GET /media/{id}/original`** — deferred to Phase 6
  (not on the Phase 5 critical path).
- **No storage cleanup on hoarding DELETE** — orphaned watermarked objects in
  a public bucket are harmless (api-spec §28.6); a cleanup job is future work.

### Tests

- `tests/unit/media.test.ts`, `inventory-attributes.test.ts`,
  `inventory-projection.test.ts` — +30 unit tests (magic-byte sniff can't be
  spoofed, JPEG/PNG/WebP dimension parsing, attribute humanising, every
  submission blocker + edit-freeze derivation against a mock client).
- **`scripts/verify-inventory.mjs`** (`npm run verify:inventory`) — **23/23**
  live: create→DRAFT; `PATCH approval_status` refused; client `hoarding_media`
  INSERT refused; every gate (`PUBLISHER_NOT_VERIFIED` →
  `HOARDING_MISSING_CORE_FIELDS` → `HOARDING_INCOMPLETE_ATTRIBUTES` +
  `missing_attribute_keys` → `HOARDING_MISSING_MEDIA` →
  `HOARDING_MEDIA_NOT_WATERMARKED` → PENDING_REVIEW); INVENTORY-003 hides a
  PENDING_REVIEW listing from a Viewer; admin approve → APPROVED → visible with
  no PII, no `original_storage_path`; OWNER-003 freezes a core edit but not a
  non-core one; delete with history → `HOARDING_HAS_REQUEST_HISTORY`;
  confirmed + Publisher-blocked dates both read unavailable, free dates
  available. Storage: service-role upload + public GET + delete on
  `hoarding-public` confirmed.
- Phase 3 `verify:authz` still 26/26. lint / typecheck / `next build` /
  149 unit / 15 e2e green.

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
