# SEEABLE Hoardings — Full API Specification

## 1. Document Metadata

| Field | Value |
|---|---|
| Document | `docs/05-technical/api-specification.md` |
| Product | SEEABLE Hoardings |
| Scope | MVP only — Bengaluru, single city, ~50–200 listings, no payments |
| Version | 1.0 |
| Status | Draft for Review |
| Date | 30 August 2026 |
| Author role | Senior Backend Architect + API Designer |
| API version | `v1` (`/api/v1`) |
| Target platform | Next.js API routes on Cloudflare (OpenNext adapter) → Supabase PostgreSQL / Auth / Storage |
| Supersedes | Nothing. This is the first version of the document `README.md` lists as Tier 1 gap #6 (*"`mvp-prd.md` §9 lists endpoint names only — no request/response schemas, auth, or error codes"*) |

### 1.1 Related documents (all read and reconciled for this specification)

| Document | Role in this specification |
|---|---|
| `docs/01-product/mvp-prd.md` | **Highest authority.** §9 fixes the endpoint baseline; §7.1–§7.7 fix every functional requirement; §5 fixes the permission matrix |
| `docs/01-product/mvp-brd.md` | Business rationale and `BR-*` traceability |
| `docs/03-modules/inventory.md` | Hoarding entity shape, type taxonomy, `INVENTORY-001/002/003`, pause/delete/delist disambiguation |
| `docs/03-modules/viewer-platform.md` | Viewer surfaces, Viewer-facing status labels, the AUTH-002 demo variance |
| `docs/03-modules/request-engine.md` | Request state machine, `REQUEST-001..004`, conflict semantics, Admin's narrow request authority |
| `docs/03-modules/admin-platform.md` | Admin capabilities, `ADMIN-001..004`, the four-capability/two-endpoint gap |
| `docs/05-technical/system-architecture.md` | Module ownership, transaction boundaries, the twelve implementation rules |
| `docs/05-technical/database-design.md` | **The settled data layer.** Tables, RLS, `SECURITY DEFINER` functions, the exclusion constraint |
| `seeable_free_first_techstack.md` | The settled runtime: Supabase Auth/Storage/Postgres, Cloudflare hosting, GitHub Actions job scheduling, browser-side image processing |
| `README.md` | Documentation index; the gap list this document closes one item of |
| `docs/03-modules/owner-platform.md` | **Referenced but does not exist.** Confirmed absent for the sixth time across this documentation effort. All Publisher-side API behavior below is derived from `mvp-prd.md` §7.2, `inventory.md` §19, and `database-design.md` §37/§41 directly |

### 1.2 Labelling convention

Every non-obvious statement in this document carries one of five labels. Nothing is silently promoted from one to another.

| Label | Meaning |
|---|---|
| **REQUIRED** | Directly mandated by an approved source requirement (a `mvp-prd.md` endpoint, a rule ID, or a database constraint that already exists). Not implementing it breaks an approved requirement |
| **RECOMMENDED** | This document's engineering judgment where the sources are silent but an implementation cannot be written without *some* answer, and a reasonable alternative exists. Sign-off wanted before treating it as final |
| **ASSUMPTION** | A technically necessary interpretation of an ambiguous source statement, made because the API cannot be specified without it |
| **OPEN QUESTION** | A genuine unresolved product or business decision. Carried to §46. Not decided here |
| **FUTURE / DEFERRED** | Explicitly out of MVP scope (`mvp-prd.md` §3.2, `mvp-brd.md` §5.2). Named so it is not accidentally built |

### 1.3 Conflict-resolution precedence used throughout

1. The most recent explicit product decision.
2. `mvp-prd.md` over older or more general documentation.
3. Explicit business rules over inferred behavior.
4. Where two sources genuinely disagree and neither precedence rule settles it, **the conflict is stated inline and carried to §46 — never silently resolved.**

Four such conflicts were found and are surfaced rather than resolved: the media-pipeline location (§14.2), the `REQUEST_EXPIRING_SOON` recipient (§27.3), the date-availability search filter (§10.4), and query-parameter casing (§4.7).

**Three defects in `database-design.md` v1.0 were also found while cross-checking the API against it.** They are correctness bugs, not ambiguities, and each blocks a documented API response from being servable as specified. They are listed with recommended fixes in §46.1 and cross-referenced from the endpoints they affect (§10.6, §11.4, §15.2, §22.4).

---

## 2. API Principles

Twelve principles govern every endpoint in this document. They are stated once here and not repeated per-endpoint.

**P1 — REST over HTTP/JSON, resource-oriented.** `mvp-prd.md` §9's existing endpoint list is already REST-shaped and already versioned; this specification preserves that rather than replacing it. Nouns are resources; verbs are HTTP methods, with one deliberate exception (state-machine actions — see P6 and ADR-API-003).

**P2 — JSON in, JSON out.** `Content-Type: application/json; charset=utf-8` on every request with a body and every response, with exactly two exceptions: `POST /api/v1/hoardings/{id}/media` accepts `multipart/form-data`, and `GET /api/health` returns JSON but without the standard envelope (§29).

**P3 — Server-authoritative validation.** Every constraint is enforced server-side regardless of what the client already checked. `system-architecture.md` §20's rule is binding: *"Availability shown on the frontend is not authoritative."* Client-side validation exists only to improve the user experience.

**P4 — Server-side authorization, always.** `system-architecture.md` §44 rule 2: *"The frontend is never the source of authorization."* Role checks and row-level ownership checks are two different things (§6.4), and both happen on the server, in the module that owns the capability.

**P5 — Module ownership is respected by the URL structure.** Request state is only ever mutated through Request Engine routes; hoarding data only through Inventory routes; moderation decisions only through Admin routes that call the owning module's boundary function. `system-architecture.md` §44 rule 7: *"Admin approving a listing calls Inventory; it does not `UPDATE hoardings` directly."*

**P6 — Clients request actions; the server determines state.** A client never sends `{"status": "CONFIRMED"}`. It sends `{"action": "ACCEPT"}` and the Request Engine decides what state results, or refuses. This is the single most important API design decision in this document (ADR-API-003).

**P7 — Transactional integrity for critical state changes.** Request creation, request confirmation, and listing approval each commit fully or not at all (`system-architecture.md` §28, §44 rule 9). Concretely, each is exactly one database statement or one `SECURITY DEFINER` function call from the API's perspective (§32).

**P8 — No external call inside a database transaction.** `system-architecture.md` §44 rule 11. A notification provider timing out must never hold a lock on the confirmation path.

**P9 — Idempotency on every critical mutation.** A retried confirmation, approval, or request creation must never produce a second state transition (§31).

**P10 — Explicit, structured errors.** One envelope, one stable machine-readable code per failure mode, a human-safe message, and a `request_id` for log correlation (§7, §8). A failed `REQUEST-004` re-validation returns *"these dates are no longer available"*, never a generic 500 — `request-engine.md` §10 and `system-architecture.md` §29 both make this a named requirement.

**P11 — Only watermarked media is ever addressable publicly.** No response body, at any privilege level, ever contains a URL that resolves to an unwatermarked original (`CONTENT-001`, §14).

**P12 — Backwards compatibility within `v1`.** Adding an optional request field, a response field, or a new endpoint is non-breaking and ships within `v1`. Removing or renaming a field, tightening validation, or changing an enum's meaning is breaking and requires `/api/v2` (§36).

### 2.1 Formatting invariants

| Concern | Rule | Source |
|---|---|---|
| Identifiers | UUID v4, lowercase, canonical hyphenated form | `database-design.md` §28 (`uuid` PKs, `gen_random_uuid()`) |
| System timestamps | ISO-8601, UTC, `Z` suffix, second precision or finer | `database-design.md` — every `timestamptz` column |
| Campaign / request dates | `YYYY-MM-DD`, **inclusive on both endpoints** | `database-design.md` §22 — `daterange(start, end, '[]')` |
| Money | INR, decimal string, exactly 2 decimal places (§4.6) | `database-design.md` §28.4 — `numeric(12,2)` |
| Enums | `UPPER_SNAKE_CASE`, matching the database `CHECK` vocabularies verbatim | `database-design.md` §16, §28.12 |
| JSON body/response fields | `snake_case`, matching database column names verbatim | `database-design.md` §28 |
| Query parameters | camelCase where `mvp-prd.md` §9 fixes the spelling; otherwise snake_case (§4.7) | `mvp-prd.md` §9 |

---

## 3. Base URL

```text
/api/v1
```

Every application endpoint in this document is mounted under `/api/v1`, with two deliberate exceptions that are **not** versioned application APIs:

```text
/api/jobs/*     Background job routes — internal, shared-secret authenticated, never public (§28)
/api/health     Liveness/readiness probe — unenveloped, no auth (§29)
```

Both spellings are taken directly from `seeable_free_first_techstack.md` §25 and this document's brief; neither is a resource a client application consumes, so neither carries the `/v1` contract or the response envelope.

### 3.1 Environment base URLs

No production domain is invented here — none is named in any source document.

```text
Development:  configured through an environment variable (e.g. NEXT_PUBLIC_API_BASE_URL)
Staging:      configured through an environment variable
Production:   configured through an environment variable
```

**REQUIRED:** the client must never hardcode a host. `system-architecture.md` §35 classifies the API base URL as *public configuration* — safe to ship to the browser, never a secret, and per-environment.

**Note on deployment shape (ASSUMPTION):** because the API and the web client are the same Next.js deployment (`seeable_free_first_techstack.md` §5, §27), the browser normally calls `/api/v1/...` as a same-origin relative path and the base URL is empty in practice. The environment variable exists for non-browser clients (integration tests, the job scheduler, any future mobile client) and for preview deployments. This is the only reading consistent with the "one main application" rule; no source document states it explicitly.

---

## 4. HTTP Conventions

### 4.1 Content type

```http
Content-Type: application/json; charset=utf-8
```

Sent on every request carrying a body and returned on every response carrying a body. The single exception is media upload:

```http
Content-Type: multipart/form-data; boundary=...
```

A request body with an unsupported content type is rejected with `415` and error code `VALIDATION_ERROR`.

### 4.2 Accept

```http
Accept: application/json
```

**RECOMMENDED:** the server treats a missing `Accept` header as `application/json`. An `Accept` header that excludes `application/json` and `*/*` is rejected with `406`. No content negotiation beyond this exists at MVP — there is no XML, CSV, or HTML representation of any resource.

### 4.3 Character encoding

UTF-8, everywhere, in both directions. This is not cosmetic for this product: Bengaluru locality names, Publisher business names, and Kannada-script address text are all expected in `hoardings.locality`, `hoardings.address_text`, and `profiles.full_name`. Byte-length limits in §14.4 are stated in bytes; character limits elsewhere are stated in Unicode code points.

### 4.4 Dates

Two distinct formats, never interchanged.

**Campaign and request dates** — calendar dates with no time component:

```text
YYYY-MM-DD

Example: 2026-09-10
```

Used for `start_date`, `end_date`, and availability block boundaries. **Both endpoints are inclusive.** This is not a stylistic choice: `mvp-prd.md` §12's own worked acceptance criterion (1–15 September conflicts with 10–20 September) only holds under inclusive-inclusive semantics, and `database-design.md` §22 implements it as a generated `daterange(start_date, end_date, '[]')` column precisely so the API and the database cannot disagree. A client computing "nights" or "days" must use `end_date - start_date + 1`.

**System timestamps** — ISO-8601 in UTC:

```text
2026-09-10T14:30:00Z
```

Used for `created_at`, `updated_at`, `confirmed_at`, `sla_deadline`, and every other `timestamptz`. **REQUIRED:** the server always emits `Z`; it never emits a local offset and never emits a naive timestamp.

**Timezone semantics (ASSUMPTION, carried to §46):** campaign dates are interpreted in **Asia/Kolkata (UTC+05:30)**, the platform's single launch market (`mvp-prd.md` §3.3, Bengaluru). This matters in exactly two places — the `REQUEST-003` start-date floor and the `CONFIRMED → LIVE` transition, both of which compare a `date` against "today". `database-design.md` uses `current_date`, which resolves against the database session's timezone; on a Supabase project that is UTC by default, so a campaign starting 1 October would flip to `LIVE` at 05:30 IST rather than at local midnight. No source document specifies the intended timezone. **RECOMMENDED:** set the database timezone (or the comparison) to `Asia/Kolkata` so date arithmetic matches the user's calendar; a 5.5-hour skew on a campaign-start transition is a visible, avoidable bug.

### 4.5 Identifiers

UUIDs, lowercase canonical form:

```text
550e8400-e29b-41d4-a716-446655440000
```

Every resource identifier in every path parameter, request body, and response body is a UUID. A path parameter that is not a syntactically valid UUID is rejected with `400 VALIDATION_ERROR` **before** any database lookup — it is never treated as a `404`, because failing fast on malformed input is cheaper and because a `404` would imply the identifier space was searched.

`hoarding_types.code` is the one identifier that is **not** a UUID: it is a stable `UPPER_SNAKE_CASE` string (`UNIPOLE_BILLBOARD`, `GANTRY`, …), because it is seeded reference data whose values appear in client code, filter URLs, and this specification's own schemas (`database-design.md` §18).

### 4.6 Money

**Decision (REQUIRED, and deliberately unambiguous): money is an INR decimal string with exactly two fractional digits, in both directions.**

```json
{ "price": "85000.00", "price_unit": "MONTH", "currency": "INR" }
```

- The value is always a **JSON string**, never a JSON number, in requests and responses alike.
- Exactly two fractional digits, always present. `"85000"` and `"85000.0"` are rejected on input; the server always emits `"85000.00"`.
- Maximum 12 significant digits total (10 integer + 2 fractional), matching `numeric(12,2)`.
- `currency` is a constant `"INR"` in every response. It is **not accepted on input** — there is exactly one currency at MVP (`mvp-prd.md` §3.3) and accepting the field would imply a multi-currency capability that does not exist. It is emitted so that a client never has to hardcode the symbol, and so a future multi-currency change is additive rather than breaking (P12).
- `price_unit` is one of `DAY`, `WEEK`, `MONTH`, defaulting to `MONTH` (`database-design.md` §28.4).

**Why a decimal string rather than integer minor units.** Integer paise is the conventional choice and would be defensible on a greenfield API. It is the wrong choice *here* for one concrete reason: the settled schema stores money as `numeric(12,2)` (`database-design.md` §28.4, §41.2), and PostgREST/`supabase-js` returns `numeric` as a string precisely to avoid IEEE-754 loss. Specifying integer paise at the API boundary would insert a ×100 conversion on every read and a ÷100 conversion on every write between the API layer and the database, for no gain — and every such conversion is a rounding bug waiting to happen in a codebase where the same number also appears in `amount_agreed`. A decimal string passes through unchanged, is exactly representable, sorts and compares correctly after parse, and matches the storage type one-to-one.

**Why not a JSON number.** `85000.00` parsed as a JavaScript `Number` is safe today, but `amount_agreed` on a large annual buy plus a client that does arithmetic before re-submitting is exactly the pattern that produces `84999.999999999`. Strings make that impossible by construction. Clients that need arithmetic should parse to a decimal type, not to a float.

**What money is *not* at MVP.** There is no `total`, no `amount_due`, no `tax`, no `currency conversion`, and no payment object anywhere in this API. `amount_agreed` is a record-keeping field, never collected and never enforced (`mvp-prd.md` §7.4, `request-engine.md` §17, `database-design.md` §22). See §45 for what a payment API would add later.

### 4.7 Naming — the one deliberate inconsistency, stated rather than hidden

**JSON bodies and response fields are `snake_case`**, matching `database-design.md`'s column names character-for-character. A field named `approval_status` in the database is `approval_status` on the wire. This removes an entire class of mapping bug and makes every response directly checkable against the data dictionary.

**Query parameters keep the exact spellings `mvp-prd.md` §9 fixes**, which are camelCase:

```text
GET /api/v1/hoardings?type=&city=&maxDistance=&maxPrice=
```

This is a genuine internal inconsistency (`maxPrice` in the query string, `max_price` nowhere, `price` in the body). It is preserved rather than corrected because §9 is an explicit, approved product decision and precedence rule 2 puts `mvp-prd.md` above this document.

**RECOMMENDED mitigation:** the server additionally accepts `snake_case` aliases for every camelCase query parameter (`max_distance`, `max_price`, `page_size`), treating them as exact synonyms. Supplying both spellings of the same parameter in one request is a `400 INVALID_FILTER` rather than a silent precedence rule. Only the camelCase spellings are documented in the OpenAPI document (§37), so generated clients produce one canonical form.

**OPEN QUESTION (§46):** whether to normalize all query parameters to `snake_case` in a `v1` revision, accepting a documented deprecation of the camelCase spellings, or keep this split permanently.

### 4.8 Standard request headers

| Header | Required? | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | On every authenticated endpoint | Supabase Auth access token (§5.4) |
| `Content-Type` | On every request with a body | §4.1 |
| `Accept` | Optional | §4.2 |
| `Idempotency-Key` | On critical mutations (§31) | Client-generated UUID; makes a retry safe |
| `X-Request-Id` | Optional | Client-supplied correlation ID; echoed back. If absent, the server generates one |

### 4.9 Standard response headers

| Header | Always present? | Purpose |
|---|---|---|
| `Content-Type: application/json; charset=utf-8` | Yes (bodied responses) | §4.1 |
| `X-Request-Id` | Yes | Matches `request_id` in the body; the value to quote in a bug report (§35) |
| `Cache-Control` | Yes | `no-store` on every authenticated endpoint; see §11.2 for the one public-read exception |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` | On rate-limited endpoints | §30 |
| `Retry-After` | On `429` and on `503` | Seconds until a retry is sensible |
| `Location` | On `201 Created` | Canonical URL of the created resource |

---

## 5. Authentication

### 5.1 What authentication is, and what it is not, in this system

Four concepts are routinely conflated and must not be. Each lives in a different place, and an endpoint that checks the wrong one is a security bug.

| Concept | Where it lives | Changed by | Example |
|---|---|---|---|
| **Authentication provider identity** | Supabase `auth.users` — the system of record for credentials and sessions | Supabase Auth only. **No table in `public` ever stores a password** (`database-design.md` §7) | `auth.users.id`, the access token |
| **Application profile** | `public.profiles`, a 1:1 extension keyed on the same UUID | The user, on their own row, restricted to four columns by a column-level `GRANT` | `full_name`, `phone`, `city` |
| **Application role** | `profiles.role` — `VIEWER` \| `PUBLISHER` \| `ADMIN` | Set once at signup by the `handle_new_user` trigger. **Never client-writable** (`database-design.md` §38.1) | Determines every authorization decision in §6 |
| **Verification status** | `publisher_profiles.verification_status` + `.suspended` | Admin only, through `verify_publisher()` / `suspend_publisher()` | Gates listing *submission*, not login (`OWNER-004`) |

**REQUIRED:** an authenticated session proves identity and carries a role. It does **not** prove verification. `OWNER-004` gates submission on verification, and `AUTH-002` gates request submission on verification — both are checked at the action, not at the door.

### 5.2 Do not build a custom password system

`seeable_free_first_techstack.md` §9 is explicit and binding: *"Do not build a custom password/session system."* Supabase Auth issues, refreshes, and revokes tokens; hashes passwords; and (when enabled) issues and verifies OTPs. This specification's `/api/v1/auth/*` endpoints are **thin server-side wrappers** over Supabase Auth, not an independent implementation.

**Why wrap at all, rather than letting the browser call Supabase directly (RECOMMENDED, with the alternative stated).** `supabase-js` in the browser can perform sign-up and sign-in without any SEEABLE endpoint, and that is the cheaper path. This document specifies the wrapped form because:

1. It keeps the AUTH-002 demo variance (§5.3) a **server-side** concern. Switching the demo build's password flow back to OTP becomes a change inside one route handler, not a coordinated client release.
2. It gives registration a single server-side place to establish the role and the `publisher_profiles` row, and to reject a client-supplied `ADMIN` role (`database-design.md` §41.5 already hardens this in `handle_new_user`, but a second check at the boundary costs nothing).
3. It gives auth endpoints the same envelope, the same error taxonomy, and the same `request_id` logging as every other endpoint, rather than surfacing raw provider errors to the client.

**ASSUMPTION, carried to §46:** if the team instead lets the browser authenticate directly against Supabase, `/api/v1/auth/register`, `/login`, `/verify-otp`, `/logout`, and `/refresh` become optional and only `GET /api/v1/auth/me` remains strictly necessary. Every other endpoint in this document is unaffected either way, because they all authenticate by validating the bearer token, not by having issued it.

### 5.3 AUTH-002 — the MVP target and the demo variance, both documented

`viewer-platform.md` v1.1's Demo Scope Note records a deliberate, explicit variance. It is a variance, **not a redefinition**, and this document does not delete the OTP requirement.

| | Mechanism | Status in this API |
|---|---|---|
| **MVP target (approved)** | `AUTH-002` / `BR-AUTH-002`: OTP verification required before a Publisher submits a listing or a Viewer sends a request | `POST /api/v1/auth/verify-otp` is **REQUIRED** and fully specified (§5.6). The verification gate is enforced at §17 (request creation) and §12 (listing submission) |
| **Demo variance (current build, Viewer side)** | Email or mobile + password. No OTP, no ownership verification, no pre-request verification gate (`viewer-platform.md` Demo Scope Note) | `POST /api/v1/auth/login` is **REQUIRED** for this build. When `AUTH_OTP_ENABLED=false`, `/auth/verify-otp` returns `501 NOT_IMPLEMENTED` with code `AUTH_OTP_DISABLED`, and the `AUTH_VERIFICATION_REQUIRED` gate on request creation is **not** applied |
| **Publisher side of the variance** | **Undocumented anywhere.** `viewer-platform.md` says the same variance *"would need to be applied symmetrically on the Publisher side"*; `admin-platform.md` and `system-architecture.md` §17 both carry this forward unresolved | **OPEN QUESTION (§46).** This API does not assume either answer. The Publisher-side gate is implemented as the `publisher_profiles.verification_status = 'VERIFIED'` check in `submit_hoarding_for_review()`, which is an **Admin decision**, and is therefore unaffected by whether OTP runs — see the note below |

**A distinction worth being precise about, because two source documents blur it.** `admin-platform.md` §8 identifies that `BR-AUTH-002`'s "OTP **at minimum**" and `mvp-prd.md` §7.5's "Publisher verification **queue**" may be two separate gates: an automatic OTP check, and a manual Admin review. `database-design.md` implements only the second — `submit_hoarding_for_review()` checks `verification_status = 'VERIFIED' AND NOT suspended`, which only an Admin can set. **This API follows the database:** Publisher listing submission is gated on the Admin verification decision, and OTP (when enabled) is an additional, independent account-verification step. Whether the two are meant to be one gate or two is `admin-platform.md`'s **OPEN QUESTION**, restated in §46, not resolved here.

**Configuration flag (RECOMMENDED):** `AUTH_OTP_ENABLED` is *private configuration*, not a secret and not public config (`system-architecture.md` §35). `GET /api/v1/auth/me` exposes its effect — not the flag itself — as `verification.otp_required`, so the client can render the correct flow without shipping a build per environment.

### 5.4 Token handling

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Property | Value | Source |
|---|---|---|
| Token type | Supabase Auth JWT access token | `seeable_free_first_techstack.md` §9 |
| Transport | `Authorization: Bearer` header only | **RECOMMENDED** — see the cookie note below |
| Access token lifetime | Supabase default (1 hour), configurable in the Supabase project | Provider default; **ASSUMPTION** — no source document states a lifetime |
| Refresh token lifetime | Supabase default, rotating | Provider default |
| Claim used for authorization | `sub` → `auth.uid()` in every RLS policy and `SECURITY DEFINER` function | `database-design.md` §37 |
| Validation | Signature + expiry verified on every request. **Never** trust a role claim from the token body; role is read from `profiles.role` | P4 |

**Bearer header, not a cookie (RECOMMENDED, with the consequence stated).** `mvp-prd.md` §7.1 requires *"session persistence with standard secure token handling"* without naming a mechanism, and `system-architecture.md` §46 leaves opaque-session-vs-signed-token explicitly open. This document specifies the `Authorization` header because it is what `supabase-js` produces natively, and because it makes the API immune to CSRF by construction — a browser does not attach an `Authorization` header cross-origin on its own. **If the team instead adopts cookie-based sessions** (`@supabase/ssr` supports this, and it is the more natural fit for Next.js Server Components), then CSRF protection becomes **REQUIRED** and §33.7 applies. Both paths are documented; the header path is the one specified.

**Never trust a client-supplied role.** A JWT's `user_metadata.role` is client-influenced at signup. Every authorization decision in this API reads `profiles.role` server-side, exactly as `is_admin()` does (`database-design.md` §41.4). This is not defense in depth — it is the only correct behavior, because `handle_new_user()` deliberately downgrades any non-`VIEWER`/`PUBLISHER` metadata role to `VIEWER`, so the token and the profile can legitimately disagree.

### 5.5 Endpoint inventory for authentication

Only endpoints that are required by `mvp-prd.md` §9, or technically necessary to serve an approved requirement, are specified. Nothing is added for completeness alone.

| Method | Path | Status | Justification |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | **REQUIRED** | `mvp-prd.md` §9, verbatim |
| `POST` | `/api/v1/auth/login` | **REQUIRED** | Not in §9, but `viewer-platform.md` §25 AC-1a specifies login behavior as an acceptance criterion; a login flow with no login endpoint is not implementable |
| `POST` | `/api/v1/auth/verify-otp` | **REQUIRED** (MVP target) / **disabled in the demo build** | `mvp-prd.md` §9, verbatim; `AUTH-002`. See §5.3 |
| `POST` | `/api/v1/auth/refresh` | **REQUIRED** | `mvp-prd.md` §7.1 requires session persistence; an access token that expires in an hour with no refresh route makes that requirement unmeetable |
| `POST` | `/api/v1/auth/logout` | **RECOMMENDED** | No source document requires sign-out. Included because a shared-device sign-out with no server-side token revocation is a real, cheap-to-close risk, and Supabase Auth already provides revocation |
| `GET` | `/api/v1/auth/me` | **REQUIRED** | Every client surface branches on role and verification status before rendering. Without this, the client would have to infer role from which other endpoints return `403`, which is both slow and wrong |
| — | `POST /api/v1/auth/forgot-password` | **OPEN QUESTION — not specified** | `viewer-platform.md` §28 names password reset as undefined for the demo build. Not invented here (§46) |

### 5.6 `POST /api/v1/auth/register`

**REQUIRED** — `mvp-prd.md` §9.

Creates a Supabase Auth user and, via the `handle_new_user` trigger, the matching `profiles` row (plus `publisher_profiles` when the role is `PUBLISHER`).

| | |
|---|---|
| Auth | None (public) |
| Authorization | None |
| Idempotency | Natural — a duplicate email/phone returns `409 AUTH_IDENTITY_IN_USE`. No `Idempotency-Key` (§31.4) |
| Rate limit | **RECOMMENDED** 5 / hour / IP, 3 / hour / identity (§30) |
| Module | Auth & Roles |

**Request**

```json
{
  "role": "VIEWER",
  "email": "vikram@example.com",
  "phone": "+919900000003",
  "password": "correct-horse-battery-staple",
  "full_name": "Vikram Shah",
  "city": "Bengaluru",
  "business_name": "Kumar Outdoor Media"
}
```

**Validation**

| Field | Rule |
|---|---|
| `role` | **Required.** Exactly one of `VIEWER`, `PUBLISHER`. `ADMIN` is rejected with `403 AUTH_ROLE_NOT_SELF_ASSIGNABLE` — Admin accounts are provisioned out of band (`admin-platform.md` §21, `database-design.md` §15). `AUTH-001`: one account, one role, permanently |
| `email` | Required unless `phone` is supplied. RFC-5322-shaped, ≤ 254 bytes, lowercased before storage |
| `phone` | Required unless `email` is supplied. E.164 (`+91…`), ≤ 20 chars |
| `password` | **Required in the demo build** (`viewer-platform.md` §19). Minimum 8 characters; length is the only rule this document imposes — Supabase Auth's own password policy is authoritative and its rejection is surfaced as `422 VALIDATION_ERROR` with `details.password` |
| `full_name` | Required, 1–120 code points |
| `city` | Optional, defaults to `"Bengaluru"` (`database-design.md` §28.1) |
| `business_name` | Optional, `PUBLISHER` only, ≤ 200 code points. Silently ignored for `VIEWER` — **RECOMMENDED**: return `422` instead, so a mis-scoped client fails loudly. This document specifies the `422` |

**Response — `201 Created`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "33333333-3333-3333-3333-333333333333",
      "role": "VIEWER",
      "email": "vikram@example.com",
      "phone": "+919900000003",
      "full_name": "Vikram Shah",
      "city": "Bengaluru",
      "created_at": "2026-08-30T09:12:44Z"
    },
    "verification": {
      "otp_required": false,
      "otp_sent": false,
      "publisher_verification_status": null
    },
    "session": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "v1.M2Rk...",
      "token_type": "bearer",
      "expires_in": 3600,
      "expires_at": "2026-08-30T10:12:44Z"
    }
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8F9"
}
```

**Behavior notes**

- **A session is returned immediately in the demo build.** When `AUTH_OTP_ENABLED=true`, `session` is `null`, `verification.otp_required` is `true`, `otp_sent` is `true`, and the client must call `/auth/verify-otp` before it holds a token. This is the one shape difference between the two builds, and it is discoverable from the response rather than from a build flag.
- **`publisher_verification_status`** is `"UNVERIFIED"` for a new Publisher and `null` for a Viewer — the field exists so the Publisher client can immediately render the "awaiting verification" state without a second call.
- **Side effects:** one `auth.users` row; one `profiles` row and (Publisher only) one `publisher_profiles` row, both written by the `handle_new_user` trigger inside the same transaction as the user insert (`database-design.md` §41.5). No notification. No audit row — registration is not an Admin action.

**Errors**

| Status | Code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON, missing `role` |
| 403 | `AUTH_ROLE_NOT_SELF_ASSIGNABLE` | `role: "ADMIN"` |
| 409 | `AUTH_IDENTITY_IN_USE` | Email or phone already registered |
| 422 | `VALIDATION_ERROR` | Field-level failures, including the provider's password policy |
| 429 | `RATE_LIMITED` | §30 |
| 503 | `SERVICE_UNAVAILABLE` | Supabase Auth unreachable |

**Security considerations.** `AUTH_IDENTITY_IN_USE` is an account-enumeration oracle: an attacker can probe which emails are registered. This is a real, accepted trade-off — the alternative (a generic success that silently does nothing) makes the signup form unusable, and `mvp-brd.md` names no confidentiality requirement over account existence. The rate limit above is the mitigation. Flagged in §33.9 rather than left implicit.

### 5.7 `POST /api/v1/auth/login`

**REQUIRED** for the current build — `viewer-platform.md` §25 AC-1a.

| | |
|---|---|
| Auth | None (public) |
| Rate limit | **RECOMMENDED** 10 / 15 min / IP **and** 5 / 15 min / identity, with exponential backoff after 5 consecutive failures (§30) |

**Request**

```json
{ "identifier": "vikram@example.com", "password": "correct-horse-battery-staple" }
```

`identifier` accepts either an email or an E.164 phone number; the server decides which by shape. A single field is specified rather than `email` / `phone` because `viewer-platform.md` §5 describes the login as *"email/mobile + password"* — one input box.

**Response — `200 OK`** — the same `user`, `verification`, and `session` objects as §5.6.

**Errors**

| Status | Code | Cause |
|---|---|---|
| 401 | `AUTH_INVALID_CREDENTIALS` | Wrong identifier or password — **the same code and message for both**, deliberately (§33.9) |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | See the note below |
| 429 | `RATE_LIMITED` | Brute-force protection tripped |

**`AUTH_ACCOUNT_SUSPENDED` is specified but NOT enabled at MVP — OPEN QUESTION.** `ADMIN-002` says suspension blocks new listing creation; it says nothing about login, and `admin-platform.md` §22 edge case #9 flags exactly this as undefined. `database-design.md` §48 confirms it implements only the narrow reading. **This API follows the narrow reading: a suspended Publisher can log in.** The error code is reserved and documented so that turning the behavior on later is a configuration change, not a new error code that breaks clients. This is the honest position — the code exists, the behavior does not.

### 5.8 `POST /api/v1/auth/verify-otp`

**REQUIRED** at the MVP target (`mvp-prd.md` §9, `AUTH-002`) — **disabled in the current demo build** (§5.3).

**Request**

```json
{ "identifier": "+919900000003", "otp": "482913", "purpose": "SIGNUP" }
```

| Field | Rule |
|---|---|
| `identifier` | Required. Email or E.164 phone, matching the one the OTP was sent to |
| `otp` | Required. 6 digits. **Compared in constant time** (§33.5) |
| `purpose` | `SIGNUP` \| `LOGIN` \| `VERIFY_CONTACT`. **RECOMMENDED** — an OTP issued for one purpose must not be redeemable for another, which is a standard OTP-reuse defense; no source document specifies purposes |

**Response — `200 OK`** — `user`, `verification` (now `otp_required: false`), and a full `session`.

**Errors**

| Status | Code | Retryable |
|---|---|---|
| 401 | `AUTH_OTP_INVALID` | Yes, until the attempt limit |
| 410 | `AUTH_OTP_EXPIRED` | No — request a new OTP |
| 429 | `RATE_LIMITED` | After `Retry-After` |
| 501 | `AUTH_OTP_DISABLED` | No — demo build, `AUTH_OTP_ENABLED=false` |

**Rate limit (RECOMMENDED, and this one matters):** 5 verification attempts per OTP, 3 OTP issuances per identity per hour, and the OTP invalidated after 5 failed attempts. A 6-digit OTP is a 10⁶ space; without an attempt cap it is guessable in minutes. `mvp-prd.md` names no limit, so this is a recommendation — but shipping OTP without one would be a defect, not a deferral.

**Not specified: OTP issuance.** No source document defines a "resend OTP" endpoint, and `seeable_free_first_techstack.md` §37 excludes SMS from the ₹0 MVP entirely (*"Twilio — SMS is not ₹0"*). This is a real dependency conflict: `AUTH-002` requires OTP, and the settled stack has no SMS provider. Email OTP through Supabase Auth is free and would satisfy `AUTH-002` for email-registered users; phone OTP would not. **OPEN QUESTION (§46).**

### 5.9 `POST /api/v1/auth/refresh`

**REQUIRED** — `mvp-prd.md` §7.1 session persistence.

**Request**

```json
{ "refresh_token": "v1.M2Rk..." }
```

**Response — `200 OK`** — a new `session` object. Refresh tokens rotate: the presented token is invalidated and a new one is returned. Presenting an already-rotated token returns `401 AUTH_TOKEN_INVALID`; **RECOMMENDED**, per standard rotation-reuse detection, the whole token family is then revoked, forcing a fresh login. This is provider behavior in Supabase Auth, documented here so clients handle the `401` by re-authenticating rather than retrying.

**Rate limit:** **RECOMMENDED** 60 / hour / user — high enough never to affect a real client, low enough to bound a stolen-token replay loop.

### 5.10 `POST /api/v1/auth/logout`

**RECOMMENDED.**

| | |
|---|---|
| Auth | Bearer token required |
| Request body | `{ "scope": "SESSION" }` — `SESSION` (default, this device) or `ALL` (every device) |
| Response | `204 No Content` |
| Idempotency | Naturally idempotent — logging out twice returns `204` both times |

Revokes the refresh token (and, with `scope: "ALL"`, every refresh token for the user) through Supabase Auth. The access token remains cryptographically valid until it expires — this is inherent to stateless JWTs and is stated here so no one assumes otherwise. Clients must discard the access token locally on logout.

### 5.11 `GET /api/v1/auth/me`

**REQUIRED** — the identity endpoint every client surface depends on.

| | |
|---|---|
| Auth | Bearer token required |
| Authorization | Any authenticated role |
| Rate limit | **RECOMMENDED** 120 / min / user |
| Cache | `Cache-Control: no-store` |

**Response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "role": "PUBLISHER",
    "email": "ramesh@example.com",
    "phone": "+919900000001",
    "full_name": "Ramesh Kumar",
    "city": "Bengaluru",
    "created_at": "2026-08-01T06:00:00Z",
    "updated_at": "2026-08-20T11:02:10Z",
    "verification": {
      "otp_required": false,
      "publisher_verification_status": "VERIFIED",
      "publisher_suspended": false,
      "can_submit_listings": true,
      "can_create_requests": true
    },
    "publisher_profile": {
      "business_name": "Kumar Outdoor Media",
      "verification_status": "VERIFIED",
      "verified_at": "2026-08-20T11:02:10Z",
      "suspended": false
    }
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FA"
}
```

**Design note — why `can_submit_listings` and `can_create_requests` are computed server-side.** These are not new state; they are the server's own answer to the gates it will apply at §12.5 and §17.4. Exposing them lets the client disable a button instead of discovering the rule through a `409`. Because they are derived on every read, they cannot drift from the gate — and because the gate is still enforced at the action, a client that ignores them changes nothing (P3, P4). `publisher_profile` is `null` for a `VIEWER`; `publisher_verification_status` is `null` for a `VIEWER` and for an `ADMIN`.

### 5.12 Authentication flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as SEEABLE API (/api/v1/auth)
    participant SA as Supabase Auth
    participant DB as PostgreSQL (public schema)

    C->>API: POST /auth/register {role, email, password, ...}
    API->>API: reject role=ADMIN; validate shape
    API->>SA: signUp(credentials, user_metadata{role,...})
    SA->>DB: INSERT auth.users
    DB->>DB: trigger handle_new_user() → profiles (+ publisher_profiles)
    alt AUTH_OTP_ENABLED = true (MVP target)
        SA-->>API: user, no session; OTP dispatched
        API-->>C: 201 {user, verification.otp_required:true, session:null}
        C->>API: POST /auth/verify-otp {identifier, otp}
        API->>SA: verifyOtp()
        SA-->>API: session
        API-->>C: 200 {user, session}
    else AUTH_OTP_ENABLED = false (current demo build)
        SA-->>API: user + session
        API-->>C: 201 {user, verification.otp_required:false, session}
    end

    Note over C,API: Every subsequent call carries Authorization: Bearer <access_token>

    C->>API: GET /api/v1/... (Bearer)
    API->>SA: verify JWT signature + expiry
    API->>DB: query as auth.uid() — RLS applies
    DB-->>API: rows the caller may see
    API-->>C: 200 {success, data, meta, request_id}
```

---

## 6. Authorization Model

### 6.1 Roles

```text
VIEWER      Advertiser / media buyer  — demand side
PUBLISHER   Hoarding / media owner    — supply side
ADMIN       SEEABLE internal operations — trust and moderation
```

Exactly three, mutually exclusive, fixed at signup (`AUTH-001`). No role hierarchy: `ADMIN` is **not** a superset of `PUBLISHER`, and this is load-bearing, not pedantic — `request-engine.md` §4 and §23 are emphatic that Admin **cannot** accept or reject a request, and `database-design.md` §37.7 implements that by giving `requests` no `is_admin()` SELECT policy at all. An implementation that treats Admin as "can do everything" violates an approved requirement.

No granular RBAC, no permission tiers, no multiple Admin levels. That is full-scope `BR-ADMIN-002`, explicitly **FUTURE** (`admin-platform.md` header note, §25).

### 6.2 The four authorization questions

Every protected endpoint answers these in order, and a failure at any step short-circuits:

1. **Authenticated?** Valid, unexpired bearer token → else `401 AUTH_REQUIRED`.
2. **Right role?** `profiles.role` read server-side → else `403 FORBIDDEN_ROLE`.
3. **Owns the row?** For every Publisher- or Viewer-scoped resource → else `403 FORBIDDEN_NOT_OWNER` (or `404`; see §6.5).
4. **State precondition met?** Verified, not suspended, listing approved, request still `REQUESTED` → else `409` or `422` with a specific code.

Steps 2 and 3 are different checks and both are mandatory. `system-architecture.md` §18 names conflating them as *"the single most likely authorization bug in a marketplace"*: a Publisher holding the `PUBLISHER` role is necessary but not sufficient to act on **a** listing — they must own **that** listing.

### 6.3 Where authorization is enforced — three layers, none optional

| Layer | Mechanism | Catches |
|---|---|---|
| **API route** | Token validation, role check, request shape validation | Unauthenticated and wrong-role calls, before any database round trip |
| **RLS policy** | `auth.uid()`-scoped `USING` / `WITH CHECK` clauses on all 11 tables (`database-design.md` §37) | Any query that slips past the route layer — including a future route that forgets its check |
| **`SECURITY DEFINER` function** | Explicit `IF … RAISE EXCEPTION` guards inside `confirm_request()`, `approve_listing()`, etc. (`database-design.md` §41.6–§41.8) | The state-transition paths, which deliberately bypass RLS and therefore must do their own, more precise checks |

**REQUIRED:** the API route layer never uses the Supabase **service-role key** to satisfy an ordinary user request. The service role bypasses RLS entirely and is reserved for exactly three contexts: the background job routes (§28), the media pipeline's storage writes (§14), and the two server-side reads that RLS currently makes impossible (§46.1). Every other request executes as the caller's own JWT so that RLS is a live control rather than decoration (`seeable_free_first_techstack.md` §10: *"Never expose the Supabase service-role key to the browser"* — and never route ordinary traffic through it either).

### 6.4 Ownership rules

| Resource | Owner | Ownership expression | Enforced by |
|---|---|---|---|
| `profiles` row | The user | `id = auth.uid()` | RLS `profiles_select_own_or_admin`, column `GRANT` |
| `publisher_profiles` row | The Publisher | `id = auth.uid()` | RLS `pp_update_own`, column `GRANT (business_name)` |
| `hoardings` row | The Publisher who created it | `publisher_id = auth.uid()` | RLS + `owns_hoarding()` |
| `hoarding_media` row | The owning hoarding's Publisher | `owns_hoarding(hoarding_id)` | RLS `hm_*` policies |
| `hoarding_availability_blocks` row | Same | `owns_hoarding(hoarding_id)` | RLS `hab_*` policies |
| `requests` row — Viewer side | The Viewer who created it | `viewer_id = auth.uid()` | RLS `requests_select_own` |
| `requests` row — Publisher side | The Publisher who owns the hoarding | `publisher_id = auth.uid()` (denormalized, trigger-set, immutable) | RLS `requests_select_own` |
| `notifications` row | The recipient | `recipient_id = auth.uid()` | RLS `notifications_select_own` |

**Never trust a client-supplied ownership ID.** `requests.publisher_id` is set by the `validate_request_creation` `BEFORE INSERT` trigger from the parent hoarding, not from the request body; `hoardings.publisher_id` is checked against `auth.uid()` by `hoardings_insert_own`. A body field naming a different owner is either ignored (where the server derives it) or rejected with `422` — never honored.

### 6.5 `403` vs `404` — a deliberate, documented split

`system-architecture.md` §29 requires that an authorization failure *"must not leak whether the resource exists (a Publisher probing another Publisher's listing IDs)"*. That argues for `404` everywhere. But a blanket `404` makes a genuine permission problem undiagnosable. The rule this API uses:

| Situation | Response | Why |
|---|---|---|
| Caller has the wrong **role** for the endpoint | `403 FORBIDDEN_ROLE` | The endpoint's existence is public knowledge; nothing about any specific row leaks |
| Caller has the right role but does **not own** a row they can otherwise see (an approved, public hoarding) | `403 FORBIDDEN_NOT_OWNER` | The row is already visible to them via `GET /hoardings/{id}`; hiding it now leaks nothing and the honest error is more useful |
| Caller does not own a row they could **not otherwise see** (another Publisher's draft, another Viewer's request) | `404 RESOURCE_NOT_FOUND` | Distinguishing "exists but not yours" from "does not exist" is exactly the enumeration oracle §29 warns about |

This falls out of RLS naturally: a row invisible under RLS returns no rows to the query, and the route reports `404` without ever having to decide. The `403` cases are the ones where the row *is* visible and the action is what's refused.

### 6.6 Permission matrix

`✓` permitted · `✗` refused · `own` permitted on rows the caller owns · `—` not applicable.

**Authentication & profile**

| Resource | Action | Viewer | Publisher | Admin | Anonymous |
|---|---|:---:|:---:|:---:|:---:|
| Account | Register (`VIEWER`/`PUBLISHER`) | ✓ | ✓ | ✗ (out of band) | ✓ |
| Account | Log in / refresh / log out | ✓ | ✓ | ✓ | — |
| Own profile | Read | ✓ | ✓ | ✓ | ✗ |
| Own profile | Update (`full_name`, `phone`, `email`, `city` only) | ✓ | ✓ | ✓ | ✗ |
| Own profile | Change `role` | ✗ | ✗ | ✗ | ✗ |
| Publisher profile | Read own | — | ✓ | ✓ (any) | ✗ |
| Publisher profile | Update `business_name` | — | own | ✗ | ✗ |
| Publisher profile | Set `verification_status` / `suspended` | ✗ | ✗ | ✓ | ✗ |

**Inventory**

| Resource | Action | Viewer | Publisher | Admin | Anonymous |
|---|---|:---:|:---:|:---:|:---:|
| Hoarding | Read public (`INVENTORY-003` satisfied) | ✓ | ✓ | ✓ | § 6.7 |
| Hoarding | Read own in any state | — | own | ✓ (all states) | ✗ |
| Hoarding | Read another Publisher's non-visible listing | ✗ | ✗ | ✓ | ✗ |
| Hoarding | Create (as `DRAFT`) | ✗ | ✓ | ✗ | ✗ |
| Hoarding | Update content | ✗ | own (subject to `OWNER-003`) | ✗ (see below) | ✗ |
| Hoarding | Pause / unpause | ✗ | own | ✗ | ✗ |
| Hoarding | Submit for review | ✗ | own (Verified, not suspended) | ✗ | ✗ |
| Hoarding | Approve / reject | ✗ | ✗ | ✓ | ✗ |
| Hoarding | Delist / relist | ✗ | ✗ | ✓ | ✗ |
| Hoarding | Delete | ✗ | own (no request history) | ✓ (no request history) | ✗ |
| Media | Upload | ✗ | own hoarding | ✗ | ✗ |
| Media | Read public (watermarked) | ✓ | ✓ | ✓ | § 6.7 |
| Media | Read original (private) | ✗ | own | ✓ | ✗ |
| Media | Reorder / set primary | ✗ | own | ✗ | ✗ |
| Media | Delete | ✗ | own | ✗ | ✗ |
| Availability | Read computed availability of a visible listing | ✓ | ✓ | ✓ | § 6.7 |
| Availability block | Create / delete | ✗ | own | ✗ | ✗ |

**Admin's listing-edit permission is deliberately absent.** `mvp-prd.md` §5 grants Admin *"edit for moderation only"*, and `admin-platform.md` §10 is unambiguous that its scope is **completely unelaborated in every source document** and must not be invented. This API therefore exposes **no** Admin listing-edit endpoint. Admin's write powers over a hoarding are exactly four: approve, reject, delist, relist. **OPEN QUESTION (§46).**

**Request Engine**

| Resource | Action | Viewer | Publisher | Admin |
|---|---|:---:|:---:|:---:|
| Request | Create | ✓ (verified, non-duplicate) | ✗ | ✗ |
| Request | Read own | own | own listings | **✗ — see below** |
| Request | List | own (`/requests/me`) | own inbox | ✗ (aggregate counts only) |
| Request | Accept (`ACCEPT`) | ✗ | own listings | ✗ |
| Request | Reject (`REJECT`) | ✗ | own listings | ✗ |
| Request | Mark completed (`COMPLETE`) | ✗ | own listings | ✓ |
| Request | Set `amount_agreed` | ✗ | own, post-confirmation | ✗ |
| Request | Cancel / withdraw | **✗ — not an MVP feature** | ✗ | ✗ |
| Request | Set `status` directly | ✗ | ✗ | ✗ |
| Request status history | Read | own request | own listing's request | ✓ |

**Admin cannot read individual requests. This is a requirement, not an oversight.** `request-engine.md` §4 and §23 and `admin-platform.md` §12 all state it; `database-design.md` §37.7 implements it by omitting any `is_admin()` clause from `requests_select_own`. It produces one genuinely awkward consequence, documented rather than smoothed over: **an Admin can call `PATCH /api/v1/requests/{id}` with `action: "COMPLETE"` (because `mark_request_completed()` is `SECURITY DEFINER` and bypasses RLS) but cannot call `GET /api/v1/requests/{id}` on the same row (which will return `404`).** An Admin therefore has no in-product way to discover the request ID they are authorized to complete. That is a real workflow gap tied to the unwritten Support/Dispute Runbook (`README.md` Tier 1 #13) and is carried to §46 — this API does not close it by quietly granting Admin a read it was explicitly not given.

**Notifications & Admin surfaces**

| Resource | Action | Viewer | Publisher | Admin |
|---|---|:---:|:---:|:---:|
| Notification | List own | own | own | own |
| Notification | Mark read (`is_read` only) | own | own | own |
| Notification | Create | ✗ | ✗ | ✗ (server-generated only) |
| Admin dashboard | Read | ✗ | ✗ | ✓ |
| Listing approval queue | Read | ✗ | ✗ | ✓ |
| Publisher verification queue | Read | ✗ | ✗ | ✓ |
| Admin action log | Read | ✗ | ✗ | ✓ |
| Job routes (`/api/jobs/*`) | Invoke | ✗ | ✗ | ✗ (shared secret only) |

### 6.7 Anonymous access — OPEN QUESTION, with a specified default

`database-design.md` §48 flags this explicitly: *"Whether pre-signup anonymous browsing of listings should be supported — not decided by any source document"*, and its grants currently require authentication to `SELECT` from `hoardings`.

**Specified default (ASSUMPTION, matching the database as written):** every endpoint except `/auth/register`, `/auth/login`, `/auth/verify-otp`, and `/api/health` requires authentication. `GET /api/v1/hoardings` returns `401 AUTH_REQUIRED` to an anonymous caller.

**The countervailing argument is real** and belongs in the decision: `mvp-brd.md` §4's first objective is *"reduce discovery friction"*, and requiring signup before a buyer can see any inventory is friction. Enabling anonymous browsing is a small, additive change — `GRANT SELECT ON hoardings, hoarding_media, hoarding_types TO anon` plus an `anon`-inclusive RLS policy scoped to the `INVENTORY-003` predicate — and would affect exactly three endpoints (`GET /hoardings`, `GET /hoardings/{id}`, `GET /hoardings/{id}/availability`). It is specified in the OpenAPI document (§37) as `security: [{}, {bearerAuth: []}]` on those three operations so that turning it on requires no contract change. **Carried to §46.**

---

## 7. Standard API Response Envelope

### 7.1 The envelope

**REQUIRED — used consistently on every `/api/v1` endpoint, with no per-module variation.**

**Success:**

```json
{
  "success": true,
  "data": { },
  "meta": { },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8F9"
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_DATE_CONFLICT",
    "message": "These dates are no longer available — a conflicting request was already confirmed.",
    "details": {
      "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "requested_range": { "start_date": "2026-09-10", "end_date": "2026-09-20" }
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8F9"
}
```

| Field | Type | Present | Meaning |
|---|---|---|---|
| `success` | boolean | Always | `true` iff the HTTP status is 2xx. Redundant with the status code **on purpose** — it survives proxies and client wrappers that lose the status, and it makes the discriminator explicit for typed clients |
| `data` | object \| array \| null | On success | The resource, or a collection under a named key (§7.3). `null` only where a 2xx carries no resource |
| `meta` | object | On success | Pagination, computed counts, applied filters. `{}` when there is nothing to say — never omitted, so clients need no presence check |
| `error` | object | On failure | `code`, `message`, `details`. Never present on success |
| `request_id` | string | **Always**, on success and failure alike | Correlation ID, also returned as the `X-Request-Id` header (§35) |

### 7.2 Why an envelope, given the cost

An envelope adds a level of nesting to every client access. It is specified anyway, for three reasons specific to this system:

1. **The error taxonomy needs a stable machine code.** §8's whole design — and the conflict-handling requirement `request-engine.md` §10 states — depends on the client distinguishing `REQUEST_DATE_CONFLICT` from `REQUEST_DUPLICATE_PENDING`, both of which are `409`. HTTP status alone cannot carry that.
2. **`request_id` must be in the body.** `system-architecture.md` §33 requires a request ID for log correlation, and users report bugs by copying what they can see. A header-only ID is invisible in a screenshot.
3. **Pagination needs a home that is not the resource.** Putting `total` and `page` beside a list of hoardings, rather than inside it, keeps the resource shape identical whether it was fetched singly or in a page.

**The alternative was considered:** bare resource bodies with RFC 7807 `application/problem+json` for errors. It is a perfectly good design and produces smaller payloads. It was rejected because it makes success and error responses structurally unrelated, which every client then has to branch on twice — and because a half-adopted envelope is worse than either, which is the failure mode this section exists to prevent (ADR-API-006).

### 7.3 Collection responses

A collection is always a **named array inside `data`**, never a bare top-level array:

```json
{
  "success": true,
  "data": {
    "hoardings": [ { }, { } ]
  },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 57, "total_pages": 3 },
    "filters_applied": { "type": "UNIPOLE_BILLBOARD", "maxPrice": "100000.00" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FB"
}
```

The key is the plural resource name: `hoardings`, `requests`, `notifications`, `media`, `blocks`, `publishers`, `actions`. A named key rather than a generic `items` means a future response can add a sibling (a facet count, a map bounding box) without a breaking change.

### 7.4 The two endpoints that do not use the envelope

| Endpoint | Shape | Why |
|---|---|---|
| `GET /api/health` | Bare JSON, no envelope (§29) | Consumed by uptime probes and platform health checks that expect a flat body, not by application clients |
| `POST /api/jobs/*` | Bare JSON, no envelope (§28) | Internal, consumed by GitHub Actions; not part of the `/api/v1` contract |

Both are documented as exceptions here so that "the envelope is used everywhere" remains a true statement with a known, closed list of carve-outs.

### 7.5 Status codes in use

| Status | Used for |
|---|---|
| `200 OK` | Successful read; successful mutation that returns the updated resource |
| `201 Created` | `POST` that created a resource. Carries `Location` |
| `202 Accepted` | Media accepted for asynchronous watermarking (§14, Variant A only) |
| `204 No Content` | Successful delete; logout. **No body at all**, therefore no envelope and no `request_id` in the body — the `X-Request-Id` header still carries it |
| `400 Bad Request` | Malformed syntax, unparseable JSON, malformed UUID, malformed pagination |
| `401 Unauthorized` | Missing, malformed, or expired token; bad credentials |
| `403 Forbidden` | Authenticated but not permitted (§6.5) |
| `404 Not Found` | Resource absent, or invisible to this caller (§6.5) |
| `405 Method Not Allowed` | Wrong verb on an existing path. Carries `Allow` |
| `406 Not Acceptable` | `Accept` excludes JSON |
| `409 Conflict` | **The category that matters most here.** State or date precondition failed |
| `410 Gone` | Expired OTP |
| `413 Payload Too Large` | Media over the size cap (§14.4) |
| `415 Unsupported Media Type` | Wrong `Content-Type` |
| `422 Unprocessable Entity` | Syntactically valid but semantically invalid — field-level validation failures |
| `429 Too Many Requests` | Rate limited. Carries `Retry-After` |
| `500 Internal Server Error` | Unhandled fault. Never leaks detail (§33.8) |
| `501 Not Implemented` | OTP endpoint while `AUTH_OTP_ENABLED=false` |
| `503 Service Unavailable` | Database, storage, or auth provider unreachable. Carries `Retry-After` |

**`400` vs `422`, since the split is a common source of inconsistency:** `400` means the server could not *understand* the request (bad JSON, a path parameter that is not a UUID, `page=abc`). `422` means the server understood it perfectly and the content is invalid (`end_date` before `start_date`, a price with three decimals, a missing required field). Field-level `details` appear on `422`, never on `400`.

---

## 8. Error Handling

### 8.1 The error object

```json
{
  "code": "HOARDING_INCOMPLETE_ATTRIBUTES",
  "message": "This listing is missing required fields for its hoarding type.",
  "details": {
    "type_code": "UNIPOLE_BILLBOARD",
    "missing_attribute_keys": ["illumination", "facing_direction"]
  }
}
```

| Field | Contract |
|---|---|
| `code` | `UPPER_SNAKE_CASE`, stable for the life of `v1`. **This is the field clients branch on.** New codes may be added within `v1` (additive); an existing code's meaning never changes |
| `message` | English, one sentence, safe to display verbatim to any user. No SQL, no stack trace, no internal identifier, no table name |
| `details` | Machine-readable specifics, shape defined per code. `{}` when there is nothing structured to add — never omitted |

**`details` is a contract, not a debug dump.** Where a rule identifies *which* thing failed, `details` carries it: `INVENTORY-001` failures list the missing keys (`inventory.md` §24 requires the Publisher be shown *which* field is missing); date conflicts carry the conflicting range; validation failures carry a `fields` map.

### 8.2 Validation error shape

`422 VALIDATION_ERROR` always uses this `details` shape, on every endpoint:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": {
      "fields": {
        "end_date": "must be on or after start_date",
        "price": "must be a decimal string with exactly two fractional digits"
      }
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FC"
}
```

Keys are the JSON pointer path relative to the request body root, using dots for nesting and `[i]` for arrays (`attributes.pole_height`, `blocks[1].end_date`). Every failed field is reported in one response — validation does not stop at the first error, because a form that surfaces one problem per round trip is a bad form.

### 8.3 Core error taxonomy

| Error code | HTTP | Meaning | Retryable |
|---|---:|---|---|
| `VALIDATION_ERROR` | 422 | Field-level validation failed | No — fix the input |
| `BAD_REQUEST` | 400 | Unparseable or structurally malformed | No |
| `AUTH_REQUIRED` | 401 | No token supplied | No — authenticate |
| `AUTH_TOKEN_INVALID` | 401 | Malformed or bad-signature token | No |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired | **Yes** — after `POST /auth/refresh` |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong identifier or password | No |
| `AUTH_IDENTITY_IN_USE` | 409 | Email/phone already registered | No |
| `AUTH_ROLE_NOT_SELF_ASSIGNABLE` | 403 | `role: "ADMIN"` at registration | No |
| `AUTH_OTP_INVALID` | 401 | Wrong OTP | Yes, until the attempt cap |
| `AUTH_OTP_EXPIRED` | 410 | OTP past its window | No — request a new one |
| `AUTH_OTP_DISABLED` | 501 | Demo build, OTP off (§5.3) | No |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Reserved, not enabled at MVP (§5.7) | No |
| `AUTH_VERIFICATION_REQUIRED` | 403 | `AUTH-002` gate: unverified account attempting a gated action | No — complete verification |
| `FORBIDDEN` | 403 | Permission denied, unspecified | No |
| `FORBIDDEN_ROLE` | 403 | Wrong role for this endpoint | No |
| `FORBIDDEN_NOT_OWNER` | 403 | Right role, wrong owner, on a visible row (§6.5) | No |
| `ADMIN_ONLY` | 403 | Endpoint requires `ADMIN` | No |
| `RESOURCE_NOT_FOUND` | 404 | Absent, or invisible to this caller | No |
| `METHOD_NOT_ALLOWED` | 405 | Wrong verb | No |
| `NOT_ACCEPTABLE` | 406 | `Accept` excludes JSON | No |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong `Content-Type` | No |
| `PAYLOAD_TOO_LARGE` | 413 | Over the size cap | No |
| `RATE_LIMITED` | 429 | Throttled | **Yes** — after `Retry-After` |
| `INTERNAL_ERROR` | 500 | Unhandled fault | **Maybe** — safe to retry only with an `Idempotency-Key` |
| `SERVICE_UNAVAILABLE` | 503 | Database or provider unreachable | **Yes** — after `Retry-After` |
| `STORAGE_UNAVAILABLE` | 503 | Object storage unreachable | **Yes** |

### 8.4 SEEABLE-specific error taxonomy

These are the codes that carry this product's business rules. Each maps to a named rule or a named source finding.

**Pagination, filtering, and input**

| Error code | HTTP | Meaning | Retryable |
|---|---:|---|---|
| `INVALID_PAGINATION` | 400 | `page < 1`, `pageSize < 1`, or `pageSize > 100` (§9) | No |
| `INVALID_FILTER` | 400 | Unknown filter, contradictory filters, or a camelCase/snake_case duplicate (§4.7) | No |
| `INVALID_DATE_RANGE` | 422 | `end_date` before `start_date`, or an unparseable date | No |
| `DATE_RANGE_IN_PAST` | 422 | The whole requested range ends before today (§17.4) | No |
| `GEO_PARAMS_INCOMPLETE` | 400 | `maxDistance` supplied without `latitude`+`longitude`, or vice versa (§10.3) | No |

**Inventory / listing**

| Error code | HTTP | Meaning | Rule | Retryable |
|---|---:|---|---|---|
| `HOARDING_NOT_FOUND` | 404 | No such listing, or not visible to this caller | `INVENTORY-003` | No |
| `HOARDING_NOT_VISIBLE` | 409 | Exists but fails the visibility predicate at action time | `INVENTORY-003` | No |
| `HOARDING_NOT_APPROVED` | 409 | `approval_status ≠ APPROVED` | `ADMIN-001` | No |
| `HOARDING_PAUSED` | 409 | `is_paused = true` | `INVENTORY-003` | Maybe — if the Publisher unpauses |
| `HOARDING_DELISTED` | 409 | `is_delisted = true` | `ADMIN-004` | No |
| `HOARDING_INVALID_STATE` | 409 | Action illegal from the current `approval_status` | `inventory.md` §14 | No |
| `HOARDING_INCOMPLETE_ATTRIBUTES` | 409 | Type-specific required keys missing at submission | `INVENTORY-001` | No — after fixing |
| `HOARDING_MISSING_CORE_FIELDS` | 409 | `price`, `latitude`, or `longitude` null at submission | `database-design.md` §41.7 | No |
| `HOARDING_MISSING_MEDIA` | 409 | Zero media rows at submission | `CONTENT-001` (derived) | No |
| `HOARDING_MEDIA_NOT_WATERMARKED` | 409 | One or more media rows not `WATERMARKED` at submission | `CONTENT-001` | **Yes** — retry once processing completes |
| `HOARDING_EDIT_FROZEN` | 409 | Core-field edit attempted while a `REQUESTED` request exists | `OWNER-003` | Maybe — once the request resolves |
| `HOARDING_ALREADY_DELISTED` | 409 | Delist on an already-delisted listing | `ADMIN-004` | No |
| `HOARDING_NOT_DELISTED` | 409 | Relist on a listing that is not delisted | `ADMIN-004` | No |
| `HOARDING_HAS_REQUEST_HISTORY` | 409 | Hard delete blocked by the `RESTRICT` FK | `database-design.md` §38.2 | No — delist instead |
| `HOARDING_TYPE_UNKNOWN` | 422 | `type_code` not in `hoarding_types` | `mvp-prd.md` §8 | No |
| `HOARDING_TYPE_NOT_LISTABLE` | 422 | A digital type at MVP | `mvp-brd.md` §5.1 | No |

**Publisher trust state**

| Error code | HTTP | Meaning | Rule | Retryable |
|---|---:|---|---|---|
| `PUBLISHER_NOT_VERIFIED` | 403 | Unverified Publisher attempting submission | `OWNER-004` | No — await verification |
| `PUBLISHER_SUSPENDED` | 403 | Suspended Publisher attempting a new listing/submission | `ADMIN-002` | No |
| `PUBLISHER_NOT_FOUND` | 404 | No such Publisher profile | — | No |
| `PUBLISHER_VERIFICATION_STATE_CONFLICT` | 409 | Verification action illegal from the current status | `admin-platform.md` §14.1 | No |

**Request Engine — the codes that carry the core invariant**

| Error code | HTTP | Meaning | Rule | Retryable |
|---|---:|---|---|---|
| `REQUEST_NOT_FOUND` | 404 | Absent, or not this caller's request | — | No |
| `REQUEST_DATE_CONFLICT` | 409 | Requested range overlaps a `CONFIRMED`/`LIVE`/`COMPLETED` request | `REQUEST-001`, `REQUEST-004` | No — **choose different dates** |
| `REQUEST_DUPLICATE_PENDING` | 409 | This Viewer already holds a `REQUESTED` request on this listing | `VIEWER-002` | No |
| `REQUEST_STATE_CONFLICT` | 409 | The request is no longer in a state that permits this action | `request-engine.md` §7 | No |
| `REQUEST_ACTION_INVALID` | 422 | Unknown `action`, or an action the caller's role never has | §20 | No |
| `REQUEST_COMPLETE_TOO_EARLY` | 409 | `COMPLETE` before the request's `start_date` | `REQUEST-003` | **Yes** — on or after the start date |
| `REQUEST_AMOUNT_NOT_SETTABLE` | 409 | `amount_agreed` set on a `REQUESTED` request | `database-design.md` §22 | Maybe — after confirmation |
| `REQUEST_CANCEL_UNSUPPORTED` | 501 | Viewer withdrawal attempted | `request-engine.md` §20 — **not an MVP feature** | No |

**`REQUEST_DATE_CONFLICT` is the single most important error code in this API.** `request-engine.md` §10 and `system-architecture.md` §29 both require that a failed confirmation return a *specific* reason. A Publisher whose accept fails must be told the dates were taken, not shown a generic error — and the Viewer whose request cannot be confirmed must be able to distinguish that from a rejection.

**Media / Content Protection**

| Error code | HTTP | Meaning | Rule | Retryable |
|---|---:|---|---|---|
| `MEDIA_NOT_FOUND` | 404 | No such media row | — | No |
| `MEDIA_TYPE_UNSUPPORTED` | 415 | MIME type outside the allow-list (§14.4) | — | No |
| `MEDIA_TOO_LARGE` | 413 | Over the per-file cap | `seeable_free_first_techstack.md` §40 | No |
| `MEDIA_DIMENSIONS_INVALID` | 422 | Below the minimum or above the maximum pixel bound | §40 | No |
| `MEDIA_PROCESSING` | 409 | Still watermarking; the requested action needs it finished | `mvp-prd.md` §12 | **Yes** — poll |
| `MEDIA_PROCESSING_FAILED` | 409 | Terminal `FAILED` status | `inventory.md` §23 #2 | **OPEN QUESTION** — no recovery policy exists (§46) |
| `MEDIA_ORIGINAL_UNAVAILABLE` | 404 | No original retained for this row (§14.2 Variant B) | — | No |
| `MEDIA_LIMIT_EXCEEDED` | 409 | Over the per-listing media count cap (§14.4) | **RECOMMENDED** | No |

**Idempotency and jobs**

| Error code | HTTP | Meaning | Retryable |
|---|---:|---|---|
| `IDEMPOTENCY_KEY_INVALID` | 400 | Not a UUID, or too long | No |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Key reused with a different request body (§31.3) | No |
| `IDEMPOTENCY_REQUEST_IN_FLIGHT` | 409 | The original request with this key is still running | **Yes** — after `Retry-After` |
| `JOB_UNAUTHORIZED` | 401 | Missing or wrong job shared secret (§28) | No |
| `JOB_ALREADY_RUNNING` | 409 | An advisory lock is held by a concurrent run | **Yes** |

### 8.5 Mapping database errors to API errors

Every business rule in this system is ultimately enforced in PostgreSQL (`database-design.md` §41). The API layer must translate faithfully — an unmapped database exception surfacing as a `500` would turn an approved, expected business outcome into an apparent outage.

| PostgreSQL condition | SQLSTATE | Source | API result |
|---|---|---|---|
| `exclusion_violation` on `requests_no_overlapping_confirmed` | `23P01` | §31 | `409 REQUEST_DATE_CONFLICT` |
| `unique_violation` on `requests_one_pending_per_viewer_hoarding` | `23505` | §41.2 | `409 REQUEST_DUPLICATE_PENDING` |
| `foreign_key_violation` on `DELETE FROM hoardings` | `23503` | §38.2 | `409 HOARDING_HAS_REQUEST_HISTORY` |
| `check_violation` (`hoardings_rejection_reason_required_check`, price, lat/lng, date order) | `23514` | §30 | `422 VALIDATION_ERROR` with the offending field |
| `RAISE … USING ERRCODE = '42501'` | `42501` | §41.6–§41.8 | `403` — `ADMIN_ONLY` on an Admin function, `FORBIDDEN_NOT_OWNER` otherwise |
| `RAISE … USING ERRCODE = 'P0002'` (`no_data_found`) | `P0002` | §41.6–§41.8 | `404` — the resource-specific `*_NOT_FOUND` code |
| `RAISE … USING ERRCODE = '55000'` (`object_not_in_prerequisite_state`) | `55000` | §41.6–§41.8 | `409` — **the specific code depends on which function raised it** (see below) |
| Connection failure / statement timeout | `08006`, `57014` | — | `503 SERVICE_UNAVAILABLE` |
| Insufficient privilege from a column `REVOKE` | `42501` | §38.1 | `403 FORBIDDEN` — and log it as a **defect**, because the route should have rejected the field first |

**A defect in the current database functions, and the required mitigation.** `database-design.md` uses the single SQLSTATE `55000` for at least ten distinct business outcomes — dates unavailable, listing not visible, request not awaiting a decision, publisher not verified, missing attributes, media not watermarked, completion too early, edit frozen, listing not awaiting review, and rejection-reason missing. The API cannot map `55000` to a specific error code without **parsing the exception message string**, which is fragile (it breaks on any wording change and on any locale change) and is exactly the kind of coupling that produces a silent regression.

**REQUIRED mitigation, in order of preference:**

1. **Preferred:** amend the `SECURITY DEFINER` functions to attach a machine code via `USING ERRCODE = '55000', DETAIL = 'SEEABLE_CODE=REQUEST_DATE_CONFLICT'`, and have the API read `DETAIL` rather than `MESSAGE`. This is a small, additive change to `database-design.md` §41 and costs nothing at runtime.
2. **Acceptable interim:** the API re-checks the precondition itself before calling the function, so it already knows which condition failed, and treats a `55000` from the function as the authoritative *outcome* while using its own pre-check to select the *code*. This is what §19.4 specifies for confirmation, and it is sound because the function remains the enforcement point — the pre-check only chooses the message.
3. **Not acceptable:** substring-matching the message text.

This is flagged in §46 as a required amendment to `database-design.md`, not silently worked around.

### 8.6 Error-handling rules that apply everywhere

- **A failure is never ambiguous about whether it took effect.** `viewer-platform.md` §20 and §25 require that *"no partial or duplicate request is silently created."* Every 4xx in this API means nothing was written; every 5xx means the outcome is unknown and the client must retry with the same `Idempotency-Key` (§31) or re-read the resource.
- **A `500` never leaks internals.** The `message` is generic; the SQL, stack trace, and internal identifiers go to logs keyed by the same `request_id` (§35).
- **Authorization failures never reveal existence** where existence is itself private (§6.5).
- **Rate-limit responses always carry `Retry-After`.** A client that retries immediately makes the problem worse.
- **The client is told which category it hit.** `409` means "the world changed or your precondition is false"; `422` means "your input is wrong." A Publisher whose accept returns `409 REQUEST_DATE_CONFLICT` should retry a different request, not the same one.

---

## 9. Pagination

### 9.1 Mechanism — offset pagination, deliberately

**REQUIRED, one mechanism, used on every collection endpoint without exception.**

```text
?page=1&pageSize=20
```

| Parameter | Type | Default | Bounds | Invalid → |
|---|---|---|---|---|
| `page` | integer | `1` | ≥ 1 | `400 INVALID_PAGINATION` |
| `pageSize` | integer | `20` | 1 … 100 | `400 INVALID_PAGINATION` |

**Why offset and not cursor.** `viewer-platform.md` §28 leaves the mechanism explicitly undecided and `system-architecture.md` §46 defers it here. At 50–200 listings, and at the low hundreds of requests and notifications the MVP will generate, cursor pagination buys nothing: there is no deep-offset performance cliff to avoid, and the two problems cursors genuinely solve — unstable ordering under concurrent inserts, and `OFFSET 100000` scans — do not occur at this scale. Offset pagination gives the client a total count and a jump-to-page affordance for free, both of which a page-numbered results list wants. The brief's own instruction applies directly: *"Given the MVP scale of approximately 50–200 listings, choose the simplest correct mechanism. Do not overengineer this."*

**The known trade-off, stated rather than discovered later:** a row inserted or removed between two page fetches can cause an item to be skipped or repeated across page boundaries. At this scale, with listings ordered by a stable key, this is a cosmetic anomaly, not a correctness problem. If it ever becomes one, moving to a keyset cursor is an additive change: `meta.pagination` gains a `next_cursor`, a `cursor` parameter is accepted, and `page`/`pageSize` remain supported (P12).

### 9.2 Pagination metadata

Every paginated response carries exactly this object under `meta.pagination`:

```json
{
  "page": 1,
  "page_size": 20,
  "total": 57,
  "total_pages": 3,
  "has_next": true,
  "has_previous": false
}
```

- `total` is the count **after** all filters and all visibility predicates are applied, never the table's row count.
- `total_pages` is `ceil(total / page_size)`, and is `0` when `total` is `0`.
- `has_next` / `has_previous` are derived, included so a client can render controls without arithmetic.
- Note the casing shift: the query parameter is `pageSize` (§4.7), the response field is `page_size` (`snake_case` bodies). This is the documented inconsistency, applied consistently.

### 9.3 Out-of-range behavior

**A `page` beyond the last page returns `200` with an empty array, not `404`.** An empty page is a valid answer to a valid question, and returning `404` would make a client that lands on a stale page number treat a normal condition as an error.

```json
{
  "success": true,
  "data": { "hoardings": [] },
  "meta": { "pagination": { "page": 9, "page_size": 20, "total": 57, "total_pages": 3, "has_next": false, "has_previous": true } },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FD"
}
```

`page=0`, `page=-1`, `pageSize=0`, `pageSize=101`, and non-integer values are all `400 INVALID_PAGINATION` — those are malformed inputs, not empty results.

### 9.4 Which endpoints paginate

| Endpoint | Paginated | Default ordering |
|---|---|---|
| `GET /api/v1/hoardings` | Yes | §10.5 |
| `GET /api/v1/publishers/me/hoardings` | Yes | `created_at DESC` |
| `GET /api/v1/requests/me` | Yes | `created_at DESC` |
| `GET /api/v1/publishers/me/requests` | Yes | `REQUESTED` first, then `sla_deadline ASC NULLS LAST`, then `created_at DESC` |
| `GET /api/v1/notifications` | Yes | `created_at DESC` |
| `GET /api/v1/admin/hoardings` | Yes | `created_at ASC` (oldest-waiting first — a queue, not a feed) |
| `GET /api/v1/admin/publishers` | Yes | `created_at ASC` |
| `GET /api/v1/admin/actions` | Yes | `created_at DESC` |
| `GET /api/v1/requests/{id}/history` | **No** | `changed_at ASC`. Bounded by the state machine to at most 4 rows |
| `GET /api/v1/hoardings/{id}/media` | **No** | `is_primary DESC, display_order ASC`. Bounded by the media cap (§14.4) |
| `GET /api/v1/hoardings/{id}/availability` | **No** | `start_date ASC`. Bounded by the requested window (§15) |

Sub-resources with a small, structurally bounded cardinality are not paginated. Paginating a four-row status history adds a `meta` block and a round-trip contract for no benefit.

---

## 10. Filtering and Search

### 10.1 The discovery endpoint

```text
GET /api/v1/hoardings
```

**REQUIRED** — `mvp-prd.md` §9, verbatim: `GET /api/v1/hoardings?type=&city=&maxDistance=&maxPrice=`.

This is the endpoint the entire Viewer experience is built on — search results, the map, and the Home/Discover surface all consume it. `viewer-platform.md` §10 states the constraint that makes that possible: *"map and Search Results reflect the same underlying filtered result set."* **REQUIRED: there is one query surface, not a separate map endpoint.** Two endpoints filtering independently is how a listing ends up on the map but not in the list.

### 10.2 Supported parameters

| Parameter | Type | Required | Default | Source |
|---|---|---|---|---|
| `type` | `hoarding_type_code` | No | all types | **REQUIRED** — `mvp-prd.md` §9, §7.3 |
| `city` | string | No | `Bengaluru` | **REQUIRED** — `mvp-prd.md` §9 |
| `latitude` | number (−90…90) | With `maxDistance` | — | **REQUIRED (derived)** — `maxDistance` is meaningless without a centre |
| `longitude` | number (−180…180) | With `maxDistance` | — | Same |
| `maxDistance` | number, **kilometres** | No | unbounded | **REQUIRED** — `mvp-prd.md` §9, §7.3 "distance from a chosen point" |
| `maxPrice` | money string | No | unbounded | **REQUIRED** — `mvp-prd.md` §9, §7.3 "budget / price ceiling" |
| `page` | integer | No | `1` | §9 |
| `pageSize` | integer | No | `20` | §9 |
| `startDate` | `YYYY-MM-DD` | No | — | **RECOMMENDED, beyond the approved filter set** — see §10.4 |
| `endDate` | `YYYY-MM-DD` | No | — | Same |

**Nothing else is accepted.** `mvp-prd.md` §7.3 defines exactly three filters, and `viewer-platform.md` §9 is explicit that the full-scope framework's illumination / orientation / audience / material filters are **not** carried into MVP. An unrecognized query parameter returns `400 INVALID_FILTER` rather than being ignored — silently dropping a filter is how a Viewer ends up looking at results they believe are filtered and are not, which is a correctness problem dressed as leniency.

**`maxDistance` is in kilometres.** `mvp-prd.md` §9 does not state a unit. `database-design.md` §33's `haversine_km()` returns kilometres and `search_available_hoardings(p_radius_km)` takes them, so kilometres is the only reading consistent with the settled data layer. **ASSUMPTION**, stated because an unlabelled distance is a bug waiting to happen; the response's `distance_km` field names the unit so a client never has to guess.

**`type` is single-valued at MVP.** `viewer-platform.md` §9 flags multi-select as an **OPEN QUESTION** (*"not specified in `mvp-prd.md`"*), and `search_available_hoardings()` takes a single `p_type_code`. This API therefore accepts one value. **Forward-compatible spelling:** repeated `type` parameters (`?type=GANTRY&type=METRO_PILLAR`) currently return `400 INVALID_FILTER` with a message naming the single-value restriction, so that enabling multi-select later is an additive change to an already-reserved syntax rather than a new parameter name. Carried to §46.

### 10.3 Combination semantics

**All filters combine with AND.** `?type=GANTRY&maxPrice=100000.00&maxDistance=5` returns gantries **and** under ₹100,000 **and** within 5 km. There is no OR, no negation, and no grouping.

This is an **ASSUMPTION**, and `viewer-platform.md` §9 flags it as one: AND is *"the natural reading of 'search and filter inventory by type, distance, and budget'... though this is an inference, not an explicit statement."* It is also the only reading a filter UI can express, and it is what `search_available_hoardings()` implements (every predicate is `AND`-joined with a `p_x IS NULL OR …` guard). Stated here so it is a decision rather than an accident.

**Absent means unconstrained, not defaulted.** Omitting `maxPrice` returns every price, not "a sensible default ceiling." Omitting `type` returns every type. The only parameter with a value-bearing default is `city`.

**Geographic parameters are a set.** `maxDistance`, `latitude`, and `longitude` must be supplied together or not at all. Supplying any one or two of the three returns `400 GEO_PARAMS_INCOMPLETE` — the alternative (silently ignoring an incomplete geo filter) would return unfiltered results to a Viewer who asked for a 2 km radius.

**Geographic filtering is server-side, always.** `system-architecture.md` §6 is explicit: *"Geospatial filtering happens server-side, against the database, because filtered results must respect `INVENTORY-003` visibility rules that the client cannot be trusted to apply."* The client may draw the radius circle; it must never compute the result set. Implementation is the bounding-box prefilter plus exact Haversine already in `search_available_hoardings()` (`database-design.md` §33).

### 10.4 Date availability filtering — CONFLICT, surfaced not resolved

`search_available_hoardings()` accepts `p_start_date` / `p_end_date` and filters on `is_hoarding_available()`. But `mvp-prd.md` §7.3 names exactly three filters — type, distance, budget — and `system-architecture.md` §14 states the position plainly: *"date-range availability is not part of general search. There is no date filter in MVP scope. Availability is evaluated when the Viewer selects dates on the detail page."*

Two settled documents disagree: the data layer implements a date filter, the product and architecture documents say search has none.

**Resolution: not resolved. Specified as opt-in and clearly labelled.** `startDate` and `endDate` are accepted, documented as **RECOMMENDED — beyond the approved MVP filter set**, and default to absent (search behaves exactly as `mvp-prd.md` §7.3 describes unless a client opts in). They are marked in the OpenAPI document with `x-seeable-status: RECOMMENDED_BEYOND_MVP`. Supplying one without the other is `400 GEO_PARAMS_INCOMPLETE`'s sibling, `400 INVALID_FILTER`.

**Why accept them at all rather than omit them:** the capability already exists in the settled schema at zero marginal cost, and the alternative — a Viewer browsing 57 listings, opening each detail page to discover which are free on their dates — is precisely the discovery friction `mvp-brd.md` §4 exists to remove. **But it is not an approved requirement**, and a team implementing strictly to `mvp-prd.md` §7.3 may omit both parameters with no other change to this specification. **OPEN QUESTION (§46).**

### 10.5 Sorting

**No `sort` parameter exists at MVP.** `viewer-platform.md` §11 and §28 record sorting as *"not defined in `mvp-prd.md`... not treated as an MVP requirement."* Inventing a sort vocabulary now would be adding an untested product surface.

Ordering is fixed, deterministic, and documented so clients can rely on it:

| Context | Order |
|---|---|
| Geographic search (`latitude`+`longitude` supplied) | `distance_km ASC`, then `created_at DESC` |
| Non-geographic search | `created_at DESC`, then `id ASC` |

Both match `search_available_hoardings()`'s own `ORDER BY` (`database-design.md` §41.8), with `id ASC` added as a final tie-break so pagination is stable across pages when two listings share a `created_at`. Sorting by price, size, or relevance is **FUTURE** (§45).

### 10.6 Visibility — the predicate no response may ever violate

**REQUIRED, and this is the single most important invariant on the read path:**

> Every listing returned by `GET /api/v1/hoardings`, `GET /api/v1/hoardings/{id}` (to a non-owner), and every media and availability sub-resource derived from them, satisfies `INVENTORY-003`:
>
> ```text
> approval_status = 'APPROVED' AND is_paused = false AND is_delisted = false
> ```

`ADMIN-001` — *"no listing reaches Viewer search results without passing Admin approval"* — is the business rule; `INVENTORY-003` is its computable form; the `visible_hoardings` view is its single implementation (`database-design.md` §41.9). **The API never re-implements this predicate in a route handler.** `system-architecture.md` §10 names duplicated visibility filtering as one of two failure modes the architecture exists to prevent: *"a listing that slipped through one of three checks would be a direct `ADMIN-001` violation."*

Three exceptions, all narrow and all deliberate:

| Caller | Sees | Mechanism |
|---|---|---|
| The owning Publisher, on their own listings | Every state, including `DRAFT`, `PENDING_REVIEW`, `REJECTED`, paused, delisted | `hoardings_select_visible_or_own_or_admin` RLS, `publisher_id = auth.uid()` branch |
| Admin | Every listing in every state | Same policy, `is_admin()` branch — a structural necessity for the approval queue |
| Everyone else | `visible_hoardings` only | The view predicate |

**Finding — `database-design.md` defect #1, affecting this endpoint.** `search_available_hoardings()` is declared `LANGUAGE plpgsql STABLE` **without** `SECURITY DEFINER`, and it calls `is_hoarding_available()`, which is likewise `LANGUAGE sql STABLE` without `SECURITY DEFINER`. Both therefore execute under the **caller's** RLS. For a Viewer:

- `hoarding_availability_blocks` is owner/Admin-only (`hab_select_own_or_admin`) → the Viewer sees zero block rows → `NOT EXISTS (…)` evaluates **true** even when the Publisher has blocked the dates.
- `requests` is owner-only (`requests_select_own`) → the Viewer sees none of *other* Viewers' confirmed requests → `NOT EXISTS (… status IN ('CONFIRMED','LIVE','COMPLETED') …)` evaluates **true** even when the hoarding is fully booked.

The consequence is that `is_hoarding_available()` **reports every date as available to every Viewer**. The write path is unaffected — `validate_request_creation()` is `SECURITY DEFINER`, and the exclusion constraint is absolute — so no double-booking can occur. But the read path lies, and a Viewer would be shown available dates and then rejected on submission, which is exactly the behavior `viewer-platform.md` §24 forbids: *"a Viewer should never be able to submit a request against dates the system already knows are unavailable."*

**REQUIRED fix:** declare both `is_hoarding_available()` and `search_available_hoardings()` as `SECURITY DEFINER SET search_path = public`. Neither returns row data from the restricted tables — `is_hoarding_available()` returns a boolean and `search_available_hoardings()` returns only `visible_hoardings` columns — so elevating them leaks nothing while making their answers correct. Carried to §46.1 as a blocking amendment to `database-design.md`.

### 10.7 Search behavior

`mvp-prd.md` §7.3 says *"browse and search all approved, available listings."* `viewer-platform.md` §8 describes search as location- and keyword-based, and §28 records ranking, autocomplete, and typo-tolerance as undefined and non-MVP.

**Specified: there is no free-text `q` parameter at MVP.** The three approved filters plus geography *are* the search. `seeable_free_first_techstack.md` §15 and `system-architecture.md` §25 both rule out a search engine at 50–200 rows, and adding a `q` that does an unranked `ILIKE '%…%'` across `title`, `locality`, and `address_text` would be an unspecified product surface with unspecified matching semantics — precisely what §46's Open Question list exists to prevent.

**What a Viewer types into "search" maps to `locality` + `city` + the map centre**, which the three approved filters already express. A free-text query is **FUTURE** (§45), and when it arrives, PostgreSQL full-text search over `title`/`locality`/`address_text` is sufficient — no new datastore (`system-architecture.md` §25's migration trigger is a *capability* requirement, not a row count).

### 10.8 Empty results

`200` with an empty array and accurate pagination metadata. Never `404`. `viewer-platform.md` §20 requires an explicit empty state rather than a blank screen, and the client can only render one if the response distinguishes "no matches" from "something broke."

---

## 11. Inventory / Hoarding APIs

### 11.1 Endpoints

| Method | Path | Actor | Status |
|---|---|---|---|
| `GET` | `/api/v1/hoardings` | Any authenticated | **REQUIRED** — `mvp-prd.md` §9 |
| `GET` | `/api/v1/hoardings/{id}` | Any authenticated | **REQUIRED** — `mvp-prd.md` §9 |
| `POST` | `/api/v1/hoardings` | Publisher | **REQUIRED** — `mvp-prd.md` §9 |
| `PATCH` | `/api/v1/hoardings/{id}` | Publisher (own) | **REQUIRED** — `mvp-prd.md` §9 |
| `DELETE` | `/api/v1/hoardings/{id}` | Publisher (own), Admin | **REQUIRED (derived)** — `mvp-prd.md` §7.2 grants "add/edit/pause/**delete**"; `inventory.md` §21 flags the missing endpoint; `database-design.md` §41.7 implements `delete_hoarding()` |
| `POST` | `/api/v1/hoardings/{id}/submit` | Publisher (own) | **REQUIRED (derived)** — the `DRAFT → PENDING_REVIEW` transition is an approved lifecycle step (`inventory.md` §14) with no endpoint in `mvp-prd.md` §9; `submit_hoarding_for_review()` exists in the schema |
| `POST` | `/api/v1/hoardings/{id}/media` | Publisher (own) | **REQUIRED** — `mvp-prd.md` §9 |
| `GET` | `/api/v1/hoardings/{id}/media` | Per listing visibility | **REQUIRED (derived)** — a detail page cannot render a gallery otherwise |
| `PATCH` | `/api/v1/hoardings/{id}/media/{mediaId}` | Publisher (own) | **RECOMMENDED** — `is_primary` / `display_order` are the only two columns the schema grants a client (§38.1) |
| `DELETE` | `/api/v1/hoardings/{id}/media/{mediaId}` | Publisher (own) | **RECOMMENDED** — `hm_delete_own` RLS policy exists |
| `GET` | `/api/v1/media/{mediaId}/original` | Publisher (own), Admin | **RECOMMENDED** — maps to `get_original_media_path()`; the only sanctioned path to a private original (§14.6) |
| `GET` | `/api/v1/hoardings/{id}/availability` | Per listing visibility | **REQUIRED (derived)** — §15 |
| `POST` | `/api/v1/hoardings/{id}/availability/blocks` | Publisher (own) | **REQUIRED (derived)** — `mvp-prd.md` §7.2 "simple availability calendar (block/unblock dates)" |
| `DELETE` | `/api/v1/hoardings/{id}/availability/blocks/{blockId}` | Publisher (own) | **REQUIRED (derived)** — the "unblock" half of the same requirement |
| `GET` | `/api/v1/hoarding-types` | Any authenticated | **RECOMMENDED** — the type taxonomy and its `required_attribute_keys` drive the listing form; hardcoding them in the client duplicates `hoarding_types` and guarantees drift |

**No endpoint is omitted silently.** Two candidates were considered and deliberately excluded:

- **`PUT /api/v1/hoardings/{id}`** — full replacement. Excluded: a listing has server-owned fields (`approval_status`, `approved_by`, `is_delisted`, timestamps) that a client must never supply, so a `PUT` would either accept and ignore them (confusing) or reject them (making `PUT` a `PATCH` with extra steps). `PATCH` is the only sound verb here.
- **A separate `POST /api/v1/hoardings/{id}/pause`** — excluded because `is_paused` is an ordinary Inventory flag the owning Publisher controls directly, unlike a request `status`. It is set through `PATCH` (§13.4). The contrast is deliberate and explained there.

### 11.2 The Hoarding resource — public representation

Returned to any caller who is not the owning Publisher or an Admin. Every field is drawn from `database-design.md` §28.4 unless noted.

```json
{
  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "publisher": {
    "id": "11111111-1111-1111-1111-111111111111",
    "business_name": "Kumar Outdoor Media",
    "is_verified": true
  },
  "title": "Outer Ring Road Unipole — Marathahalli",
  "description": "North-facing unipole on the Marathahalli stretch of ORR.",
  "type": {
    "code": "UNIPOLE_BILLBOARD",
    "display_name": "Unipole / Billboard",
    "is_digital": false
  },
  "size": "20ft x 40ft",
  "price": "85000.00",
  "price_unit": "MONTH",
  "currency": "INR",
  "location": {
    "latitude": 12.9569,
    "longitude": 77.7011,
    "locality": "Marathahalli",
    "city": "Bengaluru",
    "address_text": "Outer Ring Road, near Marathahalli Bridge"
  },
  "attributes": {
    "height_ft": 20,
    "width_ft": 40,
    "illumination": "backlit",
    "facing_direction": "north"
  },
  "site_intelligence": {
    "footfall": 42000,
    "footfall_source": "THIRD_PARTY",
    "traffic_split": { "vehicular": 0.78, "pedestrian": 0.22 },
    "dwell_time_seconds": 9,
    "data_recency": "2026-06-30",
    "confidence_flag": "MEDIUM"
  },
  "site_intelligence_complete": true,
  "media": [
    {
      "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "media_type": "IMAGE",
      "url": "https://<storage-host>/hoarding-public/aaaaaaaa/photo-1-watermarked.jpg",
      "is_primary": true,
      "display_order": 0
    }
  ],
  "availability_summary": {
    "is_listed": true,
    "next_available_date": "2026-09-01"
  },
  "distance_km": 8.4,
  "created_at": "2026-08-20T11:02:10Z",
  "updated_at": "2026-08-25T07:41:03Z"
}
```

**Field-by-field notes on the decisions that are not self-evident:**

| Field | Note |
|---|---|
| `publisher` | **Exactly three fields, deliberately.** `mvp-brd.md` §12 names **disintermediation** as *"the single biggest structural risk of a payment-free MVP"*, and `viewer-platform.md` §12 flags exposing Publisher contact details pre-request as plausibly increasing it. `phone`, `email`, and `full_name` are therefore **never** in any Viewer-facing listing response, at any request state. See §23.4 |
| `type` | Expanded from `hoardings.type_code` by joining `hoarding_types`, so a client renders a label without a second call and without a hardcoded map |
| `size` | Free text, unit undefined — `inventory.md` §8 and `database-design.md` §19 both flag this as an unresolved **OPEN QUESTION**. The API returns it verbatim and does not attempt to parse or normalize it |
| `price` / `currency` | §4.6 |
| `attributes` | Type-specific `jsonb`, shape per §39. Returned as-is; no key is renamed or filtered |
| `site_intelligence` | **Partial data is returned as partial.** `INVENTORY-002` makes it optional, and `viewer-platform.md` §12 requires that a listing *"may show partial data, or note that some fields are unavailable, rather than presenting incomplete data as if it were complete."* Absent fields are **omitted**, never returned as `0` or `""` — a footfall of zero and an unknown footfall must not look alike |
| `site_intelligence_complete` | Returned to Viewers too, so the UI can label the summary honestly. This is the same flag the Admin queue uses (`INVENTORY-002`), not a separate computation |
| `media` | **Watermarked derivatives only.** `original_storage_path` is not merely omitted from this schema — it is column-`REVOKE`d from every client role in the database (§38.1). See §14 and P11 |
| `availability_summary` | Coarse, listing-level, and deliberately not a calendar. `viewer-platform.md` §11 asks for an availability *indicator* on a result card; the full calendar is §15's endpoint. `next_available_date` is **RECOMMENDED**, computed from the first date ≥ today not covered by a block or a `CONFIRMED`/`LIVE`/`COMPLETED` request |
| `distance_km` | Present **only** when the request supplied `latitude`+`longitude`; `null` otherwise. Kilometres (§10.2) |
| `approval_status` | **Absent from the public representation.** A Viewer only ever sees `APPROVED` listings, so the field carries no information and its presence would invite a client to filter on it — duplicating `INVENTORY-003` in the client, which §10.6 forbids |

**Caching.** `GET /api/v1/hoardings` and `GET /api/v1/hoardings/{id}` return `Cache-Control: private, max-age=0, must-revalidate`. Listing visibility can change the instant an Admin delists or a Publisher pauses, and `system-architecture.md` §37 is explicit that *"`INVENTORY-003` visibility must never be served stale (an `ADMIN-001` violation)"*. No shared or CDN caching of listing JSON at MVP. Media *assets* in the public bucket are immutable once watermarked and may be cached aggressively — that is a storage-layer concern, not an API one.

### 11.3 The Hoarding resource — owner and Admin representation

The owning Publisher and Admin receive every public field **plus** the moderation and lifecycle fields:

```json
{
  "approval_status": "PENDING_REVIEW",
  "rejection_reason": null,
  "approved_at": null,
  "approved_by": null,
  "is_paused": false,
  "paused_at": null,
  "is_delisted": false,
  "delisted_at": null,
  "delist_reason": null,
  "submission_readiness": {
    "can_submit": false,
    "blockers": [
      { "code": "HOARDING_MEDIA_NOT_WATERMARKED", "message": "1 of 3 media assets is still processing." }
    ]
  },
  "media": [
    {
      "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "media_type": "IMAGE",
      "url": "https://<storage-host>/hoarding-public/aaaaaaaa/photo-1-watermarked.jpg",
      "is_primary": true,
      "display_order": 0,
      "processing_status": "WATERMARKED",
      "watermarked_at": "2026-08-20T10:58:00Z",
      "has_original": true
    }
  ],
  "pending_request_count": 2,
  "is_edit_frozen": true
}
```

| Field | Note |
|---|---|
| `approved_by` / `delisted_by` | Returned to **Admin only**, never to the owning Publisher. They identify an internal staff member; `database-design.md` §19 adds them as a moderation audit measure, not as Publisher-facing information |
| `submission_readiness` | **RECOMMENDED.** The server already evaluates every gate in `submit_hoarding_for_review()`; surfacing the result turns a `409` into a checklist. `blockers` is an array of `{code, message}` using the same codes as §8.4, so the client renders one component for both the pre-check and the failure |
| `has_original` | Boolean, never the path. Tells the owner whether `GET /api/v1/media/{id}/original` will succeed, without exposing anything (§14.6) |
| `pending_request_count` | Count of `REQUESTED` rows on this listing. **RECOMMENDED** — it is the reason `is_edit_frozen` is true, and a Publisher told "you cannot edit" deserves to know why |
| `is_edit_frozen` | `OWNER-003`, computed. `true` iff at least one `REQUESTED` request exists on this listing (§13.3) |

**Finding — `database-design.md` defect #2, affecting the `publisher` block in §11.2.** Both `profiles` and `publisher_profiles` carry RLS of the form `id = auth.uid() OR is_admin()`. A Viewer therefore **cannot read** the Publisher's `full_name`, and cannot read `publisher_profiles.business_name` or `verification_status` at all. As written, the `publisher` object in every listing response is unservable to the audience it exists for.

**REQUIRED fix, minimal and privacy-preserving:** add a `SECURITY DEFINER` function or a narrow view that exposes exactly the three public fields for a Publisher who owns at least one visible listing —

```sql
CREATE OR REPLACE FUNCTION public_publisher_summary(p_publisher_id uuid)
RETURNS TABLE (id uuid, business_name text, is_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.id, pp.business_name, (pp.verification_status = 'VERIFIED')
  FROM publisher_profiles pp
  WHERE pp.id = p_publisher_id
    AND EXISTS (SELECT 1 FROM hoardings h
                WHERE h.publisher_id = pp.id
                  AND h.approval_status = 'APPROVED'
                  AND NOT h.is_paused AND NOT h.is_delisted);
$$;
```

Note what this deliberately does **not** return: `phone`, `email`, `full_name`, `suspended`, `verified_at`, or `verification_rejection_reason`. It exposes only the three fields §11.2 specifies, only for Publishers with live inventory, which is exactly the disintermediation-conscious minimum `viewer-platform.md` §12 argues for. Carried to §46.1.

### 11.4 `GET /api/v1/hoardings/{id}`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer (see §6.7 for the anonymous Open Question) |
| Authorization | Visible under `INVENTORY-003`, **or** owned by the caller, **or** caller is Admin |
| Path param | `id` — UUID. Malformed → `400 VALIDATION_ERROR` |
| Query params | `latitude`, `longitude` — optional, together, to populate `distance_km` |
| Response | `200` with the public (§11.2) or owner/Admin (§11.3) representation, chosen by the caller's relationship to the row |
| Rate limit | **RECOMMENDED** 120 / min / user |

**Errors**

| Status | Code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `id` is not a UUID |
| 401 | `AUTH_REQUIRED` | No token |
| 404 | `HOARDING_NOT_FOUND` | No such row, **or** the row exists but fails `INVENTORY-003` for a non-owner. §6.5's rule: a Viewer must not be able to distinguish "this listing was delisted" from "this ID never existed", because that distinction is a Publisher-inventory oracle |

**A note on the `404` for a paused listing.** `viewer-platform.md` §21 requires that a Viewer who opened a listing that then becomes unavailable *"is shown an Unavailable state"* rather than a broken reference. Both are true and they are not in tension: the **detail fetch** returns `404 HOARDING_NOT_FOUND`, and the **client** renders that as the "no longer available" state rather than as a generic error page. The API's job is to stop serving the row; the copy is the client's. Where the Viewer already holds a *request* against that listing, `GET /api/v1/requests/{id}` still returns the request with its embedded hoarding summary (§21.2), so `My Requests` never resolves to a dangling reference.

### 11.5 Hoarding type reference

```text
GET /api/v1/hoarding-types
```

**RECOMMENDED.** Returns the seeded `hoarding_types` rows — the eight-type taxonomy, `is_digital`, and `required_attribute_keys`.

```json
{
  "success": true,
  "data": {
    "hoarding_types": [
      {
        "code": "UNIPOLE_BILLBOARD",
        "display_name": "Unipole / Billboard",
        "is_digital": false,
        "is_listable": true,
        "required_attribute_keys": ["height_ft", "width_ft", "illumination", "facing_direction"],
        "description": "Single-pole outdoor billboard structure"
      }
    ]
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FE"
}
```

**Why this endpoint earns its place.** `INVENTORY-001` requires that type-specific fields be complete before submission, and `database-design.md` §18 makes `required_attribute_keys` a **data** column precisely so *"adding or correcting a required field for one type is a data change, not a schema migration."* A client that hardcodes the field list defeats that design and guarantees a client/server disagreement the first time a key is corrected. This endpoint is the listing form's source of truth.

`is_listable` is derived as `NOT is_digital` and is **not** a database column. `mvp-brd.md` §5.1 scopes MVP listing to *"static hoarding types only"*, and `database-design.md` §18 recommends enforcing that at the application layer while keeping the digital rows seeded. The derived field puts that rule in one place rather than asking every client to reason from `is_digital` to "may I offer this in the dropdown."

`Cache-Control: private, max-age=3600` — reference data that changes only by migration.

---

## 12. Listing Creation API

### 12.1 `POST /api/v1/hoardings`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer, required |
| Authorization | `role = PUBLISHER`. A Viewer or Admin receives `403 FORBIDDEN_ROLE` |
| Verification | **Not required to create.** `OWNER-004`: *"An unverified Publisher can draft listings but cannot submit them for Admin approval."* The gate is at submission (§12.5), not creation |
| Idempotency | `Idempotency-Key` **RECOMMENDED** (§31) |
| Rate limit | **RECOMMENDED** 30 / hour / Publisher |
| Module | Inventory (Publisher Platform invokes it) |
| Transaction | Single `INSERT` — atomic by construction |

**Creates a listing in `DRAFT`. It does not submit it, and it does not make it visible to anyone but its owner.**

### 12.2 Request

```json
{
  "type_code": "UNIPOLE_BILLBOARD",
  "title": "Outer Ring Road Unipole — Marathahalli",
  "description": "North-facing unipole on the Marathahalli stretch of ORR.",
  "size": "20ft x 40ft",
  "price": "85000.00",
  "price_unit": "MONTH",
  "latitude": 12.9569,
  "longitude": 77.7011,
  "locality": "Marathahalli",
  "city": "Bengaluru",
  "address_text": "Outer Ring Road, near Marathahalli Bridge",
  "attributes": {
    "height_ft": 20,
    "width_ft": 40,
    "illumination": "backlit",
    "facing_direction": "north"
  },
  "site_intelligence": {
    "footfall": 42000,
    "footfall_source": "THIRD_PARTY",
    "traffic_split": { "vehicular": 0.78, "pedestrian": 0.22 },
    "dwell_time_seconds": 9,
    "data_recency": "2026-06-30",
    "confidence_flag": "MEDIUM"
  }
}
```

### 12.3 Validation

**Required at creation** — only what the database itself makes `NOT NULL`, so a Publisher can save an incomplete draft and come back to it:

| Field | Rule | Error |
|---|---|---|
| `type_code` | Present; exists in `hoarding_types` | `422 HOARDING_TYPE_UNKNOWN` |
| `type_code` | `is_digital = false` at MVP | `422 HOARDING_TYPE_NOT_LISTABLE` |
| `title` | Present, 1–200 code points | `422 VALIDATION_ERROR` |

**Optional at creation, required at submission** — enforced by `submit_hoarding_for_review()` (§12.5), not here:

`price`, `latitude`, `longitude`, every key in the type's `required_attribute_keys`, and at least one fully watermarked media asset.

**This split is the whole point of the Draft state.** `mvp-prd.md` §7.2's flow is create → fill → upload media → submit, and `INVENTORY-001` is explicitly *"a submission gate, not an approval criterion"* (`inventory.md` §9). Requiring the complete field set at `POST` would make it impossible to upload media to a listing that does not yet exist, which is a circular dependency — media attaches to `/hoardings/{id}/media`.

**Validated when present:**

| Field | Rule |
|---|---|
| `price` | Money string (§4.6), `> 0` (`hoardings_price_positive_check`) |
| `price_unit` | `DAY` \| `WEEK` \| `MONTH`, default `MONTH` |
| `latitude` | −90…90 (`hoardings_lat_range_check`) |
| `longitude` | −180…180 (`hoardings_lng_range_check`) |
| `city` | Default `"Bengaluru"`. **RECOMMENDED:** a value other than `Bengaluru` is accepted and stored — the column exists for multi-city expansion (`database-design.md` §46) and rejecting it would hardcode a launch constraint into the data layer. The client simply does not offer the choice at MVP |
| `attributes` | A JSON object. **Not validated against `required_attribute_keys` here** — unknown keys are stored, missing keys are permitted; §12.5 is where completeness is enforced |
| `site_intelligence` | A JSON object, optional, entirely. `INVENTORY-002` |
| `size` | Free text, ≤ 100 code points |

**Server-generated — silently ignored if a client sends them, and rejected with `422` if sent explicitly non-null** (fail loudly rather than pretend to honor):

`id`, `publisher_id`, `approval_status`, `rejection_reason`, `approved_at`, `approved_by`, `is_paused`, `paused_at`, `is_delisted`, `delisted_at`, `delisted_by`, `delist_reason`, `site_intelligence_complete`, `created_at`, `updated_at`.

**`publisher_id` is never read from the body.** It is set to `auth.uid()`, and `hoardings_insert_own` RLS (`WITH CHECK (publisher_id = auth.uid())`) makes a mismatch impossible even if a route handler forgot. This is the "never trust client-provided ownership IDs" rule made structural.

**`site_intelligence_complete` is server-derived, not client-set.** `INVENTORY-002` makes it a flag the **Admin queue** consumes. **RECOMMENDED derivation:** `true` when every key in a documented Site Intelligence key set is present and non-null; `false` otherwise, recomputed on every write to `site_intelligence`. **OPEN QUESTION (§46):** no source document defines which Site Intelligence fields must be present for "complete" — `mvp-prd.md` §8 lists nine field groups but never says whether all nine are needed. This document does not invent the threshold; it specifies that the server owns the computation.

### 12.4 Response — `201 Created`

```http
HTTP/1.1 201 Created
Location: /api/v1/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

Body: the owner representation (§11.3), with `approval_status: "DRAFT"`, empty `media`, and a populated `submission_readiness.blockers` array naming everything still outstanding.

**Side effects:** one `hoardings` row. **No notification** — `mvp-prd.md` §7.6's event list contains no listing-created event, and `admin-platform.md` §17 confirms the Admin queue is populated at submission, not creation. **No `admin_actions` row** — creation is not a moderation action.

### 12.5 `POST /api/v1/hoardings/{id}/submit`

**REQUIRED (derived).** No endpoint exists in `mvp-prd.md` §9 for the `DRAFT → PENDING_REVIEW` transition, yet the transition is approved (`inventory.md` §14) and `submit_hoarding_for_review()` implements it. `inventory.md` §21 flags exactly this class of gap.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` **and** owns this listing |
| Idempotency | **REQUIRED** semantics: a second submit on an already-`PENDING_REVIEW` listing returns `409 HOARDING_INVALID_STATE`, never a duplicate transition (§31) |
| Rate limit | **RECOMMENDED** 60 / hour / Publisher |
| Transaction | One `SECURITY DEFINER` function call — `submit_hoarding_for_review(p_hoarding_id)` |
| Request body | None |

**The submission gate, in the order the function evaluates it** (`database-design.md` §41.7). Every check is server-side; none is advisory.

| # | Gate | Rule | Failure |
|---|---|---|---|
| 1 | Listing exists | — | `404 HOARDING_NOT_FOUND` |
| 2 | Caller owns it | §6.4 | `403 FORBIDDEN_NOT_OWNER` |
| 3 | `approval_status ∈ {DRAFT, REJECTED}` | `inventory.md` §14 | `409 HOARDING_INVALID_STATE` |
| 4 | Publisher `verification_status = 'VERIFIED'` | **`OWNER-004`** | `403 PUBLISHER_NOT_VERIFIED` |
| 5 | Publisher `suspended = false` | **`ADMIN-002`** | `403 PUBLISHER_SUSPENDED` |
| 6 | `price`, `latitude`, `longitude` all non-null | `database-design.md` §41.7 | `409 HOARDING_MISSING_CORE_FIELDS` |
| 7 | `attributes ?& required_attribute_keys` | **`INVENTORY-001`** | `409 HOARDING_INCOMPLETE_ATTRIBUTES`, `details.missing_attribute_keys` |
| 8 | At least one media row | `inventory.md` §8 (**ASSUMPTION** — no source states a minimum) | `409 HOARDING_MISSING_MEDIA` |
| 9 | Every media row `processing_status = 'WATERMARKED'` | **`CONTENT-001`** | `409 HOARDING_MEDIA_NOT_WATERMARKED` |

**Gate 7's error carries the missing keys, because a rule is useless if the Publisher cannot act on it.** `inventory.md` §24's acceptance criterion is explicit: *"the Publisher is shown which field is missing."*

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_INCOMPLETE_ATTRIBUTES",
    "message": "This listing is missing required fields for its hoarding type.",
    "details": {
      "type_code": "UNIPOLE_BILLBOARD",
      "required_attribute_keys": ["height_ft", "width_ft", "illumination", "facing_direction"],
      "missing_attribute_keys": ["illumination", "facing_direction"]
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FF"
}
```

**Gate 9 is retryable and must be presented as such.** `mvp-prd.md` §12's acceptance criterion is unambiguous: *"the Publisher sees a 'processing media' status, not an error."* The response therefore names how many assets are outstanding, and the client renders a waiting state rather than a failure:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_MEDIA_NOT_WATERMARKED",
    "message": "Media is still being processed. This listing can be submitted once processing finishes.",
    "details": { "total_media": 3, "pending_media": 1, "failed_media": 0, "retryable": true }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E900"
}
```

When `failed_media > 0` the code is `MEDIA_PROCESSING_FAILED` instead, `retryable` is `false`, and the Publisher must delete and re-upload the failed asset — because **no recovery policy for terminal watermark failure exists in any source document** (`inventory.md` §23 #2, `system-architecture.md` §20, `database-design.md` §48 all record this gap). Delete-and-reupload is this API's **RECOMMENDED** interim path, not a sourced requirement (§46).

**Response — `200 OK`:** the owner representation with `approval_status: "PENDING_REVIEW"` and `rejection_reason` cleared.

**Resubmission after rejection is supported** — gate 3 admits `REJECTED`, and `submit_hoarding_for_review()` reuses the same row and clears `rejection_reason`. This is an **ASSUMPTION** that `database-design.md` §17 makes and this API adopts: `admin-platform.md` §22 #5 leaves *"same record reopened, or a new one created"* genuinely open. It is flagged rather than presented as settled (§46).

**Side effects:** `approval_status` → `PENDING_REVIEW`; the listing enters `GET /api/v1/admin/hoardings`. **No notification is emitted** — `mvp-prd.md` §7.6's event list has no "listing submitted" event, and `admin-platform.md` §17 confirms only approve/reject notify. An Admin discovers the queue item by polling the queue endpoint. **RECOMMENDED for consideration, not built:** an Admin-facing "new submission" notification would need a new `notifications.type` value and is therefore a scope addition, not an omission to fix silently (§46).

---

## 13. Listing Update API

### 13.1 `PATCH /api/v1/hoardings/{id}`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` **and** `publisher_id = auth.uid()` |
| Idempotency | Naturally idempotent — the same body applied twice yields the same row |
| Rate limit | **RECOMMENDED** 120 / hour / Publisher |
| Transaction | One `UPDATE`; the `enforce_hoarding_edit_freeze` `BEFORE UPDATE` trigger and RLS both apply |

Partial update. Only supplied keys change. A key supplied as `null` sets the column to `NULL` where the column is nullable, and is a `422` where it is not — `null` and "absent" are different instructions and are treated as such.

### 13.2 Editable, restricted, and immutable fields

**Freely editable by the owning Publisher (subject to §13.3's freeze):**

`title`, `description`, `size`, `price`, `price_unit`, `latitude`, `longitude`, `locality`, `city`, `address_text`, `attributes`, `site_intelligence`, `is_paused`.

**Never client-writable — `422 VALIDATION_ERROR` if present:**

`id`, `publisher_id`, `approval_status`, `rejection_reason`, `approved_at`, `approved_by`, `is_delisted`, `delisted_at`, `delisted_by`, `delist_reason`, `site_intelligence_complete`, `created_at`, `updated_at`.

**`approval_status` is the important one.** A client that could `PATCH {"approval_status": "APPROVED"}` would bypass `ADMIN-001` entirely. It is refused at the route, is not in the client's column `GRANT` for the fields Admin functions own, and can only be moved by `submit_hoarding_for_review()`, `approve_listing()`, or `reject_listing()`. Three independent layers, because this is the rule the whole moderation model rests on.

**`type_code` — RECOMMENDED as immutable after creation.** `inventory.md` §23 #5 flags *"whether a listing's `type` can be changed after creation, and whether that re-triggers `INVENTORY-001` validation"* as an **OPEN QUESTION**. Changing the type silently invalidates every key in `attributes` and could leave an already-`APPROVED` listing describing a gantry with unipole fields. This API refuses `type_code` on `PATCH` with `422 VALIDATION_ERROR` (`"type_code cannot be changed after creation; create a new listing"`), which is the conservative reading. If the business decides type changes are needed, the correct behavior is to force `approval_status` back to `DRAFT` and re-run `INVENTORY-001` — but that is a product decision, carried to §46.

### 13.3 `OWNER-003` — the edit freeze

> **`OWNER-003`:** Core listing fields cannot be edited while a request on that listing is pending confirmation.

**Enforced in the database**, by `enforce_hoarding_edit_freeze` (`database-design.md` §41.5), which blocks an `UPDATE` that changes any of:

```text
title, type_code, attributes, price, latitude, longitude
```

while any request on the listing has `status = 'REQUESTED'`.

**Which fields are "core" is an OPEN QUESTION, and this document does not close it.** `mvp-prd.md` §7.2 states the rule in prose and never enumerates the field set. `inventory.md` §18 notes only that `OWNER-003` covers *"core listing fields (which this document defines the shape of)"*, and `request-engine.md` §21 extends it by inference to price (*"falls under `OWNER-003` … by extension of `OWNER-003` rather than a separate rule"*). The six-column list above is `database-design.md`'s **implementation choice**, and this API adopts it because the settled schema enforces it — but the list is a design decision, not a sourced requirement.

Two consequences worth naming, because the boundary is genuinely arguable:

- **`size` is NOT frozen** under the current list, yet size is one of the four fields `BR-VIEWER-002` names as essential for like-for-like comparison. A Publisher could change a listing from 20×40 to 10×20 while a Viewer's request on it is pending. That looks like a gap.
- **`description` and `address_text` are NOT frozen**, which is almost certainly correct — a typo fix should not require waiting out a request.

**Carried to §46 as an OPEN QUESTION with a recommendation:** add `size` to the frozen set. It is a one-line change to the trigger, and it closes the only case where a frozen-field omission changes what the Viewer thought they were requesting.

**API behavior on a frozen edit:**

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_EDIT_FROZEN",
    "message": "Core listing details cannot be changed while a request on this listing is awaiting your response.",
    "details": {
      "frozen_fields": ["title", "type_code", "attributes", "price", "latitude", "longitude"],
      "attempted_fields": ["price"],
      "pending_request_count": 2
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E901"
}
```

Status `409 HOARDING_EDIT_FROZEN`. **Partial application is never attempted** — a `PATCH` touching one frozen and two unfrozen fields is rejected in full. Applying two of three changes and reporting failure would leave the Publisher unable to tell what took effect, which §8.6 forbids.

**Pause is explicitly exempt from the freeze.** `is_paused` is not in the trigger's column list, so a Publisher can always pause a listing even with pending requests. This is correct and matches `database-design.md` §44 test scenario #8: pausing is how a Publisher signals "stop new demand", and freezing it during exactly the period when demand exists would be backwards.

### 13.4 Pause and unpause

**Pause is a field, not an action.** `PATCH /api/v1/hoardings/{id}` with `{"is_paused": true}`.

The contrast with request `status` (§20) is deliberate and worth stating, because the two look superficially similar:

| | Request `status` | Hoarding `is_paused` |
|---|---|---|
| Owner | Request Engine | Inventory |
| Who may set it | **Nobody, directly.** Only `SECURITY DEFINER` functions | The owning Publisher, directly |
| Preconditions | A state machine with guarded transitions | None — it is a boolean the owner toggles |
| Concurrency risk | The core invariant of the system | None — last write wins, harmlessly |
| API shape | `{"action": "ACCEPT"}` | `{"is_paused": true}` |

`mvp-prd.md` §7.2 lists pause alongside add/edit/delete as an ordinary Publisher listing operation, and `inventory.md` §15 characterizes it as *"reversible … 'block/unblock', i.e. pausing is explicitly reversible language."* There is no state machine to protect, so a field is the honest representation. Modelling it as an action would imply guarantees that do not exist.

**Effects.** `is_paused = true` removes the listing from `visible_hoardings`, and therefore from all Viewer search, map, and detail responses, immediately and with no reindexing step (`INVENTORY-003`, §10.6). `approval_status` is **untouched** — an approved, paused listing is still approved, and unpausing restores visibility without re-approval (`inventory.md` §15). `paused_at` is set by the server.

**What pause does NOT do — OPEN QUESTION, and the API takes the conservative reading.** No source document defines what happens to requests already `REQUESTED` or `CONFIRMED` on a listing that is then paused. `request-engine.md` §21 and §25 #8, `inventory.md` §23 #6, and `admin-platform.md` §22 #10 all flag it, and `database-design.md` §48 confirms nothing auto-rejects them.

**Specified behavior, matching the database as written:**

- Existing `REQUESTED` requests are **not** auto-rejected or auto-expired. They remain, and the Publisher can still reject them.
- Existing `CONFIRMED` / `LIVE` requests are **completely unaffected**. This is required, not merely permitted — `ADMIN-002`'s neighbouring principle is that already-confirmed commitments complete as agreed, and nothing in the pause requirement overrides it.
- **A paused listing cannot be `ACCEPT`ed**, because `confirm_request()` re-validates `INVENTORY-003` at accept time (§19.3). A Publisher who pauses and then tries to accept a pending request receives `409 HOARDING_NOT_VISIBLE`. This is a real, reachable state and clients must handle it.
- **No new requests can be created** against a paused listing — `validate_request_creation()` rejects them (§17.4).

That last pair is worth internalizing: pausing does not cancel pending demand, but it does make that demand unconfirmable until the listing is unpaused. Whether that is the intended product behavior is genuinely open (§46).

### 13.5 `DELETE /api/v1/hoardings/{id}`

**REQUIRED (derived)** — `mvp-prd.md` §7.2 grants delete; `inventory.md` §21 flags the missing endpoint; `delete_hoarding()` implements it.

| | |
|---|---|
| Auth | Bearer |
| Authorization | Owning Publisher **or** Admin (`delete_hoarding()` permits both) |
| Response | `204 No Content` |
| Idempotency | A second delete returns `404 HOARDING_NOT_FOUND` — safe, and honest about the outcome |

**Delete is a hard delete, and it is structurally impossible on any listing with request history.** `requests.hoarding_id` is `ON DELETE RESTRICT`, so PostgreSQL itself refuses the delete; `delete_hoarding()` catches the foreign-key violation and re-raises a clear message (`database-design.md` §38.2). The API maps it to:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_HAS_REQUEST_HISTORY",
    "message": "This listing has request history and cannot be deleted. Pause it to hide it from search, or contact SEEABLE support to have it delisted.",
    "details": { "suggested_action": "PAUSE" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E902"
}
```

Status `409 HOARDING_HAS_REQUEST_HISTORY`.

**Why this constraint is a feature and not an obstacle.** `inventory.md` §15 identified the risk precisely: if delete were a soft flag or, worse, a cascade, an Admin's or Publisher's cleanup action could orphan a `COMPLETED` request's `hoarding_id` and destroy the record of a real commercial event that happened offline — in a product whose entire trust model is *"strong Admin moderation now"* with no payment trail (`mvp-brd.md` §17). The `RESTRICT` FK makes that outcome unreachable by any code path, present or future.

**Cascades that do occur:** `hoarding_media` and `hoarding_availability_blocks` are `ON DELETE CASCADE` — they have no meaning without the parent. **Storage objects are not cascaded by the database.** The route must delete the corresponding objects from both buckets after the row delete commits — **outside the transaction** (P8, `system-architecture.md` §44 rule 11). A storage-delete failure leaves an orphaned object, which is a cleanup-job concern (§28.6), not a reason to fail the request or hold a lock on a third-party call.

**Delete vs. pause vs. delist — three actions, three actors, three mechanisms.** `inventory.md` §15 is emphatic that these must not be conflated:

| Action | Actor | Endpoint | Mechanism | Reversible |
|---|---|---|---|---|
| Pause | Publisher | `PATCH /hoardings/{id}` `{"is_paused": true}` | Flag | Yes |
| Delete | Publisher / Admin | `DELETE /hoardings/{id}` | Row removal, blocked by FK | **No** |
| Delist | **Admin only** | `POST /admin/hoardings/{id}/delist` | Flag (`ADMIN-004`) | Yes (`relist`) |

They are three separate endpoints on purpose. `inventory.md` §15 names the exact bug that merging them would cause: *"if 'Delist' were implemented as calling the same code path as 'Delete', an Admin's trust-and-safety action could accidentally destroy the historical listing record."*

---

## 14. Media API

### 14.1 The pipeline this API serves

```mermaid
graph LR
    P["Publisher client"] -->|"POST multipart"| API["POST /hoardings/{id}/media"]
    API --> V["Validate<br/>MIME · size · dimensions · ownership"]
    V -->|"reject"| E["413 / 415 / 422"]
    V --> ORIG[("hoarding-private<br/>original")]
    V --> DER["Derivative pipeline<br/>resize · compress · watermark"]
    DER --> PUB[("hoarding-public<br/>watermarked only")]
    DER --> ST["processing_status → WATERMARKED"]
    ST --> ROW["hoarding_media row"]
    PUB -->|"public URL"| VIEW["Viewer"]
    ORIG -.->|"signed URL, owner/Admin only"| OWN["GET /media/{id}/original"]
    ROW --> GATE{"submit_hoarding_for_review()<br/>CONTENT-001 gate"}
```

**The two rules the whole pipeline exists to enforce, restated:**

1. **`CONTENT-001`** — a listing cannot be submitted for approval while any media asset is not fully watermarked.
2. **`mvp-prd.md` §7.7** — *"Unwatermarked originals are never exposed via a public URL."* Structurally, not by URL discipline: `system-architecture.md` §21 requires that a bug produce a broken link, not a leak.

### 14.2 CONFLICT — where watermarking happens

Two settled documents specify different pipelines.

| | Variant A — server-side worker | Variant B — browser-side Canvas |
|---|---|---|
| Source | `system-architecture.md` §20, ADR-004; `mvp-prd.md` §7.7 (*"passed through an automatic watermark pipeline **before it is stored or served**"*) | `seeable_free_first_techstack.md` §16–§18 (*"prefer browser-side image processing using Web APIs such as Canvas"*), Decision 6 |
| Flow | Client uploads the original → API stores it privately → job watermarks → derivative lands in the public bucket | Client resizes, compresses and watermarks in Canvas → uploads the derivative (and optionally the original) → API stores both |
| `processing_status` on upload | `UPLOADED` → `PROCESSING` → `WATERMARKED` | `WATERMARKED` immediately |
| Response | `202 Accepted` | `201 Created` |
| Needs a `/api/jobs/process-media` route | **Yes** | **No** |
| Integrity | The server produces the watermark. A Publisher cannot bypass it | **The client produces the watermark.** A modified client could upload an unwatermarked derivative and the server cannot tell |

**This conflict is not resolved here.** Precedence rule 1 favours Variant B (`seeable_free_first_techstack.md` is the later, more specific document and is the settled ₹0 stack), but precedence rule 3 favours Variant A (`mvp-prd.md` §7.7's *"before it is stored or served"* and `CONTENT-001`'s protection intent are explicit business rules, and Variant B makes the frontend the effective enforcer of a content-protection rule — which `system-architecture.md` §44 rule 2 and this brief's own architecture rules forbid in the authorization case and disfavour generally).

**What this specification does instead: the wire contract is identical under both, so the choice does not change any client.**

- The request shape, path, authorization, validation, and error codes are the same.
- The only observable difference is the immediate `processing_status` (`UPLOADED` vs `WATERMARKED`) and therefore the status code (`202` vs `201`).
- **A client must handle both.** After upload it polls `GET /api/v1/hoardings/{id}/media` until every asset reads `WATERMARKED`, or submits and handles `409 HOARDING_MEDIA_NOT_WATERMARKED`. Under Variant B the poll terminates immediately; under Variant A it takes a job cycle. No branching on pipeline variant is required or permitted in client code.

**Rules that hold under both variants, without exception:**

- `processing_status` and both storage paths are **written only by the server**. They are not fields in the request body, and the client's assertion that it watermarked something is never what sets `WATERMARKED` — the server sets it because the configured pipeline is B, not because the client said so.
- The public bucket write is performed by the **API using the service role**, not by the browser writing directly to Supabase Storage. This costs one hop and buys the only integrity control Variant B can have: the server validates MIME, size, and dimensions on the bytes it is about to publish, and it — not the client — chooses the storage path.
- No response, at any privilege level, contains a URL that resolves to `hoarding-private`.

**Recommendation attached to the Open Question (§46):** ship Variant B for the demo build, because it is what the settled ₹0 stack specifies and it works within Cloudflare Workers' constraints (`seeable_free_first_techstack.md` §18 warns that Node-only libraries such as Sharp will not run there). **Restore Variant A before real Publisher inventory goes live**, because `mvp-brd.md` §10 makes trust the primary NFR and a watermark the Publisher can switch off is not a trust control. The compensating control in the interim is Admin approval — a human looks at every listing's media before it reaches search (`ADMIN-001`), which catches an unwatermarked image, though it does not catch a *maliciously* watermarked one.

### 14.3 `POST /api/v1/hoardings/{id}/media`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` **and** `owns_hoarding(id)` |
| Content-Type | `multipart/form-data` |
| Idempotency | `Idempotency-Key` **RECOMMENDED** — a retried upload after a timeout must not create a second media row (§31) |
| Rate limit | **RECOMMENDED** 30 uploads / hour / Publisher, 10 / minute |
| Transaction | The storage write happens first; the row insert follows. See the ordering note below |

**Multipart parts**

| Part | Required | Content | Notes |
|---|---|---|---|
| `file` | Yes | The image or video | Variant A: the original. Variant B: the watermarked derivative |
| `original` | No | The pre-watermark original | Variant B only. When omitted, `original_storage_path` stays `NULL` and `has_original` is `false` — `database-design.md` §20 explicitly permits this |
| `is_primary` | No | `"true"` / `"false"` | Default `false`. Setting `true` clears the flag on every other asset of the listing, in the same transaction |
| `display_order` | No | integer | Default: current max + 1 |

**Storage-then-row ordering is REQUIRED, not incidental.** `system-architecture.md` §38 #2: *"Media reference and stored object must not diverge — write the reference only after the object persists."* A row pointing at an object that failed to upload produces a permanently broken image with a `WATERMARKED` status, which would let a listing pass the `CONTENT-001` gate with nothing behind it. If the row insert then fails, the orphaned object is cleaned up by the cleanup job (§28.6) — an orphaned object is harmless; an orphaned row is not.

**Response — `201 Created`** (Variant B) or **`202 Accepted`** (Variant A):

```json
{
  "success": true,
  "data": {
    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "media_type": "IMAGE",
    "url": "https://<storage-host>/hoarding-public/aaaaaaaa/photo-1-watermarked.jpg",
    "is_primary": true,
    "display_order": 0,
    "processing_status": "WATERMARKED",
    "watermarked_at": "2026-08-30T09:41:02Z",
    "has_original": true,
    "created_at": "2026-08-30T09:41:02Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E903"
}
```

Under Variant A the same body returns with `processing_status: "UPLOADED"`, `watermarked_at: null`, and `url: null` — **there is no public URL until a watermarked derivative exists**, and returning a placeholder that resolves to the original would breach `CONTENT-001`. A `null` `url` with `processing_status: "UPLOADED"` is the honest representation and is what drives the "processing media" UI state.

### 14.4 Validation and limits

All values below are **RECOMMENDED** and configurable. `mvp-prd.md` defines none of them; `seeable_free_first_techstack.md` §40 gives the only concrete guidance (*"Maximum source upload: 10 MB; public listing image ~1600–2000 px long edge"*) and explicitly says *"the exact limits should be tuned after testing actual publisher uploads."*

| Constraint | Value | Failure |
|---|---|---|
| Allowed image MIME types | `image/jpeg`, `image/png`, `image/webp` | `415 MEDIA_TYPE_UNSUPPORTED` |
| Allowed video MIME types | `video/mp4` | `415 MEDIA_TYPE_UNSUPPORTED` |
| Max upload size | **10 MB** per part | `413 MEDIA_TOO_LARGE` |
| Max derivative long edge | 2000 px | `422 MEDIA_DIMENSIONS_INVALID` |
| Min image dimensions | 640 × 480 px | `422 MEDIA_DIMENSIONS_INVALID` |
| Max media assets per listing | **12** | `409 MEDIA_LIMIT_EXCEEDED` |
| Min media assets to submit | **1** | `409 HOARDING_MISSING_MEDIA` (§12.5) |

**MIME is validated from the bytes, not the declared header.** A declared `image/jpeg` whose magic bytes say otherwise is rejected with `415`. Trusting a client-declared content type on a file that will be served publicly is a well-known content-injection path, and the check costs one buffer read.

**Video is permitted but is an edge case worth flagging.** `mvp-prd.md` §7.7 says *"every uploaded photo/video"*, and `hoarding_media.media_type` includes `VIDEO`, so the API accepts it. But `seeable_free_first_techstack.md` §18's browser-Canvas pipeline watermarks **images**; there is no described mechanism for watermarking video client-side, and no server-side video pipeline exists in the ₹0 stack. **OPEN QUESTION (§46):** whether video upload should be disabled at MVP, or whether video takes Variant A even if images take Variant B. This API does not silently disable a capability `mvp-prd.md` names.

**Storage paths are server-constructed and never client-supplied:**

```text
hoarding-private/{hoarding_id}/{media_id}-original.{ext}
hoarding-public/{hoarding_id}/{media_id}-watermarked.{ext}
```

`system-architecture.md` §20: *"Storage layout is an implementation detail, not product behavior. Bucket names, key structures, and CDN configuration must never leak into API responses as though they were product concepts."* The API returns a resolved `url`, not a path or a bucket name; the path shape above is documented for the implementer, not for the client.

### 14.5 Media sub-resources

**`GET /api/v1/hoardings/{id}/media`** — lists the listing's assets, ordered `is_primary DESC, display_order ASC`. Not paginated (§9.4). Visibility follows the parent listing: a Viewer sees the public projection (no `processing_status`, no `has_original`); the owner and Admin see the full row.

**`PATCH /api/v1/hoardings/{id}/media/{mediaId}`** — **RECOMMENDED.** Accepts exactly `is_primary` and `display_order`, matching the two columns the database grants a client (`GRANT UPDATE (is_primary, display_order)`, §41.11). Every other field returns `422`. Setting `is_primary: true` clears it elsewhere on the listing atomically. This endpoint deliberately cannot touch `processing_status`, `storage_path`, or `original_storage_path` — those are pipeline state, and a Publisher able to write `processing_status: "WATERMARKED"` would defeat `CONTENT-001` with one HTTP call.

**`DELETE /api/v1/hoardings/{id}/media/{mediaId}`** — **RECOMMENDED.** `204 No Content`. Deletes the row and, after commit, both storage objects. **Refused with `409 HOARDING_MEDIA_NOT_WATERMARKED`** — reusing the "would leave the listing unsubmittable" semantics under a clearer code, `409 MEDIA_LAST_ASSET` — if it is the only asset on a listing whose `approval_status` is `APPROVED` or `PENDING_REVIEW`. **RECOMMENDED:** an approved listing must not be able to reach zero media through an ordinary delete, because `INVENTORY-003` would keep it visible in search with no image while `submit_hoarding_for_review()`'s minimum-one gate would never re-run on it. A `DRAFT` listing may go to zero freely.

### 14.6 `GET /api/v1/media/{mediaId}/original`

**RECOMMENDED** — the only sanctioned route to a private original. Maps directly to `get_original_media_path()` (`database-design.md` §41.8).

| | |
|---|---|
| Auth | Bearer |
| Authorization | Owning Publisher **or** Admin. Anyone else: `403 FORBIDDEN_NOT_OWNER`, or `404` if they cannot see the parent listing |
| Response | `200` with a **short-lived signed URL**, never a path and never a redirect to a public object |
| Rate limit | **RECOMMENDED** 20 / hour / user — this is the highest-sensitivity read in the API |
| Audit | **RECOMMENDED:** log every call with `request_id`, `media_id`, and caller ID (§35) |

```json
{
  "success": true,
  "data": {
    "media_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "download_url": "https://<storage-host>/object/sign/hoarding-private/...?token=...",
    "expires_at": "2026-08-30T10:11:02Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E904"
}
```

**Signed URL TTL: 300 seconds (RECOMMENDED).** Long enough for a download to start, short enough that a leaked URL in a browser history or a shared screenshot is worthless within minutes.

**Why an endpoint exists for this at all, rather than nothing.** `mvp-prd.md` §7.7 forbids **public** exposure of originals; it does not forbid the Publisher who uploaded the file from retrieving their own file, and an Admin reviewing a listing for approval has a legitimate need to see the unwatermarked image. The database already implements exactly this authorization inside `get_original_media_path()`. What matters is that the original is reachable **only** through a route that checks ownership server-side and issues a time-limited credential — never through a field in any listing response (§38.1 `REVOKE`s the column from every client role precisely so that a future response schema cannot accidentally include it).

`404 MEDIA_ORIGINAL_UNAVAILABLE` when `original_storage_path IS NULL` — the legitimate Variant B case where no original was retained.

### 14.7 Public media URLs

The `url` field in every media object resolves to `hoarding-public` and therefore to a watermarked derivative, always.

- **REQUIRED:** there is no code path, response field, or query parameter in this API that produces a public URL for `hoarding-private`.
- **REQUIRED:** the private bucket has no public access policy. `system-architecture.md` §21: isolation is *"architectural, not URL discipline"* — a bug in path construction must yield a broken link.
- **RECOMMENDED:** serve the public bucket over signed URLs with a long TTL (24 h) rather than as an open bucket. `system-architecture.md` §21 notes this makes hotlinking harder and gives a revocation path when a listing is delisted. It is optional because the content is already watermarked, and the trade-off is that URLs stop being CDN-cacheable across users. Either is acceptable; the choice must be uniform, because a mix means some listings' images break when the policy changes.

---

## 15. Availability APIs

### 15.1 The availability model

**A date range is available on a hoarding when all three of the following hold** (`system-architecture.md` §27, `database-design.md` §34):

```text
1. INVENTORY-003 — approval_status = 'APPROVED' AND NOT is_paused AND NOT is_delisted   [Inventory]
2. No hoarding_availability_blocks row overlaps the range                                [Inventory]
3. No requests row with status IN ('CONFIRMED','LIVE','COMPLETED') overlaps the range     [Request Engine]
```

**Availability is computed, never stored.** There is no availability column, no cached calendar, and no "release the dates" write anywhere in this API. This is what makes `REQUEST-002` — *"a Rejected or expired request releases its dates back to Available immediately"* — structurally true rather than a step someone can forget: the instant a request's `status` leaves the blocking set, input 3 stops matching it on the very next query (`system-architecture.md` §27, ADR-006).

**Ownership, because it is the resolution of a genuine circular dependency.** Inputs 1 and 2 are Inventory data; input 3 is Request Engine data; **the composition is owned by the Request Engine** (`system-architecture.md` §9). Inventory never reads request state. The API mirrors this: the availability endpoints below live under `/hoardings/{id}` for URL ergonomics, but the composition they invoke is `is_hoarding_available()`, which is Request-Engine-owned logic.

**`COMPLETED` blocks — a RECOMMENDATION inherited, not a sourced requirement.** `system-architecture.md` §27 surfaces the question and explicitly declines to decide it; `database-design.md` §24 resolves it as *yes* (a completed booking is a historical fact, not a released one) and puts `COMPLETED` in both the exclusion constraint and `is_hoarding_available()`. This API follows the database, and flags it in §46 as a Recommendation still awaiting sign-off. The practical consequence: a hoarding that ran a campaign 1–15 September can never take another confirmed booking overlapping those dates, ever. For a physical hoarding that is correct; if the business intends historical dates to be reusable, the constraint predicate is where to change it.

### 15.2 `GET /api/v1/hoardings/{id}/availability`

**REQUIRED (derived)** — `viewer-platform.md` §13's date-selection step and `mvp-prd.md` §7.2's calendar both need a read surface; `mvp-prd.md` §9 has none.

| | |
|---|---|
| Auth | Bearer |
| Authorization | Visible listing (any authenticated caller), **or** owner, **or** Admin |
| Query | `from` (default: today), `to` (default: `from + 180 days`), `start_date` + `end_date` (optional pair) |
| Max window | 365 days between `from` and `to` → else `422 INVALID_DATE_RANGE` |
| Rate limit | **RECOMMENDED** 120 / min / user |
| Cache | `Cache-Control: private, max-age=0, must-revalidate` — availability changes on any confirmation |

**Response — `200 OK`**

```json
{
  "success": true,
  "data": {
    "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "window": { "from": "2026-09-01", "to": "2026-12-31" },
    "is_listed": true,
    "unavailable_ranges": [
      { "start_date": "2026-09-01", "end_date": "2026-09-15", "reason": "BOOKED" },
      { "start_date": "2026-10-05", "end_date": "2026-10-09", "reason": "BLOCKED" }
    ],
    "is_available": false,
    "requested_range": { "start_date": "2026-09-10", "end_date": "2026-09-20" }
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E905"
}
```

| Field | Meaning |
|---|---|
| `is_listed` | `INVENTORY-003` — whether the listing itself is currently requestable at all. A paused listing returns `is_listed: false` and an empty `unavailable_ranges`, because "everything is unavailable" is better expressed once than as a 180-day range |
| `unavailable_ranges` | Merged, non-overlapping, ascending. Inclusive on both endpoints (§4.4) |
| `reason` | `BOOKED` (a `CONFIRMED`/`LIVE`/`COMPLETED` request) or `BLOCKED` (a Publisher availability block). **Nothing else.** Never a `viewer_id`, a `request_id`, a Publisher note, or a price |
| `is_available` | Present **only** when `start_date`+`end_date` were supplied. The direct answer to "can I request these dates", from `is_hoarding_available()` |
| `requested_range` | Echo of the supplied pair, so a cached response is self-describing |

**Why `reason` is coarse, and why the ranges are merged.** Two separate concerns converge on the same answer. First, **disintermediation** (`mvp-brd.md` §12): telling Viewer B that Viewer A holds 1–15 September, and merging that with the Publisher's own blocks, is one step from a competitive-intelligence feed on a Publisher's book of business. Second, **privacy**: request records are private to their parties (`system-architecture.md` §31, `database-design.md` §37.7), and an availability endpoint that distinguished "booked by someone" per-request would be a side channel around `requests_select_own`. Merging adjacent and overlapping ranges into one list, with a two-value reason, gives a Viewer everything they need to pick dates and nothing they need not know.

**The owner and Admin see the same shape.** A Publisher wanting to know *who* booked a range uses their request inbox (§22.4), which is the surface that legitimately carries Viewer identity. Keeping the availability endpoint identical for all roles removes an entire class of "which fields does this role get" bug from the highest-traffic read on the detail page.

**Finding — `database-design.md` defect #1 blocks this endpoint.** As established in §10.6, `is_hoarding_available()` runs under the caller's RLS and therefore returns `true` for every date when a Viewer calls it, and `hoarding_availability_blocks` and `requests` are both unreadable to a Viewer, so `unavailable_ranges` would come back **empty for every Viewer on every listing**. This endpoint is the most visibly broken consequence of that defect: a Viewer would see a fully open calendar on a fully booked hoarding, pick dates, and be rejected at submission — the precise failure `viewer-platform.md` §24 forbids.

**REQUIRED fix (§46.1):** in addition to making `is_hoarding_available()` `SECURITY DEFINER`, add a `SECURITY DEFINER` function that returns the merged, reason-coded ranges without exposing the underlying rows —

```sql
CREATE OR REPLACE FUNCTION hoarding_unavailable_ranges(
  p_hoarding_id uuid, p_from date, p_to date
) RETURNS TABLE (start_date date, end_date date, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.start_date, b.end_date, 'BLOCKED'::text
  FROM hoarding_availability_blocks b
  WHERE b.hoarding_id = p_hoarding_id
    AND b.date_range && daterange(p_from, p_to, '[]')
  UNION ALL
  SELECT r.start_date, r.end_date, 'BOOKED'::text
  FROM requests r
  WHERE r.hoarding_id = p_hoarding_id
    AND r.status IN ('CONFIRMED', 'LIVE', 'COMPLETED')
    AND r.stay_range && daterange(p_from, p_to, '[]')
  ORDER BY 1;
$$;
```

Range merging is done in the API layer, which keeps the SQL simple and the merge testable. Note what the function does **not** project: no `viewer_id`, no `request_id`, no `reason` text from the Publisher's block note.

### 15.3 `POST /api/v1/hoardings/{id}/availability/blocks`

**REQUIRED (derived)** — `mvp-prd.md` §7.2: *"simple availability calendar (block/unblock dates)"*.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` **and** `owns_hoarding(id)` |
| Idempotency | `Idempotency-Key` **RECOMMENDED** |
| Rate limit | **RECOMMENDED** 120 / hour / Publisher |

**Request**

```json
{ "start_date": "2026-10-05", "end_date": "2026-10-09", "reason": "Structural maintenance" }
```

| Field | Rule |
|---|---|
| `start_date` | Required, `YYYY-MM-DD` |
| `end_date` | Required, ≥ `start_date` (`hab_date_order_check`) → else `422 INVALID_DATE_RANGE` |
| `reason` | Optional, ≤ 200 code points. **Publisher-private** — never returned to a Viewer (§15.2) |

**Blocking dates that already carry a confirmed request is permitted, and does not affect that request.** No source document forbids it, `ADMIN-002`'s neighbouring principle protects confirmed commitments, and the block is simply redundant for those dates — input 3 already makes them unavailable. The response includes an advisory so the Publisher is not misled into thinking they have freed or cancelled anything:

```json
{
  "success": true,
  "data": {
    "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "start_date": "2026-10-05",
    "end_date": "2026-10-09",
    "reason": "Structural maintenance",
    "created_at": "2026-08-30T09:55:00Z"
  },
  "meta": {
    "overlaps_confirmed_requests": 1,
    "notice": "This block overlaps 1 confirmed request. Confirmed bookings are unaffected."
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E906"
}
```

**Overlapping blocks are allowed.** `hoarding_availability_blocks` has no exclusion constraint, and merging them at write time would lose the Publisher's per-block `reason`. The read endpoint merges for display (§15.2); the storage stays faithful to what the Publisher entered.

**No `status` field on a block.** `database-design.md` §21 removes the illustrative schema's `status` column deliberately: *"No source document describes more than one kind of block... Row existence is the status."* This API does not reintroduce it.

### 15.4 `DELETE /api/v1/hoardings/{id}/availability/blocks/{blockId}`

**REQUIRED (derived)** — the "unblock" half of `mvp-prd.md` §7.2.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` **and** `owns_hoarding(id)` |
| Response | `204 No Content` |
| Idempotency | Second delete → `404 RESOURCE_NOT_FOUND` |

**Unblocking does not make dates available if a confirmed request covers them** — input 3 is independent of input 2. The dates simply return to whatever the request state says. Stated because a Publisher who deletes a block and then sees the dates still unavailable will otherwise report it as a bug.

**A block cannot be edited, only deleted and recreated.** No `PATCH` exists. A block has three fields and no lifecycle; a `PATCH` that changed the range would be indistinguishable from delete-plus-create while adding a partial-update surface to a table with no `updated_at` column.

---

## 16. Request Engine API

### 16.1 What a Request is, and is not

> A **Request** is a structured, date-based request for **one** hoarding. It is a booking-lite date hold. It does **not** represent payment, escrow, commission, contract execution, or financial settlement.
> — `request-engine.md` §2

Everything in §16–§21 follows from that sentence. There is no `payment_status`, no `invoice`, no `contract`, no `campaign_id`, and no multi-hoarding request anywhere in this API. `amount_agreed` exists and is never collected, never enforced, and never used to compute anything (`mvp-prd.md` §7.4, `request-engine.md` §17).

### 16.2 Endpoints

| Method | Path | Actor | Status |
|---|---|---|---|
| `POST` | `/api/v1/requests` | Viewer | **REQUIRED** — `mvp-prd.md` §9 |
| `GET` | `/api/v1/requests/me` | Viewer | **REQUIRED** — `mvp-prd.md` §9 |
| `GET` | `/api/v1/publishers/me/requests` | Publisher | **REQUIRED** — `mvp-prd.md` §9 |
| `GET` | `/api/v1/requests/{id}` | Viewer (own), Publisher (own listing) | **REQUIRED (derived)** — flagged as a gap by `request-engine.md` §27, `viewer-platform.md` §23, and `system-architecture.md` §19. The Request Detail page (`viewer-platform.md` §15) is not implementable without it |
| `PATCH` | `/api/v1/requests/{id}` | Publisher, Admin (`COMPLETE` only) | **REQUIRED** — `mvp-prd.md` §9, *"(accept/reject/complete)"* |
| `GET` | `/api/v1/requests/{id}/history` | Viewer (own), Publisher (own listing), Admin | **RECOMMENDED** — `request_status_history` exists with a read policy (`database-design.md` §37.8); the Request Detail page's timeline needs it. See §21 |

**Deliberately not created:**

- **`DELETE /api/v1/requests/{id}` / a `CANCEL` action.** `request-engine.md` §20 is explicit: *"Viewer cancellation of a Pending request is not introduced as an MVP feature... Since it is not approved, the MVP Request Engine must not implement Viewer-initiated cancellation."* An attempt returns `501 REQUEST_CANCEL_UNSUPPORTED`, which is honest about the reason and reserves the semantics. **OPEN QUESTION (§46).**
- **Separate `/requests/{id}/accept`, `/reject`, `/complete` routes.** Considered and rejected in ADR-API-003. `mvp-prd.md` §9 fixes one endpoint for all three transitions, and `PATCH` with an `action` discriminator preserves that while still satisfying P6. Adding action routes as aliases would give two ways to perform the system's most safety-critical operation — two idempotency surfaces, two audit paths, two places to get the concurrency handling right.
- **A general Admin request browser.** §6.6. Not an oversight — an approved restriction.

### 16.3 The Request resource

```json
{
  "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "hoarding": {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "title": "Outer Ring Road Unipole — Marathahalli",
    "type_code": "UNIPOLE_BILLBOARD",
    "locality": "Marathahalli",
    "city": "Bengaluru",
    "price": "85000.00",
    "price_unit": "MONTH",
    "currency": "INR",
    "primary_media_url": "https://<storage-host>/hoarding-public/aaaaaaaa/photo-1-watermarked.jpg"
  },
  "viewer": {
    "id": "33333333-3333-3333-3333-333333333333",
    "full_name": "Vikram Shah"
  },
  "publisher": {
    "id": "11111111-1111-1111-1111-111111111111",
    "business_name": "Kumar Outdoor Media"
  },
  "start_date": "2026-09-10",
  "end_date": "2026-09-20",
  "duration_days": 11,
  "status": "REQUESTED",
  "status_label": "Pending",
  "message": "Interested in this site for a September product launch.",
  "rejection_reason": null,
  "amount_agreed": null,
  "sla_deadline": "2026-09-01T09:41:02Z",
  "created_at": "2026-08-30T09:41:02Z",
  "updated_at": "2026-08-30T09:41:02Z",
  "responded_at": null,
  "confirmed_at": null,
  "rejected_at": null,
  "expired_at": null,
  "live_at": null,
  "completed_at": null,
  "available_actions": []
}
```

**Field notes**

| Field | Note |
|---|---|
| `hoarding` | **Embedded summary, always** — never a bare `hoarding_id`. `viewer-platform.md` §15 requires the request list to show *"hoarding (with enough identifying info to recognize it without reopening it)"*, and `§21` requires that a request against a since-removed listing *"should not resolve to a broken reference."* Embedding satisfies both: the summary is a snapshot of the current listing row, served even when the listing is now paused or delisted, because the request itself is the caller's own record |
| `viewer` | **Visible to the owning Publisher and to the Viewer themselves. Never to a third party.** `full_name` only — no phone, no email. See §23.4 on disintermediation |
| `publisher` | `business_name` only, for exactly the same reason. The Viewer never receives Publisher contact details through this API at any request state — **OPEN QUESTION (§46)**, and the conservative default is specified |
| `duration_days` | `end_date − start_date + 1`, computed. Present because inclusive-inclusive date semantics (§4.4) are the single easiest thing for a client to get wrong, and an off-by-one on a campaign length is a commercial error |
| `status` | The machine value — one of the six in §18. This is what clients branch on |
| `status_label` | The **Viewer-facing** label from `viewer-platform.md` §14 (`Pending`, `Confirmed`, `Rejected`, `Expired`, `Campaign Period`, `Completed`). Server-supplied so the mapping lives in one place; a client that renders `status` raw would show `LIVE` where the product says "Campaign Period" |
| `message` | Optional Viewer note at submission (`requests.message`). **RECOMMENDED** — the column exists in the settled schema; no source requirement names it |
| `sla_deadline` | When this request auto-expires if unanswered (`OWNER-002`). Returned to both parties: the Publisher needs the deadline to act, the Viewer needs it to know how long to wait |
| `responded_at` | Derived, not a stored column — the earliest `changed_at` in `request_status_history` where `to_status ∈ {CONFIRMED, REJECTED}`. `request-engine.md` §26 names `responded_at` as a needed field; `database-design.md` does not add the column, computing it from history instead (§43.6). This API exposes the derived value under the name the module document uses |
| `available_actions` | **RECOMMENDED.** The subset of `["ACCEPT","REJECT","COMPLETE"]` this caller may perform on this request *right now*, given role, ownership, and current status. Empty for a Viewer, always. Lets a client render buttons without reimplementing the state machine (§18) — and because the server recomputes it per response, it cannot drift from the transition guards |

**Timestamp nulls are meaningful.** `confirmed_at` is non-null iff the request has ever been confirmed; it is **not** cleared if the request later moves to `LIVE` or `COMPLETED`. The set of non-null timestamps is a compact history of the path taken.

### 16.4 Request Engine architecture

```mermaid
graph TD
    V["Viewer client"] -->|"POST /api/v1/requests"| API["API route"]
    P["Publisher client"] -->|"PATCH /api/v1/requests/{id}"| API
    A["Admin client"] -->|"PATCH .../{id} action=COMPLETE"| API

    API --> AUTHZ["Authn + role + ownership<br/>§6"]
    AUTHZ --> RE["Request Engine module"]

    RE -->|"create"| INS["INSERT INTO requests<br/>+ BEFORE INSERT trigger<br/>(visibility · conflict · publisher_id · sla_deadline)"]
    RE -->|"accept"| CONF["confirm_request()<br/>SECURITY DEFINER"]
    RE -->|"reject"| REJ["reject_request()<br/>SECURITY DEFINER"]
    RE -->|"complete"| COMP["mark_request_completed()<br/>SECURITY DEFINER"]

    INS --> DB[("PostgreSQL")]
    CONF --> DB
    REJ --> DB
    COMP --> DB

    DB --> EXC{{"EXCLUDE USING gist<br/>no overlapping CONFIRMED/LIVE/COMPLETED"}}
    DB --> UNQ{{"partial UNIQUE<br/>one REQUESTED per viewer+hoarding"}}

    DB --> HIST["request_status_history<br/>AFTER trigger"]
    DB --> NOTIF["notifications<br/>written in the same transaction"]
    NOTIF -.->|"delivered asynchronously"| JOBS["/api/jobs/process-notifications"]

    JOB1["/api/jobs/expire-requests"] --> DB
    JOB2["/api/jobs/transition-live"] --> DB
```

**Three properties this diagram encodes, each a REQUIRED rule:**

1. **Every state transition goes through a `SECURITY DEFINER` function.** `requests` has **no client `UPDATE` grant and no RLS `UPDATE` policy at all** (`database-design.md` §37.7, §41.11). There is physically no way for a client to write `status`. P6 is not a convention here — it is enforced by the absence of a privilege.
2. **The database is the enforcement layer for the core invariant.** The exclusion constraint sits underneath the functions, so even a bug in `confirm_request()` cannot produce two overlapping confirmations (§19).
3. **Notification records commit with the state change; delivery is separate.** `system-architecture.md` §22, §28. A confirmed request can never exist without its notification having been *recorded*; whether it has been *delivered* is a job's problem, and a provider outage never fails a Publisher's accept (P8).

---

## 17. Request Creation

### 17.1 `POST /api/v1/requests`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = VIEWER`. Publisher or Admin → `403 FORBIDDEN_ROLE` |
| Verification | `AUTH-002` — see §17.4 gate 2 |
| Idempotency | `Idempotency-Key` **REQUIRED in practice** (§31) — this is the highest-value idempotency case in the API |
| Rate limit | **RECOMMENDED** 20 / hour / Viewer, 5 / minute (§30) |
| Module | Request Engine |
| Transaction | **One `INSERT`.** Every check runs inside the `BEFORE INSERT` trigger, so the whole operation is one atomic statement (`database-design.md` §24) |

### 17.2 Request

```json
{
  "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "start_date": "2026-09-10",
  "end_date": "2026-09-20",
  "message": "Interested in this site for a September product launch."
}
```

| Field | Required | Rule |
|---|---|---|
| `hoarding_id` | **Yes** | UUID of an existing, visible listing |
| `start_date` | **Yes** | `YYYY-MM-DD`, inclusive |
| `end_date` | **Yes** | `YYYY-MM-DD`, inclusive, ≥ `start_date` |
| `message` | No | ≤ 1000 code points. **RECOMMENDED** — the `requests.message` column exists; no source requirement names it |

### 17.3 `amount_agreed` is NOT accepted at creation

**Specified: `amount_agreed` is refused on `POST /api/v1/requests` with `422 VALIDATION_ERROR`.**

`mvp-prd.md` §7.4 establishes the field as *"captured for record-keeping, not enforced or collected"* but says nothing about **who** enters it or **when**. `viewer-platform.md` §28 and `request-engine.md` §17 both carry this as an unresolved **OPEN QUESTION**, noting the identical gap: *"`mvp-prd.md` does not define who enters this value (Viewer at submission, Publisher at acceptance, either party after the fact) or at what stage of the lifecycle it is captured."*

`database-design.md` §22 makes an **Assumption** and this API follows it: **settable only by the owning Publisher, only once the request has left `REQUESTED`**, through the dedicated action in §20.5. Rationale for adopting that reading rather than another: the amount is the outcome of an offline negotiation that happens *after* confirmation (`mvp-prd.md` §6.2's journey: *"Confirmed → (Settle offline)"*), so a value captured at submission would be a Viewer's opening ask, not an agreed amount — and storing an opening ask in a field named `amount_agreed` would misrepresent it in exactly the records `mvp-brd.md` §17's dispute risk cares about.

**Refusing the field rather than ignoring it is deliberate.** A client that sends `amount_agreed` at creation has misunderstood the model, and a silent drop would hide that until someone noticed every request had a null amount. Carried to §46 as an unresolved product question, not a settled one.

### 17.4 Validation — the complete creation gate

Evaluated in this order. Every check is server-side. Gates 4–7 run inside the `BEFORE INSERT` trigger or as a database constraint, so they cannot be raced (§32).

| # | Gate | Rule | Failure | Where enforced |
|---|---|---|---|---|
| 1 | Authenticated Viewer | §6 | `401 AUTH_REQUIRED` / `403 FORBIDDEN_ROLE` | Route + `requests_insert_viewer` RLS (`viewer_id = auth.uid()`) |
| 2 | Viewer verified | **`AUTH-002`** | `403 AUTH_VERIFICATION_REQUIRED` | Route. **Not applied in the demo build** (§5.3) — `viewer-platform.md` records OTP as deferred, so there is no verification state to check |
| 3 | Dates well-formed, `end_date ≥ start_date` | Structural | `422 INVALID_DATE_RANGE` | Route + `requests_date_order_check` |
| 4 | Range does not lie entirely in the past | Structural (`request-engine.md` §8) | `422 DATE_RANGE_IN_PAST` | Route. See the note below |
| 5 | Listing visible: `APPROVED`, not paused, not delisted | **`ADMIN-001`, `INVENTORY-003`** | `409 HOARDING_NOT_VISIBLE` (or `404` if never visible to this caller) | `validate_request_creation` trigger |
| 6 | No `CONFIRMED`/`LIVE`/`COMPLETED` request overlaps the range | **`REQUEST-001`** | `409 REQUEST_DATE_CONFLICT` | `validate_request_creation` trigger |
| 7 | This Viewer holds no `REQUESTED` request on this listing | **`VIEWER-002`** | `409 REQUEST_DUPLICATE_PENDING` | `requests_one_pending_per_viewer_hoarding` partial unique index |
| 8 | Body carries no server-owned field | P6 | `422 VALIDATION_ERROR` | Route |

**Gate 4 is a structural minimum, not a lead-time rule.** `request-engine.md` §8 is explicit that a minimum lead time, a maximum duration, blackout dates, and minimum/maximum day counts are *"not defined anywhere in `mvp-prd.md`, and therefore **not** treated as approved validation rules."* This API adds none of them. The only past-date rule is that a range whose `end_date` is before today is rejected — a request for a period that has already finished cannot be fulfilled by anyone. A range that *starts* in the past but ends in the future is **accepted**, because nothing forbids it and a Publisher may legitimately confirm a campaign already under way. **RECOMMENDED** for the business to revisit; carried to §46.

**Gate 5 is checked at creation AND again at acceptance.** Creation-time visibility is not carried forward — `confirm_request()` re-validates (§19.3). A listing paused between request and accept blocks the accept, not retroactively the request.

**Gate 6 is the one that most commonly surprises implementers, and the semantics are exact:**

- The blocking set is `CONFIRMED`, `LIVE`, `COMPLETED` — **not** `REQUESTED`.
- **Overlapping `REQUESTED` requests from different Viewers are permitted and expected.** `mvp-prd.md` §12's own acceptance criterion requires it: *"the new request is accepted into the queue as Pending, but it cannot be moved to Confirmed until the conflict is resolved."*
- Blocking a *new submission* against already-`CONFIRMED` dates is an **ASSUMPTION** that `request-engine.md` §9 flags explicitly (*"this document treats that as the sensible default behavior, but it is an inference, not a stated rule"*) and `database-design.md` §24 implements. This API follows both. The alternative — accepting a request that provably can never be confirmed — would produce a Pending state that is a lie to the Viewer. Carried to §46 as an inherited assumption, not a settled rule.

**Overlap is inclusive-inclusive**, matching `mvp-prd.md` §12's worked example and `database-design.md`'s generated `daterange(start, end, '[]')`:

```text
A and B overlap  ⟺  A.start ≤ B.end  AND  B.start ≤ A.end
```

So 1–15 September and 16–20 September do **not** overlap, and 1–15 and 10–20 do.

### 17.5 The two request-density rules, side by side

| Rule | Statement | Enforced by |
|---|---|---|
| **`VIEWER-001`** | A Viewer may hold multiple simultaneous `REQUESTED` requests **across different listings** | No constraint — permitted by construction |
| **`VIEWER-002`** | A Viewer may **not** hold a second `REQUESTED` request on the **same** listing | `requests_one_pending_per_viewer_hoarding` partial unique index |

`VIEWER-002` is enforced by a **database unique index, not an application check**, and that is deliberate: `system-architecture.md` §16 requires it *"so a concurrent double-submit cannot slip past an application-level check."* A double-clicked submit button produces two concurrent inserts; only one can win.

The error tells the Viewer what already exists, because `viewer-platform.md` §25 AC-8 requires that *"the Viewer is shown the existing request's status"* rather than a bare refusal:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_DUPLICATE_PENDING",
    "message": "You already have a pending request on this listing.",
    "details": {
      "existing_request_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "existing_start_date": "2026-09-10",
      "existing_end_date": "2026-09-20",
      "existing_status": "REQUESTED"
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E907"
}
```

Note the scope: `VIEWER-002` restricts **`REQUESTED`** requests only. A Viewer whose earlier request was rejected or expired may submit a fresh one on the same listing immediately, and a Viewer with a `CONFIRMED` request on 1–15 September may request 20–30 September on the same hoarding.

### 17.6 Response — `201 Created`

```http
HTTP/1.1 201 Created
Location: /api/v1/requests/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
```

Body: the full Request resource (§16.3) with `status: "REQUESTED"`, `status_label: "Pending"`, a populated `sla_deadline`, and `available_actions: []`.

### 17.7 Side effects

All of these commit in the **same transaction** as the insert. `system-architecture.md` §28: *"no partially completed state transition is observable."*

| Effect | Mechanism | Rule |
|---|---|---|
| One `requests` row, `status = REQUESTED` | The `INSERT` | — |
| `publisher_id` denormalized from the hoarding | `validate_request_creation` trigger — **never from the body** | §6.4 |
| `sla_deadline = now() + default_response_sla()` | Same trigger | `OWNER-002` |
| One `request_status_history` row (`NULL → REQUESTED`) | `log_request_status_change` trigger | §21 |
| **Two** `notifications` rows | `notify_request_created` trigger | `NOTIF-001` |

**Two notifications, not one.** `request-engine.md` §22 specifies both recipients: the Publisher gets *"new request received"* and the Viewer gets *"submission confirmed"*. `database-design.md` §41.5 inserts both. Delivery is asynchronous (§27); the records are synchronous.

**No availability write occurs, and none is possible.** A `REQUESTED` request blocks nothing (`request-engine.md` §9, §11). There is no calendar to mutate — availability is computed (§15.1). An implementation that "helpfully" reserves the dates at request time would contradict `mvp-prd.md` §12's approved acceptance criterion.

**Background jobs triggered: none.** The SLA clock is a column, swept later by `/api/jobs/expire-requests` (§28.3).

### 17.8 Errors

| Status | Code | Cause |
|---|---|---|
| 401 | `AUTH_REQUIRED` | No token |
| 403 | `FORBIDDEN_ROLE` | Publisher or Admin calling |
| 403 | `AUTH_VERIFICATION_REQUIRED` | `AUTH-002` gate (MVP target only) |
| 404 | `HOARDING_NOT_FOUND` | No such listing, or never visible to this caller |
| 409 | `HOARDING_NOT_VISIBLE` | Exists, was visible, is now paused/delisted/unapproved |
| 409 | `REQUEST_DATE_CONFLICT` | Gate 6 — overlaps a confirmed booking |
| 409 | `REQUEST_DUPLICATE_PENDING` | Gate 7 — `VIEWER-002` |
| 422 | `INVALID_DATE_RANGE` | `end_date < start_date`, unparseable date |
| 422 | `DATE_RANGE_IN_PAST` | Gate 4 |
| 422 | `VALIDATION_ERROR` | Missing field, server-owned field present, `amount_agreed` present |
| 429 | `RATE_LIMITED` | §30 |

**`404` vs `409` on the listing, and why the distinction earns its keep.** A Viewer who never could see a listing gets `404` (§6.5 — no inventory oracle). A Viewer who *had* it open and it became unavailable underneath them gets `409 HOARDING_NOT_VISIBLE`, which is exactly the "Unavailable" state `viewer-platform.md` §20 and §21 require: *"the submission is blocked with a clear reason, not silently accepted then rejected."*

---

## 18. Request State Machine

### 18.1 The lifecycle

```text
                        ┌──────────────┐
                        │  REQUESTED   │  (Viewer-facing label: "Pending")
                        └──────┬───────┘
                 ┌─────────────┼─────────────┐
        Publisher│             │Publisher    │System (SLA)
         accepts │             │rejects      │elapses
                 ▼             ▼             ▼
          ┌────────────┐ ┌──────────┐ ┌──────────┐
          │ CONFIRMED  │ │ REJECTED │ │ EXPIRED  │
          └─────┬──────┘ └──────────┘ └──────────┘
                │            terminal      terminal
     System     │
     start date │
     reached    ▼
          ┌────────────┐
          │    LIVE    │  ("Campaign Period")
          └─────┬──────┘
                │ Publisher or Admin marks completed
                ▼
          ┌────────────┐
          │ COMPLETED  │   terminal
          └────────────┘
```

**Six states. No others exist, and none may be added at MVP.** `request-engine.md` §5 is explicit that `PAYMENT_PENDING`, `PAID`, `CONTRACTED`, `ESCROWED`, and `CANCELLED_BY_PAYMENT` are Phase 2 concepts that would *extend* this lifecycle, not retrofit it. `database-design.md` §28.12's `CHECK` constraint contains exactly these six values.

**`AVAILABLE` is not a request status.** `request-engine.md` §6 and `database-design.md` §12 both state this plainly: `AVAILABLE` describes a **hoarding's calendar condition** before any request exists. It never appears in `requests.status`, never appears in an API response's `status` field, and is not part of any enum in §38. `mvp-prd.md` §7.4 writes the lifecycle as `AVAILABLE → REQUESTED → …`, which reads as a seventh state and is not one — this is the single most likely misreading of the source material, and it is called out here rather than propagated.

### 18.2 Transition table

| # | From | Action | To | Actor | Trigger |
|---|---|---|---|---|---|
| 1 | *(none)* | Create | `REQUESTED` | Viewer | `POST /api/v1/requests` |
| 2 | `REQUESTED` | `ACCEPT` | `CONFIRMED` | **Publisher** (owns the listing) | `PATCH /api/v1/requests/{id}` |
| 3 | `REQUESTED` | `REJECT` | `REJECTED` | **Publisher** (owns the listing) | `PATCH /api/v1/requests/{id}` |
| 4 | `REQUESTED` | SLA elapses | `EXPIRED` | **System** | `POST /api/jobs/expire-requests` |
| 5 | `CONFIRMED` | Start date reached | `LIVE` | **System** | `POST /api/jobs/transition-live` |
| 6 | `CONFIRMED` \| `LIVE` | `COMPLETE` | `COMPLETED` | **Publisher or Admin** | `PATCH /api/v1/requests/{id}` |

**Every transition not in this table is refused with `409 REQUEST_STATE_CONFLICT`.** There is no un-confirm, no un-reject, no reopen-expired, and no un-complete. Every terminal state is genuinely terminal — no source document describes a reversal, and inventing one would create paths the exclusion constraint was never designed for.

**Transition 6 accepts `CONFIRMED` as well as `LIVE`.** `mvp-prd.md` §7.4 and `REQUEST-003` only impose a **start-date floor**, not a "must be `LIVE` first" precondition, and `mark_request_completed()` admits both (`database-design.md` §41.6). This matters operationally: if `/api/jobs/transition-live` has not run since the start date passed, a Publisher can still complete the request rather than being blocked by a job's schedule.

### 18.3 Per-transition specification

**Transition 2 — `REQUESTED → CONFIRMED` (`ACCEPT`)**

| | |
|---|---|
| Preconditions | Request exists; `status = REQUESTED`; caller is the owning Publisher; listing still satisfies `INVENTORY-003`; **no `CONFIRMED`/`LIVE`/`COMPLETED` request on the same hoarding overlaps this range** |
| Authorization | `publisher_id = auth.uid()`. Admin: **refused** (`request-engine.md` §23) |
| Validation | `REQUEST-004` — re-validated at accept time, never trusted from submission time |
| Transaction | **Required.** Row lock → precondition checks → `UPDATE` → notification insert, all in `confirm_request()` |
| Concurrency | `SELECT … FOR UPDATE` serializes concurrent attempts; the `EXCLUDE` constraint is the structural backstop (§19) |
| Notifications | `REQUEST_ACCEPTED` → Viewer (`NOTIF-001`) |
| Errors | `403 FORBIDDEN_NOT_OWNER`, `409 REQUEST_STATE_CONFLICT`, `409 HOARDING_NOT_VISIBLE`, `409 REQUEST_DATE_CONFLICT` |
| Idempotency | Retry after a lost response → `409 REQUEST_STATE_CONFLICT` (already `CONFIRMED`), or the stored `200` if an `Idempotency-Key` was used (§31) |
| Inventory effect | The dates become blocked **as a consequence of the status change**, not as a separate write (§15.1) |

**Transition 3 — `REQUESTED → REJECTED` (`REJECT`)**

| | |
|---|---|
| Preconditions | `status = REQUESTED`; caller is the owning Publisher |
| Validation | **None beyond ownership.** `request-engine.md` §7: *"Not applicable — rejection has no conflict to fail against."* |
| Reason | **Optional.** `request-engine.md` §13 flags as an **OPEN QUESTION** whether a Publisher must give one; `database-design.md` makes `requests.rejection_reason` nullable with no check, deliberately unlike `hoardings.rejection_reason` (`ADMIN-003`, mandatory). This API follows: optional here, mandatory there |
| Transaction | One `SECURITY DEFINER` call — `reject_request()` |
| Notifications | `REQUEST_REJECTED` → Viewer |
| Inventory effect | **Immediate release** (`REQUEST-002`) — structural, because availability is computed (§15.1). There is no release step |

**Transition 4 — `REQUESTED → EXPIRED` (system)**

| | |
|---|---|
| Trigger | `sla_deadline < now()` on a still-`REQUESTED` row, swept by the job |
| Actor | System. `changed_by` is `NULL` in `request_status_history` |
| SLA duration | **`default_response_sla()`, currently 48 hours (RECOMMENDED).** The exact value is an unresolved product question (`mvp-prd.md` §14, `request-engine.md` §33). It is a `CREATE OR REPLACE FUNCTION` away from changing, with no migration (`database-design.md` §22) |
| SLA clock start | `created_at`. **ASSUMPTION** — `request-engine.md` §14 records that no source states whether the clock starts at creation or at notification delivery. Carried to §46 |
| Notifications | `REQUEST_EXPIRED` → Viewer; a prior `REQUEST_EXPIRING_SOON` (§27.3) |
| Inventory effect | Immediate release (`REQUEST-002`) |
| Idempotency | The job's `WHERE status = 'REQUESTED'` clause makes a repeat run a no-op (§28.3) |

**Transition 5 — `CONFIRMED → LIVE` (system)**

| | |
|---|---|
| Trigger | `start_date ≤ current_date` on a `CONFIRMED` row |
| Actor | System. **ASSUMPTION** — `request-engine.md` §18: no manual "Mark Live" action appears anywhere in `mvp-prd.md`, unlike Completion which is explicitly manual, so automatic is the only consistent reading. Flagged, not asserted |
| Notifications | **None.** `mvp-prd.md` §7.6's event list does not include this transition; `request-engine.md` §22 and `database-design.md` §25 both confirm it is not required. **OPEN QUESTION (§46)** |
| Inventory effect | None — the dates were already blocked while `CONFIRMED` |
| Viewer label | `Campaign Period` (`viewer-platform.md` §14) |
| Timezone | Depends on §4.4's unresolved timezone question — a UTC `current_date` flips at 05:30 IST |

**Transition 6 — `CONFIRMED`/`LIVE` → `COMPLETED` (`COMPLETE`)**

| | |
|---|---|
| Preconditions | `status ∈ {CONFIRMED, LIVE}`; **`start_date ≤ today`** (`REQUEST-003`) |
| Authorization | Owning Publisher **or** Admin — `mvp-prd.md` §7.4: *"Manual 'Mark Completed' action (Publisher **or** Admin)"*. This is Admin's **only** request authority |
| Validation | `REQUEST-003`'s start-date floor **only**. There is **no end-date floor** — `request-engine.md` §19 and §25 #16 record that `mvp-prd.md` never states one, so completing mid-campaign is not textually prohibited. This API does not invent the floor. **OPEN QUESTION (§46)** |
| Notifications | **None** — not in `mvp-prd.md` §7.6's event list (§27.3) |
| Inventory effect | None. `COMPLETED` continues to block its dates (§15.1) |
| Errors | `409 REQUEST_COMPLETE_TOO_EARLY`, `409 REQUEST_STATE_CONFLICT`, `403 FORBIDDEN_NOT_OWNER` |

### 18.4 Status labels

The server supplies `status_label` alongside `status` so that the mapping in `viewer-platform.md` §14 lives in exactly one place:

| `status` | `status_label` (Viewer) | Publisher-facing |
|---|---|---|
| `REQUESTED` | `Pending` | `Awaiting your response` |
| `CONFIRMED` | `Confirmed` | `Confirmed` |
| `REJECTED` | `Rejected` | `Declined` |
| `EXPIRED` | `Expired` | `Expired — no response` |
| `LIVE` | `Campaign Period` | `Campaign Period` |
| `COMPLETED` | `Completed` | `Completed` |

**The Publisher column is RECOMMENDED, not sourced.** `request-engine.md` §5 notes that *"no Publisher-facing label is defined, since `owner-platform.md` is unavailable."* The values above are this document's proposal; the API returns `status_label` scoped to the caller's role, so changing the Publisher wording later is a server change with no client impact.

---

## 19. Request Confirmation

This section is the most safety-critical in the specification. It exists to guarantee one sentence:

> **No two overlapping requests may both reach `CONFIRMED` on the same hoarding.**
> — `request-engine.md` §10, formalized as `REQUEST-004`

### 19.1 The confirmation sequence

`PATCH /api/v1/requests/{id}` with `{"action": "ACCEPT"}` performs exactly these eight steps, in this order.

```mermaid
sequenceDiagram
    participant P as Publisher client
    participant API as API route
    participant FN as confirm_request()<br/>SECURITY DEFINER
    participant DB as PostgreSQL
    participant N as notifications

    P->>API: PATCH /requests/{id} {action:"ACCEPT"} + Idempotency-Key
    API->>API: 1. Authenticate — validate bearer token
    API->>API: 2. Role check — role = PUBLISHER
    API->>FN: supabase.rpc('confirm_request', {p_request_id})

    rect rgb(238, 244, 255)
        Note over FN,DB: One PostgreSQL transaction — atomic by construction
        FN->>DB: SELECT * FROM requests WHERE id = $1 FOR UPDATE
        DB-->>FN: row (locked)
        FN->>FN: 3. Ownership — publisher_id = auth.uid()?
        FN->>FN: 4. State — status = 'REQUESTED'?
        FN->>DB: 5. Re-check listing INVENTORY-003
        FN->>DB: 6. Re-check overlapping CONFIRMED/LIVE/COMPLETED  ← REQUEST-004
        FN->>DB: 7. UPDATE requests SET status='CONFIRMED', confirmed_at=now()
        DB-->>FN: EXCLUDE constraint evaluated — structural backstop
        FN->>N: 8. INSERT notification REQUEST_ACCEPTED → Viewer
        Note over FN,DB: COMMIT
    end

    FN-->>API: confirmed row
    API-->>P: 200 {request with status CONFIRMED}
    N-->>N: delivery is asynchronous — /api/jobs/process-notifications
```

| Step | Check | Failure |
|---|---|---|
| 1 | Authenticate the Publisher | `401 AUTH_REQUIRED` |
| 2 | Role is `PUBLISHER` | `403 FORBIDDEN_ROLE` |
| 3 | **Verify the Publisher owns the listing** — `publisher_id = auth.uid()` | `403 FORBIDDEN_NOT_OWNER` |
| 4 | **Verify the request is currently `REQUESTED`** | `409 REQUEST_STATE_CONFLICT` |
| 5 | **Re-check listing state** — still `APPROVED`, not paused, not delisted | `409 HOARDING_NOT_VISIBLE` |
| 6 | **Re-check confirmed-date conflicts** — `REQUEST-004` | `409 REQUEST_DATE_CONFLICT` |
| 7 | **Perform the state change transactionally** | Constraint violation → `409 REQUEST_DATE_CONFLICT` |
| 8 | **Notify after a successful commit** | Never fails the transition (P8) |

**Step 6 is the whole point of `REQUEST-004`.** `request-engine.md` §12: *"The system does not assume that the availability shown when the Viewer originally submitted the request is still valid when the Publisher acts on it — another request may have been confirmed in the meantime."* Between submission and acceptance, hours or days pass; the availability captured at submission is worthless.

**Step 8 happens inside the transaction as a *record*, and outside it as *delivery*.** The `notifications` row is inserted before `COMMIT`, so a confirmed request can never exist without its notification recorded (`system-architecture.md` §28). The push/email dispatch is a separate job (§28.4), because a provider timeout inside the transaction would hold a row lock on the confirmation path — the exact failure `system-architecture.md` §38 #12 names.

### 19.2 The concurrency mechanism, as selected by the settled data layer

Two independent mechanisms enforce the invariant. Both are already specified in `database-design.md`; this API relies on them and adds nothing.

**1 — Row lock plus in-transaction re-validation.**

```sql
SELECT * INTO v_request FROM requests WHERE id = p_request_id FOR UPDATE;
```

Concurrent `confirm_request()` calls on the same request serialize on the row lock. Concurrent calls on *different* requests for the *same hoarding* are serialized by step 6's read, which the exclusion index enforces at write time.

**2 — A PostgreSQL exclusion constraint, as the structural backstop.**

```sql
ALTER TABLE requests
  ADD CONSTRAINT requests_no_overlapping_confirmed
  EXCLUDE USING gist (hoarding_id WITH =, stay_range WITH &&)
  WHERE (status IN ('CONFIRMED', 'LIVE', 'COMPLETED'));
```

For any two rows on the same `hoarding_id` whose status is in the blocking set, their date ranges must not overlap — enforced by PostgreSQL as part of the index structure, with **no window between check and write** for two concurrent transactions to slip through.

**No distributed locking system is introduced, and none is needed.** `system-architecture.md` §7 explains why the modular monolith exists: the confirmation invariant is one transaction in one database. `seeable_free_first_techstack.md` §21 calls the exclusion constraint *"the single highest-value database feature for this specific product's core invariant."* This API adds no Redis lock, no advisory-lock protocol of its own, and no application-level coordination — inventing one would be strictly worse than the guarantee already in place.

**Why the function catches the constraint violation rather than letting it surface.** A raw `23P01 exclusion_violation` is not something a Publisher-facing UI should render. `confirm_request()` catches it and re-raises a specific message, which the API maps to `409 REQUEST_DATE_CONFLICT` — satisfying `system-architecture.md` §29's requirement that a failed conflict check return a *specific* reason.

### 19.3 The worked race, exactly as the brief describes it

**Setup** — Hoarding H, no confirmed requests:

```text
Viewer A  →  1–15 September   status: REQUESTED
Viewer B  → 10–20 September   status: REQUESTED
```

**Both are valid Pending requests simultaneously.** They overlap each other, and that is fine: the exclusion constraint's `WHERE` clause excludes `REQUESTED` rows entirely, so a Pending request blocks nothing (`database-design.md` §31, `mvp-prd.md` §12).

**Case 1 — the Publisher confirms A, then later acts on B.**

```text
A  →  CONFIRMED     1–15 September now blocked
B  →  remains REQUESTED
```

B is untouched. It does **not** auto-reject and it does **not** auto-expire — nothing in `REQUEST-001` or `REQUEST-002` says a losing overlapping request changes state, and inventing an auto-rejection would be a new product decision. B remains available for the Publisher to reject explicitly, or it expires naturally at its `sla_deadline`.

Any subsequent `ACCEPT` on B fails step 6:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_DATE_CONFLICT",
    "message": "These dates are no longer available — a conflicting request was already confirmed.",
    "details": {
      "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "requested_range": { "start_date": "2026-09-10", "end_date": "2026-09-20" },
      "conflicting_range": { "start_date": "2026-09-01", "end_date": "2026-09-15" },
      "request_status": "REQUESTED"
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E908"
}
```

`request_status: "REQUESTED"` is in `details` on purpose — the request did **not** change state, and the Publisher's next options (reject it, or leave it to expire) depend on knowing that.

`conflicting_range` is included because it lets the Publisher understand the refusal. It reveals that *some* booking exists on those dates — which the availability endpoint already tells any Viewer (§15.2) — and reveals nothing about **who** holds it.

**Case 2 — A and B are accepted simultaneously.**

> **Exactly one confirmation succeeds. Never both. Never neither without a clear reason.**

```text
t0   Transaction 1: confirm_request(A) → SELECT … FOR UPDATE on A
t0   Transaction 2: confirm_request(B) → SELECT … FOR UPDATE on B   (different row, no wait)
t1   T1: step 6 finds no conflicting CONFIRMED row → UPDATE A → CONFIRMED
t1   T2: step 6 finds no conflicting CONFIRMED row  (T1 has not committed;
         under READ COMMITTED, T2 cannot see T1's uncommitted row)
t2   T1: COMMIT — the exclusion index now holds A's range
t2   T2: UPDATE B → CONFIRMED  →  the exclusion index blocks it
         (T2's index insert waits on T1's uncommitted entry, then fails once T1 commits)
t3   T2: 23P01 exclusion_violation → caught → 409 REQUEST_DATE_CONFLICT
```

**This is precisely why the exclusion constraint is not redundant with step 6.** The two requests are different rows, so the `FOR UPDATE` locks do not serialize them against each other, and under `READ COMMITTED` both re-validations can legitimately see a conflict-free world. **Only the constraint closes that window.** An implementation that relied on step 6 alone would double-confirm under exactly this interleaving — the failure `mvp-prd.md` §11 names as an edge case that must *"never be silently Confirmed."*

**The response is deterministic for the loser.** `409 REQUEST_DATE_CONFLICT`, with `details` as above, and the losing request stays `REQUESTED`. It is not a `500`, not a timeout, and not a generic conflict.

### 19.4 Two further races the confirmation path must survive

**SLA expiry racing a Publisher's accept.** The expiry job's `UPDATE … WHERE status = 'REQUESTED'` and `confirm_request()`'s `SELECT … FOR UPDATE` contend on the same row. Whichever acquires the lock first wins; the second sees the changed status and fails its precondition (step 4) cleanly. If expiry wins, the Publisher receives `409 REQUEST_STATE_CONFLICT` with `details.current_status: "EXPIRED"`. **Which side *should* win is an OPEN QUESTION** — `request-engine.md` §25 #5 and `system-architecture.md` §16 both decline to decide it, guaranteeing only that exactly one transition commits. This API inherits that: the guarantee is mechanical, not a product statement about the "right" winner. Carried to §46.

**Listing paused between request and accept.** Step 5 catches it: `409 HOARDING_NOT_VISIBLE`. The request remains `REQUESTED`. This is a real, reachable state (§13.4) and the Publisher-side client must render it — most likely as "unpause this listing to accept."

### 19.5 The error-code selection problem, and how this endpoint solves it

`confirm_request()` raises `55000` for **all** of steps 4, 5, and 6, which the API must map to three different codes (§8.5). Message-string matching is not acceptable.

**Specified approach, and it is sound because the function remains the enforcement point:** the route performs a **read-only pre-check** of the same three conditions immediately before calling the function, and uses the pre-check's result to select the error code when the function raises `55000`. The pre-check never authorizes anything — it only names the failure. If the pre-check finds all three conditions satisfied and the function still raises (the genuine race in §19.3 Case 2), the code defaults to `REQUEST_DATE_CONFLICT`, which is correct: a `55000` raised after a clean pre-check can only be the conflict re-check or the constraint losing a race, both of which are the same user-visible outcome.

**REQUIRED long-term fix (§46.1):** amend the database functions to carry a machine code in the exception `DETAIL`, and delete the pre-check. It is a small, additive change and it removes the one piece of duplicated business logic this API is otherwise forced to carry.

---

## 20. Request Update / Actions

### 20.1 `PATCH /api/v1/requests/{id}`

**REQUIRED** — `mvp-prd.md` §9: *"`PATCH /api/v1/requests/{id}` (accept/reject/complete)"*.

One endpoint, three transitions, discriminated by an `action` field.

| | |
|---|---|
| Auth | Bearer |
| Authorization | Depends on `action` — §20.3 |
| Idempotency | `Idempotency-Key` **REQUIRED in practice** (§31) |
| Rate limit | **RECOMMENDED** 60 / hour / Publisher |
| Transaction | One `SECURITY DEFINER` function call per action |

### 20.2 The action model

```json
{ "action": "ACCEPT" }
```

```json
{ "action": "REJECT", "reason": "Dates unavailable — site is under maintenance." }
```

```json
{ "action": "COMPLETE" }
```

```json
{ "action": "SET_AMOUNT_AGREED", "amount_agreed": "82500.00" }
```

| Field | Rule |
|---|---|
| `action` | **Required.** One of `ACCEPT`, `REJECT`, `COMPLETE`, `SET_AMOUNT_AGREED`. Anything else → `422 REQUEST_ACTION_INVALID` |
| `reason` | `REJECT` only. **Optional** (§18.3). ≤ 500 code points. Present on any other action → `422` |
| `amount_agreed` | `SET_AMOUNT_AGREED` only. Money string, `> 0`. Present on any other action → `422` |

**A client may never send `{"status": "CONFIRMED"}`.** It returns `422 VALIDATION_ERROR` with `details.fields.status: "status is not client-writable; use action instead"`. This is checked at the route **and** is structurally impossible below it: `requests` has no client `UPDATE` grant and no RLS `UPDATE` policy (`database-design.md` §37.7, §41.11), so even a route bug cannot produce a direct status write.

**Why an action discriminator rather than three sub-resource routes (ADR-API-003).** Three considerations, in order of weight:

1. **`mvp-prd.md` §9 fixes this endpoint.** It names one `PATCH` covering accept/reject/complete. Precedence rule 2 applies.
2. **State transitions are not field assignments.** `ACCEPT` is not "set status to CONFIRMED" — it is "attempt a guarded transition that may legitimately fail because the world changed." An action name says that; a field assignment implies the client is choosing the outcome, which it is not (P6).
3. **One safety-critical surface, not several.** Confirmation carries the system's core invariant, its idempotency handling, and its concurrency semantics. Three routes would mean three places for each of those to be got right and kept in sync.

The cost is that `PATCH` here is not a JSON-merge patch, which is a mild abuse of the verb. It is accepted because the alternative — `POST /requests/{id}/accept` — contradicts the approved endpoint list for a stylistic gain.

### 20.3 Action authorization

| Action | Viewer | Publisher | Admin | Valid from |
|---|:---:|:---:|:---:|---|
| `ACCEPT` | ✗ | ✓ own listing | **✗** | `REQUESTED` |
| `REJECT` | ✗ | ✓ own listing | **✗** | `REQUESTED` |
| `COMPLETE` | ✗ | ✓ own listing | **✓** | `CONFIRMED`, `LIVE` |
| `SET_AMOUNT_AGREED` | ✗ | ✓ own listing | ✗ | `CONFIRMED`, `LIVE`, `COMPLETED` |

**Admin cannot `ACCEPT` or `REJECT`. This is a requirement.** `request-engine.md` §23's matrix ends with *"Modify state arbitrarily: No / No / **No**"* — Admin included — and §4 grants Admin exactly two request capabilities: Mark Completed, and aggregate dashboard counts. `confirm_request()` and `reject_request()` check `publisher_id = auth.uid()` with **no `is_admin()` escape hatch** (`database-design.md` §41.6). An Admin attempting `ACCEPT` receives `403 FORBIDDEN_ROLE`.

**Error precedence, so failures are predictable:** unknown action (`422`) → role (`403`) → ownership (`403`/`404`) → state (`409`) → business precondition (`409`). A caller with the wrong role on a request in the wrong state always sees the role error, never the state error — the state of a resource they may not act on is not theirs to learn.

### 20.4 `SET_AMOUNT_AGREED` — RECOMMENDED, and flagged as an inherited assumption

There is no endpoint anywhere in `mvp-prd.md` §9 for recording `amount_agreed`, yet §7.4 requires the field to exist and be captured. Some write path is technically necessary.

**Specified:** the owning Publisher only, only once the request has left `REQUESTED`, via this action. This follows `database-design.md` §22's Assumption verbatim.

**It is genuinely unresolved who should own this**, and both `viewer-platform.md` §28 and `request-engine.md` §17 say so. The reading adopted here treats the value as the outcome of the offline settlement that `mvp-prd.md` §6.2 places *after* confirmation. Carried to §46.

The value is **never** used to compute anything, never collected, never invoiced, and never compared against `hoardings.price` — a Publisher and Viewer may agree any amount offline, and `inventory.md` §12 is explicit that the listing price and `amount_agreed` are two different values with two different owners.

### 20.5 Responses

**`200 OK`** with the full updated Request resource, so the client can re-render without a second fetch.

| Action | Result |
|---|---|
| `ACCEPT` | `status: "CONFIRMED"`, `confirmed_at` set, `available_actions: ["COMPLETE","SET_AMOUNT_AGREED"]` if the start date has passed, else `["SET_AMOUNT_AGREED"]` |
| `REJECT` | `status: "REJECTED"`, `rejected_at` set, `rejection_reason` echoed, `available_actions: []` |
| `COMPLETE` | `status: "COMPLETED"`, `completed_at` and `completed_by` set, `available_actions: []` |
| `SET_AMOUNT_AGREED` | `amount_agreed` set; `status` unchanged |

### 20.6 Errors

| Status | Code | Cause |
|---|---|---|
| 401 | `AUTH_REQUIRED` | No token |
| 403 | `FORBIDDEN_ROLE` | Viewer calling; Admin attempting `ACCEPT`/`REJECT`/`SET_AMOUNT_AGREED` |
| 403 | `FORBIDDEN_NOT_OWNER` | Publisher acting on another Publisher's request |
| 404 | `REQUEST_NOT_FOUND` | No such request, or invisible to this caller |
| 409 | `REQUEST_STATE_CONFLICT` | Action illegal from the current status. `details.current_status` names it |
| 409 | `REQUEST_DATE_CONFLICT` | `ACCEPT` lost the `REQUEST-004` re-validation (§19) |
| 409 | `HOARDING_NOT_VISIBLE` | `ACCEPT` on a listing now paused/delisted |
| 409 | `REQUEST_COMPLETE_TOO_EARLY` | `COMPLETE` before `start_date` (`REQUEST-003`) |
| 409 | `REQUEST_AMOUNT_NOT_SETTABLE` | `SET_AMOUNT_AGREED` while still `REQUESTED` |
| 422 | `REQUEST_ACTION_INVALID` | Unknown action, or a field that does not belong to the action |
| 501 | `REQUEST_CANCEL_UNSUPPORTED` | `action: "CANCEL"` — reserved, not an MVP feature |

`REQUEST_STATE_CONFLICT` always carries the current state, because the correct client response depends on it:

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_STATE_CONFLICT",
    "message": "This request is no longer awaiting a response.",
    "details": { "current_status": "EXPIRED", "attempted_action": "ACCEPT", "expired_at": "2026-09-01T09:41:02Z" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E909"
}
```

---

## 21. Request History

### 21.1 What is exposed, and the three things it is not

`request-engine.md` §29 is careful here: per-request **timestamps** are approved because they are load-bearing for `REQUEST-003` and SLA expiry, while a full **audit-event API** is *"an Assumption/Open Question, not an approved MVP requirement."* `database-design.md` §23 adds `request_status_history` anyway as a **Recommendation**, on three stated grounds — it is trigger-maintained and therefore nearly free; it answers `admin-platform.md` §20's audit-trail gap; and it is the only possible data source for `mvp-brd.md` §14's *"median Publisher response time"* KPI.

This API keeps the three levels distinct, exactly as the brief requires:

| Level | Where | Status |
|---|---|---|
| **Current state** | `status` + `status_label` on the Request resource | **REQUIRED** |
| **Lifecycle timestamps** | `created_at`, `updated_at`, `responded_at`, `confirmed_at`, `rejected_at`, `expired_at`, `live_at`, `completed_at` | **REQUIRED** — `request-engine.md` §26 |
| **Full transition history** | `GET /api/v1/requests/{id}/history` | **RECOMMENDED** — not an approved MVP requirement |

### 21.2 Timestamps on the Request resource

Every timestamp in §16.3 is a real column except `responded_at`, which is derived (§16.3). A client building a timeline from the Request resource alone can do so without calling the history endpoint — which is why the history endpoint is a Recommendation rather than a necessity.

### 21.3 `GET /api/v1/requests/{id}/history`

**RECOMMENDED.**

| | |
|---|---|
| Auth | Bearer |
| Authorization | The owning Viewer, the owning Publisher, **or** Admin — matching `rsh_select_via_request` RLS exactly (`database-design.md` §37.8) |
| Pagination | None — at most 4 rows (§9.4) |
| Order | `changed_at ASC` |

```json
{
  "success": true,
  "data": {
    "request_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "history": [
      { "from_status": null,        "to_status": "REQUESTED", "changed_by": { "id": "3333...", "role": "VIEWER" },    "changed_at": "2026-08-30T09:41:02Z", "note": null },
      { "from_status": "REQUESTED", "to_status": "CONFIRMED", "changed_by": { "id": "1111...", "role": "PUBLISHER" }, "changed_at": "2026-08-31T04:12:55Z", "note": null },
      { "from_status": "CONFIRMED", "to_status": "LIVE",      "changed_by": null,                                     "changed_at": "2026-09-10T00:00:07Z", "note": "system" }
    ]
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90A"
}
```

**`changed_by: null` means a system transition** — the SLA expiry and `CONFIRMED → LIVE` jobs run without an `auth.uid()`, and `log_request_status_change` records `NULL` accordingly. The API surfaces `"note": "system"` so a UI can label it without special-casing a null.

**`changed_by` is an object with `id` and `role`, never a name or contact detail.** Both parties can already see each other's display identity on the Request resource (§16.3); the history adds no new identity exposure.

**A note on the `RLS` asymmetry, since it is surprising.** `rsh_select_via_request` **does** include `is_admin()`, while `requests_select_own` does **not** (§6.6). So an Admin can read a request's *history* but not the request itself. That is what the settled schema says, and this API implements it faithfully rather than harmonizing it silently — but it is almost certainly an oversight in `database-design.md` rather than an intentional design, since a history with no readable parent is of limited use. Flagged in §46.1 for confirmation: either add `is_admin()` to `requests_select_own` (widening Admin visibility, which `request-engine.md` §4 explicitly declines to grant) or remove it from `rsh_select_via_request` (narrowing it consistently). **This document recommends the latter**, because it preserves the approved restriction; the decision belongs with the Support/Dispute Runbook.

### 21.4 What this API does not build

- **No `/api/v1/audit-log`.** A general audit-event API is not an MVP requirement (`admin-platform.md` §20, full-scope `BR-ADMIN-003`). §24.7's `GET /api/v1/admin/actions` is scoped to `admin_actions` — moderation decisions only, Admin-readable only — and is itself labelled **RECOMMENDED**.
- **No history-write API.** `request_status_history` is trigger-maintained and has no client `INSERT`, `UPDATE`, or `DELETE` policy. It is append-only by construction.
- **No `note` write path.** The column exists and is populated only by the system. Exposing a client-writable note on an audit row would undermine the row's evidentiary value in precisely the disputes `mvp-brd.md` §17 anticipates.

---

## 22. Publisher APIs

`docs/03-modules/owner-platform.md` does not exist — confirmed absent for the sixth time. Every endpoint below is derived directly from `mvp-prd.md` §7.2's functional requirements, `inventory.md` §19's permissions table, and the RLS policies and functions in `database-design.md` §37 and §41. **Nothing is added on the assumption of what a Publisher module document would have said.**

### 22.1 Endpoints

| Method | Path | Status | Derived from |
|---|---|---|---|
| `GET` | `/api/v1/publishers/me` | **REQUIRED (derived)** | `mvp-prd.md` §7.2 profile: name, phone, business name, verification status |
| `PATCH` | `/api/v1/publishers/me` | **REQUIRED (derived)** | *"Profile setup"* in the same requirement |
| `GET` | `/api/v1/publishers/me/hoardings` | **REQUIRED (derived)** | *"Add/edit/pause/delete hoarding listings"* implies a listing-management surface |
| `GET` | `/api/v1/publishers/me/requests` | **REQUIRED** | `mvp-prd.md` §9, verbatim — the request inbox |
| `GET` | `/api/v1/publishers/me/summary` | **RECOMMENDED** | `mvp-prd.md` §7.2's *"Revenue view: list of Confirmed requests (no payout ledger — settlement is offline)"* |

**No `/api/v1/publishers/{id}` exists.** A Publisher may only ever address their own resources through `/me`. There is no endpoint anywhere in this API through which one Publisher can read another Publisher's inventory-management resources, requests, availability blocks, or profile — `system-architecture.md` §18 and `request-engine.md` §28 both make this a named requirement, and the absence of the route is the cleanest way to guarantee it. Admin reaches a specific Publisher through `/api/v1/admin/publishers/{id}` (§26), which is a different, Admin-only surface.

### 22.2 `GET /api/v1/publishers/me`

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER` → else `403 FORBIDDEN_ROLE` |

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "full_name": "Ramesh Kumar",
    "phone": "+919900000001",
    "email": "ramesh@example.com",
    "city": "Bengaluru",
    "business_name": "Kumar Outdoor Media",
    "verification_status": "VERIFIED",
    "verified_at": "2026-08-20T11:02:10Z",
    "verification_rejection_reason": null,
    "suspended": false,
    "suspended_at": null,
    "suspension_reason": null,
    "can_submit_listings": true,
    "created_at": "2026-08-01T06:00:00Z",
    "updated_at": "2026-08-20T11:02:10Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90B"
}
```

**`suspended_by` is not returned to the Publisher.** It identifies an internal staff member. Admin sees it at §26.3.

**`suspension_reason` and `verification_rejection_reason` ARE returned to the Publisher**, because a trust decision the subject cannot see is not actionable. Neither is a sourced requirement — `admin-platform.md` §27 records that whether verification outcomes notify the Publisher at all is undefined — so this is **RECOMMENDED**: the columns exist, and returning them on the Publisher's own profile is the minimum that makes suspension something they can respond to. Carried to §46.

### 22.3 `PATCH /api/v1/publishers/me`

Accepts exactly the fields the database grants a client, and no others:

| Field | Target column | Grant |
|---|---|---|
| `full_name`, `phone`, `email`, `city` | `profiles` | `GRANT UPDATE (full_name, phone, email, city)` |
| `business_name` | `publisher_profiles` | `GRANT UPDATE (business_name)` |

**Everything else returns `422 VALIDATION_ERROR`**, most importantly `role`, `verification_status`, and `suspended`. `database-design.md` §38.1 revokes these at the **column** level, so even if this route regressed, `UPDATE profiles SET role='ADMIN' WHERE id=auth.uid()` fails on privilege, not merely on policy — RLS decides *rows*, column grants decide *fields*, and self-role-escalation needs both to be wrong before it works.

A single `PATCH` may span both tables. It is applied as one transaction: either both writes land or neither does.

### 22.4 `GET /api/v1/publishers/me/requests` — the request inbox

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = PUBLISHER`. Returns rows where `publisher_id = auth.uid()` — **never** another Publisher's |
| Query | `status` (repeatable), `hoarding_id`, `page`, `pageSize` |
| Order | `REQUESTED` first, then `sla_deadline ASC NULLS LAST`, then `created_at DESC` |

**The ordering is a design decision worth stating.** This is an *inbox*, and `OWNER-002` puts a clock on every item in it. Surfacing the requests nearest their SLA deadline first is what makes the inbox act on the rule rather than merely display it. `database-design.md` §43.2's own example query orders by `sla_deadline ASC NULLS LAST` for exactly this reason.

`status` is repeatable — `?status=REQUESTED&status=CONFIRMED` — because an inbox with six states genuinely needs OR-within-a-field, unlike the discovery filters in §10.3 which are AND-only across different fields.

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "hoarding": { "id": "aaaa...", "title": "Outer Ring Road Unipole — Marathahalli", "type_code": "UNIPOLE_BILLBOARD", "locality": "Marathahalli" },
        "viewer": { "id": "3333...", "full_name": "Vikram Shah" },
        "start_date": "2026-09-10",
        "end_date": "2026-09-20",
        "duration_days": 11,
        "status": "REQUESTED",
        "status_label": "Awaiting your response",
        "message": "Interested in this site for a September product launch.",
        "sla_deadline": "2026-09-01T09:41:02Z",
        "sla_hours_remaining": 41.3,
        "created_at": "2026-08-30T09:41:02Z",
        "available_actions": ["ACCEPT", "REJECT"]
      }
    ]
  },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 7, "total_pages": 1, "has_next": false, "has_previous": false },
    "counts_by_status": { "REQUESTED": 3, "CONFIRMED": 2, "LIVE": 1, "COMPLETED": 1, "REJECTED": 0, "EXPIRED": 0 }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90C"
}
```

| Field | Note |
|---|---|
| `viewer.full_name` | The Viewer's display name, and **nothing else** — no phone, no email. The Publisher has a legitimate need to know who is asking; they do not need contact details from the platform to accept or reject. §23.4 |
| `sla_hours_remaining` | **RECOMMENDED**, derived. `OWNER-002`'s clock made legible. Negative when the sweep has not yet run on an overdue request — which is honest about the gap between deadline and job execution |
| `available_actions` | §16.3. `["ACCEPT","REJECT"]` on a `REQUESTED` row; `["COMPLETE","SET_AMOUNT_AGREED"]` on a `LIVE` one |
| `counts_by_status` | **RECOMMENDED** — computed over the whole inbox, not the current page, so a badge count is correct on page 3 |

**Finding — `database-design.md` defect #3, affecting this endpoint.** The `publisher_inbox` view is declared `WITH (security_invoker = true)` and joins `profiles p ON p.id = r.viewer_id` to expose `viewer_name`. But `profiles` RLS is `id = auth.uid() OR is_admin()`, so the Publisher **cannot read the Viewer's `profiles` row**. With `security_invoker`, the invisible row is filtered out of the inner join, and **the view returns zero rows for every Publisher** — the request inbox, one of the four surfaces `mvp-prd.md` §7.2 requires, is empty.

**REQUIRED fix (§46.1):** either

1. add a `profiles` RLS policy permitting a read of a counterparty's row where a request links the two (`EXISTS (SELECT 1 FROM requests r WHERE (r.publisher_id = auth.uid() AND r.viewer_id = profiles.id) OR (r.viewer_id = auth.uid() AND r.publisher_id = profiles.id))`), which is narrow and defensible — the two parties to a request are not strangers; **or**
2. drop the `profiles` join from the view and resolve the counterparty name through a `SECURITY DEFINER` function that returns `full_name` only.

**RECOMMENDED: option 1**, because it also fixes `viewer_request_list` symmetrically and because the counterparty relationship is exactly the scope in which a name should be visible. Either way, `phone` and `email` must remain unexposed — which option 1 achieves through the column-level projection this API specifies, not through RLS.

### 22.5 `GET /api/v1/publishers/me/hoardings`

| | |
|---|---|
| Query | `approval_status` (repeatable), `is_paused`, `is_delisted`, `page`, `pageSize` |
| Order | `created_at DESC` |
| Representation | The **owner** representation (§11.3) — every state, including `DRAFT` and `REJECTED`, with `submission_readiness` and `is_edit_frozen` |

```json
{
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 6, "total_pages": 1, "has_next": false, "has_previous": false },
    "counts_by_approval_status": { "DRAFT": 2, "PENDING_REVIEW": 1, "APPROVED": 3, "REJECTED": 0 },
    "counts": { "paused": 1, "delisted": 0, "live_in_search": 2 }
  }
}
```

`live_in_search` is the count satisfying `INVENTORY-003` — the number a Publisher actually cares about, and the only honest answer to "how many of my listings can buyers see", since `APPROVED` alone overstates it whenever something is paused or delisted.

### 22.6 `GET /api/v1/publishers/me/summary`

**RECOMMENDED** — `mvp-prd.md` §7.2's *"Revenue view: list of Confirmed requests (no payout ledger — settlement is offline)."*

```json
{
  "success": true,
  "data": {
    "listings": { "total": 6, "live_in_search": 2, "pending_approval": 1, "draft": 2, "rejected": 0 },
    "requests": { "awaiting_response": 3, "confirmed": 2, "live": 1, "completed": 1, "expired": 0, "rejected": 0 },
    "confirmed_value": { "amount": "165000.00", "currency": "INR", "basis": "SUM of amount_agreed where recorded" },
    "verification_status": "VERIFIED",
    "suspended": false
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90D"
}
```

**`confirmed_value` is not revenue, and the field is named and annotated so nobody mistakes it for revenue.** It is the sum of `amount_agreed` over confirmed, live, and completed requests **where a value was recorded at all** — many will be `null` (§20.4), and the platform neither collects nor verifies any of it (`mvp-prd.md` §7.4, `inventory.md` §12). The `basis` string is returned deliberately: a bare number labelled "revenue" in a marketplace with no payment system is precisely the kind of field that ends up in a pitch deck as though it meant something.

**No payout ledger, no invoice, no commission, no tax.** `mvp-prd.md` §7.2 says so explicitly, and none of those concepts exists anywhere in this API (§45).

---

## 23. Viewer APIs

### 23.1 Endpoints

| Method | Path | Status |
|---|---|---|
| `GET` | `/api/v1/hoardings` | **REQUIRED** — §10, §11 |
| `GET` | `/api/v1/hoardings/{id}` | **REQUIRED** — §11.4 |
| `GET` | `/api/v1/hoardings/{id}/availability` | **REQUIRED (derived)** — §15.2 |
| `POST` | `/api/v1/requests` | **REQUIRED** — §17 |
| `GET` | `/api/v1/requests/me` | **REQUIRED** — §23.2 |
| `GET` | `/api/v1/requests/{id}` | **REQUIRED (derived)** — §23.3 |
| `GET` | `/api/v1/notifications` | **REQUIRED (derived)** — §27 |
| `PATCH` | `/api/v1/notifications/{id}` | **REQUIRED (derived)** — §27 |
| `GET` | `/api/v1/viewers/me` | **REQUIRED (derived)** — `mvp-prd.md` §7.1 profile |
| `PATCH` | `/api/v1/viewers/me` | **REQUIRED (derived)** — same |
| `GET` | `/api/v1/hoarding-types` | **RECOMMENDED** — §11.5, for the type filter |

**`GET /api/v1/viewers/me` and `GET /api/v1/auth/me` overlap, and the split is deliberate.** `/auth/me` is the *identity* endpoint — role, verification, capability flags — called once on app load by every role. `/viewers/me` is the *profile resource*, and it exists chiefly because `PATCH /viewers/me` and `PATCH /publishers/me` accept genuinely different field sets (the Publisher's includes `business_name`, which lives in a different table with a different grant). Collapsing them into one `/me` resource would give one endpoint two shapes depending on the caller's role, which is worse. **RECOMMENDED** as specified; a single `/me` is a reasonable alternative and is noted in §46.

### 23.2 `GET /api/v1/requests/me`

**REQUIRED** — `mvp-prd.md` §9.

| | |
|---|---|
| Authorization | `role = VIEWER`; returns rows where `viewer_id = auth.uid()` |
| Query | `status` (repeatable), `page`, `pageSize` |
| Order | `created_at DESC` |

Returns the Request resource (§16.3) with `status_label` in **Viewer** vocabulary — `Pending`, `Confirmed`, `Rejected`, `Expired`, `Campaign Period`, `Completed` (`viewer-platform.md` §14). `available_actions` is always `[]`: a Viewer has no actions on their own request at MVP, because cancellation is not an MVP feature (§16.2).

`meta.counts_by_status` is returned as in §22.4.

### 23.3 `GET /api/v1/requests/{id}`

**REQUIRED (derived).** Named as a gap by `request-engine.md` §27, `viewer-platform.md` §23, and `system-architecture.md` §19. The Request Detail page (`viewer-platform.md` §15) — hoarding summary, dates, status, Publisher response — is not implementable from the list endpoint alone.

| | |
|---|---|
| Authorization | `viewer_id = auth.uid()` **or** `publisher_id = auth.uid()`. **Admin receives `404`** — §6.6 |
| Response | The full Request resource, `status_label` scoped to the caller's role |
| Errors | `404 REQUEST_NOT_FOUND` for any caller who is not one of the two parties |

**The embedded `hoarding` summary is served even when the listing is no longer visible.** `viewer-platform.md` §21 requires that a request against a since-removed listing *"should not resolve to a broken reference."* The request is the Viewer's own record of something that happened; hiding its subject would be a worse failure than showing a listing that is no longer purchasable. The summary carries `is_currently_listed: false` so the client can render "this listing is no longer available" alongside the request rather than offering a dead link.

### 23.4 Which listing fields are public to Viewers — and the disintermediation boundary

`mvp-brd.md` §12 names **disintermediation** as *"the single biggest structural risk of a payment-free MVP"*: a Viewer and Publisher meet through SEEABLE and then transact offline forever, cutting the platform out. `mvp-brd.md` §17 lists it as the top risk. `viewer-platform.md` §12 draws the direct consequence: *"Exposing direct Publisher contact information on the detail page, before a request even exists, would plausibly increase that risk."*

**Specified default — the conservative reading, applied uniformly:**

| Publisher field | Viewer sees it? |
|---|---|
| `business_name` | **Yes**, at every stage — it is the trust signal a buyer needs to evaluate a listing |
| `is_verified` | **Yes**, at every stage — `mvp-brd.md` §10 makes verification the platform's substitute for payment-based trust; hiding it would waste the mechanism |
| `phone` | **No.** Not on the listing, not on a confirmed request, not anywhere in this API |
| `email` | **No.** Same |
| `full_name` (of the Publisher individual) | **No** — `business_name` is the commercial identity |
| `verification_rejection_reason`, `suspended`, `suspended_at` | **No** — internal trust state |

**This is an OPEN QUESTION, not a settled rule, and it is specified conservatively on purpose.** `viewer-platform.md` §28 lists it explicitly: *"Whether Publisher contact details are visible to a Viewer pre-request, post-request, or only post-Confirmation."* Three readings are defensible, and the third has real merit — once a request is `CONFIRMED`, `mvp-prd.md` §6.2's own journey requires the two parties to *"settle offline"*, which they cannot do without some channel. The counter-argument is that a platform that hands over contact details at confirmation has handed over the relationship.

**Why the conservative default is specified rather than the post-confirmation reveal:** withholding is reversible and revealing is not. `system-architecture.md` §31 gives the implementation guidance this API follows — *"treat Publisher contact fields as separately gated, not as ordinary listing fields — so that whichever policy is chosen can be applied at one point rather than retrofitted across every response that includes a Publisher."* Concretely: contact fields are never part of any `hoarding` or `request` serializer, so enabling a post-confirmation reveal means adding one gated block to one place. Carried to §46 as a decision the business must make before launch, because "settle offline" without a channel is an incomplete flow.

**Symmetrically, the Publisher never receives Viewer contact details** — only `full_name` on requests against their own listings (§22.4). The disintermediation risk runs both directions, and `mvp-brd.md` §12's *"a Viewer submits requests they never intend to honor"* edge case is the mirror image.

### 23.5 `GET` / `PATCH /api/v1/viewers/me`

| | |
|---|---|
| Authorization | `role = VIEWER` |
| `GET` returns | `id`, `full_name`, `phone`, `email`, `city`, `created_at`, `updated_at` |
| `PATCH` accepts | `full_name`, `phone`, `email`, `city` — exactly the column `GRANT` (§38.1) |
| `PATCH` refuses | `role`, `id`, timestamps, and every Publisher-only field → `422 VALIDATION_ERROR` |

`mvp-prd.md` §7.1's minimal profile is *"name, phone/email, city"* — no company field, no saved searches, no preferences, no payment details. `viewer-platform.md` §19 confirms nothing further is defined, and none is added here. The demo build's password is held by Supabase Auth, never in `profiles`, and is not a field on this resource (§5.1).

---

## 24. Admin APIs

### 24.1 The gap this section closes, and the boundary it respects

`admin-platform.md` §19 states the problem precisely: `mvp-prd.md` §7.5 names **four** Admin capabilities — listing approval, Publisher verification, the dashboard, and suspend/delist — while `mvp-prd.md` §9 provides endpoints for only **two** of them. `inventory.md` §21 and `system-architecture.md` §19 flag the same gap from their own sides. It is *"a real gap between the functional requirements and the API surface,"* explicitly deferred to this document.

**This section closes it — and closes it exactly at the boundary the source documents draw, not one capability further.**

### 24.2 Endpoints

| Method | Path | Status | Source |
|---|---|---|---|
| `POST` | `/api/v1/admin/hoardings/{id}/approve` | **REQUIRED** | `mvp-prd.md` §9, verbatim |
| `POST` | `/api/v1/admin/hoardings/{id}/reject` | **REQUIRED** | `mvp-prd.md` §9, verbatim |
| `GET` | `/api/v1/admin/dashboard` | **REQUIRED** | `mvp-prd.md` §9, verbatim |
| `GET` | `/api/v1/admin/hoardings` | **REQUIRED (derived)** | `mvp-prd.md` §7.5 *"listing approval queue"* — a queue with no read endpoint is not a queue |
| `POST` | `/api/v1/admin/hoardings/{id}/delist` | **REQUIRED (derived)** | `mvp-prd.md` §7.5 *"delist a hoarding"*; `ADMIN-004`; `delist_hoarding()` |
| `POST` | `/api/v1/admin/hoardings/{id}/relist` | **RECOMMENDED** | `relist_hoarding()` exists; `inventory.md` §27 flags reversibility as open |
| `GET` | `/api/v1/admin/publishers` | **REQUIRED (derived)** | `mvp-prd.md` §7.5 *"Publisher verification queue"* |
| `GET` | `/api/v1/admin/publishers/{id}` | **REQUIRED (derived)** | A verification decision needs the record it is about |
| `POST` | `/api/v1/admin/publishers/{id}/verify` | **REQUIRED (derived)** | `mvp-prd.md` §7.5; `AUTH-002`; `OWNER-004` |
| `POST` | `/api/v1/admin/publishers/{id}/reject-verification` | **REQUIRED (derived)** | The other half of the verify/reject decision |
| `POST` | `/api/v1/admin/publishers/{id}/suspend` | **REQUIRED (derived)** | `mvp-prd.md` §7.5 *"suspend a Publisher"*; `ADMIN-002` |
| `POST` | `/api/v1/admin/publishers/{id}/unsuspend` | **RECOMMENDED** | `unsuspend_publisher()` exists — itself a Recommendation in `database-design.md` §17, since **no source document describes a reversal** |
| `GET` | `/api/v1/admin/actions` | **RECOMMENDED** | `admin_actions` exists with an Admin read policy; §24.7 |

**Deliberately NOT created — each is an approved restriction, not an omission:**

| Not created | Why |
|---|---|
| `GET /api/v1/admin/requests` | `request-engine.md` §4 and §23, `admin-platform.md` §12: Admin has *"no general visibility into individual Viewer or Publisher requests... never as a browsable list."* `database-design.md` §37.7 implements it by omitting `is_admin()` from the RLS policy. Building this would take a documented restriction and quietly remove it |
| `POST /api/v1/admin/requests/{id}/accept` or `/reject` | Admin has no accept/reject authority whatsoever (`request-engine.md` §23's matrix) |
| `PATCH /api/v1/admin/hoardings/{id}` | `mvp-prd.md` §5's *"edit for moderation only"* is, per `admin-platform.md` §10, *"completely unelaborated in any source document."* Inventing a moderation-edit field set would be manufacturing a capability |
| `POST /api/v1/admin/hoardings/bulk-approve` | `mvp-prd.md` §14 asks whether bulk approval is needed **and does not answer**. Not a decision to make here (§46) |
| Any Admin account-management endpoint | Full-scope `BR-ADMIN-001`/`002` — **FUTURE**. MVP has exactly one Admin role, provisioned out of band |

### 24.3 Admin authorization

Every `/api/v1/admin/*` endpoint enforces, in order:

1. Valid bearer token → else `401 AUTH_REQUIRED`.
2. `profiles.role = 'ADMIN'`, **read server-side** → else `403 ADMIN_ONLY`.
3. The database function's own `IF NOT is_admin() THEN RAISE … '42501'` guard (`database-design.md` §41.7–§41.8).

**Layer 3 is not redundant.** `is_admin()` is `SECURITY DEFINER` and reads `profiles` directly, so it holds even if the route layer regressed or a function were ever called from somewhere else. `database-design.md` §41.11 notes that `EXECUTE` is granted broadly and *"Admin-only enforcement lives in the function body"* — meaning the function's own check is the real control, not the grant.

**`403 ADMIN_ONLY` is returned to authenticated non-Admins, not `404`.** The existence of an admin API is not a secret; what it operates on is protected by the per-endpoint checks.

### 24.4 `GET /api/v1/admin/dashboard`

**REQUIRED** — `mvp-prd.md` §9. Maps to `admin_dashboard_summary()`.

`mvp-prd.md` §7.5 defines the contents exactly: **total listings, pending approvals, total requests, confirmation rate.** No other metric is an MVP dashboard requirement.

```json
{
  "success": true,
  "data": {
    "listings": {
      "total": 63,
      "pending_approval": 4,
      "approved": 55,
      "live_in_search": 52
    },
    "requests": {
      "total": 210,
      "confirmed": 88,
      "confirmation_rate_pct": 41.9
    },
    "publishers": {
      "total": 19,
      "verified": 14
    },
    "generated_at": "2026-08-30T10:00:00Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90E"
}
```

**`listings.total` counts every listing regardless of status** — including drafts and rejections. `admin-platform.md` §7 flags this as genuinely ambiguous (*"`mvp-prd.md` does not state whether this counts only Approved listings or every listing ever submitted"*) and reasons that the *"platform health"* reading is the more useful one; `database-design.md` §35 adopts it. This API follows, **and returns `approved` and `live_in_search` as separate fields so both readings are available without a second query.** That is the honest way to serve an ambiguous requirement: give the number the source asked for, plus the numbers that disambiguate it.

**`confirmation_rate_pct` counts `CONFIRMED`, `LIVE`, and `COMPLETED` as confirmed**, since all three are states a request reaches *through* confirmation. Counting only rows currently sitting in `CONFIRMED` would make the rate fall as campaigns progress, which would be a misleading business metric.

**`publishers.total` and `.verified` are RECOMMENDED, beyond the four required metrics.** They come free from the same function, and `mvp-brd.md` §14 names *"number of Publishers onboarded and verified"* as an MVP KPI.

**The BRD/PRD KPI gap is surfaced, not silently filled.** `mvp-brd.md` §14 also names *median Publisher response time* and *repeat usage*, which are **not** in `mvp-prd.md` §7.5's dashboard requirement. `admin-platform.md` §7 flags the mismatch and suggests they may belong to the still-unwritten Analytics & Event Tracking Plan (`README.md` Tier 1 #11). **This API does not add them to the dashboard.** They are computable from `request_status_history` today (`database-design.md` §43.6 shows the exact queries), and where they should surface is an **OPEN QUESTION (§46)**.

`Cache-Control: private, max-age=0, must-revalidate` — a moderation dashboard must never show stale counts. `generated_at` is returned so the operator knows how fresh the numbers are.

### 24.5 `GET /api/v1/admin/hoardings` — the approval queue

**REQUIRED (derived).** Maps to `admin_listing_queue()` when unfiltered.

| | |
|---|---|
| Query | `approval_status` (repeatable, default `PENDING_REVIEW`), `publisher_id`, `type`, `site_intelligence_complete`, `page`, `pageSize` |
| Order | `created_at ASC` — oldest-waiting first. A queue, not a feed |

Returns the **Admin representation** (§11.3) — every state, `approved_by`/`delisted_by` included — plus per-row review context:

```json
{
  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "title": "Outer Ring Road Unipole — Marathahalli",
  "approval_status": "PENDING_REVIEW",
  "publisher": {
    "id": "1111...",
    "business_name": "Kumar Outdoor Media",
    "verification_status": "VERIFIED",
    "suspended": false
  },
  "type": { "code": "UNIPOLE_BILLBOARD", "display_name": "Unipole / Billboard" },
  "site_intelligence_complete": false,
  "review_flags": [
    { "code": "SITE_INTELLIGENCE_INCOMPLETE", "severity": "INFO", "message": "Site Intelligence data is incomplete. This does not block approval." }
  ],
  "media_summary": { "total": 3, "watermarked": 3, "processing": 0, "failed": 0 },
  "submitted_at": "2026-08-29T13:20:00Z",
  "created_at": "2026-08-28T10:00:00Z"
}
```

**`review_flags` implements `INVENTORY-002` exactly as written and no further.** Site Intelligence is *"optional at MVP submission but flagged 'incomplete' in the Admin queue if missing."* `admin-platform.md` §9 is explicit that this is *"a visibility flag, not a blocking gate — `INVENTORY-002` does not say an Admin must reject a listing for missing Site Intelligence data, only that the queue must surface the gap."* Hence `severity: "INFO"` and the message that says so in the payload itself.

**`review_flags` is deliberately short, because there is no rubric.** `admin-platform.md` §10 and `README.md` Tier 1 #12 both confirm that **Content Moderation Guidelines do not exist** — there is no defined criterion for what should cause a rejection beyond the structural gates that already passed upstream. This API therefore surfaces only what a rule names: the `INVENTORY-002` flag, and a `PUBLISHER_UNVERIFIED` flag in the (unexpected) case that a listing reached the queue from a Publisher whose verification was revoked afterwards. **No quality-scoring, no heuristics, no "suspicious listing" flags** — inventing a moderation rubric here would be exactly the manufactured capability §24.2 avoids.

**`submitted_at` is derived, not stored.** No column records submission time; `database-design.md` §28.4 has `created_at`, `approved_at`, and `updated_at` but nothing for the `DRAFT → PENDING_REVIEW` transition. The API derives it as `updated_at` **when** `approval_status = 'PENDING_REVIEW'`, which is correct only if nothing else has updated the row since submission — and `OWNER-003`'s freeze plus the absence of a client `UPDATE` path for a `PENDING_REVIEW` listing make that near-certain but not guaranteed. **RECOMMENDED (§46.1):** add `submitted_at timestamptz` to `hoardings`, set by `submit_hoarding_for_review()`. A queue ordered by "how long has this been waiting" deserves a real column, and one is cheap.

### 24.6 Admin listing state visibility

Admin sees every listing in every state. This is a structural necessity, not a privilege grant: an approval queue cannot show `PENDING_REVIEW` listings if Admin can only read `APPROVED` ones. `admin-platform.md` §13 records it as an Assumption *"required for the approval queue to function"*; `database-design.md` §37.4 implements it as the `is_admin()` branch of `hoardings_select_visible_or_own_or_admin`.

**Admin's read breadth over inventory is not a precedent for requests.** The two were decided separately, for different reasons, and §6.6's asymmetry is intentional.

### 24.7 `GET /api/v1/admin/actions`

**RECOMMENDED — and explicitly NOT the full-scope audit log.**

`admin_actions` exists in the settled schema with an Admin-only read policy. `database-design.md` §26 describes it as *"a deliberately lightweight audit trail — explicitly not the full-scope BRD's `BR-ADMIN-003` compliance-grade audit log."* `admin-platform.md` §20 makes the case for having something: `mvp-brd.md` §17 names *"no-recourse disputes"* as a live risk whose stated mitigation is *"strong Admin moderation now"*, and moderation actions that record **what** changed but not **who** changed it are weak evidence in exactly those disputes.

| | |
|---|---|
| Query | `action_type` (repeatable), `target_hoarding_id`, `target_publisher_id`, `admin_id`, `from`, `to`, `page`, `pageSize` |
| Order | `created_at DESC` |

```json
{
  "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  "action_type": "LISTING_REJECTED",
  "admin": { "id": "4444...", "label": "SEEABLE Ops" },
  "target_hoarding_id": "aaaa...",
  "target_publisher_id": "1111...",
  "reason": "Photographs do not show the advertised site.",
  "created_at": "2026-08-29T15:04:00Z"
}
```

`admin.label` is `admin_actions.admin_label` — a denormalized snapshot of the acting Admin's name at action time, so the row stays readable after the account is gone (`admin_id` is `ON DELETE SET NULL`, never `CASCADE`).

**Eight action types, matching the database `CHECK` exactly:** `LISTING_APPROVED`, `LISTING_REJECTED`, `PUBLISHER_VERIFIED`, `PUBLISHER_VERIFICATION_REJECTED`, `PUBLISHER_SUSPENDED`, `PUBLISHER_UNSUSPENDED`, `HOARDING_DELISTED`, `HOARDING_RELISTED`. **No request action appears** — Admin's `COMPLETE` is not audited into `admin_actions`, because `mark_request_completed()` writes no audit row (it is jointly a Publisher action, and the transition is already captured in `request_status_history`). **RECOMMENDED for consideration (§46):** whether an Admin-performed completion should also write an `admin_actions` row, given it is an Admin acting on a commercial record.

---

## 25. Admin Listing Approval

### 25.1 `POST /api/v1/admin/hoardings/{id}/approve`

**REQUIRED** — `mvp-prd.md` §9, verbatim. Maps to `approve_listing()`.

| | |
|---|---|
| Auth | Bearer |
| Authorization | `role = ADMIN` (three layers, §24.3) |
| Body | None |
| Idempotency | `Idempotency-Key` **RECOMMENDED**; a second approve on an `APPROVED` listing returns `409 HOARDING_INVALID_STATE` |
| Rate limit | **RECOMMENDED** 300 / hour / Admin — high, because this is bulk operational work |
| Transaction | One `SECURITY DEFINER` call |

**Validation, in the order `approve_listing()` evaluates it:**

| # | Check | Failure |
|---|---|---|
| 1 | Caller is Admin | `403 ADMIN_ONLY` |
| 2 | Listing exists | `404 HOARDING_NOT_FOUND` |
| 3 | `approval_status = 'PENDING_REVIEW'` — under `SELECT … FOR UPDATE` | `409 HOARDING_INVALID_STATE` |

**Only three checks, and that is correct.** `admin-platform.md` §9 is precise about why: the upstream gates — Publisher verified (`OWNER-004`), type-specific fields complete (`INVENTORY-001`), media watermarked (`CONTENT-001`) — were **all enforced at submission** (§12.5). A listing cannot reach `PENDING_REVIEW` without passing them. *"Admin's approval decision is not a check of structural completeness (that has already passed) — it is a judgment call on accuracy, legitimacy, and quality."*

**RECOMMENDED defensive re-check, and the reason it is only a recommendation.** Between submission and approval, a media asset could be deleted or a Publisher suspended, so approving a listing that no longer satisfies `CONTENT-001` is theoretically reachable. §14.5 already blocks deleting the last asset of a `PENDING_REVIEW` listing, which closes the main path. A full re-check inside `approve_listing()` would close the rest. It is **RECOMMENDED**, not required, because `database-design.md` does not implement it and adding it changes an approved function's behavior — flagged in §46.1.

**Transaction boundary** (`system-architecture.md` §28):

```text
BEGIN
  Assert Admin
  SELECT … FOR UPDATE, assert approval_status = 'PENDING_REVIEW'
  UPDATE hoardings SET approval_status='APPROVED', approved_at=now(),
                       approved_by=auth.uid(), rejection_reason=NULL
  INSERT admin_actions  (LISTING_APPROVED)
  INSERT notifications  (LISTING_APPROVED → Publisher)
COMMIT
```

**Viewer visibility follows automatically.** There is no reindex step and no separate visibility write — `INVENTORY-003` is a query-time predicate, so the listing appears in search the instant the transaction commits, with **no window in which an unapproved listing is visible** (`system-architecture.md` §13, §28). That window is precisely what an `ADMIN-001` violation would look like.

**Response — `200 OK`** with the Admin representation, `approval_status: "APPROVED"`, `approved_at` and `approved_by` populated.

**Side effects:** one `hoardings` update, one `admin_actions` row, one `notifications` row (`LISTING_APPROVED` → Publisher). **Notification delivery** is asynchronous (§27, §28.4).

**A note on `NOTIF-001`'s scope gap, which this endpoint sits inside.** `admin-platform.md` §17 and `system-architecture.md` §22 both flag that `NOTIF-001`'s literal text covers only *"state change in the Request Engine"*, while `mvp-prd.md` §7.6's functional requirement explicitly lists *"listing approved/rejected"* — which are Inventory/Admin events, not Request Engine transitions. This API emits the notification, following the functional requirement's evident intent over the rule ID's wording, exactly as `database-design.md` §25 does. **The gap is a documentation defect in `mvp-prd.md` and is carried to §46 unresolved**, not patched by minting a new rule ID here.

### 25.2 `POST /api/v1/admin/hoardings/{id}/reject`

**REQUIRED** — `mvp-prd.md` §9. Maps to `reject_listing()`.

**Request**

```json
{ "reason": "The uploaded photographs do not show the advertised site." }
```

| Field | Rule |
|---|---|
| `reason` | **REQUIRED.** Non-empty after trimming, 1–1000 code points |

**`ADMIN-003` — the reason is mandatory, and it is enforced twice.**

> **`ADMIN-003`:** When an Admin rejects a hoarding listing, the system must require and store a rejection reason before the rejection can be completed.

`admin-platform.md` §16 formalizes this from `mvp-prd.md` §7.5's *"Approve / Reject with a reason"*, and is candid that allocating the requirement to Reject only (not Approve) is that document's own reading — *"a rejection reason is the case where the Publisher needs actionable feedback to fix and resubmit, whereas an approval needs no corrective feedback."* This API adopts it: `reason` is required on reject, absent on approve.

Two independent enforcement points, deliberately (`database-design.md` §30):

1. `reject_listing()` raises before any write if the reason is null or blank → `422 VALIDATION_ERROR`.
2. `hoardings_rejection_reason_required_check` — `CHECK (approval_status <> 'REJECTED' OR rejection_reason IS NOT NULL)` — makes it impossible for **any** write path, including a future migration or a direct `UPDATE`, to persist a rejected listing with no reason.

`ADMIN-003` is treated as important enough to enforce twice because the reason is the Publisher's only route back: without it, a rejected Publisher has no idea what to fix, and the resubmission path (§12.5) is useless.

**Validation:** Admin (1) → listing exists (2) → `PENDING_REVIEW` (3) → reason non-blank (4).

**Transaction:**

```text
BEGIN
  Assert Admin; assert reason non-blank
  SELECT … FOR UPDATE, assert approval_status = 'PENDING_REVIEW'
  UPDATE hoardings SET approval_status='REJECTED', rejection_reason=$reason
  INSERT admin_actions  (LISTING_REJECTED, reason)
  INSERT notifications  (LISTING_REJECTED → Publisher, reason in the message)
COMMIT
```

**The rejected listing does not appear in Viewer search** — `INVENTORY-003` fails on `approval_status`. The Publisher retains full access to it and may edit and resubmit (§12.5), which is `database-design.md`'s **Assumption**; `admin-platform.md` §22 #5 leaves *"same record reopened, or a new one created"* genuinely open (§46).

### 25.3 Two Admins on one queue item

`admin-platform.md` §22 #8 flags this as undefined: *"Two Admins act on the same queue item at the same time — no concurrency/locking behavior defined."*

**Resolved structurally, with no new mechanism.** Both `approve_listing()` and `reject_listing()` take `SELECT … FOR UPDATE` before asserting `approval_status = 'PENDING_REVIEW'`. The first transaction to acquire the lock proceeds; the second waits, then sees the changed status and fails its own precondition:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_INVALID_STATE",
    "message": "This listing is no longer awaiting review.",
    "details": { "current_status": "APPROVED", "approved_at": "2026-08-30T10:02:11Z" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90F"
}
```

Never a double-approval, never a silent overwrite, never a `500`. `system-architecture.md` §16 anticipated exactly this: *"architecturally it needs no special mechanism beyond the precondition check."*

### 25.4 `POST /api/v1/admin/hoardings/{id}/delist` and `/relist`

**REQUIRED (derived)** and **RECOMMENDED** respectively. Map to `delist_hoarding()` / `relist_hoarding()`.

**Request (delist)**

```json
{ "reason": "Site reported as no longer installed at the listed location." }
```

`reason` is **optional** — `ADMIN-003` covers listing *rejection*, not delisting, and no source document requires a delist reason. **RECOMMENDED:** supply one anyway; it is the only record of why a live listing vanished, and `delist_reason` is what §24.7's audit row carries.

**`ADMIN-004` — delisting is independent of Publisher suspension, in both directions.**

> Suspending a Publisher does not, by itself, delist any of that Publisher's already-approved listings. Delisting an individual hoarding is a separate, independent Admin action.

`admin-platform.md` §16 formalizes this from `mvp-prd.md` §7.5's phrasing — *"suspend a Publisher **or** delist a hoarding"*, two items joined by "or" — and is explicit that the alternative reading (suspension cascades to delisting) is *"equally plausible from a trust-and-safety standpoint and is not ruled out by any source text."*

**Both readings are carried to §46. This API implements the independent reading**, because it is what the settled schema does: `suspend_publisher()` never writes to `hoardings` (`database-design.md` §41.8), and test scenario #7 asserts that a suspended Publisher's approved listings *remain in `visible_hoardings`*.

**The literal consequence, stated plainly because it may not be what the business wants:** suspending a Publisher for a trust-and-safety reason leaves every one of their approved listings live in Viewer search until each is individually delisted. `admin-platform.md` §24's own acceptance criterion says so. If that is not the intended outcome, the fix is a product decision — and it belongs in `ADMIN-004`, not in an undocumented cascade added here.

**Effects of delisting:** `is_delisted = true`, `delisted_at`/`delisted_by`/`delist_reason` set; the listing leaves `visible_hoardings` immediately; `approval_status` is **unchanged**, so relisting restores visibility without re-approval. Existing `CONFIRMED`/`LIVE` requests are unaffected. Existing `REQUESTED` requests are **not** auto-rejected — `admin-platform.md` §22 #10 flags this case as undefined and nothing in the schema resolves it — but they become unconfirmable, because `confirm_request()` step 5 re-validates visibility (§19.1). Same shape as the pause case (§13.4), same **OPEN QUESTION**.

| Error | Cause |
|---|---|
| `409 HOARDING_ALREADY_DELISTED` | Delist on an already-delisted listing |
| `409 HOARDING_NOT_DELISTED` | Relist on a listing that is not delisted |
| `404 HOARDING_NOT_FOUND` | No such listing |

**Relist is RECOMMENDED, not required, and the reason matters.** `admin-platform.md` §14.2 records that *"no 're-list' action is described"* anywhere, and `inventory.md` §27 carries reversibility as an open question. `relist_hoarding()` exists in the schema, and leaving an Admin no way to undo a mistaken delist is operationally untenable — but it is a Recommendation awaiting sign-off, not a sourced requirement (§46).

---

## 26. Publisher Verification

### 26.1 Verification is not listing approval — two separate trust decisions

`admin-platform.md` §8 and the brief both insist on this, and conflating them is the most likely modelling error in the Admin domain:

| | Publisher verification | Listing approval |
|---|---|---|
| Subject | An **account** (`publisher_profiles`) | A **listing** (`hoardings`) |
| Rule | `AUTH-002`, `OWNER-004`, `BR-AUTH-002` | `ADMIN-001`, `ADMIN-003` |
| Effect | Gates whether the Publisher may **submit** any listing | Gates whether **this** listing reaches Viewer search |
| Frequency | Once per Publisher | Once per listing |
| Reversal | Suspension (an independent axis) | Delisting (an independent axis) |
| Reason required? | **Not specified** — optional here | **Required** — `ADMIN-003` |

A verified Publisher's listings still each need approval. An approved listing does not imply a verified Publisher — except that `OWNER-004` makes the ordering impossible to violate: an unverified Publisher cannot submit, so nothing of theirs can be pending.

**What the verification queue actually reviews is an OPEN QUESTION.** `admin-platform.md` §8 identifies a real ambiguity: `BR-AUTH-002`'s *"OTP **at minimum**"* combined with §7.5's separate *"Publisher verification **queue**"* suggests two things may be happening — an automatic, instant OTP check with nothing for an Admin to look at, and a separate manual review with **criteria that no source document states**. No KYC, GST, bank-account, or business-document requirement is specified anywhere, and **none is invented here**. This API provides the queue and the decision endpoints; what an Admin looks at before deciding is a product and operations question (§46).

### 26.2 `GET /api/v1/admin/publishers` — the verification queue

**REQUIRED (derived)** — `mvp-prd.md` §7.5.

| | |
|---|---|
| Query | `verification_status` (repeatable, default `UNVERIFIED`), `suspended`, `page`, `pageSize` |
| Order | `created_at ASC` — longest-waiting first |

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "full_name": "Anita Rao",
  "phone": "+919900000002",
  "email": "anita@example.com",
  "city": "Bengaluru",
  "business_name": "Rao Hoardings",
  "verification_status": "UNVERIFIED",
  "verified_at": null,
  "verification_rejection_reason": null,
  "suspended": false,
  "suspended_at": null,
  "suspended_by": null,
  "suspension_reason": null,
  "listing_counts": { "draft": 2, "pending_review": 0, "approved": 0, "rejected": 0 },
  "created_at": "2026-08-25T08:00:00Z"
}
```

**Admin sees the Publisher's `phone` and `email` here, and only here.** A verification decision about an account is not possible without seeing the account. This is the only place in the API where contact details are returned to anyone other than their owner, and it is Admin-only. `system-architecture.md` §31 permits Admin access to Publisher personal data *"as far as a documented capability requires"* — the verification queue is that documented capability.

`listing_counts` is **RECOMMENDED** context: an unverified Publisher sitting on two drafts is a different queue item from one with none.

### 26.3 `GET /api/v1/admin/publishers/{id}`

The same representation for a single Publisher, plus `suspended_by` expanded to `{id, label}`. `404 PUBLISHER_NOT_FOUND` if no `publisher_profiles` row exists — note that a `VIEWER` profile is not a Publisher and returns `404` here, not a partial record.

### 26.4 Verification decision endpoints

**`POST /api/v1/admin/publishers/{id}/verify`** — maps to `verify_publisher()`.

Body: none. Sets `verification_status = 'VERIFIED'`, `verified_at = now()`, clears `verification_rejection_reason`; writes a `PUBLISHER_VERIFIED` audit row.

**`POST /api/v1/admin/publishers/{id}/reject-verification`** — maps to `reject_publisher_verification()`.

```json
{ "reason": "Business details could not be confirmed." }
```

`reason` is **optional** — `ADMIN-003` governs listing rejection only, and no source document requires a reason for a verification rejection. **RECOMMENDED:** supply one; §22.2 returns it to the Publisher, and a rejection with no reason leaves them nothing to act on.

**What happens after a verification rejection is undefined, and this API does not invent it.** `admin-platform.md` §8, §14.1, and §22 #4 all record the gap: *"can the Publisher retry, is the account permanently blocked, is there a cooldown — is not defined anywhere."* `database-design.md` §17 leaves the row at `REJECTED` indefinitely. **Specified behavior:** the row stays `REJECTED`; a subsequent `verify` call succeeds and moves it to `VERIFIED` (there is no state guard preventing it); nothing auto-expires or auto-retries. Whether a rejected Publisher should be able to reapply, and through what mechanism, is an **OPEN QUESTION (§46)**.

**No notification is emitted for either outcome.** `admin-platform.md` §17 confirms that Publisher verification outcomes are *"not listed anywhere in §7.6's event list"*, and `database-design.md` §25 declines to add a notification type for them, calling the omission *"evidence of scope discipline, not a gap to fix."* This API follows. A verified Publisher discovers the change on their next `GET /api/v1/publishers/me` or `GET /api/v1/auth/me`. **RECOMMENDED for the business to reconsider (§46)** — a Publisher waiting on verification with no signal is a poor onboarding experience — but adding it means adding a `notifications.type` value, which is a scope decision, not an implementation detail.

### 26.5 Suspension

**`POST /api/v1/admin/publishers/{id}/suspend`** — maps to `suspend_publisher()`.

```json
{ "reason": "Multiple listings reported as misrepresenting their location." }
```

**`ADMIN-002`, implemented exactly as written and no further:**

> Suspending a Publisher does not cancel already-Confirmed requests; those complete as agreed, but the Publisher cannot create new listings while suspended.

| Suspension does | Suspension does NOT do |
|---|---|
| Set `suspended = true`, `suspended_at`, `suspended_by`, `suspension_reason` | Cancel or alter **any** request, in any state |
| Block `POST /api/v1/hoardings/{id}/submit` — gate 5 (§12.5) | Delist any listing (`ADMIN-004`, §25.4) |
| Write a `PUBLISHER_SUSPENDED` audit row | Block login (§5.7 — **OPEN QUESTION**, narrow reading specified) |
| — | Hide the Publisher's approved listings from search |

**This is the Critical Product Boundary of the Admin domain and it is not weakened anywhere in this API.** `admin-platform.md` §11 restates it: *"Publisher suspension must never cancel an already-Confirmed request."* `database-design.md` §44 test scenario #7 asserts it. A Viewer with a confirmed booking on a suspended Publisher's hoarding still has that booking, and it still completes.

**Two behaviors around suspension are genuinely undefined, and the API takes the narrow reading of each:**

1. **Can a suspended Publisher still accept or reject a request that was already `REQUESTED`?** `ADMIN-002` speaks only to already-*Confirmed* requests. `request-engine.md` §33 and `admin-platform.md` §22 #6 both flag it. `confirm_request()` and `reject_request()` **do not check suspension** (`database-design.md` §41.6). **Specified: yes, a suspended Publisher can still respond to pending requests.** That follows the code and the literal rule, and it has a defensible logic — a Viewer with a pending request deserves an answer rather than a silent expiry. Carried to §46.
2. **Does suspension block login?** `ADMIN-002` says only "cannot create new listings." **Specified: no** (§5.7).

**`POST /api/v1/admin/publishers/{id}/unsuspend`** — **RECOMMENDED**, maps to `unsuspend_publisher()`. `database-design.md` §17 is candid that this is its own addition: *"no un-suspend action is described anywhere... included because leaving genuinely no reversal path for an Admin who suspends the wrong Publisher seems operationally untenable."* This API exposes it under the same label. Clears all four suspension columns and writes a `PUBLISHER_UNSUSPENDED` audit row. **The Publisher's `verification_status` is untouched throughout** — which is the entire reason `database-design.md` §17 keeps suspension as an independent boolean rather than a fourth `verification_status` value: unsuspending never has to reconstruct what the Publisher's verification state was before.

| Error | Cause |
|---|---|
| `404 PUBLISHER_NOT_FOUND` | No `publisher_profiles` row |
| `409 PUBLISHER_VERIFICATION_STATE_CONFLICT` | Suspend on an already-suspended Publisher; unsuspend on one who is not suspended |
| `403 ADMIN_ONLY` | Non-Admin caller |

---

## 27. Notifications API

### 27.1 Event creation and event delivery are different things

`system-architecture.md` §22 and `request-engine.md` §22 both draw this line, and the API respects it:

| | Creation | Delivery |
|---|---|---|
| Who | The **emitting module** — Request Engine or Admin/Inventory | The **Notifications module** |
| When | **Synchronously, inside the transaction** that caused the state change | **Asynchronously**, by `/api/jobs/process-notifications` |
| Guarantee | A confirmed request can never exist without its notification recorded | Delivered *"within a defined delay"* (`NOTIF-001`, target under 5 minutes) |
| Failure | Rolls back with the state change | Retried; **never fails the originating business action** (P8) |

**In-app is the system of record.** `seeable_free_first_techstack.md` §23 makes in-app notifications the primary ₹0 channel and §24 makes email explicitly optional: *"Do not make email the system of record."* `system-architecture.md` §38 #4 agrees: on provider failure, *"in-app status remains authoritative."* Consequently, the endpoints below read the `notifications` table, and email/push dispatch is a job concern that this API surface does not expose at all.

### 27.2 Endpoints

| Method | Path | Status |
|---|---|---|
| `GET` | `/api/v1/notifications` | **REQUIRED (derived)** — `viewer-platform.md` §23 flags the missing endpoint; Notifications is an in-scope MVP module (`mvp-prd.md` §3.1) with no API in §9 |
| `PATCH` | `/api/v1/notifications/{id}` | **REQUIRED (derived)** — the `is_read` column is one of exactly two a client may write (`database-design.md` §41.11) |

**`PATCH /api/v1/notifications/{id}` with `{"is_read": true}` is the canonical spelling**, rather than `PATCH /notifications/{id}/read`. Both appear in this document's own brief (§23 and §27 of it). The body-driven form is chosen because it maps one-to-one onto the two-column grant, and because it makes un-reading (`{"is_read": false}`) available without a second route. A `/read` sub-resource is noted as the alternative.

**No `POST /api/v1/notifications`.** Notifications are written only by triggers and `SECURITY DEFINER` functions; `notifications` has no client `INSERT` policy at all.

**No mark-all-read endpoint at MVP** — **FUTURE**. It is a convenience with no source requirement, and adding it means deciding whether "all" is scoped by filter, which is a product question.

### 27.3 Events

Seven notification types, matching the `CHECK` constraint exactly (`database-design.md` §28.12):

| Type | Recipient(s) | Emitted when | Source |
|---|---|---|---|
| `REQUEST_CREATED` | **Publisher and Viewer** — two rows | A request is created | `request-engine.md` §22; `mvp-prd.md` §7.6 *"new request received"* |
| `REQUEST_ACCEPTED` | Viewer | `ACCEPT` commits | `NOTIF-001` |
| `REQUEST_REJECTED` | Viewer | `REJECT` commits | `NOTIF-001` |
| `REQUEST_EXPIRING_SOON` | **Both** — see the conflict below | The SLA deadline approaches | `mvp-prd.md` §7.6 |
| `REQUEST_EXPIRED` | Viewer | The expiry job transitions the row | `NOTIF-001` |
| `LISTING_APPROVED` | Publisher | `approve_listing()` commits | `mvp-prd.md` §7.6 |
| `LISTING_REJECTED` | Publisher | `reject_listing()` commits | `mvp-prd.md` §7.6 |

**CONFLICT — `REQUEST_EXPIRING_SOON`'s recipient.** `request-engine.md` §22 frames it as Publisher-relevant (*"implied — they are the one who can still act"*); `viewer-platform.md` §18 independently lists it as Viewer-relevant. **Not resolved.** `database-design.md` §25 notifies **both**, on the reasoning that over-notifying is the lower-risk default, and this API follows. Flagged in §46.

**Events that deliberately do NOT exist**, each because a source document places it out of scope:

| Not emitted | Why |
|---|---|
| Request becomes `LIVE` | Not in `mvp-prd.md` §7.6's event list; `request-engine.md` §22 and `database-design.md` §25 both confirm it is not required. **OPEN QUESTION (§46)** |
| Request `COMPLETED` | Same |
| Publisher verified / verification rejected | `admin-platform.md` §17: *"not listed anywhere in §7.6's event list at all"* |
| Publisher suspended / unsuspended | Same |
| Hoarding delisted / relisted | Same |
| Listing submitted (to Admin) | No Admin-facing notification event exists; the queue is polled (§12.5) |

Adding any of these means adding a `notifications.type` value, which is a **scope decision**, not an implementation gap to fill quietly.

### 27.4 `GET /api/v1/notifications`

| | |
|---|---|
| Auth | Bearer |
| Authorization | `recipient_id = auth.uid()` — every role, own rows only |
| Query | `unread_only` (boolean, default `false`), `type` (repeatable), `page`, `pageSize` |
| Order | `created_at DESC` |
| Rate limit | **RECOMMENDED** 120 / min / user — clients poll this |

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "type": "REQUEST_ACCEPTED",
        "title": "Your request was accepted",
        "message": "The Publisher has confirmed your requested dates.",
        "related_hoarding_id": "aaaa...",
        "related_request_id": "bbbb...",
        "is_read": false,
        "read_at": null,
        "created_at": "2026-08-31T04:12:55Z"
      }
    ]
  },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 12, "total_pages": 1, "has_next": false, "has_previous": false },
    "unread_count": 3
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E910"
}
```

`meta.unread_count` is computed over **all** the caller's notifications, not the current page — a badge that changes when you turn the page is a bug. It is backed by the `idx_notifications_recipient_unread` partial index, so the count is cheap regardless of history size.

`related_hoarding_id` and `related_request_id` are the client's deep-link targets. Both are `ON DELETE SET NULL`, so a notification for a since-deleted listing arrives with a null link rather than a dangling one — the client renders it as text without a link.

**Delivery status is not exposed.** Whether the optional email was sent is `/api/jobs/process-notifications`'s business (§28.4) and has no user-facing meaning: in-app is authoritative (§27.1). Surfacing a "delivered" flag would imply a guarantee the ₹0 stack does not make.

### 27.5 `PATCH /api/v1/notifications/{id}`

```json
{ "is_read": true }
```

| | |
|---|---|
| Authorization | `recipient_id = auth.uid()` → else `404` (a notification you do not own does not exist for you) |
| Accepts | `is_read` only. Any other field → `422 VALIDATION_ERROR` |
| Server-set | `read_at = now()` when `is_read` transitions false → true; cleared on the reverse |
| Idempotency | Naturally idempotent |
| Response | `200` with the updated notification |

The accepted field set is exactly `GRANT UPDATE (is_read, read_at) ON notifications TO authenticated`, with `read_at` server-derived rather than client-supplied — a client that could set `read_at` to an arbitrary time gains nothing and can only corrupt the ordering.

### 27.6 Notification flow

```mermaid
graph LR
    subgraph TX["One database transaction"]
        SC["State change<br/>confirm_request() · approve_listing() · INSERT requests"]
        NR["INSERT notifications row(s)"]
        SC --> NR
    end
    TX -->|COMMIT| DB[("notifications table")]
    DB -->|"GET /api/v1/notifications"| C["Client — in-app feed<br/><b>system of record</b>"]
    DB -->|"polled on schedule"| JOB["POST /api/jobs/process-notifications"]
    JOB -.->|"optional, best-effort"| EMAIL["Free email provider<br/>(Resend free tier)"]
    JOB -.->|"marks dispatched"| DB
    EMAIL -.->|"failure → retry;<br/>never fails the business action"| JOB
```

---

## 28. Background Job APIs

### 28.1 Architecture and the trust boundary

`seeable_free_first_techstack.md` §5 and §25 fix the mechanism: **GitHub Actions scheduled workflows make an authenticated HTTPS call to a protected `/api/jobs/*` route on the same Next.js application.** There is no separate Cloudflare Workers deployment, no message broker, and no Workers Cron Trigger — the revision note in that document explains why (a Workers project cannot open a raw Postgres connection without Hyperdrive, and Vercel's Hobby cron caps at once per day).

```mermaid
graph LR
    GHA["GitHub Actions<br/>scheduled workflow (cron)"] -->|"Authorization: Bearer JOBS_SHARED_SECRET"| R["/api/jobs/* route<br/>same Next.js app"]
    R --> AUTH{"constant-time<br/>secret compare"}
    AUTH -->|"mismatch"| U["401 JOB_UNAUTHORIZED<br/>no detail, logged"]
    AUTH -->|"match"| LOCK{"pg_try_advisory_lock"}
    LOCK -->|"held"| C["409 JOB_ALREADY_RUNNING"]
    LOCK -->|"acquired"| FN["SECURITY DEFINER function<br/>re-validates its own preconditions"]
    FN --> DB[("PostgreSQL")]
    FN --> RES["200 {job, processed, duration_ms}"]
```

**These routes are NOT public API.** They are not under `/api/v1`, they do not use the response envelope (§7.4), they are excluded from CORS entirely (§34), they are excluded from the OpenAPI document (§37), and no browser ever calls them.

### 28.2 Authentication and hardening

| Control | Specification | Status |
|---|---|---|
| Credential | `Authorization: Bearer ${JOBS_SHARED_SECRET}` | **REQUIRED** — `seeable_free_first_techstack.md` §25: *"never leave a job-trigger route unauthenticated"* |
| Secret storage | A GitHub Actions secret and a platform environment variable. **Never in source control** (`system-architecture.md` §35) | **REQUIRED** |
| Comparison | **Constant-time.** A naive `===` on a secret is timing-attackable | **REQUIRED** |
| Secret length | ≥ 32 bytes of cryptographic randomness | **RECOMMENDED** |
| Failure response | `401` with a bare `{"error":"unauthorized"}`, no envelope, no detail. Logged with source IP | **REQUIRED** |
| Method | `POST` only. `GET` → `405`. A `GET` job trigger is one crawler away from running on its own | **REQUIRED** |
| CORS | **No CORS headers at all.** Not a browser surface | **REQUIRED** |
| Rate limit | 60 / hour / route — far above any real schedule, low enough to bound a leaked-secret loop | **RECOMMENDED** |
| Replay protection | **None at MVP.** See below | **RECOMMENDED, deferred** |
| Concurrency | `pg_try_advisory_lock` per job; a second concurrent run returns `409` immediately rather than queueing | **RECOMMENDED** |

**Replay protection is deliberately deferred, with the reasoning stated.** A timestamp-plus-HMAC scheme would prevent a captured request from being replayed. It is **not specified at MVP** because every one of these jobs is **idempotent by design** (§28.3–§28.6) — replaying `expire-requests` a hundred times expires nothing extra, because its `WHERE status = 'REQUESTED' AND sla_deadline < now()` clause is self-limiting. Replay is therefore a denial-of-service concern, not a correctness one, and the rate limit and advisory lock bound it. **RECOMMENDED** if the secret is ever suspected of exposure, and worth revisiting before the API handles real inventory (§46).

### 28.3 `POST /api/jobs/expire-requests`

**REQUIRED** — `OWNER-002`, `REQUEST-002`, `seeable_free_first_techstack.md` §25. Maps to `expire_stale_requests()`.

| | |
|---|---|
| Schedule | **RECOMMENDED** every 15 minutes. `OWNER-002` sets no granularity; 15 minutes bounds the lag between an SLA deadline and its effect without meaningful cost |
| Precondition re-check | `WHERE status = 'REQUESTED' AND sla_deadline IS NOT NULL AND sla_deadline < now()` — **evaluated at execution time, against live state** |
| Batch size | Unbounded at MVP scale. **RECOMMENDED** a `LIMIT 500` guard if the backlog ever grows |
| Idempotency | Structural. A row already `EXPIRED` no longer matches the `WHERE` clause |
| Side effects | `status → EXPIRED`, `expired_at` set; one `REQUEST_EXPIRED` notification per row; one `request_status_history` row per transition, `changed_by = NULL` |

```json
{ "job": "expire-requests", "processed": 3, "duration_ms": 41, "ran_at": "2026-08-30T10:15:00Z" }
```

**The precondition re-check is the point, not a detail.** `system-architecture.md` §44 rule 12: *"Every background job re-asserts its preconditions rather than trusting the state it saw when enqueued."* Concretely: a request the Publisher confirmed thirty seconds ago is no longer `REQUESTED`, so the sweep skips it. §38 #11 names the failure this prevents — *"expiring an already-Confirmed request... would destroy a valid booking."* Because the check and the update are one statement, there is no window between them.

**This job's failure mode is silent and is the most dangerous in the system.** `system-architecture.md` §33 and §39 both single it out: if the job stops, nothing errors — requests simply never expire, dates stay held indefinitely, and `OWNER-002` is quietly violated with no signal anywhere. **REQUIRED:** a "last successful run" metric with a staleness alert (§35.4). It is the cheapest possible protection against the least visible failure in the product.

### 28.4 `POST /api/jobs/process-notifications`

**REQUIRED** — `NOTIF-001`, `seeable_free_first_techstack.md` §25.

Two responsibilities:

1. **Emit `REQUEST_EXPIRING_SOON`** — `notify_expiring_soon_requests()`. Selects `REQUESTED` rows whose `sla_deadline` falls within the warning window (currently 6 hours) and which have no `REQUEST_EXPIRING_SOON` notification already. **Idempotency is achieved by querying the notifications table itself** (`database-design.md` §41.6), so repeat runs never re-notify — an elegant approach that needs no extra state.
2. **Dispatch optional email** for undelivered notification rows, if an email provider is configured.

| | |
|---|---|
| Schedule | **RECOMMENDED** every 15 minutes |
| Batch | **RECOMMENDED** 100 emails per run — stays inside a free tier and inside the route's execution budget |
| Retry | Exponential backoff, max 3 attempts, then abandoned. **Never blocks or fails the originating business action** (P8) |
| Degradation | Provider unreachable → the job reports the failure and returns `200`; in-app remains authoritative (§27.1) |

**The email channel is optional infrastructure and the API says so.** `seeable_free_first_techstack.md` §24: *"Email is useful but should be optional... Do not make email the system of record."* §38: *"The marketplace must not stop functioning because an optional integration reaches a quota."* If the email quota is exhausted, notifications still appear in-app and nothing else changes.

**Which channel ships alongside push is still undecided.** `mvp-prd.md` §14 asks *"Which single notification channel (SMS or email) ships first alongside push?"* and does not answer; `seeable_free_first_techstack.md` §37 excludes SMS from the ₹0 stack outright, which effectively answers it as email — but that is a stack constraint, not a product decision. **OPEN QUESTION (§46).** No push provider is named in any source document either, and this job specifies email only.

### 28.5 `POST /api/jobs/transition-live`

**REQUIRED (conditional)** — maps to `promote_confirmed_to_live()`.

| | |
|---|---|
| Schedule | **RECOMMENDED** daily, shortly after local midnight — see the timezone caveat |
| Precondition | `WHERE status = 'CONFIRMED' AND start_date <= current_date` |
| Idempotency | Structural — a row already `LIVE` no longer matches |
| Missed run | Self-correcting: the next run picks up everything overdue |
| Notifications | **None** (§27.3) |

**This job's existence rests on an Assumption, and if the Assumption is wrong the job should not exist.** `request-engine.md` §18 infers that the `CONFIRMED → LIVE` transition is system-triggered *"because no manual 'Mark Live' action appears anywhere in `mvp-prd.md`, unlike Completion which is explicitly manual."* `system-architecture.md` §23 restates it: *"Conditional on an Assumption... If that assumption is wrong, this job should not exist."* Carried to §46.

**Timezone caveat (§4.4):** `current_date` resolves against the database session timezone, UTC by default on Supabase. A campaign starting 1 October flips to `LIVE` at 05:30 IST rather than local midnight. Running the job at 18:30 UTC (00:00 IST) does not fix this — the comparison itself is what needs the correct timezone.

### 28.6 `POST /api/jobs/keep-alive` and `POST /api/jobs/cleanup`

**`keep-alive` — REQUIRED for this deployment.** `seeable_free_first_techstack.md` §25: Supabase free-tier projects pause after 7 days of low activity, and restoring one *"requires a manual click in the dashboard, which is a bad thing to discover during a live demo."* A trivial read every 2–3 days prevents it.

```json
{ "job": "keep-alive", "ok": true, "db_latency_ms": 18, "ran_at": "2026-08-30T02:00:00Z" }
```

It performs exactly one lightweight `SELECT`, writes nothing, and touches no business state. Same shared-secret protection as every other job route.

**`cleanup` — RECOMMENDED, with no defined preconditions.** `seeable_free_first_techstack.md` §25 names it — *"remove temporary processing records and stale data where appropriate"* — without specifying what qualifies. **This API does not invent a retention policy.** No source document defines one, and `system-architecture.md` §46 lists data retention as an unwritten Security & Data Privacy concern. The route is reserved with a documented, narrow initial scope:

- Delete storage objects orphaned by a failed media upload or a listing delete (§13.5, §14.3), identified as objects with no `hoarding_media` row, older than 24 hours.
- **Nothing else.** No notification pruning, no analytics-event expiry, no request archival.

Anything beyond that requires a retention policy that does not exist (§46).

### 28.7 `POST /api/jobs/process-media` — CONDITIONAL

**Exists only under media Variant A (§14.2).** Under Variant B — browser-side Canvas watermarking, which is what `seeable_free_first_techstack.md` §18 specifies — **there is no server-side watermarking step and this route does not exist.**

`seeable_free_first_techstack.md` §25 lists four jobs and this is not among them. `system-architecture.md` §23 lists media watermarking as the first of its four. That is the same conflict as §14.2, appearing here as a route that exists or does not depending on the resolution.

Specified for completeness, so that adopting Variant A does not require redesigning the job surface:

| | |
|---|---|
| Schedule | Every 2 minutes (short, because it gates listing submission and drives a visible "processing" UI state) |
| Precondition | `WHERE processing_status IN ('UPLOADED','PROCESSING')` — re-checked at execution |
| Steps | Read the original from `hoarding-private` → resize, compress, watermark (Publisher ID + geo + timestamp, `mvp-prd.md` §7.7) → write the derivative to `hoarding-public` → set `processing_status = 'WATERMARKED'`, `watermarked_at`, `storage_path` |
| Idempotency | **REQUIRED and non-trivial.** `system-architecture.md` §38 #10: *"a partially written derivative must never be treated as complete."* The derivative must be fully written and verified **before** the status flips — the status write is the commit point, and it is last |
| Retry | Exponential backoff, max 3 attempts, then `processing_status = 'FAILED'` |
| Failure recovery | **UNDEFINED in every source document.** `inventory.md` §23 #2, `system-architecture.md` §20, `database-design.md` §48 all record the gap. A `FAILED` asset blocks submission (`CONTENT-001`) with no automatic path out; §12.5's interim answer is delete-and-reupload. **OPEN QUESTION (§46)** |

**The ordering rule is the whole safety argument.** If the status flipped to `WATERMARKED` before the derivative landed, a listing could pass the `CONTENT-001` gate, reach Admin approval, and go live with a broken image — or worse, with `storage_path` pointing somewhere unintended. Status last, always.

### 28.8 Job summary

| Route | Schedule (RECOMMENDED) | DB function | Idempotent | Notifications |
|---|---|---|---|---|
| `/api/jobs/expire-requests` | */15 min | `expire_stale_requests()` | Structural | `REQUEST_EXPIRED` |
| `/api/jobs/process-notifications` | */15 min | `notify_expiring_soon_requests()` + email dispatch | Structural | `REQUEST_EXPIRING_SOON` |
| `/api/jobs/transition-live` | Daily | `promote_confirmed_to_live()` | Structural | None |
| `/api/jobs/keep-alive` | Every 2 days | — | Trivially | None |
| `/api/jobs/cleanup` | Weekly | — | Yes | None |
| `/api/jobs/process-media` | */2 min — **Variant A only** | — | Requires care | None |

**GitHub Actions scheduled workflows are best-effort.** `seeable_free_first_techstack.md` §25 states it plainly: *"under high platform load, a run can be delayed by minutes past its scheduled time."* None of these jobs needs second-level precision, but **nothing time-critical may be built on this scheduler** — which is one more reason the availability model is computed rather than job-maintained (§15.1).

---

## 29. Health API

### 29.1 `GET /api/health`

**RECOMMENDED** — `system-architecture.md` §33: *"Health checks: application liveness, database connectivity, object storage reachability."*

| | |
|---|---|
| Auth | **None** — probes cannot authenticate |
| Envelope | **None** (§7.4) |
| Rate limit | **RECOMMENDED** 60 / min / IP — it is unauthenticated, so it needs its own bound |
| Cache | `Cache-Control: no-store` |

**Shallow (default) — pure liveness, no dependency calls:**

```json
{ "status": "ok", "service": "seeable-api", "time": "2026-08-30T10:30:00Z" }
```

**Deep — `GET /api/health?deep=1`:**

```json
{
  "status": "degraded",
  "service": "seeable-api",
  "time": "2026-08-30T10:30:00Z",
  "checks": {
    "database": { "status": "ok", "latency_ms": 14 },
    "storage":  { "status": "fail", "latency_ms": 5001 }
  }
}
```

| `status` | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | Everything reachable |
| `degraded` | 200 | A non-critical dependency is failing — storage down means images break, but search and requests still work (`system-architecture.md` §24) |
| `fail` | 503 | The database is unreachable. Nothing works |

**Storage down is `degraded`, not `fail`, on purpose.** `system-architecture.md` §24 and §38 #2 require graceful degradation: *"Viewer sees a media-unavailable state, not a broken layout; text listing data still renders."* A load balancer that pulled every instance out of rotation because a storage bucket was slow would convert a partial outage into a total one.

### 29.2 What health must never expose

**REQUIRED — the endpoint is unauthenticated, so every field is public:**

| Never returned | Why |
|---|---|
| Connection strings, hostnames, database names | Infrastructure reconnaissance |
| Environment variable names or values | Same |
| Version numbers, commit SHAs, dependency versions | Narrows an attacker's exploit search |
| Table names, row counts, user counts | Business intelligence and schema disclosure |
| Stack traces or provider error text | `system-architecture.md` §30 |
| Any secret, key, or token | — |

Only three things are returned: a status word, a fixed service name, and a timestamp — plus, in deep mode, per-dependency status and latency. Latency is included because it is the one signal that makes the check actionable; it reveals nothing beyond "the database is slow", which the response time already told you.

**`?deep=1` should be rate-limited more tightly than the shallow check (RECOMMENDED, 10 / min / IP)**, because it performs real dependency calls and is therefore an unauthenticated amplification vector.

---

## 30. Rate Limiting

### 30.1 Status of this section

**Every limit below is RECOMMENDED and configurable. None is a requirement.**

`system-architecture.md` §29 is explicit: *"No rate-limit requirement exists in any source document — noted as absent, not invented."* This section exists because shipping an unauthenticated registration endpoint, an OTP verifier, and a request-creation endpoint with no limits at all would be a defect, and because `mvp-brd.md` §12 and §17 name a business risk that a limit directly addresses: *"A Viewer submits requests they never intend to honor, tying up a Publisher's calendar (needs a rate-limit or reputation signal even without payment)."*

The values are chosen to be invisible to real users and meaningful against abuse. **They should be tuned against real traffic**, and all of them are *private configuration* (`system-architecture.md` §35), changeable without a deploy.

### 30.2 Recommended limits

| Endpoint group | Limit | Scope | Rationale |
|---|---|---|---|
| `POST /auth/register` | 5 / hour | IP | Account-creation abuse; §5.6's enumeration mitigation |
| `POST /auth/register` | 3 / hour | identity | Same identity retried |
| `POST /auth/login` | 10 / 15 min | IP | Brute force |
| `POST /auth/login` | 5 / 15 min | identity | Credential stuffing against one account |
| `POST /auth/login` — after 5 consecutive failures | Exponential backoff, cap 15 min | identity | **RECOMMENDED**, the single highest-value auth control |
| `POST /auth/verify-otp` | 5 attempts / OTP; 3 OTP issuances / hour / identity | identity | A 6-digit OTP is a 10⁶ space (§5.8) |
| `POST /auth/refresh` | 60 / hour | user | Bounds a stolen-token loop |
| `GET /hoardings` (search) | 60 / min | user | Map pan/zoom is bursty; this is generous |
| `GET /hoardings/{id}`, `/availability`, `/auth/me`, `/notifications` | 120 / min | user | Ordinary reads |
| **`POST /requests`** | **20 / hour, 5 / min** | **Viewer** | **Directly addresses `mvp-brd.md` §12's named risk.** Not a soft cap on *simultaneous pending* requests — see §30.4 |
| `PATCH /requests/{id}` | 60 / hour | Publisher | Inbox work is bursty but bounded |
| `POST /hoardings` | 30 / hour | Publisher | Listing creation |
| `PATCH /hoardings/{id}` | 120 / hour | Publisher | Form autosave is plausible |
| `POST /hoardings/{id}/submit` | 60 / hour | Publisher | |
| `POST /hoardings/{id}/media` | 30 / hour, 10 / min | Publisher | Bandwidth and storage quota protection (`seeable_free_first_techstack.md` §40) |
| `GET /media/{id}/original` | 20 / hour | user | Highest-sensitivity read in the API (§14.6) |
| `POST /admin/**` | 300 / hour | Admin | Deliberately high — moderation is bulk work and must not be throttled |
| `GET /admin/dashboard` | 60 / min | Admin | |
| `POST /api/jobs/*` | 60 / hour | route | Bounds a leaked-secret loop (§28.2) |
| `GET /api/health` | 60 / min | IP | Unauthenticated |
| `GET /api/health?deep=1` | 10 / min | IP | Performs dependency calls |

### 30.3 Behavior

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
RateLimit-Limit: 20
RateLimit-Remaining: 0
RateLimit-Reset: 47
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 47 seconds.",
    "details": { "retry_after_seconds": 47, "limit": 20, "window": "1h" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E911"
}
```

- **Scope:** authenticated endpoints are limited per user ID; unauthenticated ones per IP.
- **Algorithm:** **RECOMMENDED** a fixed window, for one specific reason — `seeable_free_first_techstack.md` §26 rules out Redis, and a fixed-window counter in PostgreSQL (or in the platform's own edge rate limiter) needs no extra infrastructure, while a sliding-window log would need per-request storage. `system-architecture.md` §44 rule 10 applies: no new infrastructure without a demonstrated requirement.
- **Headers on every rate-limited response**, not only on `429`, so a client can back off before it is throttled.
- **Admin is never rate-limited into uselessness**, and the job routes are limited only as a leaked-secret bound.

### 30.4 What rate limiting is NOT used for

**A soft cap on simultaneous *pending* requests per Viewer is a different control, and it is not implemented.** `mvp-brd.md` §12 and §17 raise it (*"Consider a soft cap on simultaneous Pending requests per Viewer"*) and frame it explicitly as *"something the business should decide,"* not an approved requirement. `request-engine.md` §33 and `database-design.md` §48 both carry it as open.

Rate limiting bounds requests **per unit time**; a pending cap bounds them **per unit state**. They address the same risk from different angles, and only the first is specified here. If the business wants the second, `database-design.md` §48 notes it is a small addition — a `COUNT`-based check in `validate_request_creation()` — and it would need its own error code (`REQUEST_PENDING_LIMIT_EXCEEDED`). **OPEN QUESTION (§46).**

---

## 31. Idempotency

### 31.1 The scenario this exists for

> A Publisher accepts a request. The database commits. The response is lost — the connection drops, the client times out, the user's phone loses signal. The client retries.
>
> **The retry must not create a second state transition or corrupt data.**

This is not hypothetical. `request-engine.md` §25 #12–#13 name it for both the Viewer and Publisher sides and record the exact retry semantics as an **OPEN QUESTION**; `system-architecture.md` §16 requires *some* mechanism without prescribing one; `viewer-platform.md` §21 and §25 require that the user be told unambiguously whether their action took effect.

### 31.2 Three layers, and most of the work is already done

**Layer 1 — natural idempotency from state preconditions.** Every state transition asserts its starting state. A retried `ACCEPT` on an already-`CONFIRMED` request fails precondition 4 and returns `409 REQUEST_STATE_CONFLICT`. **No corruption, no double transition** — the guarantee already holds. What it does not give is a *good* answer: the client cannot tell "my first attempt succeeded" from "someone else changed this."

**Layer 2 — database constraints absorb the common duplicates.**

| Duplicate | Absorbed by |
|---|---|
| Double-submitted request creation | `requests_one_pending_per_viewer_hoarding` partial unique index → `409 REQUEST_DUPLICATE_PENDING` |
| Concurrent confirmations of overlapping requests | `requests_no_overlapping_confirmed` exclusion constraint → `409 REQUEST_DATE_CONFLICT` |
| Double registration | Supabase Auth unique identity → `409 AUTH_IDENTITY_IN_USE` |

`system-architecture.md` §16 explicitly prefers the database for `VIEWER-002` *"so a concurrent double-submit cannot slip past an application-level check."*

**Layer 3 — the `Idempotency-Key` header, which turns a safe-but-confusing `409` into the original success.**

```http
Idempotency-Key: 7f3c1c2e-9b4a-4f0d-b8a1-2c5d6e7f8a90
```

The server stores `(key, user_id, endpoint, request_fingerprint) → (status, response_body)` and replays the stored response for a repeat of the same key. This is what makes a lost-response retry return `200 {status: "CONFIRMED"}` — the truth — instead of `409 REQUEST_STATE_CONFLICT`, which is technically safe but reads to the user as a failure of an operation that actually succeeded.

**RECOMMENDED implementation, and a flagged deviation.** `database-design.md` §48 states that *"a genuine idempotency-key mechanism is not built."* This API specifies one, which means adding a table the settled schema does not have:

```sql
CREATE TABLE idempotency_keys (
  key              uuid        NOT NULL,
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint         text        NOT NULL,
  request_hash     text        NOT NULL,
  status_code      int,
  response_body    jsonb,
  state            text        NOT NULL DEFAULT 'IN_FLIGHT'
                     CHECK (state IN ('IN_FLIGHT', 'COMPLETED')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  PRIMARY KEY (key, user_id, endpoint)
);
CREATE INDEX idx_idempotency_keys_created ON idempotency_keys (created_at);
```

The row is inserted as `IN_FLIGHT` **before** the operation and updated to `COMPLETED` with the response **in the same transaction as the operation** — so a crash mid-operation rolls back both, and the key becomes reusable rather than permanently poisoned. Retention: 24 hours, pruned by the cleanup job (§28.6). **Carried to §46.1** as an addition to `database-design.md`, not a silent divergence.

### 31.3 Semantics

| Situation | Response |
|---|---|
| First use of the key | Operation runs; response stored and returned |
| Repeat, same key, **same body**, original completed | The **stored response**, verbatim, including the original `request_id`, plus `Idempotency-Replayed: true` |
| Repeat, same key, **different body** | `409 IDEMPOTENCY_KEY_CONFLICT` — the key is a promise about one specific request |
| Repeat while the original is still `IN_FLIGHT` | `409 IDEMPOTENCY_REQUEST_IN_FLIGHT` with `Retry-After: 2` |
| Key present but not a UUID | `400 IDEMPOTENCY_KEY_INVALID` |
| Key older than 24 hours | Treated as new — the retry window has closed |
| Key reused by a different user | Treated as new; keys are scoped per user, so one user cannot probe or replay another's |

Returning the **original `request_id`** on a replay is deliberate: it points the client and the operator at the log entry for the attempt that actually did the work.

### 31.4 Where idempotency applies

| Endpoint | `Idempotency-Key` | Why |
|---|---|---|
| `POST /api/v1/requests` | **Strongly recommended** | Layer 2 absorbs the duplicate, but only within `VIEWER-002`'s scope; a key gives the client the created request instead of a `409` |
| `PATCH /api/v1/requests/{id}` (`ACCEPT`) | **Strongly recommended** | The canonical lost-response case (§31.1) |
| `PATCH /api/v1/requests/{id}` (`REJECT`, `COMPLETE`) | **Recommended** | Same shape, lower stakes |
| `POST /api/v1/admin/hoardings/{id}/approve` \| `/reject` | **Recommended** | Two Admins or one double-click; §25.3's lock handles safety, a key handles clarity |
| `POST /api/v1/admin/publishers/{id}/*` | **Recommended** | Same |
| `POST /api/v1/hoardings/{id}/media` | **Strongly recommended** | Uploads are slow and time out often; without a key, a retry creates a duplicate asset and burns free-tier storage |
| `POST /api/v1/hoardings` | Recommended | A duplicate draft is cheap to delete but confusing |
| `POST /api/v1/hoardings/{id}/submit` | Optional | Layer 1 covers it — a second submit returns `409 HOARDING_INVALID_STATE` |
| `POST /api/v1/hoardings/{id}/availability/blocks` | Recommended | Nothing prevents a duplicate block otherwise |
| `GET`, `PATCH /notifications/{id}`, `DELETE *` | **Not applicable** | Already idempotent by HTTP semantics |
| `POST /api/v1/auth/*` | **Not applicable** | Layer 2 covers registration; a login retry is harmless |
| `POST /api/jobs/*` | **Not applicable** | Idempotent by design (§28) |

**The key is never *required*.** An absent key means the client accepts Layer 1 and 2 semantics — safe, occasionally confusing. Requiring it would break every simple client for a benefit only some clients need.

### 31.5 Retry guidance for clients

| Failure | Safe to retry? | How |
|---|---|---|
| Network timeout, no response | **Yes** | Same `Idempotency-Key`. Without one, re-read the resource before retrying |
| `500 INTERNAL_ERROR` | **Yes, with a key.** Without one, re-read first | The outcome is unknown |
| `503 SERVICE_UNAVAILABLE` | **Yes** | After `Retry-After`, with backoff |
| `429 RATE_LIMITED` | **Yes** | After `Retry-After` |
| `409 REQUEST_STATE_CONFLICT` | **No** | The state changed. Re-read and re-decide |
| `409 REQUEST_DATE_CONFLICT` | **No** | The dates are gone. Choose different dates |
| `409 REQUEST_DUPLICATE_PENDING` | **No** | The request already exists; `details` names it |
| `4xx` generally | **No** | Fix the request |

**Browser refresh and double-click are covered by Layers 1 and 2 even with no key**, which is why the base guarantee matters more than the header: a double-clicked "Accept" produces one confirmation and one `409`, never two confirmations, and a refreshed request-submission page produces `409 REQUEST_DUPLICATE_PENDING` rather than a second request.

---

## 32. Concurrency and Transaction Safety

### 32.1 Transaction boundaries

Three operations require a transaction; everything else is a plain write (`system-architecture.md` §28).

**Request creation** — one `INSERT`, atomic by construction:

```text
BEGIN  (implicit — a single statement)
  RLS WITH CHECK: viewer_id = auth.uid() AND status = 'REQUESTED'
  BEFORE INSERT trigger validate_request_creation():
      assert listing satisfies INVENTORY-003
      assert no overlapping CONFIRMED/LIVE/COMPLETED request
      set publisher_id (from the hoarding, never the body)
      set sla_deadline
  INSERT requests
  partial UNIQUE index enforces VIEWER-002
  AFTER trigger log_request_status_change  → request_status_history
  AFTER trigger notify_request_created     → 2 notification rows
COMMIT
```

No `rpc()` call is needed here: a single `INSERT` and every trigger it fires are one transaction, so any raise rolls back the whole thing including earlier triggers' effects (`database-design.md` §24).

**Request confirmation** — one `SECURITY DEFINER` function (§19.1):

```text
BEGIN
  SELECT … FOR UPDATE                       -- lock the request row
  assert publisher_id = auth.uid()
  assert status = 'REQUESTED'
  re-assert INVENTORY-003 on the hoarding
  re-assert no conflicting CONFIRMED/LIVE/COMPLETED range   -- REQUEST-004
  UPDATE requests SET status='CONFIRMED', confirmed_at=now()
      -- EXCLUDE constraint evaluated here; violation caught and re-raised
  INSERT notifications (REQUEST_ACCEPTED → viewer)
COMMIT
```

**Listing approval** — one `SECURITY DEFINER` function (§25.1):

```text
BEGIN
  assert is_admin()
  SELECT … FOR UPDATE; assert approval_status = 'PENDING_REVIEW'
  UPDATE hoardings SET approval_status='APPROVED', approved_at, approved_by
  INSERT admin_actions
  INSERT notifications (LISTING_APPROVED → publisher)
COMMIT
```

**The property all three share:** no partially completed state transition is ever observable. A request is `REQUESTED` or `CONFIRMED`, never "confirmed but dates not blocked" — because the dates are blocked *as a consequence of* the status, not by a second write (§15.1). A listing is `PENDING_REVIEW` or `APPROVED`, never "approved but invisible" — because visibility is a query-time predicate, not a stored flag.

**Deliberately outside transactions:** media watermarking, notification *delivery*, storage object deletion, search, and every external call. **No external call ever occurs inside a transaction** (P8) — `system-architecture.md` §38 #12: a notification provider timing out while holding a row lock on the confirmation path would turn a third-party latency spike into a marketplace-wide booking outage.

### 32.2 The eight races, each with its authoritative check and expected API response

**Race 1 — two Viewers submit overlapping requests simultaneously.**

| | |
|---|---|
| Authoritative check | `validate_request_creation()` — against `CONFIRMED`/`LIVE`/`COMPLETED` only |
| Expected result | **Both succeed.** Two `REQUESTED` rows, overlapping each other |
| API response | `201` to both |
| Rule | `mvp-prd.md` §12's own acceptance criterion; `request-engine.md` §25 #1–#2 |

**This is correct behavior, not a race to prevent.** The exclusion constraint's `WHERE` clause excludes `REQUESTED` rows entirely, so Pending requests never contend. An implementation that "helpfully" blocked the second would contradict an approved acceptance criterion.

**Race 2 — two simultaneous Publisher confirmations of overlapping requests.**

| | |
|---|---|
| Authoritative check | `SELECT … FOR UPDATE` + `REQUEST-004` re-check + **the `EXCLUDE` constraint** |
| Expected result | **Exactly one succeeds** |
| API response | Winner `200 CONFIRMED`; loser `409 REQUEST_DATE_CONFLICT` with the conflicting range |
| Rule | `REQUEST-001`, `REQUEST-004` |

Walked through step by step in §19.3 Case 2. The critical point bears repeating: the two requests are **different rows**, so their `FOR UPDATE` locks do not serialize them against each other, and under `READ COMMITTED` both re-validations can legitimately see a conflict-free world. **Only the exclusion constraint closes that window.** Application logic alone cannot.

**Race 3 — confirmation vs. SLA expiry.**

| | |
|---|---|
| Authoritative check | Both contend on the same row: `confirm_request()`'s `FOR UPDATE` vs the expiry job's `UPDATE … WHERE status='REQUESTED'` |
| Expected result | Exactly one commits; the other fails its precondition |
| API response | If expiry won: `409 REQUEST_STATE_CONFLICT`, `details.current_status: "EXPIRED"`. If confirmation won: the job's `WHERE` clause simply does not match, and it reports one fewer processed row |
| Rule | **Which side *should* win is an OPEN QUESTION** — `request-engine.md` §25 #5, `system-architecture.md` §16 both decline to decide. The guarantee is mechanical: exactly one, deterministically (§46) |

**Race 4 — two Admins approve/reject the same listing.**

| | |
|---|---|
| Authoritative check | `SELECT … FOR UPDATE` then `assert approval_status = 'PENDING_REVIEW'` |
| Expected result | First wins; second fails |
| API response | `409 HOARDING_INVALID_STATE`, `details.current_status` |
| Rule | Flagged undefined by `admin-platform.md` §22 #8; **resolved structurally** by the row lock, with no new mechanism (§25.3) |

**Race 5 — listing edit vs. a pending request.**

| | |
|---|---|
| Authoritative check | `enforce_hoarding_edit_freeze` `BEFORE UPDATE` trigger |
| Expected result | The edit is refused **in full** if it touches a frozen column while a `REQUESTED` row exists |
| API response | `409 HOARDING_EDIT_FROZEN` with `frozen_fields`, `attempted_fields`, `pending_request_count` |
| Rule | `OWNER-003`. Note the freeze is evaluated **inside** the `UPDATE`, so a request created microseconds earlier is seen |

**Race 6 — listing pause vs. request creation.**

| | |
|---|---|
| Authoritative check | `validate_request_creation()` re-reads the hoarding's visibility inside the insert |
| Expected result | If the pause committed first, no request is created |
| API response | `409 HOARDING_NOT_VISIBLE` |
| Rule | `viewer-platform.md` §21: *"the submission is blocked with a clear reason, not silently accepted then rejected"* |

The mirror case — pause committing *after* the request — leaves a valid `REQUESTED` row that cannot be confirmed until the listing is unpaused (§13.4).

**Race 7 — duplicate client submissions (double-click, refresh, retry).**

| | |
|---|---|
| Authoritative check | `requests_one_pending_per_viewer_hoarding` partial unique index; optionally the `Idempotency-Key` store |
| Expected result | Exactly one request exists |
| API response | Without a key: `201` then `409 REQUEST_DUPLICATE_PENDING` naming the existing request. With a key: `201` then the stored `201` replayed |
| Rule | `VIEWER-002`; §31 |

**Race 8 — delist vs. confirmation.**

| | |
|---|---|
| Authoritative check | `confirm_request()` step 5 re-reads `INVENTORY-003` |
| Expected result | If the delist committed first, confirmation fails |
| API response | `409 HOARDING_NOT_VISIBLE` |
| Rule | `ADMIN-004`; the request stays `REQUESTED` |

### 32.3 Rules that make the above hold

**REQUIRED, every one of them:**

1. **The frontend is never the source of truth for availability.** `system-architecture.md` §20: *"Availability shown on the frontend is not authoritative."* Every write path re-reads live state.
2. **Every state transition re-asserts its preconditions at execution time**, never trusting state read earlier in the same user journey. This is `REQUEST-004` generalized.
3. **Every background job re-asserts its preconditions**, never trusting the state it saw when scheduled (`system-architecture.md` §44 rule 12).
4. **Critical invariants are enforced by database constraints, not only by application logic** — the exclusion constraint and the partial unique index are the two that carry the product's core promises.
5. **No external call inside a transaction** (P8).
6. **Client-supplied ownership IDs are never trusted** — `publisher_id` is derived, `viewer_id` is `auth.uid()`.
7. **A failed transition leaves the resource in its prior state, and says so** — the `details.current_status` field on every state conflict.

### 32.4 Isolation level

**`READ COMMITTED`** — the PostgreSQL default. **RECOMMENDED**, deliberately, rather than `REPEATABLE READ` or `SERIALIZABLE`.

The argument is specific rather than conventional: the one invariant that a weaker isolation level could break is *"no two overlapping `CONFIRMED` requests"*, and that invariant is enforced by an **exclusion constraint**, which is an index-level guarantee independent of isolation level entirely. Raising the isolation level would add serialization-failure retries to every confirmation for a guarantee already held by stronger means. `database-design.md` §24 makes the same argument from the other direction: the constraint exists so that *"even a bug in the function's own logic, a future direct `UPDATE`, or a second code path added later cannot produce two overlapping `CONFIRMED` rows."*

Where an operation genuinely needs a stable read across statements, it takes an explicit `FOR UPDATE` — which is what `confirm_request()`, `approve_listing()`, `reject_listing()`, and `mark_request_completed()` all do.

---

## 33. Security

### 33.1 Authentication and session security

| Control | Specification |
|---|---|
| Credential storage | **Supabase Auth only.** No `public` table stores a password, a password hash, or an OTP secret (`database-design.md` §7) |
| Password hashing | Provider-managed, modern and adaptive. **Required now**, because the demo build stores passwords (`viewer-platform.md` §24, `system-architecture.md` §30) |
| Token transport | `Authorization: Bearer` over HTTPS only (§5.4) |
| Token validation | Signature and expiry checked on **every** request. Never cached, never skipped for "internal" routes |
| Role source | `profiles.role`, read server-side. **Never** a token claim (§5.4) |
| Session revocation | `POST /auth/logout`; refresh-token rotation with reuse detection (§5.9) |

### 33.2 Authorization

Three enforcement layers, none optional (§6.3): route-level role checks, RLS on all 11 tables, and explicit guards inside every `SECURITY DEFINER` function.

**The single most likely authorization bug in this product**, named by `system-architecture.md` §18: treating a role check as sufficient where an ownership check is required. `role = 'PUBLISHER'` says the caller may manage listings; it says nothing about *which*. Every Publisher-scoped operation performs a row-level ownership check, and §36's CI list makes it a mandatory automated test.

### 33.3 Row Level Security

RLS is enabled on all 11 application tables and is a live control, not decoration. **REQUIRED:** ordinary user requests execute as the caller's JWT so RLS applies. The service-role key bypasses RLS entirely and is confined to exactly three contexts:

1. The `/api/jobs/*` routes (§28).
2. The media pipeline's storage writes and the `processing_status` update (§14).
3. The two server-side reads RLS currently makes impossible, once §46.1's fixes land — and after those fixes, ideally neither (both become `SECURITY DEFINER` functions instead).

**The service-role key is never sent to a browser, never used to satisfy a user-scoped read that RLS could serve, and never included in any response.** `seeable_free_first_techstack.md` §10 and §30 both state the first half; the second is this document's addition, and it matters: a route that "just uses the service role because it's simpler" silently disables every RLS policy behind it.

### 33.4 Input validation

**REQUIRED at the API boundary on every write path**, before any database call:

- Type, format, length, range, and enum membership on every field.
- Unknown fields rejected, not ignored — an ignored field is a silent behavioral difference between what the client sent and what the server did.
- UUID path parameters validated syntactically before lookup (§4.5).
- Money strings validated for exactly two decimals (§4.6).
- Dates validated for format and ordering.
- Nested `jsonb` (`attributes`, `site_intelligence`) validated as objects with a documented depth and size cap — **RECOMMENDED** 16 KB and 5 levels, since an unbounded `jsonb` is a cheap memory-amplification vector.

`seeable_free_first_techstack.md` §42 names Zod for this. The important property is not the library but that validation happens **server-side on every path**, including paths the current client never exercises.

### 33.5 SQL injection, and why it is structurally near-impossible here

Every database interaction in this architecture is either a PostgREST call through `@supabase/supabase-js` (parameterized by construction) or an `rpc()` invocation of a named function with typed parameters. **No route builds SQL by string concatenation.**

**REQUIRED, nonetheless:**

- Never interpolate user input into a raw SQL string, including in migrations and admin scripts.
- Every `SECURITY DEFINER` function carries `SET search_path = public`. `database-design.md` §37 explains why this is not optional: without it, an elevated-privilege function can be tricked into resolving an unqualified table name against an attacker-controlled schema — a well-known privilege-escalation pattern.
- Constant-time comparison for the OTP (§5.8) and the job secret (§28.2). Both are secrets compared against user-supplied input, and both leak length-prefix information under naive comparison.

### 33.6 Output filtering — what never leaves the server

**REQUIRED. These are absolute, and each has an enforcement mechanism, not just a rule:**

| Never in any response | Enforced by |
|---|---|
| Supabase **service-role key** | Never referenced in any serializer; never in public config (§35) |
| Storage credentials, signing keys | Same |
| Passwords, password hashes | Not stored in `public` at all (§33.1) |
| OTP values or OTP secrets | Provider-held |
| `original_storage_path` | **Column-`REVOKE`d** from `authenticated` and `anon` (§38.1). A response schema literally cannot include it |
| Private media URLs | Only ever a short-lived signed URL from `GET /media/{id}/original` (§14.6) |
| Publisher `phone` / `email` to a Viewer | Not in any listing or request serializer (§23.4) |
| Viewer `phone` / `email` to a Publisher | Same |
| `suspended_by`, `approved_by`, `delisted_by` to a non-Admin | Admin-only projection (§11.3, §22.2) |
| Internal error text, stack traces, SQL | Generic `message`; detail to logs only (§8.6) |
| Table names, column names, constraint names in error messages | Mapped to API codes (§8.5) |

**`original_storage_path` deserves the emphasis it gets.** It is removed at the **privilege** level rather than the serializer level, which means a future endpoint that naively selects `*` from `hoarding_media` will error rather than leak. That is the difference between a rule and a control.

### 33.7 CSRF

**Not applicable as specified.** The API authenticates with an `Authorization` header, which a browser never attaches automatically on a cross-origin request. There is no ambient credential to forge.

**If the team adopts cookie-based sessions** (`@supabase/ssr` supports it and it is the more natural Next.js fit — §5.4), CSRF protection becomes **REQUIRED**:

- `SameSite=Lax` at minimum, `Strict` where the flow allows.
- `Secure` and `HttpOnly` on every auth cookie.
- A double-submit token or an origin check on every state-changing request.
- The CORS policy in §34 becomes load-bearing rather than merely tidy.

Flagged in §46 as a decision that changes this section's requirements.

### 33.8 XSS and content handling

The API returns JSON, never HTML, so it is not itself an XSS vector — but it stores free text that a client will render, and several fields are user-authored and cross-tenant visible:

`hoardings.title`, `description`, `locality`, `address_text`, `size`; `requests.message`, `rejection_reason`; `publisher_profiles.business_name`; `profiles.full_name`; availability block `reason`.

| Control | Specification |
|---|---|
| Storage | **Store raw, escape on output.** Sanitizing on input destroys legitimate characters (an ampersand in a business name) and creates a false sense of safety when a second write path forgets |
| Response encoding | `Content-Type: application/json; charset=utf-8` on every response — never `text/html` |
| `X-Content-Type-Options: nosniff` | **REQUIRED** on every response |
| Client contract | **REQUIRED, and it is on the client:** every string field is untrusted and must be rendered as text, never as markup. React and Vue do this by default; a `dangerouslySetInnerHTML` on a listing description would be an XSS |
| Length caps | Every free-text field is length-capped (§33.4), bounding stored-payload size |

**No field in this API is documented as accepting HTML or Markdown.** If rich text is ever wanted for `description`, it needs a sanitization policy that does not exist today.

### 33.9 Enumeration, information disclosure, and brute force

| Vector | Control |
|---|---|
| Account enumeration on `/auth/register` | Accepted trade-off (§5.6), bounded by rate limits |
| Account enumeration on `/auth/login` | **Identical response for wrong-identifier and wrong-password** — `401 AUTH_INVALID_CREDENTIALS`, same message, comparable timing |
| Listing enumeration by UUID | `404` for anything not visible to the caller (§6.5); UUIDv4 is not guessable |
| Request enumeration by UUID | `404` to any caller who is not one of the two parties (§23.3) |
| Publisher inventory probing | No `/publishers/{id}` endpoint exists for non-Admins (§22.1) |
| Credential brute force | Rate limits plus exponential backoff (§30.2) |
| OTP brute force | 5 attempts per OTP, then invalidation (§5.8) |
| Timing side channels | Constant-time comparison on OTP and job secret (§33.5) |

### 33.10 Secrets management

`system-architecture.md` §35's three-category split is a security boundary, not a filing convention:

| Category | Examples | Handling |
|---|---|---|
| **Public config** | API base URL, map style URL, `NEXT_PUBLIC_SUPABASE_URL`, the publishable Supabase key | May ship to the browser; safe in source control |
| **Private config** | Log level, `AUTH_OTP_ENABLED`, SLA duration, pagination limits, rate-limit values | Server-side only; per-environment values acceptable in source control |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY`, `JOBS_SHARED_SECRET`, `RESEND_API_KEY`, storage signing keys | **Never in source control.** Platform secret store, injected at runtime, rotatable |

**A map API key shipped to the browser is public by nature** and must be domain-restricted and usage-capped at the provider, since it cannot be kept secret (`system-architecture.md` §35).

### 33.11 PII minimization

| Principle | Application |
|---|---|
| Collect only what is required | `mvp-prd.md` §7.1's minimal profile: name, phone/email, city. No company details for Viewers, no KYC documents, no payment details (§23.5) |
| Expose only to those who need it | §23.4's contact-visibility boundary; Admin sees contact details only in the verification queue (§26.2) |
| Never log it | §35.3 |
| Retention | **No policy exists in any source document.** Not invented here — it belongs to `README.md` Tier 1 #8, unwritten (`system-architecture.md` §31, §46) |

### 33.12 Compliance

**No compliance certification is claimed, and none is designed for.** `system-architecture.md` §30 states the position and this API adopts it: no source document names a regulatory requirement, and asserting one would misrepresent the product's obligations. Two unwritten documents remain prerequisites for real user onboarding, and neither is superseded by this section: **Security & Data Privacy** (`README.md` Tier 1 #8) and **Terms of Service** (Tier 1 #9, flagged there as *"highest priority of this list"* — the direct mitigation for the disintermediation and no-recourse risks, since SEEABLE must explicitly disclaim being party to the offline transaction).

---

## 34. CORS

### 34.1 Policy

**REQUIRED: an explicit allow-list. Never `Access-Control-Allow-Origin: *` on any authenticated endpoint.**

```http
Access-Control-Allow-Origin: https://<configured-origin>
Access-Control-Allow-Credentials: false
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Request-Id, Accept
Access-Control-Expose-Headers: X-Request-Id, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, Idempotency-Replayed, Location
Access-Control-Max-Age: 600
Vary: Origin
```

- The allowed origins are **environment-specific configuration** (`system-architecture.md` §35, public config). No production domain is hardcoded, here or anywhere.
- **`Vary: Origin` is required** on every response that echoes an origin, or a shared cache will serve one origin's CORS headers to another.
- The server **echoes a matched origin** rather than reflecting whatever arrives — reflection is `*` with extra steps.
- An unmatched origin gets **no CORS headers at all**, and the browser blocks it. It does not get a `403`: a CORS failure is a browser-side decision, and returning an error body would leak that the endpoint exists to a cross-origin caller.

### 34.2 Per-surface policy

| Surface | Origin policy |
|---|---|
| `/api/v1/**` | Allow-list: production web origin, staging origin, `http://localhost:3000` in development **only** |
| `/api/health` | `*` permitted — unauthenticated, no credentials, no sensitive content (§29.2) |
| `/api/jobs/**` | **No CORS headers at all.** Not a browser surface. A preflight receives no allow headers and is blocked (§28.2) |

**`localhost` is never in the production allow-list.** A production API that trusts `http://localhost:3000` is trivially exploitable by any locally running page.

### 34.3 Why `Allow-Credentials: false`

The API authenticates with an `Authorization` header, not a cookie (§5.4), so no credential needs to ride along automatically. Setting `Allow-Credentials: false` means a compromised or misconfigured origin cannot make authenticated requests using an ambient session — it would need the token itself.

**If cookie sessions are adopted (§33.7), this must become `true`**, `Allow-Origin` may then never be `*` under any circumstance, and CSRF protection becomes mandatory. The two decisions are linked and must move together.

### 34.4 In practice, most requests are same-origin

The web client and the API are one Next.js deployment (`seeable_free_first_techstack.md` §5, §27), so the browser normally calls `/api/v1/...` same-origin and CORS never engages. The policy matters for preview deployments on a different hostname, a future separately-hosted client, and local development against a deployed API. Specifying it now is cheap; discovering it is absent during a preview deploy is not.

---

## 35. API Logging and Observability

### 35.1 The request ID

**REQUIRED on every request, no exceptions.**

- Generated per request unless the client supplied `X-Request-Id` (in which case it is validated for shape and length and adopted).
- Returned in the `X-Request-Id` response header **and** in the `request_id` body field (§7.1) — the body copy is what a user can screenshot.
- Attached to **every** log line for that request, including database errors and job runs.
- Format: **RECOMMENDED** `req_` + a ULID, so log lines sort chronologically by ID.

This one field is what makes a user's bug report ("it said something went wrong") actionable in seconds. It costs nothing.

### 35.2 What to log per request

| Field | Always | Notes |
|---|---|---|
| `request_id` | Yes | §35.1 |
| `timestamp` | Yes | ISO-8601 UTC |
| `method`, `path` | Yes | **Path template**, not the raw path — `/api/v1/hoardings/{id}`, so logs aggregate |
| `status` | Yes | |
| `latency_ms` | Yes | |
| `error_code` | On failure | The API error code from §8, not the message |
| `role` | When authenticated | `VIEWER` / `PUBLISHER` / `ADMIN` |
| `user_id` | When authenticated | The UUID. **Not** the name, email, or phone |
| `resource_id` | Where safe and relevant | `hoarding_id`, `request_id`, `media_id` — UUIDs are not PII |
| `idempotency_key` | When supplied | Correlates a retry with its original |
| `sqlstate` | On a database error | The PostgreSQL code, for the mapping in §8.5 |

**Log the path template, not the concrete path.** `/api/v1/hoardings/aaaaaaaa-…` in a log message defeats aggregation and makes "which endpoint is slow" unanswerable.

### 35.3 What must NEVER be logged

**REQUIRED. `system-architecture.md` §31 calls this *"the most common accidental data-protection failure and the cheapest to prevent at the start."***

| Never logged | Including |
|---|---|
| Passwords | Not in a request body dump, not in a validation error, not at debug level |
| Access tokens, refresh tokens | Never the value; a truncated prefix is also unnecessary |
| OTP codes | Neither issued nor submitted |
| **Private media URLs or signed URLs** | A signed URL in a log is a live credential for its TTL |
| The service-role key or any secret | |
| Phone numbers, email addresses | Log the `user_id` instead — it resolves to the person when someone with database access needs it, and is meaningless in a log aggregator |
| Full request bodies on write endpoints | They contain the above. Log field **names** on a validation failure, never values |
| `original_storage_path` | §33.6 |

**A structural mitigation:** the logger uses an explicit allow-list of loggable fields rather than a deny-list of redactions. A deny-list fails open — a new field is logged until someone remembers to add it — while an allow-list fails closed.

### 35.4 Metrics

`system-architecture.md` §33's list, with the SEEABLE-specific ones that carry business meaning:

| Metric | Why it matters |
|---|---|
| API latency (p50, p95, p99) per endpoint | `mvp-prd.md` §10's *"responsive at 50–200 listings"* |
| API error rate, by status class and error code | An error-code breakdown distinguishes "users are hitting conflicts" from "the service is broken" |
| Authorization failure rate | **A spike here is the signature of the row-level-ownership bug §33.2 warns about** |
| Request creation count | `mvp-brd.md` §14 KPI |
| Request confirmation count and rate | `mvp-brd.md` §14 KPI; `mvp-prd.md` §7.5 dashboard |
| **Conflict rejection rate** (`REQUEST_DATE_CONFLICT` / confirmation attempts) | `system-architecture.md` §33: *"a sudden change signals either a concurrency bug or unexpected demand patterns."* A rate near zero on a healthy marketplace is itself suspicious — it may mean the check is not running |
| Media processing failure rate | `CONTENT-001` gate health; a rise blocks listings from ever being submitted |
| Notification delivery failure rate | Optional-channel health (§28.4) |
| **Background job execution and lag** | See below |
| Listing approval queue depth and age | Operational: how long a Publisher waits |
| Rate-limit trigger count by endpoint | Detects both abuse and a limit set too tight |

**Job lag deserves its own alert, and it is the most important monitoring rule in the system.** `system-architecture.md` §33 and §39: the SLA expiry job failing is **silent from the user's perspective** — nothing errors, requests simply never expire, dates stay held indefinitely, and `OWNER-002` is quietly violated. **REQUIRED:** a "last successful run" timestamp per job, with an alert when it exceeds twice the scheduled interval. It is the cheapest possible protection against the least visible failure in the product.

### 35.5 Health and tracing

`GET /api/health` (§29) covers liveness and dependency reachability. **No distributed tracing at MVP** — `system-architecture.md` §33 specifies platform-provided logging with no dedicated observability stack, and `seeable_free_first_techstack.md` §35 excludes Sentry and PostHog as mandatory dependencies. The `request_id` provides correlation within a single deployable, which is all a modular monolith needs (§44 rule 10: no infrastructure without a demonstrated requirement).

---

## 36. API Versioning

### 36.1 The scheme

```text
/api/v1
```

Path-based, major version only. No minor versions in the path, no `Accept` header negotiation, no `X-API-Version`.

**`mvp-prd.md` §9's endpoint list is already `/api/v1`-prefixed**, which `system-architecture.md` §19 calls *"the closest thing to a prior architectural decision this project has."* Adopting it preserves that rather than replacing it.

### 36.2 Backwards compatibility within `v1`

**Non-breaking — ships within `v1`, at any time, without notice:**

- Adding a new endpoint.
- Adding an **optional** request field.
- Adding a response field. *(Clients must ignore unknown fields — see §36.4.)*
- Adding a new value to a **response-only** enum, where the client already handles unknown values gracefully.
- Adding a new error **code** within an existing HTTP status.
- Relaxing a validation rule.
- Adding an optional query parameter.

**Breaking — requires `/api/v2`:**

- Removing or renaming any field, endpoint, or parameter.
- Changing a field's type or format (for example, money from string to number).
- Making an optional request field required.
- Tightening validation on an existing field.
- Adding a value to a **request** enum in a way that changes existing behavior, or removing one.
- Changing an existing error code's HTTP status or meaning.
- Changing the response envelope's shape.
- Changing the authorization required for an existing endpoint.

**Adding a value to `requests.status` would be breaking.** Payment states (`PAID`, `ESCROWED`) are Phase 2 (§45), and a client that switches exhaustively on six states will not handle a seventh. `database-design.md` §46 notes the *database* side is trivial (`text` + `CHECK` rather than a native `ENUM`) — but the API contract is where the compatibility cost actually falls, and it is not trivial there.

### 36.3 `v2`

**There is no `v2`, and none is planned.** When one becomes necessary:

- `/api/v1` and `/api/v2` run side by side.
- `v1` gets a deprecation window and a `Deprecation` / `Sunset` header on every response.
- `v1` receives security fixes only during the window.
- The Phase 2 additions in §45 are **additive** wherever possible, precisely so they land in `v1`.

### 36.4 The client contract

**REQUIRED of every client, and stated here because it is what makes additive evolution possible:**

1. **Ignore unknown response fields.** A client that errors on an unexpected key turns every additive change into a breaking one.
2. **Handle unknown enum values gracefully** — render the raw value, do not crash.
3. **Branch on `error.code`, not on `error.message`.** Messages are wording; codes are contract.
4. **Do not depend on field ordering** in JSON objects.
5. **Do not depend on the absence of a field** — treat absent and null as equivalent unless this document says otherwise (§16.3's timestamp nulls are the documented exception, where absence is meaningful).

### 36.5 What is deliberately not introduced

| Not used | Why |
|---|---|
| **GraphQL** | `mvp-prd.md` §9 is REST-shaped; no source document mentions GraphQL; the brief forbids introducing it. A second query paradigm over 14 endpoints is infrastructure without a requirement (`system-architecture.md` §44 rule 10) |
| Multiple concurrent API versions at MVP | One version, one contract |
| Header or media-type versioning | Path versioning is already established |
| Per-endpoint versioning | Guarantees drift |
| Date-based versioning | Overkill at this scale |

---

## 37. OpenAPI 3.1 Specification

This document is written so that this section is a direct, mechanical transcription of §5–§31 — every endpoint, parameter, schema, and error above appears below. It is complete and runnable through a validator or a code generator as written; nothing is a placeholder.

**Two surfaces are deliberately excluded, and both are excluded for the same reason** — they are not public API and generating a client for them would be wrong:

- **`/api/jobs/*`** (§28): internal, shared-secret authenticated, never called by a browser, not versioned, and not enveloped.
- Nothing else. `GET /api/health` **is** included, because it is a public, unauthenticated endpoint that consumers legitimately probe.

**Server URL note.** The `servers` entry is a variable, not a hardcoded host — no production domain is named in any source document (§3.1). Paths carry their full `/api/v1` prefix so that `/api/health` can be represented in the same document.

```yaml
openapi: 3.1.0

info:
  title: SEEABLE Hoardings API
  version: 1.0.0
  summary: MVP API for the SEEABLE Hoardings out-of-home advertising marketplace (Bengaluru).
  description: |
    Booking-lite OOH marketplace API covering the MVP loop:
    Discover -> Compare -> Request -> Publisher Decision -> Confirm -> Notify.

    Scope boundaries that are load-bearing for anyone generating a client from this document:
      * NO payments, escrow, commissions, contracts, or invoicing exist anywhere in this API.
        Commercial settlement happens offline between Viewer and Publisher.
      * NO campaign management. One request = one hoarding = one date range.
      * NO agency role, no digital-screen purchasing, no AI, no DRM.
      * `requests.amount_agreed` is a record-keeping field. It is never collected,
        never enforced, and never used to compute anything.

    Core invariant, enforced by a PostgreSQL exclusion constraint beneath the API:
      no two overlapping requests may both reach CONFIRMED on the same hoarding.

    Conventions:
      * Every /api/v1 response uses the envelope { success, data, meta, request_id }
        or { success, error, request_id }. /api/health does not.
      * All JSON body and response fields are snake_case; query parameters keep the
        camelCase spellings fixed by mvp-prd.md section 9.
      * Money is an INR decimal string with exactly two fractional digits.
      * Campaign dates are YYYY-MM-DD, inclusive on BOTH endpoints.
      * System timestamps are ISO-8601 UTC with a Z suffix.
  contact:
    name: SEEABLE Product & Engineering
  license:
    name: Proprietary — internal specification

servers:
  - url: "{baseUrl}"
    description: Environment-specific base URL, supplied by configuration.
    variables:
      baseUrl:
        default: "http://localhost:3000"
        description: Development, staging, and production hosts are configured via environment variables.

tags:
  - name: Auth
    description: Registration, login, OTP verification, session handling, and identity.
  - name: Inventory
    description: Hoarding listings, type taxonomy, media, and availability.
  - name: Media
    description: Listing media upload and the watermarked-only public contract (CONTENT-001).
  - name: Availability
    description: Computed availability and Publisher-managed date blocks.
  - name: Requests
    description: The Request Engine — creation, lifecycle actions, and history.
  - name: Publisher
    description: Publisher-scoped profile, inventory, and request inbox.
  - name: Viewer
    description: Viewer-scoped profile and request tracking.
  - name: Notifications
    description: In-app notification feed. In-app is the system of record.
  - name: Admin
    description: Internal moderation — listing approval, Publisher verification, suspension, dashboard.
  - name: System
    description: Health and liveness.

security:
  - bearerAuth: []

paths:

  # ----------------------------------------------------------------- Auth ---
  /api/v1/auth/register:
    post:
      tags: [Auth]
      operationId: registerAccount
      summary: Register a Viewer or Publisher account
      description: |
        Creates a Supabase Auth user and, via a database trigger, the matching
        profiles row (plus publisher_profiles when role is PUBLISHER).
        role=ADMIN is rejected — Admin accounts are provisioned out of band.
        When OTP is enabled, `session` is null and the client must call /auth/verify-otp.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/RegisterRequest" }
      responses:
        "201":
          description: Account created.
          headers:
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AuthResult" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "409": { $ref: "#/components/responses/Conflict" }
        "422": { $ref: "#/components/responses/ValidationFailed" }
        "429": { $ref: "#/components/responses/RateLimited" }
        "503": { $ref: "#/components/responses/ServiceUnavailable" }

  /api/v1/auth/login:
    post:
      tags: [Auth]
      operationId: login
      summary: Log in with identifier and password
      description: |
        Demo-build credential flow (viewer-platform.md Demo Scope Note).
        `identifier` accepts either an email address or an E.164 phone number.
        Wrong identifier and wrong password return the identical error, deliberately.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/LoginRequest" }
      responses:
        "200":
          description: Authenticated.
          headers:
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AuthResult" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "429": { $ref: "#/components/responses/RateLimited" }

  /api/v1/auth/verify-otp:
    post:
      tags: [Auth]
      operationId: verifyOtp
      summary: Verify a one-time password (AUTH-002)
      description: |
        MVP target behaviour. Returns 501 AUTH_OTP_DISABLED while the demo build
        runs with AUTH_OTP_ENABLED=false. Five attempts per OTP, then invalidation.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/VerifyOtpRequest" }
      responses:
        "200":
          description: Verified; a session is issued.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AuthResult" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "410":
          description: The OTP has expired (AUTH_OTP_EXPIRED). Request a new one.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "429": { $ref: "#/components/responses/RateLimited" }
        "501":
          description: OTP verification is disabled in this build (AUTH_OTP_DISABLED).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }

  /api/v1/auth/refresh:
    post:
      tags: [Auth]
      operationId: refreshSession
      summary: Exchange a refresh token for a new session
      description: Refresh tokens rotate. Presenting a rotated token returns 401 and revokes the family.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refresh_token]
              properties:
                refresh_token: { type: string, minLength: 1 }
              additionalProperties: false
      responses:
        "200":
          description: New session issued.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          session: { $ref: "#/components/schemas/Session" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "429": { $ref: "#/components/responses/RateLimited" }

  /api/v1/auth/logout:
    post:
      tags: [Auth]
      operationId: logout
      summary: Revoke the current session, or every session
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                scope:
                  type: string
                  enum: [SESSION, ALL]
                  default: SESSION
              additionalProperties: false
      responses:
        "204": { $ref: "#/components/responses/NoContent" }
        "401": { $ref: "#/components/responses/Unauthorized" }

  /api/v1/auth/me:
    get:
      tags: [Auth]
      operationId: getCurrentIdentity
      summary: Current identity, role, and verification capability flags
      responses:
        "200":
          description: The authenticated identity.
          headers:
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/CurrentIdentity" }
        "401": { $ref: "#/components/responses/Unauthorized" }

  # ------------------------------------------------------------ Inventory ---
  /api/v1/hoarding-types:
    get:
      tags: [Inventory]
      operationId: listHoardingTypes
      summary: The eight-type hoarding taxonomy and its required attribute keys
      description: |
        Reference data driving the listing form. `required_attribute_keys` is the
        INVENTORY-001 field set for each type; clients must not hardcode it.
        `is_listable` is false for the two digital types at MVP.
      responses:
        "200":
          description: The taxonomy.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          hoarding_types:
                            type: array
                            items: { $ref: "#/components/schemas/HoardingType" }
        "401": { $ref: "#/components/responses/Unauthorized" }

  /api/v1/hoardings:
    get:
      tags: [Inventory]
      operationId: searchHoardings
      summary: Search visible inventory (INVENTORY-003 applied)
      description: |
        Returns only listings satisfying INVENTORY-003 (APPROVED, not paused,
        not delisted) unless the caller owns them or is an Admin.
        Filters combine with AND. maxDistance requires latitude and longitude.
        There is no sort parameter at MVP; ordering is distance ascending when a
        centre is supplied, otherwise created_at descending.
      security:
        - {}
        - bearerAuth: []
      parameters:
        - $ref: "#/components/parameters/TypeFilter"
        - $ref: "#/components/parameters/CityFilter"
        - $ref: "#/components/parameters/LatitudeParam"
        - $ref: "#/components/parameters/LongitudeParam"
        - $ref: "#/components/parameters/MaxDistanceParam"
        - $ref: "#/components/parameters/MaxPriceParam"
        - $ref: "#/components/parameters/StartDateFilter"
        - $ref: "#/components/parameters/EndDateFilter"
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of visible listings.
          headers:
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          hoardings:
                            type: array
                            items: { $ref: "#/components/schemas/HoardingPublic" }
                      meta: { $ref: "#/components/schemas/PaginatedMeta" }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "429": { $ref: "#/components/responses/RateLimited" }

    post:
      tags: [Inventory]
      operationId: createHoarding
      summary: Create a listing in DRAFT (Publisher)
      description: |
        Verification is NOT required to create (OWNER-004 gates submission, not creation).
        Only type_code and title are required here; price, location, attributes, and
        media are enforced at POST /hoardings/{id}/submit.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HoardingCreateRequest" }
      responses:
        "201":
          description: Draft listing created.
          headers:
            Location: { schema: { type: string }, description: Canonical URL of the new listing. }
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "422": { $ref: "#/components/responses/ValidationFailed" }
        "429": { $ref: "#/components/responses/RateLimited" }

  /api/v1/hoardings/{hoardingId}:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    get:
      tags: [Inventory]
      operationId: getHoarding
      summary: Listing detail
      description: |
        Returns the public representation to a Viewer, or the owner/Admin
        representation (moderation fields, submission readiness) to the owning
        Publisher or an Admin. A listing that fails INVENTORY-003 returns 404 to
        a non-owner — existence is not disclosed.
      security:
        - {}
        - bearerAuth: []
      parameters:
        - $ref: "#/components/parameters/LatitudeParam"
        - $ref: "#/components/parameters/LongitudeParam"
      responses:
        "200":
          description: The listing.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        oneOf:
                          - $ref: "#/components/schemas/HoardingPublic"
                          - $ref: "#/components/schemas/HoardingOwner"
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }

    patch:
      tags: [Inventory]
      operationId: updateHoarding
      summary: Update a listing, or pause/unpause it (Publisher, own)
      description: |
        Partial update. OWNER-003: an update touching title, type_code, attributes,
        price, latitude, or longitude is refused in full while any REQUESTED request
        exists on the listing. is_paused is exempt from the freeze.
        approval_status and every other moderation field are never client-writable.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HoardingUpdateRequest" }
      responses:
        "200":
          description: Updated listing.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409":
          description: HOARDING_EDIT_FROZEN (OWNER-003).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

    delete:
      tags: [Inventory]
      operationId: deleteHoarding
      summary: Hard-delete a listing (Publisher own, or Admin)
      description: |
        Refused with 409 HOARDING_HAS_REQUEST_HISTORY when any request references
        the listing — enforced by an ON DELETE RESTRICT foreign key, not by
        application logic. Delist or pause instead.
      responses:
        "204": { $ref: "#/components/responses/NoContent" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/hoardings/{hoardingId}/submit:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Inventory]
      operationId: submitHoardingForReview
      summary: Submit a DRAFT or REJECTED listing for Admin review
      description: |
        Runs the full submission gate: Publisher VERIFIED and not suspended (OWNER-004,
        ADMIN-002); price and coordinates present; INVENTORY-001 type-specific keys
        complete; at least one media asset; every asset WATERMARKED (CONTENT-001).
        Media still processing returns a retryable 409, not a hard error.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      responses:
        "200":
          description: Listing moved to PENDING_REVIEW.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403":
          description: PUBLISHER_NOT_VERIFIED, PUBLISHER_SUSPENDED, or FORBIDDEN_NOT_OWNER.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409":
          description: |
            A submission gate failed. Codes: HOARDING_INVALID_STATE,
            HOARDING_MISSING_CORE_FIELDS, HOARDING_INCOMPLETE_ATTRIBUTES,
            HOARDING_MISSING_MEDIA, HOARDING_MEDIA_NOT_WATERMARKED,
            MEDIA_PROCESSING_FAILED.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }

  # ---------------------------------------------------------------- Media ---
  /api/v1/hoardings/{hoardingId}/media:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    get:
      tags: [Media]
      operationId: listHoardingMedia
      summary: List a listing's media assets
      description: Ordered is_primary DESC, display_order ASC. Not paginated.
      security:
        - {}
        - bearerAuth: []
      responses:
        "200":
          description: The listing's media.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          media:
                            type: array
                            items: { $ref: "#/components/schemas/HoardingMedia" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }

    post:
      tags: [Media]
      operationId: uploadHoardingMedia
      summary: Upload a media asset (Publisher, own)
      description: |
        Returns 201 with processing_status WATERMARKED under the browser-side
        pipeline, or 202 with UPLOADED under the server-side worker pipeline
        (see specification section 14.2). The wire contract is identical for both;
        clients poll until every asset reads WATERMARKED.
        `url` is null until a watermarked derivative exists — no response ever
        returns a URL resolving to an unwatermarked original (CONTENT-001).
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
                  description: The image or video. Max 10 MB.
                original:
                  type: string
                  format: binary
                  description: Optional pre-watermark original (browser-side pipeline only).
                is_primary:
                  type: boolean
                  default: false
                display_order:
                  type: integer
                  minimum: 0
            encoding:
              file: { contentType: "image/jpeg, image/png, image/webp, video/mp4" }
              original: { contentType: "image/jpeg, image/png, image/webp, video/mp4" }
      responses:
        "201":
          description: Media stored and already watermarked.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingMedia" }
        "202":
          description: Media accepted; watermarking is in progress.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingMedia" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409":
          description: MEDIA_LIMIT_EXCEEDED — the per-listing asset cap was reached.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "413":
          description: MEDIA_TOO_LARGE.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "415":
          description: MEDIA_TYPE_UNSUPPORTED — MIME validated from the bytes, not the header.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "422": { $ref: "#/components/responses/ValidationFailed" }
        "429": { $ref: "#/components/responses/RateLimited" }
        "503":
          description: STORAGE_UNAVAILABLE.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }

  /api/v1/hoardings/{hoardingId}/media/{mediaId}:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
      - $ref: "#/components/parameters/MediaIdParam"
    patch:
      tags: [Media]
      operationId: updateHoardingMedia
      summary: Set primary flag or display order (Publisher, own)
      description: |
        Accepts exactly is_primary and display_order — the only two columns the
        database grants a client. processing_status and storage paths are pipeline
        state and are never client-writable.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              minProperties: 1
              properties:
                is_primary: { type: boolean }
                display_order: { type: integer, minimum: 0 }
              additionalProperties: false
      responses:
        "200":
          description: Updated media asset.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingMedia" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

    delete:
      tags: [Media]
      operationId: deleteHoardingMedia
      summary: Delete a media asset (Publisher, own)
      description: |
        Refused with 409 MEDIA_LAST_ASSET when it is the only asset on an
        APPROVED or PENDING_REVIEW listing, which would leave the listing visible
        with no image and unable to re-satisfy the submission gate.
      responses:
        "204": { $ref: "#/components/responses/NoContent" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/media/{mediaId}/original:
    parameters:
      - $ref: "#/components/parameters/MediaIdParam"
    get:
      tags: [Media]
      operationId: getOriginalMediaUrl
      summary: Short-lived signed URL for the private original (owner or Admin only)
      description: |
        The ONLY sanctioned path to an unwatermarked original. Never returns a
        storage path, never a public URL. 404 MEDIA_ORIGINAL_UNAVAILABLE when no
        original was retained.
      responses:
        "200":
          description: A signed, expiring download URL.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/OriginalMediaLink" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "429": { $ref: "#/components/responses/RateLimited" }

  # --------------------------------------------------------- Availability ---
  /api/v1/hoardings/{hoardingId}/availability:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    get:
      tags: [Availability]
      operationId: getHoardingAvailability
      summary: Computed availability for a listing
      description: |
        Availability is composed from three inputs and never cached: INVENTORY-003
        visibility, Publisher blocks, and CONFIRMED/LIVE/COMPLETED requests.
        Unavailable ranges are merged and carry only a coarse reason (BOOKED or
        BLOCKED) — never a viewer id, request id, or Publisher note.
        Supplying start_date and end_date adds a direct is_available answer.
      security:
        - {}
        - bearerAuth: []
      parameters:
        - name: from
          in: query
          required: false
          schema: { type: string, format: date }
          description: Window start. Defaults to today.
        - name: to
          in: query
          required: false
          schema: { type: string, format: date }
          description: Window end. Defaults to from + 180 days. Max window 365 days.
        - name: start_date
          in: query
          required: false
          schema: { type: string, format: date }
          description: With end_date, requests a direct availability answer for this range.
        - name: end_date
          in: query
          required: false
          schema: { type: string, format: date }
      responses:
        "200":
          description: Computed availability for the window.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AvailabilityResult" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  /api/v1/hoardings/{hoardingId}/availability/blocks:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Availability]
      operationId: createAvailabilityBlock
      summary: Block a date range (Publisher, own)
      description: |
        Blocking dates that already carry a confirmed request is permitted and does
        not affect that request; meta.overlaps_confirmed_requests reports it.
        Overlapping blocks are allowed and are merged only for display.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/AvailabilityBlockCreateRequest" }
      responses:
        "201":
          description: Block created.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AvailabilityBlock" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  /api/v1/hoardings/{hoardingId}/availability/blocks/{blockId}:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
      - $ref: "#/components/parameters/BlockIdParam"
    delete:
      tags: [Availability]
      operationId: deleteAvailabilityBlock
      summary: Unblock a date range (Publisher, own)
      description: |
        Unblocking does not free dates covered by a confirmed request — the two
        inputs to availability are independent.
      responses:
        "204": { $ref: "#/components/responses/NoContent" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }

  # ------------------------------------------------------------- Requests ---
  /api/v1/requests:
    post:
      tags: [Requests]
      operationId: createRequest
      summary: Submit a date request on a listing (Viewer)
      description: |
        Enforced on insert, atomically: listing satisfies INVENTORY-003; no
        overlapping CONFIRMED/LIVE/COMPLETED request (REQUEST-001); this Viewer holds
        no other REQUESTED request on this listing (VIEWER-002, a partial unique index).
        Overlapping REQUESTED requests from DIFFERENT Viewers are valid and expected.
        amount_agreed is NOT accepted here.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/RequestCreateRequest" }
      responses:
        "201":
          description: Request created in REQUESTED (Viewer label "Pending").
          headers:
            Location: { schema: { type: string } }
            X-Request-Id: { $ref: "#/components/headers/XRequestId" }
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/RequestResource" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403":
          description: FORBIDDEN_ROLE, or AUTH_VERIFICATION_REQUIRED under the MVP OTP target.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409":
          description: |
            HOARDING_NOT_VISIBLE, REQUEST_DATE_CONFLICT (REQUEST-001),
            or REQUEST_DUPLICATE_PENDING (VIEWER-002).
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "422": { $ref: "#/components/responses/ValidationFailed" }
        "429": { $ref: "#/components/responses/RateLimited" }

  /api/v1/requests/me:
    get:
      tags: [Requests, Viewer]
      operationId: listMyRequests
      summary: The Viewer's own requests
      parameters:
        - $ref: "#/components/parameters/RequestStatusFilter"
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of the caller's requests.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          requests:
                            type: array
                            items: { $ref: "#/components/schemas/RequestResource" }
                      meta: { $ref: "#/components/schemas/RequestListMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/requests/{requestId}:
    parameters:
      - $ref: "#/components/parameters/RequestIdParam"
    get:
      tags: [Requests]
      operationId: getRequest
      summary: Request detail (the owning Viewer or the owning Publisher)
      description: |
        Admin receives 404 — Admin has no individual-request visibility
        (request-engine.md sections 4 and 23). The embedded hoarding summary is
        served even when the listing is no longer visible, so a request never
        resolves to a broken reference.
      responses:
        "200":
          description: The request.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/RequestResource" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }

    patch:
      tags: [Requests]
      operationId: actOnRequest
      summary: Accept, reject, complete, or record the agreed amount
      description: |
        The client requests an ACTION; the server determines the resulting state.
        A body containing `status` is rejected — status is never client-writable.
        ACCEPT re-validates listing visibility and date conflicts at accept time
        (REQUEST-004) inside one transaction, backed by a database exclusion
        constraint. Admin may only send COMPLETE.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/RequestActionRequest" }
      responses:
        "200":
          description: The updated request.
          headers:
            Idempotency-Replayed:
              schema: { type: boolean }
              description: Present and true when this is a replay of a stored response.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/RequestResource" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409":
          description: |
            REQUEST_STATE_CONFLICT, REQUEST_DATE_CONFLICT (REQUEST-004 lost the race),
            HOARDING_NOT_VISIBLE, REQUEST_COMPLETE_TOO_EARLY (REQUEST-003),
            REQUEST_AMOUNT_NOT_SETTABLE.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }
        "422": { $ref: "#/components/responses/ValidationFailed" }
        "501":
          description: REQUEST_CANCEL_UNSUPPORTED — Viewer withdrawal is not an MVP feature.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ErrorEnvelope" }

  /api/v1/requests/{requestId}/history:
    parameters:
      - $ref: "#/components/parameters/RequestIdParam"
    get:
      tags: [Requests]
      operationId: getRequestHistory
      summary: Status-transition history for a request
      description: |
        Append-only, trigger-maintained. changed_by is null for system transitions
        (SLA expiry, CONFIRMED to LIVE). Not paginated — bounded by the state machine.
      responses:
        "200":
          description: The transition history.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          request_id: { type: string, format: uuid }
                          history:
                            type: array
                            items: { $ref: "#/components/schemas/RequestStatusHistoryEntry" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }

  # ------------------------------------------------------------ Publisher ---
  /api/v1/publishers/me:
    get:
      tags: [Publisher]
      operationId: getMyPublisherProfile
      summary: The Publisher's own profile and trust state
      responses:
        "200":
          description: The Publisher profile.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherProfileSelf" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
    patch:
      tags: [Publisher]
      operationId: updateMyPublisherProfile
      summary: Update own profile fields
      description: |
        Accepts exactly the columns the database grants a client:
        full_name, phone, email, city, business_name. role, verification_status,
        and suspended are refused — they are also column-REVOKEd in the database.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PublisherProfileUpdateRequest" }
      responses:
        "200":
          description: Updated profile.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherProfileSelf" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  /api/v1/publishers/me/hoardings:
    get:
      tags: [Publisher]
      operationId: listMyHoardings
      summary: The Publisher's own listings, in every state
      parameters:
        - $ref: "#/components/parameters/ApprovalStatusFilter"
        - name: is_paused
          in: query
          schema: { type: boolean }
        - name: is_delisted
          in: query
          schema: { type: boolean }
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of the Publisher's listings.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          hoardings:
                            type: array
                            items: { $ref: "#/components/schemas/HoardingOwner" }
                      meta: { $ref: "#/components/schemas/PaginatedMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/publishers/me/requests:
    get:
      tags: [Publisher, Requests]
      operationId: listMyInboundRequests
      summary: The Publisher's request inbox
      description: |
        Ordered REQUESTED first, then sla_deadline ascending — an inbox acting on
        OWNER-002's clock, not a chronological feed.
      parameters:
        - $ref: "#/components/parameters/RequestStatusFilter"
        - name: hoarding_id
          in: query
          schema: { type: string, format: uuid }
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of requests on the Publisher's own listings.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          requests:
                            type: array
                            items: { $ref: "#/components/schemas/RequestResource" }
                      meta: { $ref: "#/components/schemas/RequestListMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/publishers/me/summary:
    get:
      tags: [Publisher]
      operationId: getMyPublisherSummary
      summary: Listing and request counts, plus recorded agreed value
      description: |
        confirmed_value is NOT revenue. It is the sum of amount_agreed where a value
        was recorded at all; SEEABLE neither collects nor verifies any of it.
      responses:
        "200":
          description: Publisher summary.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherSummary" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  # --------------------------------------------------------------- Viewer ---
  /api/v1/viewers/me:
    get:
      tags: [Viewer]
      operationId: getMyViewerProfile
      summary: The Viewer's own profile
      responses:
        "200":
          description: The Viewer profile.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/ViewerProfile" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
    patch:
      tags: [Viewer]
      operationId: updateMyViewerProfile
      summary: Update own profile fields
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/ViewerProfileUpdateRequest" }
      responses:
        "200":
          description: Updated profile.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/ViewerProfile" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  # -------------------------------------------------------- Notifications ---
  /api/v1/notifications:
    get:
      tags: [Notifications]
      operationId: listNotifications
      summary: The caller's in-app notification feed
      description: |
        In-app is the system of record; email is optional and its delivery status
        is deliberately not exposed. meta.unread_count spans all notifications,
        not just the current page.
      parameters:
        - name: unread_only
          in: query
          schema: { type: boolean, default: false }
        - name: type
          in: query
          schema: { $ref: "#/components/schemas/NotificationType" }
          description: Repeatable.
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of the caller's notifications.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          notifications:
                            type: array
                            items: { $ref: "#/components/schemas/Notification" }
                      meta:
                        allOf:
                          - $ref: "#/components/schemas/PaginatedMeta"
                          - type: object
                            properties:
                              unread_count: { type: integer, minimum: 0 }
        "401": { $ref: "#/components/responses/Unauthorized" }

  /api/v1/notifications/{notificationId}:
    parameters:
      - $ref: "#/components/parameters/NotificationIdParam"
    patch:
      tags: [Notifications]
      operationId: updateNotification
      summary: Mark a notification read or unread
      description: read_at is server-derived; only is_read is accepted.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [is_read]
              properties:
                is_read: { type: boolean }
              additionalProperties: false
      responses:
        "200":
          description: The updated notification.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/Notification" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "404": { $ref: "#/components/responses/NotFound" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  # ---------------------------------------------------------------- Admin ---
  /api/v1/admin/dashboard:
    get:
      tags: [Admin]
      operationId: getAdminDashboard
      summary: Platform counts (ADMIN dashboard, mvp-prd.md section 7.5)
      description: |
        listings.total counts every listing regardless of status (the platform-health
        reading); approved and live_in_search are returned so both readings of the
        ambiguous requirement are available without a second query.
      responses:
        "200":
          description: Dashboard counts.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/AdminDashboard" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/admin/hoardings:
    get:
      tags: [Admin]
      operationId: listAdminHoardings
      summary: The listing approval queue (all states visible to Admin)
      description: Ordered created_at ascending — oldest-waiting first.
      parameters:
        - $ref: "#/components/parameters/ApprovalStatusFilter"
        - name: publisher_id
          in: query
          schema: { type: string, format: uuid }
        - $ref: "#/components/parameters/TypeFilter"
        - name: site_intelligence_complete
          in: query
          schema: { type: boolean }
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of listings with review context.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          hoardings:
                            type: array
                            items: { $ref: "#/components/schemas/HoardingAdminQueueItem" }
                      meta: { $ref: "#/components/schemas/PaginatedMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/admin/hoardings/{hoardingId}/approve:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Admin]
      operationId: approveHoarding
      summary: Approve a listing (ADMIN-001)
      description: |
        Requires approval_status = PENDING_REVIEW, asserted under a row lock so two
        Admins acting simultaneously cannot both succeed. Viewer visibility follows
        automatically — INVENTORY-003 is a query-time predicate, so there is no
        window in which an unapproved listing is visible.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      responses:
        "200":
          description: Listing approved and now live in search.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/admin/hoardings/{hoardingId}/reject:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Admin]
      operationId: rejectHoarding
      summary: Reject a listing with a mandatory reason (ADMIN-003)
      description: |
        The reason is required and is enforced twice — in the function and by a
        CHECK constraint, so no write path can persist a rejected listing without one.
        The Publisher may edit and resubmit the same listing record.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                reason: { type: string, minLength: 1, maxLength: 1000 }
              additionalProperties: false
      responses:
        "200":
          description: Listing rejected.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }
        "422": { $ref: "#/components/responses/ValidationFailed" }

  /api/v1/admin/hoardings/{hoardingId}/delist:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Admin]
      operationId: delistHoarding
      summary: Remove a listing from Viewer search (ADMIN-004)
      description: |
        Independent of Publisher suspension in both directions. approval_status is
        unchanged, so relisting restores visibility without re-approval.
        Confirmed requests are unaffected.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                reason: { type: string, maxLength: 1000 }
              additionalProperties: false
      responses:
        "200":
          description: Listing delisted.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/admin/hoardings/{hoardingId}/relist:
    parameters:
      - $ref: "#/components/parameters/HoardingIdParam"
    post:
      tags: [Admin]
      operationId: relistHoarding
      summary: Reverse a delisting (RECOMMENDED — no source document describes it)
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      responses:
        "200":
          description: Listing relisted.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/HoardingOwner" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/admin/publishers:
    get:
      tags: [Admin]
      operationId: listAdminPublishers
      summary: The Publisher verification queue
      description: |
        The only place in this API where a user's phone and email are returned to
        anyone other than their owner. Admin-only, and required to make a
        verification decision about an account.
      parameters:
        - name: verification_status
          in: query
          schema: { $ref: "#/components/schemas/VerificationStatus" }
          description: Repeatable. Defaults to UNVERIFIED.
        - name: suspended
          in: query
          schema: { type: boolean }
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of Publisher records.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          publishers:
                            type: array
                            items: { $ref: "#/components/schemas/PublisherAdminRecord" }
                      meta: { $ref: "#/components/schemas/PaginatedMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  /api/v1/admin/publishers/{publisherId}:
    parameters:
      - $ref: "#/components/parameters/PublisherIdParam"
    get:
      tags: [Admin]
      operationId: getAdminPublisher
      summary: A single Publisher record for review
      responses:
        "200":
          description: The Publisher record.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherAdminRecord" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }

  /api/v1/admin/publishers/{publisherId}/verify:
    parameters:
      - $ref: "#/components/parameters/PublisherIdParam"
    post:
      tags: [Admin]
      operationId: verifyPublisher
      summary: Verify a Publisher (gates listing submission — OWNER-004)
      description: |
        Distinct from listing approval. Emits no notification — Publisher
        verification outcomes are not in mvp-prd.md section 7.6's event list.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      responses:
        "200":
          description: Publisher verified.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherAdminRecord" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }

  /api/v1/admin/publishers/{publisherId}/reject-verification:
    parameters:
      - $ref: "#/components/parameters/PublisherIdParam"
    post:
      tags: [Admin]
      operationId: rejectPublisherVerification
      summary: Reject a Publisher's verification
      description: |
        The reason is OPTIONAL — ADMIN-003 governs listing rejection only.
        What happens after a verification rejection (retry, cooldown, permanent
        block) is undefined in every source document and is not invented here.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                reason: { type: string, maxLength: 1000 }
              additionalProperties: false
      responses:
        "200":
          description: Verification rejected.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherAdminRecord" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }

  /api/v1/admin/publishers/{publisherId}/suspend:
    parameters:
      - $ref: "#/components/parameters/PublisherIdParam"
    post:
      tags: [Admin]
      operationId: suspendPublisher
      summary: Suspend a Publisher (ADMIN-002)
      description: |
        Blocks new listing submission ONLY. Never cancels an already-confirmed
        request, never delists any listing (ADMIN-004), and does not block login.
        Verification status is untouched, so unsuspending needs no state reconstruction.
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                reason: { type: string, maxLength: 1000 }
              additionalProperties: false
      responses:
        "200":
          description: Publisher suspended.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherAdminRecord" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/admin/publishers/{publisherId}/unsuspend:
    parameters:
      - $ref: "#/components/parameters/PublisherIdParam"
    post:
      tags: [Admin]
      operationId: unsuspendPublisher
      summary: Reverse a suspension (RECOMMENDED — no source document describes it)
      parameters:
        - $ref: "#/components/parameters/IdempotencyKeyHeader"
      responses:
        "200":
          description: Publisher unsuspended.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data: { $ref: "#/components/schemas/PublisherAdminRecord" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/Conflict" }

  /api/v1/admin/actions:
    get:
      tags: [Admin]
      operationId: listAdminActions
      summary: Moderation audit trail (RECOMMENDED — NOT the full-scope audit log)
      description: |
        A deliberately lightweight trail of the eight moderation action types.
        Not BR-ADMIN-003's compliance-grade audit log, which is full-scope only.
      parameters:
        - name: action_type
          in: query
          schema: { $ref: "#/components/schemas/AdminActionType" }
          description: Repeatable.
        - name: target_hoarding_id
          in: query
          schema: { type: string, format: uuid }
        - name: target_publisher_id
          in: query
          schema: { type: string, format: uuid }
        - name: admin_id
          in: query
          schema: { type: string, format: uuid }
        - name: from
          in: query
          schema: { type: string, format: date-time }
        - name: to
          in: query
          schema: { type: string, format: date-time }
        - $ref: "#/components/parameters/PageParam"
        - $ref: "#/components/parameters/PageSizeParam"
      responses:
        "200":
          description: A page of moderation actions.
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/SuccessEnvelope"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          actions:
                            type: array
                            items: { $ref: "#/components/schemas/AdminAction" }
                      meta: { $ref: "#/components/schemas/PaginatedMeta" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }

  # --------------------------------------------------------------- System ---
  /api/health:
    get:
      tags: [System]
      operationId: getHealth
      summary: Liveness and optional dependency readiness
      description: |
        Unenveloped by design — consumed by uptime probes, not application clients.
        Exposes no version, hostname, connection string, table name, or count.
        Storage failure is `degraded` (200), not `fail`, so a partial outage is not
        escalated into a total one.
      security: []
      parameters:
        - name: deep
          in: query
          required: false
          schema: { type: string, enum: ["1"] }
          description: Perform dependency checks. Rate-limited more tightly than the shallow check.
      responses:
        "200":
          description: Service is ok or degraded.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HealthResponse" }
        "503":
          description: The database is unreachable.
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HealthResponse" }

components:

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Supabase Auth access token. The `sub` claim becomes auth.uid() in every
        RLS policy and SECURITY DEFINER function. A role claim in the token is
        NEVER trusted — role is read server-side from profiles.role.

  headers:
    XRequestId:
      description: Correlation ID; matches request_id in the body.
      schema: { type: string }
    RetryAfter:
      description: Seconds to wait before retrying.
      schema: { type: integer, minimum: 0 }

  parameters:
    PageParam:
      name: page
      in: query
      required: false
      schema: { type: integer, minimum: 1, default: 1 }
      description: 1-based page number. Out of range returns an empty page, not 404.
    PageSizeParam:
      name: pageSize
      in: query
      required: false
      schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
      description: Response field is page_size (snake_case bodies, camelCase query params).
    HoardingIdParam:
      name: hoardingId
      in: path
      required: true
      schema: { type: string, format: uuid }
    MediaIdParam:
      name: mediaId
      in: path
      required: true
      schema: { type: string, format: uuid }
    RequestIdParam:
      name: requestId
      in: path
      required: true
      schema: { type: string, format: uuid }
    BlockIdParam:
      name: blockId
      in: path
      required: true
      schema: { type: string, format: uuid }
    NotificationIdParam:
      name: notificationId
      in: path
      required: true
      schema: { type: string, format: uuid }
    PublisherIdParam:
      name: publisherId
      in: path
      required: true
      schema: { type: string, format: uuid }
    IdempotencyKeyHeader:
      name: Idempotency-Key
      in: header
      required: false
      schema: { type: string, format: uuid }
      description: |
        Client-generated UUID. A repeat with the same key and body replays the stored
        response (with Idempotency-Replayed: true); a repeat with a different body
        returns 409 IDEMPOTENCY_KEY_CONFLICT. Keys are scoped per user and expire
        after 24 hours.
    TypeFilter:
      name: type
      in: query
      required: false
      schema: { $ref: "#/components/schemas/HoardingTypeCode" }
      description: Single-valued at MVP. Repeating it returns 400 INVALID_FILTER.
    CityFilter:
      name: city
      in: query
      required: false
      schema: { type: string, default: Bengaluru }
    LatitudeParam:
      name: latitude
      in: query
      required: false
      schema: { type: number, minimum: -90, maximum: 90 }
      description: Search centre. Required together with longitude and maxDistance.
    LongitudeParam:
      name: longitude
      in: query
      required: false
      schema: { type: number, minimum: -180, maximum: 180 }
    MaxDistanceParam:
      name: maxDistance
      in: query
      required: false
      schema: { type: number, exclusiveMinimum: 0 }
      description: Radius in KILOMETRES from (latitude, longitude).
    MaxPriceParam:
      name: maxPrice
      in: query
      required: false
      schema: { $ref: "#/components/schemas/Money" }
      description: Inclusive price ceiling, INR decimal string.
    StartDateFilter:
      name: startDate
      in: query
      required: false
      schema: { type: string, format: date }
      description: |
        RECOMMENDED, beyond the approved MVP filter set. mvp-prd.md section 7.3
        defines only type, distance, and budget; the data layer supports date
        availability filtering at no cost. Opt-in; must be supplied with endDate.
      x-seeable-status: RECOMMENDED_BEYOND_MVP
    EndDateFilter:
      name: endDate
      in: query
      required: false
      schema: { type: string, format: date }
      x-seeable-status: RECOMMENDED_BEYOND_MVP
    RequestStatusFilter:
      name: status
      in: query
      required: false
      schema: { $ref: "#/components/schemas/RequestStatus" }
      description: Repeatable; values OR together.
    ApprovalStatusFilter:
      name: approval_status
      in: query
      required: false
      schema: { $ref: "#/components/schemas/ApprovalStatus" }
      description: Repeatable; values OR together.

  responses:
    NoContent:
      description: Success, no body. X-Request-Id is still returned as a header.
      headers:
        X-Request-Id: { $ref: "#/components/headers/XRequestId" }
    BadRequest:
      description: Malformed request (BAD_REQUEST, INVALID_PAGINATION, INVALID_FILTER, GEO_PARAMS_INCOMPLETE).
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    Unauthorized:
      description: AUTH_REQUIRED, AUTH_TOKEN_INVALID, AUTH_TOKEN_EXPIRED, or AUTH_INVALID_CREDENTIALS.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    Forbidden:
      description: FORBIDDEN, FORBIDDEN_ROLE, FORBIDDEN_NOT_OWNER, ADMIN_ONLY, PUBLISHER_NOT_VERIFIED, PUBLISHER_SUSPENDED.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    NotFound:
      description: |
        The resource is absent, or invisible to this caller. Invisibility and
        non-existence are deliberately indistinguishable where existence is private.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    Conflict:
      description: A state or date precondition failed. See the error code for which.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    ValidationFailed:
      description: VALIDATION_ERROR with a per-field details.fields map.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ValidationErrorEnvelope" }
    RateLimited:
      description: RATE_LIMITED.
      headers:
        Retry-After: { $ref: "#/components/headers/RetryAfter" }
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    InternalError:
      description: INTERNAL_ERROR. Never leaks internal detail; correlate by request_id.
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }
    ServiceUnavailable:
      description: SERVICE_UNAVAILABLE or STORAGE_UNAVAILABLE.
      headers:
        Retry-After: { $ref: "#/components/headers/RetryAfter" }
      content:
        application/json:
          schema: { $ref: "#/components/schemas/ErrorEnvelope" }

  schemas:

    # ---------- envelopes ----------
    SuccessEnvelope:
      type: object
      required: [success, data, meta, request_id]
      properties:
        success: { type: boolean, const: true }
        data: {}
        meta: { type: object, default: {} }
        request_id: { type: string }

    ErrorEnvelope:
      type: object
      required: [success, error, request_id]
      properties:
        success: { type: boolean, const: false }
        error: { $ref: "#/components/schemas/ErrorDetails" }
        request_id: { type: string }

    ErrorDetails:
      type: object
      required: [code, message, details]
      properties:
        code:
          type: string
          description: Stable machine-readable code. Clients branch on this, never on message.
          examples: [REQUEST_DATE_CONFLICT, HOARDING_EDIT_FROZEN, PUBLISHER_NOT_VERIFIED]
        message:
          type: string
          description: One sentence, safe to display verbatim. No SQL, no stack trace, no internal identifier.
        details:
          type: object
          description: Machine-readable specifics; shape defined per code. {} when there is nothing to add.
          default: {}

    ValidationErrorEnvelope:
      allOf:
        - $ref: "#/components/schemas/ErrorEnvelope"
        - type: object
          properties:
            error:
              type: object
              properties:
                code: { type: string, const: VALIDATION_ERROR }
                details:
                  type: object
                  properties:
                    fields:
                      type: object
                      additionalProperties: { type: string }
                      description: Field path -> human-readable reason. All failures reported at once.

    Pagination:
      type: object
      required: [page, page_size, total, total_pages, has_next, has_previous]
      properties:
        page: { type: integer, minimum: 1 }
        page_size: { type: integer, minimum: 1, maximum: 100 }
        total: { type: integer, minimum: 0, description: After all filters AND all visibility predicates. }
        total_pages: { type: integer, minimum: 0 }
        has_next: { type: boolean }
        has_previous: { type: boolean }

    PaginatedMeta:
      type: object
      properties:
        pagination: { $ref: "#/components/schemas/Pagination" }
        filters_applied: { type: object, additionalProperties: true }

    RequestListMeta:
      allOf:
        - $ref: "#/components/schemas/PaginatedMeta"
        - type: object
          properties:
            counts_by_status:
              type: object
              description: Counts across the whole result set, not the current page.
              additionalProperties: { type: integer, minimum: 0 }

    # ---------- primitives ----------
    Money:
      type: string
      pattern: "^[0-9]{1,10}\\.[0-9]{2}$"
      description: |
        INR decimal string with exactly two fractional digits. Always a string,
        never a JSON number — it maps one-to-one onto numeric(12,2) with no
        conversion layer and no IEEE-754 rounding.
      examples: ["85000.00", "1250.50"]

    Role:
      type: string
      enum: [VIEWER, PUBLISHER, ADMIN]

    VerificationStatus:
      type: string
      enum: [UNVERIFIED, VERIFIED, REJECTED]

    ApprovalStatus:
      type: string
      enum: [DRAFT, PENDING_REVIEW, APPROVED, REJECTED]

    RequestStatus:
      type: string
      enum: [REQUESTED, CONFIRMED, REJECTED, EXPIRED, LIVE, COMPLETED]
      description: |
        Exactly six values. AVAILABLE is NOT a request status — it describes a
        hoarding's calendar condition. No payment states exist at MVP.

    RequestAction:
      type: string
      enum: [ACCEPT, REJECT, COMPLETE, SET_AMOUNT_AGREED]

    PriceUnit:
      type: string
      enum: [DAY, WEEK, MONTH]

    MediaKind:
      type: string
      enum: [IMAGE, VIDEO]

    ProcessingStatus:
      type: string
      enum: [UPLOADED, PROCESSING, WATERMARKED, FAILED]

    NotificationType:
      type: string
      enum:
        - REQUEST_CREATED
        - REQUEST_ACCEPTED
        - REQUEST_REJECTED
        - REQUEST_EXPIRED
        - REQUEST_EXPIRING_SOON
        - LISTING_APPROVED
        - LISTING_REJECTED

    AdminActionType:
      type: string
      enum:
        - LISTING_APPROVED
        - LISTING_REJECTED
        - PUBLISHER_VERIFIED
        - PUBLISHER_VERIFICATION_REJECTED
        - PUBLISHER_SUSPENDED
        - PUBLISHER_UNSUSPENDED
        - HOARDING_DELISTED
        - HOARDING_RELISTED

    HoardingTypeCode:
      type: string
      enum:
        - UNIPOLE_BILLBOARD
        - GANTRY
        - METRO_PILLAR
        - WALL_WRAP
        - TRANSIT_MEDIA
        - BUS_QUEUE_SHELTER
        - DIGITAL_BILLBOARD
        - DIGITAL_SCREEN
      description: |
        Six static types are listable at MVP. The two DIGITAL_* types exist in the
        taxonomy for forward compatibility and are NOT listable
        (422 HOARDING_TYPE_NOT_LISTABLE on create).

    # ---------- auth ----------
    RegisterRequest:
      type: object
      required: [role, full_name]
      properties:
        role: { type: string, enum: [VIEWER, PUBLISHER] }
        email: { type: string, format: email, maxLength: 254 }
        phone: { type: string, pattern: "^\\+[1-9][0-9]{7,18}$" }
        password: { type: string, minLength: 8, maxLength: 128 }
        full_name: { type: string, minLength: 1, maxLength: 120 }
        city: { type: string, maxLength: 80, default: Bengaluru }
        business_name: { type: string, maxLength: 200, description: PUBLISHER only; 422 if sent by a VIEWER. }
      anyOf:
        - required: [email]
        - required: [phone]
      additionalProperties: false

    LoginRequest:
      type: object
      required: [identifier, password]
      properties:
        identifier: { type: string, minLength: 3, description: Email address or E.164 phone number. }
        password: { type: string, minLength: 1 }
      additionalProperties: false

    VerifyOtpRequest:
      type: object
      required: [identifier, otp]
      properties:
        identifier: { type: string, minLength: 3 }
        otp: { type: string, pattern: "^[0-9]{6}$" }
        purpose: { type: string, enum: [SIGNUP, LOGIN, VERIFY_CONTACT], default: SIGNUP }
      additionalProperties: false

    Session:
      type: object
      required: [access_token, refresh_token, token_type, expires_in, expires_at]
      properties:
        access_token: { type: string }
        refresh_token: { type: string }
        token_type: { type: string, const: bearer }
        expires_in: { type: integer, description: Seconds. }
        expires_at: { type: string, format: date-time }

    VerificationState:
      type: object
      properties:
        otp_required: { type: boolean, description: Reflects AUTH_OTP_ENABLED without exposing the flag. }
        otp_sent: { type: boolean }
        publisher_verification_status:
          oneOf:
            - $ref: "#/components/schemas/VerificationStatus"
            - type: "null"
        publisher_suspended: { type: [boolean, "null"] }
        can_submit_listings: { type: boolean, description: Server-computed OWNER-004 + ADMIN-002 gate result. }
        can_create_requests: { type: boolean, description: Server-computed AUTH-002 gate result. }

    AuthResult:
      type: object
      required: [user, verification]
      properties:
        user: { $ref: "#/components/schemas/UserSummary" }
        verification: { $ref: "#/components/schemas/VerificationState" }
        session:
          oneOf:
            - $ref: "#/components/schemas/Session"
            - type: "null"
          description: Null when OTP verification is still outstanding.

    UserSummary:
      type: object
      required: [id, role, full_name, created_at]
      properties:
        id: { type: string, format: uuid }
        role: { $ref: "#/components/schemas/Role" }
        email: { type: [string, "null"], format: email }
        phone: { type: [string, "null"] }
        full_name: { type: [string, "null"] }
        city: { type: [string, "null"] }
        created_at: { type: string, format: date-time }

    CurrentIdentity:
      allOf:
        - $ref: "#/components/schemas/UserSummary"
        - type: object
          properties:
            updated_at: { type: string, format: date-time }
            verification: { $ref: "#/components/schemas/VerificationState" }
            publisher_profile:
              oneOf:
                - $ref: "#/components/schemas/PublisherProfileEmbedded"
                - type: "null"

    PublisherProfileEmbedded:
      type: object
      properties:
        business_name: { type: [string, "null"] }
        verification_status: { $ref: "#/components/schemas/VerificationStatus" }
        verified_at: { type: [string, "null"], format: date-time }
        suspended: { type: boolean }

    # ---------- inventory ----------
    HoardingType:
      type: object
      required: [code, display_name, is_digital, is_listable, required_attribute_keys]
      properties:
        code: { $ref: "#/components/schemas/HoardingTypeCode" }
        display_name: { type: string }
        is_digital: { type: boolean }
        is_listable:
          type: boolean
          description: Derived as NOT is_digital. Digital types are taxonomy-only at MVP.
        required_attribute_keys:
          type: array
          items: { type: string }
          description: The INVENTORY-001 field set for this type. Clients must not hardcode it.
        description: { type: [string, "null"] }

    HoardingTypeSummary:
      type: object
      required: [code, display_name, is_digital]
      properties:
        code: { $ref: "#/components/schemas/HoardingTypeCode" }
        display_name: { type: string }
        is_digital: { type: boolean }

    PublisherPublic:
      type: object
      required: [id, business_name, is_verified]
      description: |
        Exactly three fields, deliberately. phone, email, and full_name are NEVER
        exposed to a Viewer at any request state — the disintermediation boundary
        (mvp-brd.md section 12).
      properties:
        id: { type: string, format: uuid }
        business_name: { type: [string, "null"] }
        is_verified: { type: boolean }

    Location:
      type: object
      properties:
        latitude: { type: [number, "null"], minimum: -90, maximum: 90 }
        longitude: { type: [number, "null"], minimum: -180, maximum: 180 }
        locality: { type: [string, "null"] }
        city: { type: string }
        address_text: { type: [string, "null"] }

    HoardingAttributes:
      description: |
        Type-specific attributes, stored as jsonb. The applicable shape is selected
        by the listing's type_code. Additional keys are permitted and preserved;
        INVENTORY-001 requires only that the type's required keys be present at
        submission.
      oneOf:
        - $ref: "#/components/schemas/UnipoleAttributes"
        - $ref: "#/components/schemas/GantryAttributes"
        - $ref: "#/components/schemas/MetroPillarAttributes"
        - $ref: "#/components/schemas/WallWrapAttributes"
        - $ref: "#/components/schemas/TransitMediaAttributes"
        - $ref: "#/components/schemas/BusQueueShelterAttributes"
        - $ref: "#/components/schemas/DigitalBillboardAttributes"
        - $ref: "#/components/schemas/DigitalScreenAttributes"

    UnipoleAttributes:
      type: object
      title: UNIPOLE_BILLBOARD
      properties:
        pole_height: { type: number, description: Metres or feet — unit undefined in source (OPEN QUESTION). }
        facing_direction: { type: string, examples: [north, south, east, west] }
        road_name: { type: string }
        visibility_distance: { type: number, description: Approach visibility distance. }
        height_ft: { type: number }
        width_ft: { type: number }
        illumination: { type: string, examples: [backlit, frontlit, non-lit] }
      additionalProperties: true

    GantryAttributes:
      type: object
      title: GANTRY
      properties:
        span_width: { type: number }
        road_spanned: { type: string }
        clearance_height: { type: number }
        height_ft: { type: number }
        width_ft: { type: number }
        illumination: { type: string }
        road_name: { type: string }
      additionalProperties: true

    MetroPillarAttributes:
      type: object
      title: METRO_PILLAR
      properties:
        metro_line: { type: string }
        pillar_number: { type: string }
        nearest_station: { type: string }
        platform_facing: { type: boolean }
        height_ft: { type: number }
        width_ft: { type: number }
      additionalProperties: true

    WallWrapAttributes:
      type: object
      title: WALL_WRAP
      properties:
        building_name: { type: string }
        wrap_area: { type: number }
        floors_covered: { type: integer }
        height_ft: { type: number }
        width_ft: { type: number }
        wrap_type: { type: string }
      additionalProperties: true

    TransitMediaAttributes:
      type: object
      title: TRANSIT_MEDIA
      properties:
        vehicle_type: { type: string, examples: [bus, cab, auto] }
        route_number: { type: string }
        fleet_operator: { type: string }
        vehicle_registration: { type: string }
        media_position: { type: string, examples: [rear, side-left, side-right, full-wrap] }
      additionalProperties: true

    BusQueueShelterAttributes:
      type: object
      title: BUS_QUEUE_SHELTER
      properties:
        shelter_id: { type: string }
        routes:
          type: array
          items: { type: string }
          description: Route(s) served.
        height_ft: { type: number }
        width_ft: { type: number }
        illumination: { type: string }
      additionalProperties: true

    DigitalBillboardAttributes:
      type: object
      title: DIGITAL_BILLBOARD
      description: Data model only — NOT listable at MVP.
      properties:
        resolution: { type: string }
        pixel_pitch: { type: number }
        brightness: { type: number }
        loop_duration: { type: number }
        slot_count: { type: integer }
      additionalProperties: true

    DigitalScreenAttributes:
      type: object
      title: DIGITAL_SCREEN
      description: Data model only — NOT listable at MVP.
      properties:
        network_id: { type: string }
        zone: { type: string }
        resolution: { type: string }
        orientation: { type: string }
      additionalProperties: true

    SiteIntelligence:
      type: object
      description: |
        Optional and informational at MVP (INVENTORY-002). Absent fields are OMITTED,
        never returned as 0 or "" — an unknown footfall and a footfall of zero must
        not look alike. No pricing, ranking, or recommendation logic reads this.
      properties:
        footfall: { type: integer, minimum: 0 }
        footfall_source: { type: string, enum: [SENSOR, THIRD_PARTY, SELF_REPORTED] }
        traffic_split:
          type: object
          properties:
            vehicular: { type: number, minimum: 0, maximum: 1 }
            pedestrian: { type: number, minimum: 0, maximum: 1 }
        demographics:
          type: object
          properties:
            age_bands: { type: object, additionalProperties: { type: number } }
            gender_split: { type: object, additionalProperties: { type: number } }
            sec_class: { type: object, additionalProperties: { type: number } }
        commute_mode_split: { type: object, additionalProperties: { type: number } }
        dwell_time_seconds: { type: number, minimum: 0 }
        peak_off_peak_curve: { type: object, additionalProperties: { type: number } }
        nearby_pois:
          type: array
          items:
            type: object
            properties:
              name: { type: string }
              category: { type: string }
              distance_m: { type: number }
        data_recency: { type: string, format: date }
        confidence_flag: { type: string, enum: [LOW, MEDIUM, HIGH] }
      additionalProperties: true

    HoardingMedia:
      type: object
      required: [id, media_type, is_primary, display_order]
      properties:
        id: { type: string, format: uuid }
        hoarding_id: { type: string, format: uuid }
        media_type: { $ref: "#/components/schemas/MediaKind" }
        url:
          type: [string, "null"]
          format: uri
          description: |
            Resolves to the WATERMARKED derivative only. Null while processing.
            No response at any privilege level returns a URL to an unwatermarked
            original (CONTENT-001).
        is_primary: { type: boolean }
        display_order: { type: integer, minimum: 0 }
        processing_status:
          $ref: "#/components/schemas/ProcessingStatus"
          description: Owner/Admin projection only.
        watermarked_at: { type: [string, "null"], format: date-time }
        has_original:
          type: boolean
          description: Owner/Admin only. A boolean, never the path.
        created_at: { type: string, format: date-time }

    OriginalMediaLink:
      type: object
      required: [media_id, download_url, expires_at]
      properties:
        media_id: { type: string, format: uuid }
        download_url: { type: string, format: uri, description: Short-lived signed URL (300 s). }
        expires_at: { type: string, format: date-time }

    AvailabilitySummary:
      type: object
      properties:
        is_listed: { type: boolean, description: INVENTORY-003 satisfied. }
        next_available_date: { type: [string, "null"], format: date }

    HoardingPublic:
      type: object
      required: [id, publisher, title, type, price, price_unit, currency, location, created_at]
      properties:
        id: { type: string, format: uuid }
        publisher: { $ref: "#/components/schemas/PublisherPublic" }
        title: { type: string, maxLength: 200 }
        description: { type: [string, "null"] }
        type: { $ref: "#/components/schemas/HoardingTypeSummary" }
        size: { type: [string, "null"], description: Free text — the unit is an unresolved OPEN QUESTION. }
        price: { $ref: "#/components/schemas/Money" }
        price_unit: { $ref: "#/components/schemas/PriceUnit" }
        currency: { type: string, const: INR }
        location: { $ref: "#/components/schemas/Location" }
        attributes: { $ref: "#/components/schemas/HoardingAttributes" }
        site_intelligence: { $ref: "#/components/schemas/SiteIntelligence" }
        site_intelligence_complete: { type: boolean }
        media:
          type: array
          items: { $ref: "#/components/schemas/HoardingMedia" }
        availability_summary: { $ref: "#/components/schemas/AvailabilitySummary" }
        distance_km:
          type: [number, "null"]
          description: Present only when latitude and longitude were supplied.
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    SubmissionBlocker:
      type: object
      required: [code, message]
      properties:
        code: { type: string, examples: [HOARDING_MEDIA_NOT_WATERMARKED, HOARDING_INCOMPLETE_ATTRIBUTES] }
        message: { type: string }

    HoardingOwner:
      allOf:
        - $ref: "#/components/schemas/HoardingPublic"
        - type: object
          required: [approval_status, is_paused, is_delisted]
          properties:
            approval_status: { $ref: "#/components/schemas/ApprovalStatus" }
            rejection_reason: { type: [string, "null"] }
            approved_at: { type: [string, "null"], format: date-time }
            approved_by:
              type: [string, "null"]
              format: uuid
              description: Admin projection only — never returned to the owning Publisher.
            is_paused: { type: boolean }
            paused_at: { type: [string, "null"], format: date-time }
            is_delisted: { type: boolean }
            delisted_at: { type: [string, "null"], format: date-time }
            delisted_by: { type: [string, "null"], format: uuid, description: Admin projection only. }
            delist_reason: { type: [string, "null"] }
            submission_readiness:
              type: object
              properties:
                can_submit: { type: boolean }
                blockers:
                  type: array
                  items: { $ref: "#/components/schemas/SubmissionBlocker" }
            pending_request_count: { type: integer, minimum: 0 }
            is_edit_frozen: { type: boolean, description: OWNER-003 — true while any REQUESTED request exists. }

    ReviewFlag:
      type: object
      required: [code, severity, message]
      properties:
        code: { type: string, examples: [SITE_INTELLIGENCE_INCOMPLETE, PUBLISHER_UNVERIFIED] }
        severity: { type: string, enum: [INFO, WARNING] }
        message: { type: string }

    HoardingAdminQueueItem:
      allOf:
        - $ref: "#/components/schemas/HoardingOwner"
        - type: object
          properties:
            publisher:
              type: object
              properties:
                id: { type: string, format: uuid }
                business_name: { type: [string, "null"] }
                verification_status: { $ref: "#/components/schemas/VerificationStatus" }
                suspended: { type: boolean }
            review_flags:
              type: array
              items: { $ref: "#/components/schemas/ReviewFlag" }
              description: |
                Only flags a rule names. No quality heuristics — Content Moderation
                Guidelines do not exist (README.md Tier 1 item 12).
            media_summary:
              type: object
              properties:
                total: { type: integer }
                watermarked: { type: integer }
                processing: { type: integer }
                failed: { type: integer }
            submitted_at: { type: [string, "null"], format: date-time }

    HoardingCreateRequest:
      type: object
      required: [type_code, title]
      description: |
        Only type_code and title are required at creation. price, coordinates,
        type-specific attributes, and media are enforced at submission, so a
        Publisher can save an incomplete draft. Server-owned fields are refused.
      properties:
        type_code: { $ref: "#/components/schemas/HoardingTypeCode" }
        title: { type: string, minLength: 1, maxLength: 200 }
        description: { type: string, maxLength: 5000 }
        size: { type: string, maxLength: 100 }
        price: { $ref: "#/components/schemas/Money" }
        price_unit: { $ref: "#/components/schemas/PriceUnit" }
        latitude: { type: number, minimum: -90, maximum: 90 }
        longitude: { type: number, minimum: -180, maximum: 180 }
        locality: { type: string, maxLength: 120 }
        city: { type: string, maxLength: 80, default: Bengaluru }
        address_text: { type: string, maxLength: 500 }
        attributes: { $ref: "#/components/schemas/HoardingAttributes" }
        site_intelligence: { $ref: "#/components/schemas/SiteIntelligence" }
      additionalProperties: false

    HoardingUpdateRequest:
      type: object
      minProperties: 1
      description: |
        Partial update. type_code is immutable after creation. approval_status and
        every moderation field are refused with 422 — they are never client-writable.
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        description: { type: [string, "null"], maxLength: 5000 }
        size: { type: [string, "null"], maxLength: 100 }
        price: { $ref: "#/components/schemas/Money" }
        price_unit: { $ref: "#/components/schemas/PriceUnit" }
        latitude: { type: number, minimum: -90, maximum: 90 }
        longitude: { type: number, minimum: -180, maximum: 180 }
        locality: { type: [string, "null"], maxLength: 120 }
        city: { type: string, maxLength: 80 }
        address_text: { type: [string, "null"], maxLength: 500 }
        attributes: { $ref: "#/components/schemas/HoardingAttributes" }
        site_intelligence: { $ref: "#/components/schemas/SiteIntelligence" }
        is_paused: { type: boolean, description: Exempt from the OWNER-003 edit freeze. }
      additionalProperties: false

    # ---------- availability ----------
    UnavailableRange:
      type: object
      required: [start_date, end_date, reason]
      properties:
        start_date: { type: string, format: date }
        end_date: { type: string, format: date }
        reason:
          type: string
          enum: [BOOKED, BLOCKED]
          description: |
            Deliberately coarse. Never a viewer id, request id, or Publisher note —
            an availability feed that identified who booked what would be a
            competitive-intelligence side channel around request privacy.

    AvailabilityResult:
      type: object
      required: [hoarding_id, window, is_listed, unavailable_ranges]
      properties:
        hoarding_id: { type: string, format: uuid }
        window:
          type: object
          properties:
            from: { type: string, format: date }
            to: { type: string, format: date }
        is_listed: { type: boolean }
        unavailable_ranges:
          type: array
          items: { $ref: "#/components/schemas/UnavailableRange" }
          description: Merged, non-overlapping, ascending. Inclusive on both endpoints.
        is_available:
          type: [boolean, "null"]
          description: Present only when start_date and end_date were supplied.
        requested_range:
          oneOf:
            - type: object
              properties:
                start_date: { type: string, format: date }
                end_date: { type: string, format: date }
            - type: "null"

    AvailabilityBlock:
      type: object
      required: [id, hoarding_id, start_date, end_date, created_at]
      properties:
        id: { type: string, format: uuid }
        hoarding_id: { type: string, format: uuid }
        start_date: { type: string, format: date }
        end_date: { type: string, format: date }
        reason: { type: [string, "null"], description: Publisher-private; never returned to a Viewer. }
        created_at: { type: string, format: date-time }

    AvailabilityBlockCreateRequest:
      type: object
      required: [start_date, end_date]
      properties:
        start_date: { type: string, format: date }
        end_date: { type: string, format: date }
        reason: { type: string, maxLength: 200 }
      additionalProperties: false

    # ---------- requests ----------
    HoardingSummary:
      type: object
      required: [id, title, type_code]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        type_code: { $ref: "#/components/schemas/HoardingTypeCode" }
        locality: { type: [string, "null"] }
        city: { type: [string, "null"] }
        price: { $ref: "#/components/schemas/Money" }
        price_unit: { $ref: "#/components/schemas/PriceUnit" }
        currency: { type: string, const: INR }
        primary_media_url: { type: [string, "null"], format: uri }
        is_currently_listed:
          type: boolean
          description: |
            False when the listing no longer satisfies INVENTORY-003. The summary is
            still served, so a request never resolves to a broken reference.

    PartySummary:
      type: object
      required: [id]
      description: Display identity only. Never phone, email, or address.
      properties:
        id: { type: string, format: uuid }
        full_name: { type: [string, "null"] }
        business_name: { type: [string, "null"] }

    RequestResource:
      type: object
      required: [id, hoarding, start_date, end_date, duration_days, status, status_label, created_at]
      properties:
        id: { type: string, format: uuid }
        hoarding: { $ref: "#/components/schemas/HoardingSummary" }
        viewer: { $ref: "#/components/schemas/PartySummary" }
        publisher: { $ref: "#/components/schemas/PartySummary" }
        start_date: { type: string, format: date }
        end_date: { type: string, format: date }
        duration_days:
          type: integer
          minimum: 1
          description: end_date - start_date + 1. Both endpoints are inclusive.
        status: { $ref: "#/components/schemas/RequestStatus" }
        status_label: { type: string, description: Role-scoped display label, server-supplied. }
        message: { type: [string, "null"] }
        rejection_reason: { type: [string, "null"], description: Optional on Publisher rejection, unlike ADMIN-003. }
        amount_agreed:
          oneOf:
            - $ref: "#/components/schemas/Money"
            - type: "null"
          description: Record-keeping only. Never collected, never enforced, never computed with.
        sla_deadline: { type: [string, "null"], format: date-time }
        sla_hours_remaining: { type: [number, "null"], description: Derived; negative when overdue and unswept. }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }
        responded_at: { type: [string, "null"], format: date-time, description: Derived from status history. }
        confirmed_at: { type: [string, "null"], format: date-time }
        rejected_at: { type: [string, "null"], format: date-time }
        expired_at: { type: [string, "null"], format: date-time }
        live_at: { type: [string, "null"], format: date-time }
        completed_at: { type: [string, "null"], format: date-time }
        available_actions:
          type: array
          items: { $ref: "#/components/schemas/RequestAction" }
          description: Actions this caller may perform right now. Always empty for a Viewer.

    RequestCreateRequest:
      type: object
      required: [hoarding_id, start_date, end_date]
      properties:
        hoarding_id: { type: string, format: uuid }
        start_date: { type: string, format: date }
        end_date: { type: string, format: date, description: Inclusive; must be on or after start_date. }
        message: { type: string, maxLength: 1000 }
      additionalProperties: false

    RequestActionRequest:
      type: object
      required: [action]
      description: |
        The client requests an ACTION; the server determines the resulting state.
        A body containing `status` is rejected with 422 — status is never client-writable.
      properties:
        action: { $ref: "#/components/schemas/RequestAction" }
        reason: { type: string, maxLength: 500, description: REJECT only, and optional. }
        amount_agreed:
          allOf: [{ $ref: "#/components/schemas/Money" }]
          description: SET_AMOUNT_AGREED only.
      additionalProperties: false
      allOf:
        - if:
            properties: { action: { const: SET_AMOUNT_AGREED } }
            required: [action]
          then:
            required: [amount_agreed]
        - if:
            properties: { action: { enum: [ACCEPT, COMPLETE] } }
            required: [action]
          then:
            not:
              anyOf:
                - required: [reason]
                - required: [amount_agreed]

    RequestStatusHistoryEntry:
      type: object
      required: [to_status, changed_at]
      properties:
        from_status:
          oneOf:
            - $ref: "#/components/schemas/RequestStatus"
            - type: "null"
          description: Null on the initial creation entry.
        to_status: { $ref: "#/components/schemas/RequestStatus" }
        changed_by:
          oneOf:
            - type: object
              properties:
                id: { type: string, format: uuid }
                role: { $ref: "#/components/schemas/Role" }
            - type: "null"
          description: Null for system transitions (SLA expiry, CONFIRMED to LIVE).
        changed_at: { type: string, format: date-time }
        note: { type: [string, "null"] }

    # ---------- profiles ----------
    ViewerProfile:
      type: object
      required: [id, created_at]
      properties:
        id: { type: string, format: uuid }
        full_name: { type: [string, "null"] }
        phone: { type: [string, "null"] }
        email: { type: [string, "null"], format: email }
        city: { type: [string, "null"] }
        created_at: { type: string, format: date-time }
        updated_at: { type: string, format: date-time }

    ViewerProfileUpdateRequest:
      type: object
      minProperties: 1
      properties:
        full_name: { type: string, minLength: 1, maxLength: 120 }
        phone: { type: string, pattern: "^\\+[1-9][0-9]{7,18}$" }
        email: { type: string, format: email, maxLength: 254 }
        city: { type: string, maxLength: 80 }
      additionalProperties: false

    PublisherProfileSelf:
      allOf:
        - $ref: "#/components/schemas/ViewerProfile"
        - type: object
          properties:
            business_name: { type: [string, "null"] }
            verification_status: { $ref: "#/components/schemas/VerificationStatus" }
            verified_at: { type: [string, "null"], format: date-time }
            verification_rejection_reason: { type: [string, "null"] }
            suspended: { type: boolean }
            suspended_at: { type: [string, "null"], format: date-time }
            suspension_reason: { type: [string, "null"] }
            can_submit_listings: { type: boolean }

    PublisherProfileUpdateRequest:
      type: object
      minProperties: 1
      properties:
        full_name: { type: string, minLength: 1, maxLength: 120 }
        phone: { type: string, pattern: "^\\+[1-9][0-9]{7,18}$" }
        email: { type: string, format: email, maxLength: 254 }
        city: { type: string, maxLength: 80 }
        business_name: { type: [string, "null"], maxLength: 200 }
      additionalProperties: false

    PublisherAdminRecord:
      allOf:
        - $ref: "#/components/schemas/PublisherProfileSelf"
        - type: object
          properties:
            suspended_by:
              oneOf:
                - type: object
                  properties:
                    id: { type: string, format: uuid }
                    label: { type: string }
                - type: "null"
            listing_counts:
              type: object
              additionalProperties: { type: integer, minimum: 0 }

    PublisherSummary:
      type: object
      properties:
        listings:
          type: object
          additionalProperties: { type: integer, minimum: 0 }
        requests:
          type: object
          additionalProperties: { type: integer, minimum: 0 }
        confirmed_value:
          type: object
          description: NOT revenue. SEEABLE neither collects nor verifies any of it.
          properties:
            amount: { $ref: "#/components/schemas/Money" }
            currency: { type: string, const: INR }
            basis: { type: string }
        verification_status: { $ref: "#/components/schemas/VerificationStatus" }
        suspended: { type: boolean }

    # ---------- notifications & admin ----------
    Notification:
      type: object
      required: [id, type, title, message, is_read, created_at]
      properties:
        id: { type: string, format: uuid }
        type: { $ref: "#/components/schemas/NotificationType" }
        title: { type: string }
        message: { type: string }
        related_hoarding_id: { type: [string, "null"], format: uuid }
        related_request_id: { type: [string, "null"], format: uuid }
        is_read: { type: boolean }
        read_at: { type: [string, "null"], format: date-time }
        created_at: { type: string, format: date-time }

    AdminAction:
      type: object
      required: [id, action_type, admin, created_at]
      properties:
        id: { type: string, format: uuid }
        action_type: { $ref: "#/components/schemas/AdminActionType" }
        admin:
          type: object
          properties:
            id: { type: [string, "null"], format: uuid, description: Null once the account is removed. }
            label: { type: string, description: Denormalized snapshot, so the row stays readable. }
        target_hoarding_id: { type: [string, "null"], format: uuid }
        target_publisher_id: { type: [string, "null"], format: uuid }
        reason: { type: [string, "null"] }
        created_at: { type: string, format: date-time }

    AdminDashboard:
      type: object
      required: [listings, requests, generated_at]
      properties:
        listings:
          type: object
          properties:
            total: { type: integer, description: Every listing regardless of status (platform-health reading). }
            pending_approval: { type: integer }
            approved: { type: integer }
            live_in_search: { type: integer, description: INVENTORY-003 satisfied. }
        requests:
          type: object
          properties:
            total: { type: integer }
            confirmed: { type: integer, description: CONFIRMED, LIVE, and COMPLETED. }
            confirmation_rate_pct: { type: number }
        publishers:
          type: object
          properties:
            total: { type: integer }
            verified: { type: integer }
        generated_at: { type: string, format: date-time }

    HealthResponse:
      type: object
      required: [status, service, time]
      properties:
        status: { type: string, enum: [ok, degraded, fail] }
        service: { type: string, const: seeable-api }
        time: { type: string, format: date-time }
        checks:
          type: object
          properties:
            database:
              type: object
              properties:
                status: { type: string, enum: [ok, fail] }
                latency_ms: { type: number }
            storage:
              type: object
              properties:
                status: { type: string, enum: [ok, fail] }
                latency_ms: { type: number }
```

---

## 38. Data Schemas

The authoritative definitions are the OpenAPI `components/schemas` in §37. This section is the human-readable index — what each schema is, where it comes from, and the decisions embedded in it.

### 38.1 Schema catalogue

| Schema | Backed by | Notes |
|---|---|---|
| `UserSummary` | `profiles` | Identity fields shared by every role |
| `CurrentIdentity` | `profiles` + `publisher_profiles` | `GET /auth/me`; adds computed capability flags |
| `ViewerProfile` | `profiles` | Exactly `mvp-prd.md` §7.1's minimal profile |
| `PublisherProfileSelf` | `profiles` + `publisher_profiles` | The Publisher's own view; excludes `suspended_by` |
| `PublisherAdminRecord` | Same | Admin view; adds `suspended_by`, `listing_counts` |
| `PublisherPublic` | `publisher_profiles` | **Exactly three fields** — the disintermediation boundary (§23.4) |
| `PartySummary` | `profiles` / `publisher_profiles` | Counterparty display identity on a request. Never contact details |
| `HoardingType` | `hoarding_types` | Includes `required_attribute_keys` — the `INVENTORY-001` source of truth |
| `HoardingPublic` | `hoardings` + joins | Viewer-facing. **No `approval_status`** — it would carry no information |
| `HoardingOwner` | Same | Adds moderation state, `submission_readiness`, `is_edit_frozen` |
| `HoardingAdminQueueItem` | Same | Adds `review_flags`, `media_summary`, Publisher trust state |
| `HoardingSummary` | `hoardings` | Embedded in a Request; carries `is_currently_listed` |
| `HoardingAttributes` | `hoardings.attributes` | `oneOf` across eight type shapes (§39) |
| `SiteIntelligence` | `hoardings.site_intelligence` | Every field optional (`INVENTORY-002`); absent fields omitted, never zeroed |
| `HoardingMedia` | `hoarding_media` | `url` resolves to the watermarked derivative only |
| `OriginalMediaLink` | — | Short-lived signed URL; the only route to a private original |
| `AvailabilityBlock` | `hoarding_availability_blocks` | `reason` is Publisher-private |
| `UnavailableRange` | Computed | Merged; `reason` is `BOOKED` or `BLOCKED` and nothing more |
| `AvailabilityResult` | Computed | The three-input composition (§15.1) |
| `RequestResource` | `requests` + joins | The Request Engine's public shape |
| `RequestStatusHistoryEntry` | `request_status_history` | `changed_by: null` means a system transition |
| `Notification` | `notifications` | In-app is the system of record |
| `AdminAction` | `admin_actions` | Lightweight moderation trail, **not** the full-scope audit log |
| `AdminDashboard` | `admin_dashboard_summary()` | The four required metrics plus the two that disambiguate them |
| `Pagination`, `PaginatedMeta`, `RequestListMeta` | — | §9 |
| `SuccessEnvelope`, `ErrorEnvelope`, `ErrorDetails`, `ValidationErrorEnvelope` | — | §7, §8 |
| `Money` | `numeric(12,2)` | Decimal string, exactly two fractional digits (§4.6) |
| `Session`, `AuthResult`, `VerificationState` | Supabase Auth + `publisher_profiles` | §5 |
| `HealthResponse` | — | Unenveloped (§29) |

**Schemas that deliberately do NOT exist**, because the concepts do not exist at MVP: `Payment`, `Invoice`, `Contract`, `Campaign`, `Commission`, `Agency`, `Escrow`, `Device`, `Creative`, `AuditEvent` (generic), `SearchRanking`. See §45.

### 38.2 Enumerations

Every enum matches a database `CHECK` vocabulary verbatim (`database-design.md` §28.12). **No value in this API exists that the database would reject, and no database value is missing here.**

```text
Role                 VIEWER · PUBLISHER · ADMIN
VerificationStatus   UNVERIFIED · VERIFIED · REJECTED
ApprovalStatus       DRAFT · PENDING_REVIEW · APPROVED · REJECTED
RequestStatus        REQUESTED · CONFIRMED · REJECTED · EXPIRED · LIVE · COMPLETED
RequestAction        ACCEPT · REJECT · COMPLETE · SET_AMOUNT_AGREED
PriceUnit            DAY · WEEK · MONTH
MediaKind            IMAGE · VIDEO
ProcessingStatus     UPLOADED · PROCESSING · WATERMARKED · FAILED
NotificationType     REQUEST_CREATED · REQUEST_ACCEPTED · REQUEST_REJECTED ·
                     REQUEST_EXPIRED · REQUEST_EXPIRING_SOON ·
                     LISTING_APPROVED · LISTING_REJECTED
AdminActionType      LISTING_APPROVED · LISTING_REJECTED ·
                     PUBLISHER_VERIFIED · PUBLISHER_VERIFICATION_REJECTED ·
                     PUBLISHER_SUSPENDED · PUBLISHER_UNSUSPENDED ·
                     HOARDING_DELISTED · HOARDING_RELISTED
HoardingTypeCode     UNIPOLE_BILLBOARD · GANTRY · METRO_PILLAR · WALL_WRAP ·
                     TRANSIT_MEDIA · BUS_QUEUE_SHELTER ·
                     DIGITAL_BILLBOARD · DIGITAL_SCREEN
UnavailableReason    BOOKED · BLOCKED
```

**Three things that are NOT enum values, each for a stated reason:**

- **`AVAILABLE` is not a `RequestStatus`.** It describes a hoarding's calendar condition, not a request record (`request-engine.md` §6). Adding it would create a seventh state with no transitions.
- **`SUSPENDED` is not a `VerificationStatus`.** Suspension is an independent boolean, so unsuspending never has to reconstruct the prior verification state (`database-design.md` §17). `admin-platform.md` §14.1's four-state model is the alternative reading, and §46 carries it.
- **`DELISTED` is not an `ApprovalStatus`.** `is_delisted` and `is_paused` are independent flags layered on `approval_status`, so a delisted listing stays `APPROVED` and relisting restores visibility without re-approval (`inventory.md` §14–§15).

### 38.3 Field-name consistency

Every response field name matches its `database-design.md` §28 column name exactly, with three documented exceptions:

| API field | Column | Why it differs |
|---|---|---|
| `type` (object) | `type_code` | Expanded to `{code, display_name, is_digital}` so clients render a label without a hardcoded map. `type_code` remains the raw value inside |
| `location` (object) | `latitude`, `longitude`, `locality`, `city`, `address_text` | Grouped, because they are always read and written together |
| `responded_at` | *(none)* | Derived from `request_status_history`. `request-engine.md` §26 names the field; `database-design.md` computes it rather than storing it |

---

## 39. Hoarding Type Schemas

### 39.1 Structure

Every listing has exactly one `type_code` and carries the **shared base fields** (location, size, price, availability, media) plus a **type-specific attribute set** in `attributes` (`mvp-prd.md` §8, `inventory.md` §7).

`attributes` is `jsonb`, per `mvp-prd.md` §10's explicit NFR that type-specific attributes be stored as structured JSON *"so new hoarding types and future payment fields can be added without a schema rewrite."* The API mirrors that: **there is no separate endpoint per hoarding type**, and adding a ninth type requires no API change — it is a row in `hoarding_types` and a new `oneOf` branch in the OpenAPI document.

**Validation is a submission gate, not a write gate.** `attributes` is stored as supplied on create and update; `INVENTORY-001` completeness is checked only at `POST /hoardings/{id}/submit`, against `hoarding_types.required_attribute_keys` (§12.5 gate 7). Unknown keys are preserved, never stripped — a Publisher's extra detail is not the API's to discard.

### 39.2 The six static types (live and listable at MVP)

**`UNIPOLE_BILLBOARD` — Unipole / Bulletin Billboard**

| Field | Type | Source |
|---|---|---|
| `pole_height` | number | `mvp-prd.md` §8 |
| `facing_direction` | string | §8 |
| `road_name` | string | §8 |
| `visibility_distance` | number | §8 |
| `height_ft`, `width_ft`, `illumination` | number, number, string | `database-design.md` §42.1 seed |

**`GANTRY`**

| Field | Type | Source |
|---|---|---|
| `span_width` | number | `mvp-prd.md` §8 |
| `road_spanned` | string | §8 |
| `clearance_height` | number | §8 |
| `height_ft`, `width_ft`, `illumination`, `road_name` | | seed |

**`METRO_PILLAR`**

| Field | Type | Source |
|---|---|---|
| `metro_line` | string | `mvp-prd.md` §8 |
| `pillar_number` | string | §8 |
| `nearest_station` | string | §8 |
| `platform_facing` | boolean (Y/N) | §8 |
| `height_ft`, `width_ft` | | seed |

**`WALL_WRAP` — Wall Wrap / Building Wrap**

| Field | Type | Source |
|---|---|---|
| `building_name` | string | `mvp-prd.md` §8 |
| `wrap_area` | number | §8 |
| `floors_covered` | integer | §8 |
| `height_ft`, `width_ft`, `wrap_type` | | seed |

**`TRANSIT_MEDIA`**

| Field | Type | Source |
|---|---|---|
| `vehicle_type` | string | `mvp-prd.md` §8 |
| `route_number` | string | §8 |
| `fleet_operator` | string | §8 |
| `vehicle_registration` | string | §8 |
| `media_position` | string | seed |

**`BUS_QUEUE_SHELTER`**

| Field | Type | Source |
|---|---|---|
| `shelter_id` | string | `mvp-prd.md` §8 |
| `routes` | array of string | §8 (*"route(s) served"*) |
| `height_ft`, `width_ft`, `illumination` | | seed |

### 39.3 The two digital types (data model only)

**`DIGITAL_BILLBOARD`** — `resolution`, `pixel_pitch`, `brightness`, `loop_duration`, `slot_count`
**`DIGITAL_SCREEN`** — `network_id`, `zone`, `resolution`, `orientation`

**Both are represented in the taxonomy and are NOT listable at MVP.** `mvp-prd.md` §3.2 and §8 and `mvp-brd.md` §5.1 scope MVP inventory to *"static hoarding types only"*. `GET /api/v1/hoarding-types` returns them with `is_listable: false`; `POST /api/v1/hoardings` with a digital `type_code` returns `422 HOARDING_TYPE_NOT_LISTABLE`.

**Enforced at the application layer, not the database.** `database-design.md` §18 recommends exactly this, keeping `is_digital` as queryable seeded metadata so that enabling digital inventory later is a UI and validation change, not a migration. **No device, CMS, slot-scheduling, or programmatic-serving field exists anywhere in this API** — that is the full-scope Digital Screen module, explicitly deferred.

### 39.4 A CONFLICT in the seeded required-attribute keys, surfaced

`database-design.md` §42.1 carries its own warning: the `required_attribute_keys` it seeds are *"this document's reasonable reconstruction of `mvp-prd.md` §8's per-type field tables... not a character-for-character copy."*

The divergence is real and material. For `UNIPOLE_BILLBOARD`, `mvp-prd.md` §8 names **pole height, facing direction, road name, visibility distance**; the seed requires **`height_ft`, `width_ft`, `illumination`, `facing_direction`**. Only `facing_direction` appears in both. `illumination` does not appear in `mvp-prd.md` §8 at all — it is one of the full-scope attributes `inventory.md` §2 explicitly excludes from MVP (*"illumination, orientation, material... are not introduced here"*).

**Consequence, stated plainly:** `INVENTORY-001` validation runs against `required_attribute_keys`, so as seeded, a Publisher who fills in every field `mvp-prd.md` §8 lists **would still be blocked from submitting**, and a Publisher who fills in the seeded keys would be missing fields the PRD requires. This is a live blocker for the listing form.

**The OpenAPI schemas in §37 accept both sets** — the union, with `additionalProperties: true` — so no client breaks whichever way it is resolved. **REQUIRED before implementation: reconcile `hoarding_types.required_attribute_keys` against `mvp-prd.md` §8 directly.** `database-design.md` §49 asks for exactly this. Carried to §46.1.

### 39.5 Site Intelligence is not type-specific

`site_intelligence` is a **separate object on every listing**, identical in shape across all eight types, and **optional in its entirety** (`INVENTORY-002`).

**No Site Intelligence field is ever required**, at creation or at submission. `INVENTORY-002` makes incompleteness a **visibility flag in the Admin queue**, never a gate: *"this does not block Admin from approving it"* (`inventory.md` §24). §24.5's `review_flags` carries `severity: "INFO"` for exactly this reason.

**Partial data is returned as partial.** Absent fields are omitted, never returned as `0`, `""`, or `"unknown"` — `viewer-platform.md` §12 requires that a listing *"may show partial data, or note that some fields are unavailable, rather than presenting incomplete data as if it were complete."* A footfall of zero and an unknown footfall must never look alike.

**Nothing reads it.** No pricing, ranking, recommendation, or sort logic in this API consumes Site Intelligence. It is captured now so a future system can consume it without asking Publishers to re-supply it (`mvp-prd.md` §15, `inventory.md` §10).

---

## 40. Request API Examples

Realistic Bengaluru inventory; all personal names and businesses are fictional.

### 40.1 Create a request

```http
POST /api/v1/requests HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
Idempotency-Key: 7f3c1c2e-9b4a-4f0d-b8a1-2c5d6e7f8a90

{
  "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "start_date": "2026-09-10",
  "end_date": "2026-09-20",
  "message": "Interested in this site for a September product launch."
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/requests/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
X-Request-Id: req_01J9Z4K7N2QW8XY3B5C6D7E907
```

```json
{
  "success": true,
  "data": {
    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "hoarding": {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "title": "Outer Ring Road Unipole — Marathahalli",
      "type_code": "UNIPOLE_BILLBOARD",
      "locality": "Marathahalli",
      "city": "Bengaluru",
      "price": "85000.00",
      "price_unit": "MONTH",
      "currency": "INR",
      "primary_media_url": "https://<storage-host>/hoarding-public/aaaaaaaa/photo-1-watermarked.jpg",
      "is_currently_listed": true
    },
    "publisher": { "id": "11111111-1111-1111-1111-111111111111", "business_name": "Kumar Outdoor Media" },
    "start_date": "2026-09-10",
    "end_date": "2026-09-20",
    "duration_days": 11,
    "status": "REQUESTED",
    "status_label": "Pending",
    "message": "Interested in this site for a September product launch.",
    "amount_agreed": null,
    "sla_deadline": "2026-09-01T09:41:02Z",
    "sla_hours_remaining": 47.9,
    "created_at": "2026-08-30T09:41:02Z",
    "updated_at": "2026-08-30T09:41:02Z",
    "responded_at": null,
    "available_actions": []
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E907"
}
```

### 40.2 List the Viewer's own requests

```http
GET /api/v1/requests/me?status=REQUESTED&status=CONFIRMED&page=1&pageSize=20 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "hoarding": { "id": "aaaa...", "title": "Outer Ring Road Unipole — Marathahalli", "type_code": "UNIPOLE_BILLBOARD", "locality": "Marathahalli", "is_currently_listed": true },
        "start_date": "2026-09-10", "end_date": "2026-09-20", "duration_days": 11,
        "status": "REQUESTED", "status_label": "Pending",
        "sla_deadline": "2026-09-01T09:41:02Z",
        "created_at": "2026-08-30T09:41:02Z",
        "available_actions": []
      },
      {
        "id": "cccccccc-1111-2222-3333-444444444444",
        "hoarding": { "id": "dddd...", "title": "Indiranagar 100ft Road Gantry", "type_code": "GANTRY", "locality": "Indiranagar", "is_currently_listed": true },
        "start_date": "2026-10-01", "end_date": "2026-10-31", "duration_days": 31,
        "status": "CONFIRMED", "status_label": "Confirmed",
        "amount_agreed": "142000.00",
        "confirmed_at": "2026-08-28T06:15:44Z",
        "responded_at": "2026-08-28T06:15:44Z",
        "created_at": "2026-08-27T11:20:00Z",
        "available_actions": []
      }
    ]
  },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 2, "total_pages": 1, "has_next": false, "has_previous": false },
    "counts_by_status": { "REQUESTED": 1, "CONFIRMED": 1, "LIVE": 0, "COMPLETED": 0, "REJECTED": 0, "EXPIRED": 0 }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E912"
}
```

### 40.3 Publisher request inbox

```http
GET /api/v1/publishers/me/requests?status=REQUESTED HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "hoarding": { "id": "aaaa...", "title": "Outer Ring Road Unipole — Marathahalli", "type_code": "UNIPOLE_BILLBOARD", "locality": "Marathahalli", "is_currently_listed": true },
        "viewer": { "id": "3333...", "full_name": "Vikram Shah" },
        "start_date": "2026-09-10", "end_date": "2026-09-20", "duration_days": 11,
        "status": "REQUESTED", "status_label": "Awaiting your response",
        "message": "Interested in this site for a September product launch.",
        "sla_deadline": "2026-09-01T09:41:02Z",
        "sla_hours_remaining": 41.3,
        "created_at": "2026-08-30T09:41:02Z",
        "available_actions": ["ACCEPT", "REJECT"]
      }
    ]
  },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 1, "total_pages": 1, "has_next": false, "has_previous": false },
    "counts_by_status": { "REQUESTED": 1, "CONFIRMED": 2, "LIVE": 1, "COMPLETED": 3, "REJECTED": 1, "EXPIRED": 0 }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90C"
}
```

Note `viewer.full_name` and nothing else — no phone, no email (§23.4).

### 40.4 Accept a request

```http
PATCH /api/v1/requests/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
Idempotency-Key: 9c2b7a51-3e6d-4a08-9f11-7e0a2b3c4d5e

{ "action": "ACCEPT" }
```

```json
{
  "success": true,
  "data": {
    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "status": "CONFIRMED",
    "status_label": "Confirmed",
    "start_date": "2026-09-10",
    "end_date": "2026-09-20",
    "duration_days": 11,
    "confirmed_at": "2026-08-31T04:12:55Z",
    "responded_at": "2026-08-31T04:12:55Z",
    "updated_at": "2026-08-31T04:12:55Z",
    "available_actions": ["SET_AMOUNT_AGREED"]
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E913"
}
```

Side effects: 10–20 September on this hoarding is now blocked against every other request (`REQUEST-001`); a `REQUEST_ACCEPTED` notification row was written in the same transaction; a `request_status_history` row records `REQUESTED → CONFIRMED`. `COMPLETE` is not yet available — the start date has not passed (`REQUEST-003`).

### 40.5 Reject a request

```http
PATCH /api/v1/requests/eeeeeeee-1111-2222-3333-444444444444 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "action": "REJECT", "reason": "Dates unavailable — the site is under structural maintenance." }
```

```json
{
  "success": true,
  "data": {
    "id": "eeeeeeee-1111-2222-3333-444444444444",
    "status": "REJECTED",
    "status_label": "Rejected",
    "rejection_reason": "Dates unavailable — the site is under structural maintenance.",
    "rejected_at": "2026-08-31T04:20:10Z",
    "responded_at": "2026-08-31T04:20:10Z",
    "available_actions": []
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E914"
}
```

The dates release immediately (`REQUEST-002`) — with no release step, because availability is computed (§15.1). The `reason` is optional here, unlike `ADMIN-003`'s mandatory listing-rejection reason.

### 40.6 Mark completed

```http
PATCH /api/v1/requests/cccccccc-1111-2222-3333-444444444444 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "action": "COMPLETE" }
```

```json
{
  "success": true,
  "data": {
    "id": "cccccccc-1111-2222-3333-444444444444",
    "status": "COMPLETED",
    "status_label": "Completed",
    "start_date": "2026-10-01",
    "end_date": "2026-10-31",
    "live_at": "2026-10-01T00:00:07Z",
    "completed_at": "2026-11-01T09:30:00Z",
    "amount_agreed": "142000.00",
    "available_actions": []
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E915"
}
```

`COMPLETED` continues to block its dates (§15.1) — a completed booking is a historical fact, not a released one.

### 40.7 Conflict response — `REQUEST-004` re-validation failed

```http
PATCH /api/v1/requests/ffffffff-1111-2222-3333-444444444444 HTTP/1.1
Content-Type: application/json

{ "action": "ACCEPT" }
```

```http
HTTP/1.1 409 Conflict
```

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_DATE_CONFLICT",
    "message": "These dates are no longer available — a conflicting request was already confirmed.",
    "details": {
      "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "requested_range": { "start_date": "2026-09-10", "end_date": "2026-09-20" },
      "conflicting_range": { "start_date": "2026-09-01", "end_date": "2026-09-15" },
      "request_status": "REQUESTED"
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E908"
}
```

The request stays `REQUESTED`. The Publisher may still reject it, or let it expire. `conflicting_range` reveals that dates are taken — which the availability endpoint already tells any Viewer — and reveals nothing about who holds them.

### 40.8 Acting on an expired request

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_STATE_CONFLICT",
    "message": "This request is no longer awaiting a response.",
    "details": {
      "current_status": "EXPIRED",
      "attempted_action": "ACCEPT",
      "expired_at": "2026-09-01T09:41:02Z",
      "sla_deadline": "2026-09-01T09:41:02Z"
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E909"
}
```

`409`. The SLA sweep won the race (§32.2 Race 3) — the outcome is deterministic even though which side *should* win is an unresolved product question.

### 40.9 Duplicate pending request

```http
POST /api/v1/requests HTTP/1.1
Content-Type: application/json

{ "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "start_date": "2026-11-01", "end_date": "2026-11-10" }
```

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_DUPLICATE_PENDING",
    "message": "You already have a pending request on this listing.",
    "details": {
      "existing_request_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "existing_start_date": "2026-09-10",
      "existing_end_date": "2026-09-20",
      "existing_status": "REQUESTED"
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E907"
}
```

`409`. `VIEWER-002`, enforced by a partial unique index so a concurrent double-submit cannot slip past. `details` names the existing request, satisfying `viewer-platform.md` §25 AC-8.

### 40.10 Request status history

```http
GET /api/v1/requests/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/history HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "request_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "history": [
      { "from_status": null, "to_status": "REQUESTED", "changed_by": { "id": "3333...", "role": "VIEWER" }, "changed_at": "2026-08-30T09:41:02Z", "note": null },
      { "from_status": "REQUESTED", "to_status": "CONFIRMED", "changed_by": { "id": "1111...", "role": "PUBLISHER" }, "changed_at": "2026-08-31T04:12:55Z", "note": null },
      { "from_status": "CONFIRMED", "to_status": "LIVE", "changed_by": null, "changed_at": "2026-09-10T00:00:07Z", "note": "system" }
    ]
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90A"
}
```

---

## 41. Inventory API Examples

### 41.1 Search

```http
GET /api/v1/hoardings?city=Bengaluru&page=1&pageSize=20 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

```json
{
  "success": true,
  "data": { "hoardings": [ "…HoardingPublic objects…" ] },
  "meta": {
    "pagination": { "page": 1, "page_size": 20, "total": 57, "total_pages": 3, "has_next": true, "has_previous": false },
    "filters_applied": { "city": "Bengaluru" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E916"
}
```

### 41.2 Filter by type

```http
GET /api/v1/hoardings?type=METRO_PILLAR&city=Bengaluru HTTP/1.1
```

Returns only Metro Pillar listings satisfying `INVENTORY-003`. Repeating `type` returns `400 INVALID_FILTER` — single-valued at MVP, with the syntax reserved (§10.2).

### 41.3 Filter by distance

```http
GET /api/v1/hoardings?latitude=12.9716&longitude=77.5946&maxDistance=8 HTTP/1.1
```

Within 8 km of Bengaluru city centre, ordered nearest first, each carrying `distance_km`. Omitting `latitude` or `longitude` returns:

```json
{
  "success": false,
  "error": {
    "code": "GEO_PARAMS_INCOMPLETE",
    "message": "maxDistance requires both latitude and longitude.",
    "details": { "supplied": ["maxDistance"], "missing": ["latitude", "longitude"] }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E917"
}
```

### 41.4 Filter by maximum price, combined

```http
GET /api/v1/hoardings?type=UNIPOLE_BILLBOARD&maxPrice=100000.00&latitude=12.9716&longitude=77.5946&maxDistance=10 HTTP/1.1
```

All four filters AND together (§10.3): unipoles **and** ≤ ₹100,000 **and** within 10 km. `maxPrice` is inclusive and is a money string, not a number (§4.6).

### 41.5 Listing detail

```http
GET /api/v1/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?latitude=12.9716&longitude=77.5946 HTTP/1.1
```

Returns the `HoardingPublic` object shown in §11.2 — with `distance_km`, watermarked media only, a three-field `publisher` block, and no `approval_status`.

### 41.6 Create a listing

```http
POST /api/v1/hoardings HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
Idempotency-Key: 2a1b3c4d-5e6f-4708-9a0b-1c2d3e4f5a6b

{
  "type_code": "GANTRY",
  "title": "Indiranagar 100ft Road Gantry",
  "description": "Full-span gantry over 100ft Road, high evening commuter volume.",
  "size": "40ft x 20ft",
  "price": "142000.00",
  "price_unit": "MONTH",
  "latitude": 12.9784,
  "longitude": 77.6408,
  "locality": "Indiranagar",
  "city": "Bengaluru",
  "address_text": "100ft Road, near CMH Road junction",
  "attributes": {
    "span_width": 40,
    "road_spanned": "100ft Road",
    "clearance_height": 5.5,
    "height_ft": 20,
    "width_ft": 40,
    "illumination": "backlit"
  }
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/hoardings/dddddddd-dddd-dddd-dddd-dddddddddddd
```

```json
{
  "success": true,
  "data": {
    "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "approval_status": "DRAFT",
    "is_paused": false,
    "is_delisted": false,
    "media": [],
    "submission_readiness": {
      "can_submit": false,
      "blockers": [
        { "code": "HOARDING_MISSING_MEDIA", "message": "At least one media asset is required before submission." }
      ]
    },
    "pending_request_count": 0,
    "is_edit_frozen": false,
    "created_at": "2026-08-30T11:00:00Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E918"
}
```

### 41.7 Update a listing — blocked by `OWNER-003`

```http
PATCH /api/v1/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa HTTP/1.1
Content-Type: application/json

{ "price": "92000.00" }
```

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_EDIT_FROZEN",
    "message": "Core listing details cannot be changed while a request on this listing is awaiting your response.",
    "details": {
      "frozen_fields": ["title", "type_code", "attributes", "price", "latitude", "longitude"],
      "attempted_fields": ["price"],
      "pending_request_count": 2
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E901"
}
```

`409`. Pausing the same listing in the same moment **succeeds** — `is_paused` is exempt from the freeze (§13.3):

```http
PATCH /api/v1/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
{ "is_paused": true }
→ 200 OK, approval_status still "APPROVED", listing removed from search
```

### 41.8 Upload media

```http
POST /api/v1/hoardings/dddddddd-dddd-dddd-dddd-dddddddddddd/media HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Content-Type: multipart/form-data; boundary=----X
Idempotency-Key: 6b5a4938-2716-4c05-8d93-1a2b3c4d5e6f

------X
Content-Disposition: form-data; name="file"; filename="gantry-1.jpg"
Content-Type: image/jpeg

<binary>
------X
Content-Disposition: form-data; name="is_primary"

true
------X--
```

```json
{
  "success": true,
  "data": {
    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "hoarding_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "media_type": "IMAGE",
    "url": "https://<storage-host>/hoarding-public/dddddddd/cccccccc-watermarked.jpg",
    "is_primary": true,
    "display_order": 0,
    "processing_status": "WATERMARKED",
    "watermarked_at": "2026-08-30T11:04:22Z",
    "has_original": true,
    "created_at": "2026-08-30T11:04:22Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E903"
}
```

`201` under the browser-side pipeline. Under the server-side worker the same body returns `202` with `processing_status: "UPLOADED"`, `url: null`, and `watermarked_at: null` — **no public URL exists until a watermarked derivative does** (§14.2).

### 41.9 Submit for review

```http
POST /api/v1/hoardings/dddddddd-dddd-dddd-dddd-dddddddddddd/submit HTTP/1.1
```

Success → `200` with `approval_status: "PENDING_REVIEW"`. Blocked on incomplete attributes:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_INCOMPLETE_ATTRIBUTES",
    "message": "This listing is missing required fields for its hoarding type.",
    "details": {
      "type_code": "GANTRY",
      "required_attribute_keys": ["height_ft", "width_ft", "illumination", "road_name"],
      "missing_attribute_keys": ["road_name"]
    }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E8FF"
}
```

Or blocked, retryably, on media processing:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_MEDIA_NOT_WATERMARKED",
    "message": "Media is still being processed. This listing can be submitted once processing finishes.",
    "details": { "total_media": 3, "pending_media": 1, "failed_media": 0, "retryable": true }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E900"
}
```

The client renders this as *"processing media"*, not as an error — `mvp-prd.md` §12's explicit acceptance criterion.

### 41.10 Availability

```http
GET /api/v1/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/availability?from=2026-09-01&to=2026-12-31&start_date=2026-09-10&end_date=2026-09-20 HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "hoarding_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "window": { "from": "2026-09-01", "to": "2026-12-31" },
    "is_listed": true,
    "unavailable_ranges": [
      { "start_date": "2026-09-01", "end_date": "2026-09-15", "reason": "BOOKED" },
      { "start_date": "2026-10-05", "end_date": "2026-10-09", "reason": "BLOCKED" }
    ],
    "is_available": false,
    "requested_range": { "start_date": "2026-09-10", "end_date": "2026-09-20" }
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E905"
}
```

---

## 42. Admin API Examples

### 42.1 Dashboard

```http
GET /api/v1/admin/dashboard HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

```json
{
  "success": true,
  "data": {
    "listings": { "total": 63, "pending_approval": 4, "approved": 55, "live_in_search": 52 },
    "requests": { "total": 210, "confirmed": 88, "confirmation_rate_pct": 41.9 },
    "publishers": { "total": 19, "verified": 14 },
    "generated_at": "2026-08-30T10:00:00Z"
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90E"
}
```

The four metrics `mvp-prd.md` §7.5 requires, plus `approved`/`live_in_search` so the ambiguous *"total listings"* requirement is legible either way (§24.4).

### 42.2 Approve a listing

```http
POST /api/v1/admin/hoardings/dddddddd-dddd-dddd-dddd-dddddddddddd/approve HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 8e7d6c5b-4a39-4281-b70f-6e5d4c3b2a19
```

```json
{
  "success": true,
  "data": {
    "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "title": "Indiranagar 100ft Road Gantry",
    "approval_status": "APPROVED",
    "approved_at": "2026-08-30T12:10:00Z",
    "approved_by": "44444444-4444-4444-4444-444444444444",
    "rejection_reason": null,
    "is_paused": false,
    "is_delisted": false
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E919"
}
```

Live in Viewer search the instant the transaction commits — no reindex, no window (§25.1). A second Admin approving the same item concurrently receives:

```json
{
  "success": false,
  "error": {
    "code": "HOARDING_INVALID_STATE",
    "message": "This listing is no longer awaiting review.",
    "details": { "current_status": "APPROVED", "approved_at": "2026-08-30T12:10:00Z" }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E90F"
}
```

### 42.3 Reject a listing

```http
POST /api/v1/admin/hoardings/dddddddd-dddd-dddd-dddd-dddddddddddd/reject HTTP/1.1
Content-Type: application/json

{ "reason": "The uploaded photographs do not show the advertised site." }
```

```json
{
  "success": true,
  "data": {
    "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
    "approval_status": "REJECTED",
    "rejection_reason": "The uploaded photographs do not show the advertised site."
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91A"
}
```

Omitting `reason` is refused **before any write** (`ADMIN-003`, enforced twice — §25.2):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": { "fields": { "reason": "a rejection reason is required (ADMIN-003)" } }
  },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91B"
}
```

### 42.4 Verification queue and decision

```http
GET /api/v1/admin/publishers?verification_status=UNVERIFIED HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "publishers": [
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "full_name": "Anita Rao",
        "phone": "+919900000002",
        "email": "anita@example.com",
        "city": "Bengaluru",
        "business_name": "Rao Hoardings",
        "verification_status": "UNVERIFIED",
        "verified_at": null,
        "suspended": false,
        "listing_counts": { "draft": 2, "pending_review": 0, "approved": 0, "rejected": 0 },
        "created_at": "2026-08-25T08:00:00Z"
      }
    ]
  },
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 1, "total_pages": 1, "has_next": false, "has_previous": false } },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91C"
}
```

```http
POST /api/v1/admin/publishers/22222222-2222-2222-2222-222222222222/verify HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "id": "22222222-2222-2222-2222-222222222222",
    "verification_status": "VERIFIED",
    "verified_at": "2026-08-30T12:30:00Z",
    "verification_rejection_reason": null,
    "suspended": false,
    "can_submit_listings": true
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91D"
}
```

The Publisher may now submit listings (`OWNER-004`). **No notification is emitted** — verification outcomes are not in `mvp-prd.md` §7.6's event list (§26.4).

### 42.5 Suspension

```http
POST /api/v1/admin/publishers/11111111-1111-1111-1111-111111111111/suspend HTTP/1.1
Content-Type: application/json

{ "reason": "Multiple listings reported as misrepresenting their location." }
```

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "business_name": "Kumar Outdoor Media",
    "verification_status": "VERIFIED",
    "suspended": true,
    "suspended_at": "2026-08-30T12:45:00Z",
    "suspended_by": { "id": "4444...", "label": "SEEABLE Ops" },
    "suspension_reason": "Multiple listings reported as misrepresenting their location.",
    "can_submit_listings": false
  },
  "meta": {},
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91E"
}
```

**`verification_status` stays `VERIFIED`** — suspension is an independent axis, so unsuspending never has to reconstruct prior state (§26.5).

**What did NOT happen, and it matters:** the Publisher's approved listings are **still live in Viewer search**, and their two confirmed requests are **untouched and will complete as agreed** (`ADMIN-002`, `ADMIN-004`). Removing those listings requires a separate delist call per listing:

```http
POST /api/v1/admin/hoardings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/delist HTTP/1.1
Content-Type: application/json

{ "reason": "Publisher suspended pending investigation." }
```

Whether suspension *should* cascade to delisting is an unresolved product question (§25.4, §46) — the literal reading is implemented and its consequence is visible here rather than hidden.

### 42.6 Moderation audit trail

```http
GET /api/v1/admin/actions?target_publisher_id=11111111-1111-1111-1111-111111111111 HTTP/1.1
```

```json
{
  "success": true,
  "data": {
    "actions": [
      { "id": "eeee...", "action_type": "HOARDING_DELISTED", "admin": { "id": "4444...", "label": "SEEABLE Ops" }, "target_hoarding_id": "aaaa...", "target_publisher_id": "1111...", "reason": "Publisher suspended pending investigation.", "created_at": "2026-08-30T12:47:00Z" },
      { "id": "ffff...", "action_type": "PUBLISHER_SUSPENDED", "admin": { "id": "4444...", "label": "SEEABLE Ops" }, "target_hoarding_id": null, "target_publisher_id": "1111...", "reason": "Multiple listings reported as misrepresenting their location.", "created_at": "2026-08-30T12:45:00Z" }
    ]
  },
  "meta": { "pagination": { "page": 1, "page_size": 20, "total": 2, "total_pages": 1, "has_next": false, "has_previous": false } },
  "request_id": "req_01J9Z4K7N2QW8XY3B5C6D7E91F"
}
```

---

## 43. Traceability Matrix

Every approved requirement ID, mapped to the endpoints that implement it. `BR-*` business IDs map one-to-one onto PRD IDs per `mvp-brd.md` §7 and are folded into the same rows.

| Requirement | Business ID | API surface | Enforcement |
|---|---|---|---|
| **`AUTH-001`** — one account, one role | `BR-AUTH-001` | `POST /auth/register`, `GET /auth/me` | `role` set once by trigger; `ADMIN` refused at registration; column-`REVOKE`d thereafter |
| **`AUTH-002`** — OTP verification gate | `BR-AUTH-002` | `POST /auth/verify-otp`; the gate applies at `POST /requests` and `POST /hoardings/{id}/submit` | §5.3 — MVP target specified, demo variance documented, **not** silently deleted |
| **`OWNER-001`** — no overlapping accepts | `BR-OWNER-001` | `PATCH /requests/{id}` `ACCEPT` | The Publisher-facing mirror of `REQUEST-001`; **one** implementation, in `confirm_request()` + the exclusion constraint |
| **`OWNER-002`** — unanswered requests expire | `BR-OWNER-002` | `POST /api/jobs/expire-requests`; `sla_deadline` on every Request resource | Scheduled sweep with precondition re-check |
| **`OWNER-003`** — no core edits while pending | — | `PATCH /hoardings/{id}` | `409 HOARDING_EDIT_FROZEN`; `enforce_hoarding_edit_freeze` trigger |
| **`OWNER-004`** — unverified Publishers cannot submit | `BR-AUTH-002` | `POST /hoardings/{id}/submit` gate 4 | `403 PUBLISHER_NOT_VERIFIED` |
| **`VIEWER-001`** — multiple simultaneous pending requests | `BR-VIEWER-001` | `POST /requests` | No cross-listing constraint exists — permitted by construction |
| **`VIEWER-002`** — no duplicate pending per listing | — | `POST /requests` | `409 REQUEST_DUPLICATE_PENDING`; partial unique index |
| **`REQUEST-001`** — confirmation blocks dates | `BR-REQUEST-001` | `PATCH /requests/{id}` `ACCEPT`; `GET /hoardings/{id}/availability` | Exclusion constraint; availability computed from live status |
| **`REQUEST-002`** — rejection/expiry releases dates | `BR-REQUEST-002` | `PATCH /requests/{id}` `REJECT`; `/api/jobs/expire-requests` | **Structural** — computed availability means there is no release step to forget |
| **`REQUEST-003`** — no completion before start date | `BR-REQUEST-003` | `PATCH /requests/{id}` `COMPLETE` | `409 REQUEST_COMPLETE_TOO_EARLY` |
| **`REQUEST-004`** — accept-time re-validation | `BR-REQUEST-001` | `PATCH /requests/{id}` `ACCEPT` | §19 — the core invariant; row lock + re-check + exclusion constraint |
| **`ADMIN-001`** — no unapproved listing in search | `BR-ADMIN-001` | `POST /admin/hoardings/{id}/approve`; every `GET /hoardings*` | `INVENTORY-003` predicate, applied in **one** place (`visible_hoardings`) |
| **`ADMIN-002`** — suspension does not cancel confirmed requests | — | `POST /admin/publishers/{id}/suspend` | `suspend_publisher()` never writes to `hoardings` or `requests` |
| **`ADMIN-003`** — rejection requires a reason | — | `POST /admin/hoardings/{id}/reject` | Enforced **twice**: function guard + `CHECK` constraint |
| **`ADMIN-004`** — delisting independent of suspension | — | `POST /admin/hoardings/{id}/delist` \| `/relist` | Separate endpoints, separate columns, no cascade |
| **`INVENTORY-001`** — type-specific fields complete before review | `BR-OWNER-001` | `POST /hoardings/{id}/submit` gate 7; `GET /hoarding-types` | `409 HOARDING_INCOMPLETE_ATTRIBUTES` naming the missing keys |
| **`INVENTORY-002`** — Site Intelligence optional, flagged | — | `GET /admin/hoardings` `review_flags`; `site_intelligence_complete` | `severity: "INFO"` — a flag, never a gate |
| **`INVENTORY-003`** — Viewer-visibility eligibility | — | Every Viewer-facing read | One predicate, one place (§10.6) |
| **`CONTENT-001`** — no submission with unwatermarked media | `BR-CONTENT-001` | `POST /hoardings/{id}/media`; `/submit` gate 9; `GET /media/{id}/original` | `409 HOARDING_MEDIA_NOT_WATERMARKED`; `original_storage_path` column-`REVOKE`d |
| **`NOTIF-001`** — state changes trigger notifications | — | `GET /notifications`; every state-changing endpoint | Records written in-transaction; delivery async |
| **`BR-ADMIN-002`** — platform-health visibility | — | `GET /admin/dashboard` | The four required metrics |
| **`BR-VIEWER-002`** — standardized comparison fields | — | `GET /hoardings` result shape | `location`, `size`, `price`, `type` on every result |

### 43.1 Requirements with NO API surface, and why

| Requirement | Why nothing is exposed |
|---|---|
| Full-scope `BR-ADMIN-001` (payment/pricing administration) | **FUTURE.** `admin-platform.md`'s header note is explicit that the full-scope `BR-ADMIN-*` IDs are not MVP |
| Full-scope `BR-ADMIN-002` (granular RBAC) | **FUTURE.** MVP has one Admin role |
| Full-scope `BR-ADMIN-003` (compliance audit log) | **FUTURE.** `GET /admin/actions` is the lightweight substitute, not this |
| Admin "edit for moderation only" (`mvp-prd.md` §5) | Scope *"completely unelaborated in any source document"* (`admin-platform.md` §10). Not invented (§24.2) |
| Bulk listing approval | `mvp-prd.md` §14 asks and does not answer (§46) |
| Viewer request cancellation | *"Not introduced as an MVP feature"* (`request-engine.md` §20). `501` reserved |
| Admin individual-request browsing | Explicitly withheld (`request-engine.md` §4, §23) |

---

## 44. Endpoint Inventory

The single quick-reference list. **Auth** column: `—` public, `B` bearer token, `S` job shared secret.

| Method | Path | Module | Actor | Auth | Purpose |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Auth | Public | — | Create a Viewer or Publisher account |
| POST | `/api/v1/auth/login` | Auth | Public | — | Identifier + password sign-in (demo build) |
| POST | `/api/v1/auth/verify-otp` | Auth | Public | — | OTP verification (`AUTH-002`); `501` while disabled |
| POST | `/api/v1/auth/refresh` | Auth | Public | — | Rotate the session |
| POST | `/api/v1/auth/logout` | Auth | Any | B | Revoke this session or all |
| GET | `/api/v1/auth/me` | Auth | Any | B | Identity, role, verification, capability flags |
| GET | `/api/v1/hoarding-types` | Inventory | Any | B | Type taxonomy + `required_attribute_keys` |
| GET | `/api/v1/hoardings` | Inventory | Any | B | Search visible inventory |
| POST | `/api/v1/hoardings` | Inventory | Publisher | B | Create a `DRAFT` listing |
| GET | `/api/v1/hoardings/{id}` | Inventory | Any | B | Listing detail |
| PATCH | `/api/v1/hoardings/{id}` | Inventory | Publisher (own) | B | Update; pause/unpause |
| DELETE | `/api/v1/hoardings/{id}` | Inventory | Publisher (own), Admin | B | Hard delete; blocked by request history |
| POST | `/api/v1/hoardings/{id}/submit` | Inventory | Publisher (own) | B | Submit for Admin review |
| GET | `/api/v1/hoardings/{id}/media` | Media | Per visibility | B | List media assets |
| POST | `/api/v1/hoardings/{id}/media` | Media | Publisher (own) | B | Upload a media asset |
| PATCH | `/api/v1/hoardings/{id}/media/{mediaId}` | Media | Publisher (own) | B | Set primary / reorder |
| DELETE | `/api/v1/hoardings/{id}/media/{mediaId}` | Media | Publisher (own) | B | Delete a media asset |
| GET | `/api/v1/media/{mediaId}/original` | Media | Publisher (own), Admin | B | Signed URL for the private original |
| GET | `/api/v1/hoardings/{id}/availability` | Availability | Per visibility | B | Computed availability |
| POST | `/api/v1/hoardings/{id}/availability/blocks` | Availability | Publisher (own) | B | Block dates |
| DELETE | `/api/v1/hoardings/{id}/availability/blocks/{blockId}` | Availability | Publisher (own) | B | Unblock dates |
| POST | `/api/v1/requests` | Request Engine | Viewer | B | Submit a date request |
| GET | `/api/v1/requests/me` | Request Engine | Viewer | B | The Viewer's own requests |
| GET | `/api/v1/requests/{id}` | Request Engine | Viewer/Publisher (party) | B | Request detail |
| PATCH | `/api/v1/requests/{id}` | Request Engine | Publisher; Admin (`COMPLETE`) | B | Accept / reject / complete / record amount |
| GET | `/api/v1/requests/{id}/history` | Request Engine | Party, Admin | B | Status-transition history |
| GET | `/api/v1/publishers/me` | Publisher | Publisher | B | Own profile and trust state |
| PATCH | `/api/v1/publishers/me` | Publisher | Publisher | B | Update own profile |
| GET | `/api/v1/publishers/me/hoardings` | Publisher | Publisher | B | Own listings, every state |
| GET | `/api/v1/publishers/me/requests` | Publisher | Publisher | B | Request inbox |
| GET | `/api/v1/publishers/me/summary` | Publisher | Publisher | B | Counts + recorded agreed value |
| GET | `/api/v1/viewers/me` | Viewer | Viewer | B | Own profile |
| PATCH | `/api/v1/viewers/me` | Viewer | Viewer | B | Update own profile |
| GET | `/api/v1/notifications` | Notifications | Any | B | In-app notification feed |
| PATCH | `/api/v1/notifications/{id}` | Notifications | Recipient | B | Mark read / unread |
| GET | `/api/v1/admin/dashboard` | Admin | Admin | B | Platform counts |
| GET | `/api/v1/admin/hoardings` | Admin | Admin | B | Listing approval queue |
| POST | `/api/v1/admin/hoardings/{id}/approve` | Admin | Admin | B | Approve a listing |
| POST | `/api/v1/admin/hoardings/{id}/reject` | Admin | Admin | B | Reject with a mandatory reason |
| POST | `/api/v1/admin/hoardings/{id}/delist` | Admin | Admin | B | Remove from search (`ADMIN-004`) |
| POST | `/api/v1/admin/hoardings/{id}/relist` | Admin | Admin | B | Reverse a delisting |
| GET | `/api/v1/admin/publishers` | Admin | Admin | B | Verification queue |
| GET | `/api/v1/admin/publishers/{id}` | Admin | Admin | B | Publisher record |
| POST | `/api/v1/admin/publishers/{id}/verify` | Admin | Admin | B | Verify a Publisher |
| POST | `/api/v1/admin/publishers/{id}/reject-verification` | Admin | Admin | B | Reject verification |
| POST | `/api/v1/admin/publishers/{id}/suspend` | Admin | Admin | B | Suspend (`ADMIN-002`) |
| POST | `/api/v1/admin/publishers/{id}/unsuspend` | Admin | Admin | B | Reverse a suspension |
| GET | `/api/v1/admin/actions` | Admin | Admin | B | Moderation audit trail |
| GET | `/api/health` | System | Public | — | Liveness / readiness |
| POST | `/api/jobs/expire-requests` | Jobs | Scheduler | S | SLA expiry sweep |
| POST | `/api/jobs/process-notifications` | Jobs | Scheduler | S | Expiring-soon + optional email |
| POST | `/api/jobs/transition-live` | Jobs | Scheduler | S | `CONFIRMED → LIVE` |
| POST | `/api/jobs/keep-alive` | Jobs | Scheduler | S | Supabase free-tier keep-alive |
| POST | `/api/jobs/cleanup` | Jobs | Scheduler | S | Orphaned storage objects only |
| POST | `/api/jobs/process-media` | Jobs | Scheduler | S | **Variant A only** (§14.2, §28.7) |

**49 public operations across 41 paths, plus 6 internal job routes.** Fourteen of the public operations come verbatim from `mvp-prd.md` §9; the rest are derived from approved functional requirements that §9 left without an endpoint — the gap `admin-platform.md` §19, `inventory.md` §21, and `system-architecture.md` §19 each flagged.

---

## 45. MVP vs Future API

### 45.1 MVP surface

Everything in §44. Grouped by the capability it serves:

| Capability | Endpoints |
|---|---|
| **Authentication** | 6 auth endpoints |
| **Discovery** | `GET /hoardings`, `GET /hoardings/{id}`, `GET /hoarding-types`, `GET /hoardings/{id}/availability` |
| **Inventory management** | Create, update, submit, delete, plus Publisher listing views |
| **Media** | Upload, list, reorder, delete, original access |
| **Availability** | Read computed availability; create and delete blocks |
| **Requests** | Create, list (both sides), detail, act, history |
| **Publisher workflow** | Profile, inventory, inbox, summary |
| **Admin moderation** | Dashboard, approval queue, approve/reject, delist/relist, verification queue, verify/reject/suspend/unsuspend, audit trail |
| **Notifications** | List, mark read |
| **Operations** | Health, six job routes |

### 45.2 Future — named so it is not accidentally built

**None of the following exists anywhere in this API.** No endpoint, no field, no enum value, no schema. `mvp-prd.md` §3.2, §15 and `mvp-brd.md` §5.2 defer every one of them.

| Future capability | What it would add | Additive to `v1`? |
|---|---|---|
| **Payments / escrow** | `/payments`, `/payments/{id}/refund`; `PAID`/`ESCROWED` request states; a `payment` object on the Request resource | Endpoints yes; **new `RequestStatus` values are breaking** (§36.2) |
| **Commissions** | `/commissions`, platform-fee fields on every confirmed request | Yes |
| **Contracts** | `/contracts`, `/contracts/{id}/sign`, document generation | Yes |
| **Campaign management** | `/campaigns`, multi-hoarding requests, budget allocation. **Structurally out** — a request is one hoarding, one range | New parent resource; `requests` becomes a child |
| **Agency platform** | Org accounts, sub-users, agency-scoped views. **Requires `AUTH-001` to change** — one account, one role | **Breaking** |
| **Digital screens / CMS** | Device registry, slot scheduling, loop management, creative upload, playback proof | Yes — the two digital types already exist in the taxonomy |
| **AI recommendations** | `/recommendations`, ranking, dynamic pricing. Site Intelligence is already captured and unread | Yes |
| **Advanced analytics** | `/analytics/*`, funnels, cohorts. `analytics_events` already exists, unexposed | Yes |
| **DRM / screenshot protection** | Signed short-TTL media, watermark-per-viewer, download deterrents | Yes |
| **Full audit log** (`BR-ADMIN-003`) | Compliance-grade, immutable, every action. `GET /admin/actions` is the lightweight substitute | Likely supersedes |
| **Granular RBAC** (`BR-ADMIN-002`) | Admin tiers, permission sets. MVP has exactly one Admin role | **Breaking** |
| **Free-text search** | `?q=` with ranking, autocomplete, typo tolerance. PostgreSQL FTS suffices — no new datastore | Yes |
| **Multi-city** | `city` is already a real column on `hoardings` and `profiles`, not a constant | Yes |
| **Sorting** | `?sort=price_asc` etc. Deliberately absent (§10.5) | Yes |
| **Viewer cancellation** | `action: "CANCEL"` — reserved as `501` today | Yes |
| **Bulk moderation** | `POST /admin/hoardings/bulk-approve` — `mvp-prd.md` §14 asks and does not answer | Yes |

**The OpenAPI document in §37 contains none of these.** Its `paths` block is exactly the MVP surface, and a generated client cannot accidentally reference a deferred concept.

### 45.3 Why so much of Phase 2 is additive

Three MVP decisions are load-bearing for a cheap Phase 2, and each was made for its own reasons rather than for future-proofing:

1. **`amount_agreed` already exists** on every request as a record-keeping field (`mvp-prd.md` §15 makes this explicit) — a `payments` table joins to `requests.id` without touching `requests`.
2. **Type-specific attributes are `jsonb` against a data-driven `required_attribute_keys`** — a ninth hoarding type is a row, not a migration and not an API change.
3. **`requests.status` is `text` + `CHECK`, not a native `ENUM`** — the database side of adding a payment state is trivial. The **API** side is not, and §36.2 says so: the compatibility cost falls on the contract, not the schema.

---

## 46. Open Questions

Genuine unresolved decisions only. Each carries what it is, why it matters, this document's current position, and who must decide.

### 46.1 Findings requiring a `database-design.md` amendment — BLOCKING

These are defects and gaps found while cross-checking this API against the settled schema. Each blocks a documented response from being servable as written. They are engineering corrections, not product decisions.

---

**F1 — `is_hoarding_available()` and `search_available_hoardings()` are not `SECURITY DEFINER`, so availability is wrong for every Viewer.**

**Why it matters.** Both run under the caller's RLS. A Viewer cannot read `hoarding_availability_blocks` (owner/Admin only) or other Viewers' `requests` (owner only), so both `NOT EXISTS` clauses evaluate **true** and every date reports as available on a fully booked hoarding. The write path is safe — `validate_request_creation()` is `SECURITY DEFINER` and the exclusion constraint is absolute — but the read path lies, and `viewer-platform.md` §24 forbids exactly this: *"a Viewer should never be able to submit a request against dates the system already knows are unavailable."*

**Recommendation.** Declare both `SECURITY DEFINER SET search_path = public`. Neither projects rows from the restricted tables — one returns a boolean, the other returns only `visible_hoardings` columns — so elevating them leaks nothing.
**Decision needed from:** Engineering (data layer). **Affects:** §10.6, §15.2, §41.10.

---

**F2 — No readable path exists for the `publisher` block on a listing.**

**Why it matters.** `profiles` and `publisher_profiles` are both `id = auth.uid() OR is_admin()`. A Viewer cannot read `business_name` or `verification_status`, so the three-field `publisher` object every listing response carries is unservable — and it is the trust signal `mvp-brd.md` §10 makes central.

**Recommendation.** Add the `public_publisher_summary()` `SECURITY DEFINER` function in §11.3, which returns exactly `id`, `business_name`, and `is_verified`, only for Publishers with at least one visible listing, and never `phone`, `email`, `full_name`, or suspension state.
**Decision needed from:** Engineering (data layer). **Affects:** §11.2, §11.3.

---

**F3 — The `publisher_inbox` view returns zero rows for every Publisher.**

**Why it matters.** It is `security_invoker` and inner-joins `profiles` for `viewer_name`; the Publisher cannot read the Viewer's `profiles` row, so the join drops every row. The request inbox — one of the four surfaces `mvp-prd.md` §7.2 requires — is empty.

**Recommendation.** Add a narrow `profiles` SELECT policy permitting a counterparty read where a request links the two users. It fixes `viewer_request_list` symmetrically, and the two parties to a request are not strangers. Contact fields stay hidden through this API's column projection, not through RLS.
**Decision needed from:** Engineering (data layer), with Product sign-off on counterparty name visibility. **Affects:** §22.4, §23.3.

---

**F4 — `55000` is used for at least ten distinct business outcomes.**

**Why it matters.** The API cannot select a specific error code without parsing exception message strings, which breaks on any wording change. §8.5 specifies a read-only pre-check as an interim, which duplicates business logic the API should not own.

**Recommendation.** Attach a machine code via `USING ERRCODE = '55000', DETAIL = 'SEEABLE_CODE=…'` in every `SECURITY DEFINER` function, and delete the pre-check.
**Decision needed from:** Engineering (data layer). **Affects:** §8.5, §19.5.

---

**F5 — `request_status_history` is Admin-readable but `requests` is not.**

**Why it matters.** `rsh_select_via_request` includes `is_admin()`; `requests_select_own` deliberately does not. An Admin can read a request's history but not the request — almost certainly an oversight, since a history with no readable parent is of limited use.

**Recommendation.** **Remove `is_admin()` from `rsh_select_via_request`**, preserving the approved restriction, rather than widening `requests_select_own`, which `request-engine.md` §4 explicitly declines to grant.
**Decision needed from:** Product, alongside the Support/Dispute Runbook. **Affects:** §21.3.

---

**F6 — `hoarding_types.required_attribute_keys` contradicts `mvp-prd.md` §8.**

**Why it matters.** For `UNIPOLE_BILLBOARD`, the PRD names pole height, facing direction, road name, visibility distance; the seed requires `height_ft`, `width_ft`, `illumination`, `facing_direction`. `illumination` is a full-scope attribute `inventory.md` §2 explicitly excludes. `INVENTORY-001` validates against the seed, so a Publisher who fills in everything the PRD lists is **blocked from submitting**. This is a live blocker for the listing form.

**Recommendation.** Reconcile the seed against `mvp-prd.md` §8 directly before implementation. `database-design.md` §42.1 and §49 both ask for this.
**Decision needed from:** Product + Engineering, together. **Affects:** §12.5, §39.4.

---

**F7 — No `submitted_at` column exists.**

**Why it matters.** The Admin queue orders by "how long has this been waiting", which is currently derived from `updated_at` — correct only while nothing else updates a `PENDING_REVIEW` row.

**Recommendation.** Add `hoardings.submitted_at timestamptz`, set by `submit_hoarding_for_review()`.
**Decision needed from:** Engineering (data layer). **Affects:** §24.5.

---

**F8 — No idempotency-key store exists.**

**Why it matters.** `database-design.md` §48 states it is not built. Without it, a lost-response retry on a confirmation returns `409 REQUEST_STATE_CONFLICT` — safe, but it reads to the user as a failure of an operation that actually succeeded.

**Recommendation.** Add the `idempotency_keys` table in §31.2, with 24-hour retention pruned by the cleanup job.
**Decision needed from:** Engineering. **Affects:** §31.

---

**F9 — `approve_listing()` does not re-check `CONTENT-001`.**

**Why it matters.** Between submission and approval, a media asset could be deleted or a Publisher suspended. §14.5 blocks deleting the last asset of a `PENDING_REVIEW` listing, which closes the main path, but not all of them.

**Recommendation.** Add a defensive re-check inside `approve_listing()`. **RECOMMENDED**, not required — it changes an approved function's behavior.
**Decision needed from:** Engineering. **Affects:** §25.1.

---

### 46.2 Authentication and access

**Q1 — Does the demo build's OTP deferral apply to Publishers as well as Viewers?**
*Why it matters:* until answered, no one can state what gates Publisher listing submission today. `viewer-platform.md` wrote the variance for Viewers only and said it *"would need to be applied symmetrically"*; `admin-platform.md` and `system-architecture.md` §46 both carry it as blocking.
*Current position:* this API gates Publisher submission on the **Admin verification decision** (`verification_status = 'VERIFIED'`), which is unaffected by whether OTP runs. **Decision needed from:** Product.

**Q2 — Is the "Publisher verification queue" the same gate as OTP, or a separate manual review — and what criteria does it apply?**
*Why it matters:* `BR-AUTH-002`'s *"OTP at minimum"* plus a *queue* implies two gates. No KYC, GST, or document requirement is specified anywhere.
*Current position:* two independent gates; manual-review criteria **not invented**. **Decision needed from:** Product + Operations.

**Q3 — Should anonymous browsing of listings be supported?**
*Why it matters:* `mvp-brd.md` §4's first objective is *"reduce discovery friction"*, and requiring signup before seeing any inventory is friction.
*Current position:* authentication required, matching the database grants. The OpenAPI marks the three affected operations `security: [{}, {bearerAuth: []}]` so enabling it needs no contract change. **Decision needed from:** Product.

**Q4 — Bearer header or cookie sessions?**
*Why it matters:* cookies make CSRF protection mandatory (§33.7) and change the CORS policy (§34.3).
*Current position:* bearer header. **Decision needed from:** Engineering.

**Q5 — Does suspension block login?**
*Current position:* no — `ADMIN-002`'s literal reading. `AUTH_ACCOUNT_SUSPENDED` is reserved and unused. **Decision needed from:** Product.

**Q6 — Password reset / forgot-password flow.** Undefined anywhere for the demo build (`viewer-platform.md` §28). Not specified here. **Decision needed from:** Product.

**Q7 — OTP delivery channel.** `AUTH-002` requires OTP; `seeable_free_first_techstack.md` §37 excludes SMS from the ₹0 stack. Email OTP satisfies `AUTH-002` for email-registered users; phone OTP does not. **Decision needed from:** Product + Engineering.

### 46.3 Inventory, media, and availability

**Q8 — The unit for `size`.** sqft, sqm, or a named class — undefined. Free text defeats the like-for-like comparison `BR-VIEWER-002` exists for. *Current position:* free text, returned verbatim. **Decision needed from:** Product.

**Q9 — How are coordinates captured?** `system-architecture.md` §26 calls this *"the most consequential undocumented dependency in the architecture"*: distance filtering and map markers have no confirmed data source, and if Publishers type an address rather than pinning a map, a geocoding service is required and none is named. *Current position:* coordinates are taken as given and required at submission. **Decision needed from:** Product + Engineering. **BLOCKING for the listing form.**

**Q10 — Server-side or browser-side watermarking?** (§14.2) The two settled documents disagree; browser-side makes the client the effective enforcer of `CONTENT-001`. *Current position:* the wire contract is identical either way; Variant B for the demo, Variant A recommended before real inventory. **Decision needed from:** Product + Engineering.

**Q11 — Recovery policy for terminal watermark failure.** Undefined everywhere. *Current position:* delete-and-reupload, an interim with no source. **Decision needed from:** Engineering.

**Q12 — Should video upload be disabled at MVP?** `mvp-prd.md` §7.7 says *"photo/video"*, but no video watermarking mechanism exists in the ₹0 stack. *Current position:* accepted, because disabling a named capability silently would be worse. **Decision needed from:** Product.

**Q13 — Which fields are "core" under `OWNER-003`?** The six-column list is `database-design.md`'s implementation choice, not a sourced set. **`size` is not frozen**, yet it is one of the four comparison fields `BR-VIEWER-002` names. *Current position:* the six columns; **recommend adding `size`**. **Decision needed from:** Product.

**Q14 — Can `type_code` change after creation?** *Current position:* immutable; changing it would invalidate `attributes` and could leave an approved listing describing the wrong asset. **Decision needed from:** Product.

**Q15 — Should a rejected listing reuse the same record on resubmission?** *Current position:* same record, following `database-design.md`. **Decision needed from:** Product.

**Q16 — What happens to a `REQUESTED` request when its listing is paused or delisted?** *Current position:* nothing auto-changes, but the request becomes unconfirmable until the listing is visible again. **Decision needed from:** Product.

**Q17 — Which Site Intelligence fields make `site_intelligence_complete` true?** `mvp-prd.md` §8 lists nine field groups and never says whether all are needed. *Current position:* server-computed against a documented key set, threshold undefined. **Decision needed from:** Product.

**Q18 — Should `COMPLETED` requests continue to block their dates?** `system-architecture.md` §27 declines to decide; `database-design.md` §24 says yes. *Current position:* yes — a physical hoarding's past campaign is a historical fact. **Decision needed from:** Product.

**Q19 — Should the search endpoint accept date-availability filters?** (§10.4) Two settled documents disagree. *Current position:* accepted, opt-in, marked beyond the approved filter set. **Decision needed from:** Product.

**Q20 — Should the hoarding-type filter support multi-select?** *Current position:* single-valued, with the repeated-parameter syntax reserved. **Decision needed from:** Product.

### 46.4 Requests and SLA

**Q21 — The exact Publisher response SLA, and what starts the clock.** `mvp-prd.md` §14 asks and does not answer. *Current position:* 48 hours from `created_at`, redefinable without a migration. **Decision needed from:** Product.

**Q22 — Who records `amount_agreed`, and when?** *Current position:* the owning Publisher, post-confirmation. **Decision needed from:** Product.

**Q23 — Must completion wait for the request's end date?** `REQUEST-003` enforces only the start-date floor; an end-date floor is *"not textually prohibited"*. *Current position:* start date only. **Decision needed from:** Product.

**Q24 — Should Viewer cancellation of a pending request exist?** *Current position:* not an MVP feature; `501` reserved. **Decision needed from:** Product.

**Q25 — Should new submissions against already-confirmed dates be blocked outright?** `request-engine.md` §9 flags its own answer as an inference. *Current position:* blocked, so a Viewer is never shown a Pending state that can never resolve. **Decision needed from:** Product.

**Q26 — When SLA expiry and a Publisher response race, which *should* win?** *Current position:* whichever commits first — a mechanical guarantee, not a product statement. **Decision needed from:** Product.

**Q27 — Should a soft cap on simultaneous pending requests per Viewer exist?** `mvp-brd.md` §12/§17 names it as a live risk-mitigation idea, not a decision. *Current position:* not built; rate limiting addresses the adjacent risk (§30.4). **Decision needed from:** Business.

**Q28 — Can a suspended Publisher still accept or reject a pending request?** `ADMIN-002` addresses only confirmed requests. *Current position:* yes — a Viewer with a pending request deserves an answer rather than a silent expiry. **Decision needed from:** Product.

**Q29 — Should timezone be `Asia/Kolkata` rather than UTC for date comparisons?** (§4.4) A UTC `current_date` flips a campaign to `LIVE` at 05:30 IST. *Current position:* flagged; **recommend `Asia/Kolkata`**. **Decision needed from:** Engineering.

### 46.5 Admin, notifications, and privacy

**Q30 — Are Publisher contact details ever visible to a Viewer?** The most consequential open question in this API. `mvp-prd.md` §6.2 requires the parties to *"settle offline"* after confirmation, which needs a channel; `mvp-brd.md` §12 names disintermediation as the top structural risk. *Current position:* **never**, at any state — withholding is reversible and revealing is not, and contact fields are gated at one point so a post-confirmation reveal is a small change. **Decision needed from:** Business + Product, before launch. *"Settle offline" without a channel is an incomplete flow.*

**Q31 — Should suspension cascade to delisting?** `admin-platform.md` §16 records both readings as defensible. *Current position:* independent, per `ADMIN-004`'s literal wording — a suspended Publisher's approved listings stay live until each is delisted. **Decision needed from:** Business (trust and safety).

**Q32 — What is the scope of Admin's "edit for moderation only"?** *"Completely unelaborated in any source document."* *Current position:* no Admin listing-edit endpoint exists. **Decision needed from:** Product.

**Q33 — Does Admin need individual-request visibility for disputes?** *Current position:* no, per the approved restriction — which produces the documented asymmetry where an Admin may `COMPLETE` a request they cannot `GET` (§6.6). **Decision needed from:** Product, with the Support/Dispute Runbook.

**Q34 — Does Admin need bulk listing approval?** `mvp-prd.md` §14 asks and does not answer. *Current position:* not built. **Decision needed from:** Product.

**Q35 — Should Publisher verification and suspension outcomes notify the Publisher?** Not in `mvp-prd.md` §7.6's event list. *Current position:* no notification; the Publisher discovers it on their next profile read. **Recommend reconsidering** — waiting on verification with no signal is poor onboarding. **Decision needed from:** Product.

**Q36 — Should `LIVE` and `COMPLETED` transitions notify anyone?** Not in the event list. *Current position:* no. **Decision needed from:** Product.

**Q37 — Who receives `REQUEST_EXPIRING_SOON`?** `request-engine.md` says Publisher; `viewer-platform.md` says Viewer. *Current position:* both. **Decision needed from:** Product.

**Q38 — Which channel ships alongside push?** `mvp-prd.md` §14 asks; the ₹0 stack excludes SMS, which effectively answers it as email — but that is a stack constraint, not a product decision. No push provider is named anywhere either. **Decision needed from:** Product.

**Q39 — Should the BRD's wider KPIs appear on the Admin dashboard?** Median response time and repeat usage are in `mvp-brd.md` §14 but not `mvp-prd.md` §7.5. They are computable from `request_status_history` today. *Current position:* not on the dashboard. **Decision needed from:** Product + Analytics.

**Q40 — Should an Admin-performed `COMPLETE` write an `admin_actions` row?** It currently does not. *Current position:* not written; the transition is captured in `request_status_history`. **Decision needed from:** Product.

**Q41 — Should `unsuspend` and `relist` exist at all?** Neither reversal is described in any source document; both are included as Recommendations because leaving no undo path is operationally untenable. **Decision needed from:** Product.

**Q42 — What happens after a verification rejection?** Retry, cooldown, or permanent block — undefined. *Current position:* the row stays `REJECTED`; a later `verify` succeeds. **Decision needed from:** Product.

**Q43 — Should `suspended` be a fourth `verification_status` value instead of an independent boolean?** `admin-platform.md` §18 suggests the former; `database-design.md` §17 chose the latter to avoid state reconstruction on unsuspend. *Current position:* independent boolean. **Decision needed from:** Product sign-off.

### 46.6 Cross-cutting

**Q44 — Normalize query parameters to `snake_case`?** (§4.7) *Current position:* keep `mvp-prd.md` §9's camelCase, accept snake_case aliases. **Decision needed from:** Engineering.

**Q45 — Rate-limit values.** No source requirement exists; every value in §30 is a recommendation to tune against real traffic. **Decision needed from:** Engineering + Product.

**Q46 — Data-retention policy.** None exists in any source document. Belongs to the unwritten Security & Data Privacy document. **Decision needed from:** Business + Legal.

**Q47 — Replay protection on job routes.** Deferred because every job is idempotent; worth revisiting before real inventory. **Decision needed from:** Engineering.

**Q48 — Should `/viewers/me` and `/publishers/me` collapse into one `/me`?** *Current position:* separate, because their `PATCH` field sets genuinely differ. **Decision needed from:** Engineering.

**Q49 — Should a "listing submitted" notification reach Admin?** No Admin-facing notification event exists; the queue is polled. Adding one means adding a `notifications.type` value — a scope decision. **Decision needed from:** Product.

### 46.7 Documentation gaps this specification depends on

| Gap | Status | Impact here |
|---|---|---|
| `docs/03-modules/owner-platform.md` | **Absent — sixth confirmation** | All Publisher endpoints derived from `mvp-prd.md` §7.2 directly (§22) |
| Content Moderation Guidelines (`README.md` #12) | Not started | No rejection rubric exists; `review_flags` carries only what a rule names (§24.5) |
| Support / Dispute Handling Runbook (#13) | Not started | Admin's request-visibility boundary and F5 both depend on it |
| Security & Data Privacy (#8) | Not started | Retention, DR, and PII policy (§33.11) |
| Terms of Service (#9) | Not started — *"highest priority"* | Must disclaim SEEABLE's role in the offline transaction before real users onboard |
| Analytics & Event Tracking Plan (#11) | Not started | Where the BRD's wider KPIs surface (Q39) |
| `NOTIF-001` scope gap in `mvp-prd.md` | Unresolved | The rule covers Request Engine changes; §7.6 also lists listing events (§25.1) |
| `mvp-brd.md` `BR-OWNER-001/002` ID collision | Unresolved | Traceability uses the unambiguous PRD IDs (§43) |
| `BR-ADMIN-00X` collision across three documents | Unresolved | This document uses only the MVP-scoped IDs |

---

## 47. API Design Decisions

ADR-style. All **Proposed** — no architectural decision in this project has yet been formally accepted (`system-architecture.md` §40).

### ADR-API-001 — REST over HTTP/JSON at `/api/v1`

**Context.** `mvp-prd.md` §9 already specifies REST-shaped, `/api/v1`-prefixed endpoints — the closest thing to a prior architectural decision this project has.
**Decision.** Adopt it. Resource-oriented REST, JSON, path versioning, no GraphQL, no second paradigm.
**Alternatives.** GraphQL (rejected — no source mentions it, the brief forbids it, and a second query paradigm over 14 endpoints is infrastructure without a requirement); RPC-style (rejected — discards the existing endpoint list).
**Consequences.** Some operations do not map cleanly onto a verb, which ADR-API-003 addresses. Over-fetching on the listing detail is accepted at this scale.
**Status: Proposed.**

### ADR-API-002 — Authorization is enforced server-side, in three layers

**Context.** `system-architecture.md` §44 rule 2; `mvp-brd.md` §10 makes trust the primary NFR.
**Decision.** Route-level role checks, RLS on all 11 tables, and explicit guards inside every `SECURITY DEFINER` function. Role is read from `profiles.role`, never from a token claim. Ownership checks are separate from role checks and both are mandatory.
**Alternatives.** RLS alone (rejected — the state-transition functions bypass RLS by design and must guard themselves); route checks alone (rejected — a forgotten check becomes a data breach).
**Consequences.** Some checks are duplicated. That is the point: `system-architecture.md` §18 names conflating role with ownership as the most likely marketplace bug.
**Status: Proposed.**

### ADR-API-003 — Clients request actions; the server determines state

**Context.** `mvp-prd.md` §9 fixes `PATCH /api/v1/requests/{id}` for accept, reject, and complete. Request state is exclusively the Request Engine's (`system-architecture.md` §44 rule 3).
**Decision.** One endpoint, an `action` discriminator, and a hard refusal of any body containing `status`.
**Alternatives.** `POST /requests/{id}/accept` etc. (rejected — contradicts §9, and splits the system's most safety-critical operation across three idempotency and concurrency surfaces); `PATCH {"status": "CONFIRMED"}` (rejected — implies the client chooses the outcome; `ACCEPT` may legitimately fail because the world changed).
**Consequences.** `PATCH` is not a JSON-merge patch here — a mild verb abuse, accepted to preserve the approved endpoint list. Enforced beneath the API by the absence of any client `UPDATE` grant on `requests`.
**Status: Proposed.**

### ADR-API-004 — Request confirmation is transactional, with a database-level backstop

**Context.** `REQUEST-004`: no two overlapping requests may both reach `CONFIRMED`.
**Decision.** One `SECURITY DEFINER` function performing lock → precondition checks → re-validation → update → notification insert, sitting on a `btree_gist` exclusion constraint.
**Alternatives.** Application-level check-then-write (rejected — `READ COMMITTED` leaves a window two concurrent transactions both pass; §19.3 Case 2); distributed locking (rejected — no requirement, and `system-architecture.md` §7 explains why the monolith exists); `SERIALIZABLE` isolation (rejected — adds retries for a guarantee the constraint already holds).
**Consequences.** Confirmation is one `rpc()` call, not composable from smaller ones. The loser of a race gets a deterministic `409 REQUEST_DATE_CONFLICT` with the conflicting range.
**Status: Proposed.**

### ADR-API-005 — Only watermarked media is ever addressable publicly

**Context.** `CONTENT-001`; `mvp-prd.md` §7.7.
**Decision.** No response at any privilege level contains a URL resolving to `hoarding-private`. Originals are reachable only through `GET /media/{id}/original`, which checks ownership server-side and returns a 300-second signed URL. `original_storage_path` is column-`REVOKE`d from every client role.
**Alternatives.** Omitting the field from serializers (rejected — a rule, not a control; a future `SELECT *` would leak it); no original access at all (rejected — the uploading Publisher and a reviewing Admin have legitimate need).
**Consequences.** Under the browser-side pipeline the watermark is client-produced, which is a real integrity gap mitigated only by Admin review (§14.2, Q10).
**Status: Proposed.**

### ADR-API-006 — One response envelope, used everywhere

**Context.** The error taxonomy needs a machine code; `request_id` must be visible to users; pagination needs a home.
**Decision.** `{success, data, meta, request_id}` and `{success, error, request_id}` on every `/api/v1` endpoint, with exactly two documented carve-outs (`/api/health`, `/api/jobs/*`).
**Alternatives.** Bare bodies with RFC 7807 (rejected — makes success and error structurally unrelated, doubling client branching); a partial envelope (rejected — worse than either, and the failure mode §7.2 exists to prevent).
**Consequences.** One extra level of nesting on every access. Accepted.
**Status: Proposed.**

### ADR-API-007 — Idempotency on every critical mutation, in three layers

**Context.** A Publisher accepts, the database commits, the response is lost, the client retries.
**Decision.** State preconditions (safe by default), database constraints (absorb the common duplicates), and an optional `Idempotency-Key` header backed by a 24-hour store that replays the original response.
**Alternatives.** Preconditions alone (rejected — safe but returns `409` for an operation that succeeded); mandatory keys (rejected — breaks every simple client).
**Consequences.** Requires an `idempotency_keys` table the settled schema does not have (F8).
**Status: Proposed.**

### ADR-API-008 — Money is an INR decimal string

**Context.** `numeric(12,2)` in the settled schema; PostgREST returns `numeric` as a string.
**Decision.** Decimal string, exactly two fractional digits, both directions. `currency` is response-only.
**Alternatives.** Integer paise (rejected — inserts ×100/÷100 conversions on every read and write against `numeric(12,2)`, each a rounding bug); JSON number (rejected — client-side arithmetic on `amount_agreed` produces float artefacts).
**Consequences.** Clients must parse to a decimal type, not a float.
**Status: Proposed.**

### ADR-API-009 — Offset pagination, one mechanism

**Context.** 50–200 listings; the brief says choose the simplest correct mechanism.
**Decision.** `?page=&pageSize=`, default 20, max 100, with a `total` count.
**Alternatives.** Cursor (rejected — solves problems that do not occur at this scale, and loses the total count a page-numbered list wants); mixed mechanisms (rejected — guarantees inconsistency).
**Consequences.** Cross-page drift under concurrent inserts, cosmetic at this scale. Moving to cursors later is additive.
**Status: Proposed.**

### ADR-API-010 — `INVENTORY-003` is applied in exactly one place

**Context.** `ADMIN-001` violated is the worst read-path failure in the product. Three separate conditions across several endpoints.
**Decision.** One predicate, one implementation (`visible_hoardings`), never re-implemented in a route handler and never cached.
**Alternatives.** Per-endpoint filtering (rejected — `system-architecture.md` §10: a listing slipping through one of three checks is a direct `ADMIN-001` violation); a cached visibility flag (rejected — `system-architecture.md` §37: visibility must never be served stale).
**Consequences.** Every visible-inventory read goes through the view. Approval takes effect with no reindex and no window.
**Status: Proposed.**

### ADR-API-011 — Publisher contact details are never exposed to Viewers at MVP

**Context.** `mvp-brd.md` §12 and §17 name disintermediation as the top structural risk; `viewer-platform.md` §28 leaves the policy explicitly open.
**Decision.** `business_name` and `is_verified` only, at every request state. Contact fields are gated at one point rather than scattered across serializers.
**Alternatives.** Reveal post-confirmation (a serious contender — `mvp-prd.md` §6.2 requires the parties to settle offline; deferred to Q30); reveal pre-request (rejected — maximizes the named risk).
**Consequences.** "Settle offline" currently has no in-product channel. This is a known incompleteness, flagged as blocking before launch rather than papered over.
**Status: Proposed.**

### ADR-API-012 — Admin's request authority is narrow, and the API does not widen it

**Context.** `request-engine.md` §4 and §23 and `admin-platform.md` §12 restrict Admin to Mark Completed and aggregate counts. `database-design.md` §37.7 implements it by omitting `is_admin()` from the `requests` RLS policy.
**Decision.** No Admin request-browsing endpoint, no Admin accept/reject. The documented restriction is preserved even where it is inconvenient.
**Alternatives.** Add a read-only Admin request view (rejected — it would quietly remove an approved restriction; if operational need emerges it should come through the Support Runbook as a product decision).
**Consequences.** An Admin may `COMPLETE` a request they cannot `GET` (§6.6) — a real workflow gap, surfaced rather than closed unilaterally.
**Status: Proposed.**

### ADR-API-013 — Every capability gap in `mvp-prd.md` §9 is filled explicitly and labelled

**Context.** §9 provides endpoints for two of Admin's four capabilities, none for pause/delete/delist/submit, no single-request detail, and no notification endpoints.
**Decision.** Add the endpoints that approved functional requirements make technically necessary, label each **REQUIRED (derived)** or **RECOMMENDED**, and record every endpoint deliberately *not* created with the requirement that forbids it.
**Alternatives.** Implement only §9's list (rejected — four approved functional requirements would be unimplementable); add whatever seems useful (rejected — that is how `mvp-prd.md` §5's unelaborated "edit for moderation" becomes a manufactured feature set).
**Consequences.** The endpoint count roughly triples. Each addition is traceable to a requirement, and §24.2 lists what was refused.
**Status: Proposed.**

---

## 48. Quality Requirements — Consistency Audit

Performed against the finished document. Each item states what was checked, not merely that it passed.

### 48.1 Coverage

| Check | Result |
|---|---|
| Every `mvp-prd.md` §9 endpoint documented | **Pass.** All 14, verbatim paths (§44) |
| Every MVP module has API coverage | **Pass.** Auth, Inventory, Publisher, Viewer, Request Engine, Admin, Notifications, Content Protection — all seven, plus jobs and health |
| Every requirement ID mapped to a surface | **Pass.** All 22, plus the four flagged as having none and why (§43, §43.1) |
| Every module document's flagged API gap addressed | **Pass.** Publisher verification, suspension, delisting, pause, delete, submit, single-request detail, notifications — each now has an endpoint, labelled and justified |

### 48.2 Correctness against the rules

| Check | Result |
|---|---|
| No API violates the §5 role permissions | **Pass.** §6.6's matrix is derived from `mvp-prd.md` §5, and Admin's absence from request accept/reject is preserved |
| No API exposes private media | **Pass.** No response contains a `hoarding-private` URL; the column is `REVOKE`d; §14.6 is the only original-access route |
| No API lets a client mutate request status directly | **Pass.** Action-only (§20), plus no client `UPDATE` grant on `requests` |
| No API bypasses Admin approval | **Pass.** `approval_status` is never client-writable; `INVENTORY-003` is applied in one place |
| No API allows double confirmation | **Pass.** Lock + re-validation + exclusion constraint (§19); the loser gets a deterministic `409` |
| No API introduces payment functionality | **Pass.** No payment endpoint, field, schema, or enum value. `amount_agreed` is documented five separate times as record-keeping only |
| No API contradicts `database-design.md` | **Pass** on behavior. **Nine deviations and defects are documented as such** in §46.1 rather than silently absorbed |
| No API contradicts `system-architecture.md` | **Pass.** All twelve implementation rules are honored and cited at the point they apply |

### 48.3 Internal consistency

| Check | Result |
|---|---|
| Request state transitions consistent everywhere | **Pass.** §18.2's six transitions are the only ones referenced in §19, §20, §28, §32, and §37 |
| Field names consistent | **Pass.** `snake_case` bodies matching column names, with three documented derivations (§38.3) and one documented query-parameter exception (§4.7) |
| Enum names consistent | **Pass.** §38.2 matches `database-design.md` §28.12 exactly; three near-misses are explained (`AVAILABLE`, `SUSPENDED`, `DELISTED`) |
| Date formats consistent | **Pass.** `YYYY-MM-DD` inclusive-inclusive for campaign dates; ISO-8601 UTC for timestamps; the timezone ambiguity is flagged, not hidden |
| Money format consistent | **Pass.** Decimal string everywhere, including `maxPrice`, `amount_agreed`, and `confirmed_value` |
| Error format consistent | **Pass.** One envelope, one `details` shape per code, `422` always carrying `fields` |
| Envelope used consistently | **Pass.** Every `/api/v1` endpoint; two carve-outs named as a closed list (§7.4) |
| Pagination consistent | **Pass.** One mechanism; §9.4 lists which endpoints paginate and which are bounded |
| Authentication assumptions explicit | **Pass.** §5.1's four-concept split; §5.3's MVP-target-vs-demo-variance table |
| Demo-only behavior not presented as production | **Pass.** The AUTH-002 variance is labelled at §5.3, §17.4 gate 2, §43, and §46 — never silently applied |

### 48.4 Assumptions not silently promoted

Every inference in this document carries a label. The load-bearing ones:

| Assumption | Labelled at |
|---|---|
| Submissions against confirmed dates are blocked at creation | §17.4 gate 6 |
| `CONFIRMED → LIVE` is system-triggered | §18.3, §28.5 |
| A rejected listing reuses its record on resubmission | §12.5 |
| At least one media asset is required to submit | §12.5 gate 8 |
| `COMPLETED` continues to block its dates | §15.1 |
| `amount_agreed` is Publisher-set, post-confirmation | §20.4 |
| The SLA clock starts at `created_at` | §18.3 |
| Admin accounts are provisioned out of band | §5.6 |
| Campaign dates are Asia/Kolkata | §4.4 |
| `maxDistance` is in kilometres | §10.2 |
| Filters combine with AND | §10.3 |
| The API wraps Supabase Auth rather than the client calling it directly | §5.2 |

### 48.5 Genuine conflicts surfaced rather than resolved

| Conflict | Where |
|---|---|
| Media pipeline: server-side worker vs. browser-side Canvas | §14.2, Q10 |
| `REQUEST_EXPIRING_SOON` recipient: Publisher vs. Viewer | §27.3, Q37 |
| Date-availability search filter: data layer supports it, product documents exclude it | §10.4, Q19 |
| Query-parameter casing: PRD camelCase vs. schema snake_case | §4.7, Q44 |
| `required_attribute_keys` seed vs. `mvp-prd.md` §8 | §39.4, F6 |
| `NOTIF-001` wording vs. `mvp-prd.md` §7.6's event list | §25.1 |
| Suspension cascade to delisting: two defensible readings of `ADMIN-004` | §25.4, Q31 |
| `suspended` as a boolean vs. a fourth `verification_status` value | §38.2, Q43 |

### 48.6 Deferred scope confirmed absent

Searched the finished document for payment, escrow, commission, contract, campaign, agency, CMS, device, AI, recommendation, and DRM concepts appearing as endpoints, fields, schemas, or enum values.

**Result: none present.** Every occurrence of those words is in a §45 "Future" table, a §4/§16 scope statement, or an explicit "does not exist at MVP" note. The OpenAPI `paths` block contains only the MVP surface, so a generated client cannot reference a deferred concept.

### 48.7 Fitness for purpose

| Audience | Assessment |
|---|---|
| **Backend** | Every endpoint states authorization, validation order, transaction boundary, database function, side effects, and error mapping |
| **Frontend** | Every response shape is complete; `available_actions`, `submission_readiness`, and `status_label` remove the need to re-implement server rules client-side |
| **QA** | Every rule ID maps to an endpoint and an error code (§43); §32.2's eight races and §40–§42's examples are directly executable as test cases |
| **OpenAPI generation** | §37 is complete, parses cleanly, and has no unresolved `$ref` — 41 paths, 49 operations, 72 schemas |
| **Future maintenance** | §36 defines what is additive; §45 names what Phase 2 adds; §46 records every decision still owed, with its owner |

### 48.8 The one thing this document cannot certify

**Three defects in `database-design.md` (F1, F2, F3) mean that, as the schema stands today, three documented responses cannot be served correctly:** availability reports every date as free to every Viewer, the `publisher` block on every listing is unreadable, and the Publisher request inbox returns nothing. None is a flaw in this API's design, and each has a small, specific fix in §46.1 — but **the API cannot be implemented as specified until they are applied.** They are stated here rather than buried so that they are fixed before, not after, the first integration test fails.

---

*End of SEEABLE Hoardings — Full API Specification.*
