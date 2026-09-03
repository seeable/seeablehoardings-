# SEEABLE Hoardings — MVP Product Requirements Document (PRD)

**Document Type:** Product Requirements Document (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.0
**Status:** Draft for Review
**Date:** 26 August 2026
**Related Documents:** SEEABLE_Hoardings_Master_PRD_Framework.md, claude_SEEABLE_Hoardings_BRD.md, docs/03-modules/inventory.md, docs/03-modules/owner-platform.md, docs/01-product/mvp-scope.md
**Supersedes:** docs/01-product/mvp-scope.md (this document expands it into full requirement detail)

---

## 1. Executive Summary

This PRD defines everything required to ship the first working version of SEEABLE Hoardings: a two-sided marketplace connecting hoarding **Publishers** (inventory owners) with **Viewers** (advertisers/media buyers) for outdoor advertising space in Bengaluru. The MVP proves the core marketplace loop — list, discover, request, confirm — end to end. The one deliberate gap is **payment**: all commercial settlement happens outside the platform at this stage. Every other part of the flow, including conflict-safe date requests, listing approval, and notifications, is fully functional.

## 2. MVP Objective

Validate that Publishers will list real inventory and Viewers will use the platform to find and request it, at a working scale of **50+ live hoardings**, before investing in payment infrastructure, digital screens, campaigns, agencies, or AI. Every module below is a strict subset of its full-scope counterpart in the Master PRD Framework — nothing here needs to be rebuilt later, only extended.

## 3. Scope

### 3.1 In Scope — MVP Modules (7)

| # | Module | One-line purpose |
|---|---|---|
| 1 | Auth & Roles | Single login, two primary roles (Publisher, Viewer) plus internal Admin |
| 2 | Publisher Module | Profile, hoarding listings, request inbox |
| 3 | Viewer Module | Browse, search, map, date requests |
| 4 | Request Engine | The booking-lite state machine, minus payment |
| 5 | Admin Module | Listing approval, Publisher verification, basic counts |
| 6 | Notifications | Request and approval events |
| 7 | Content Protection | Watermarking on media upload |

### 3.2 Out of Scope — Deferred Post-MVP

| Deferred | Reason |
|---|---|
| Online payment, escrow, commissions | Explicitly excluded from this version by decision |
| Digital screens, CMS, device management | No digital inventory at launch |
| Campaign management | MVP is single-hoarding requests, not multi-site campaigns |
| Agency platform | Single-advertiser flow only at MVP |
| AI recommendations / creative assistance | Site Intelligence data is captured now so AI can consume it later, but no AI logic ships in MVP |
| Contract generation | Manual/offline agreements at MVP |
| Full analytics suite | Basic counts only |
| Screenshot/DRM protection | Watermarking only; deterrent-grade DRM is future work |

### 3.3 Scale & Launch Target

- **Geography:** Bengaluru, single city at launch
- **Inventory volume:** 50+ approved hoardings live in search at any time
- **Currency:** INR (₹)
- **Users:** Publishers (supply), Viewers (demand), internal Admin (moderation) — no Agency or Technician roles at MVP

## 4. Actors

| Actor | MVP Role |
|---|---|
| Publisher | Lists and manages hoarding inventory; accepts/rejects requests |
| Viewer | Searches inventory; sends date requests |
| Admin | Approves listings, verifies Publishers, monitors basic platform health |

Advertising Agency, Hoarding Operator, Technician, Finance Team, and Public Viewer (street-level) from the full framework are **not active roles in MVP**.

## 5. Roles & Permissions

| Action | Publisher | Viewer | Admin |
|---|---:|---:|---:|
| Create/edit own listing | Yes | No | No (edit for moderation only) |
| Browse/search listings | Yes | Yes | Yes |
| Submit date request | No | Yes | No |
| Accept/reject request | Yes (own listings) | No | No |
| Approve/reject listing | No | No | Yes |
| Verify Publisher | No | No | Yes |
| View platform-wide counts | No | No | Yes |

## 6. User Journeys

### 6.1 Publisher Journey

```text
Register → Verify (lightweight) → Add Hoarding
    ↓
Select Type → Fill Base + Type-Specific Fields → Upload Media (watermarked)
    ↓
Submit for Review → Admin Approves
    ↓
Listing Live → Receive Request → Accept / Reject
    ↓
(Settle offline) → Mark Completed
```

### 6.2 Viewer Journey

```text
Register → Browse / Search / Filter (type, distance, budget)
    ↓
View Listing Detail → Request Dates
    ↓
Await Publisher Response
    ↓
Confirmed → (Settle offline) → Campaign Period → Completed
```

## 7. Module Requirements

### 7.1 Auth & Roles

**Functional requirements**
- Registration and login for Publisher and Viewer via phone or email OTP
- Role selected at signup; one account = one role at MVP (no dual-role accounts yet)
- Minimal profile: name, phone/email, city
- Session persistence with standard secure token handling

**Business rules**
- **AUTH-001:** A single account cannot hold both Publisher and Viewer roles at MVP.
- **AUTH-002:** Verification (OTP) is required before a Publisher can submit a listing or a Viewer can send a request.

### 7.2 Publisher Module

**Functional requirements**
- Profile setup: name, phone, business name (optional), verification status
- Add/edit/pause/delete hoarding listings
- Listing form branches by **hoarding type** (see §8 for full taxonomy)
- Media upload with automatic watermarking (see §7.7)
- Simple availability calendar (block/unblock dates)
- Flat pricing per listing (no dynamic/seasonal pricing at MVP)
- Request inbox: Accept / Reject incoming Viewer requests
- Revenue view: list of Confirmed requests (no payout ledger — settlement is offline)

**Business rules**
- **OWNER-001:** A Publisher cannot accept two requests with overlapping dates on the same hoarding.
- **OWNER-002:** A request left unanswered past the response SLA auto-expires and releases the dates.
- **OWNER-003:** Core listing fields cannot be edited while a request on that listing is pending confirmation.
- **OWNER-004:** An unverified Publisher can draft listings but cannot submit them for Admin approval.

### 7.3 Viewer Module

**Functional requirements**
- Browse and search all approved, available listings
- Filters: hoarding type, distance from a chosen point, budget/price ceiling
- Map view with markers, distance-based radius visualization
- Listing detail page: photos, type-specific specs, price, Site Intelligence summary
- Submit a date-range request on a listing
- Track own requests: Pending / Confirmed / Rejected

**Business rules**
- **VIEWER-001:** A Viewer can hold multiple simultaneous Pending requests across different listings.
- **VIEWER-002:** A Viewer cannot submit a second request on a listing while an existing request from them on that listing is still Pending.

### 7.4 Request Engine

**Functional requirements**
- State machine: `AVAILABLE → REQUESTED → CONFIRMED / REJECTED → LIVE → COMPLETED`
- Automatic conflict detection — a hoarding cannot be Confirmed for two overlapping date ranges
- Manual "Mark Completed" action (Publisher or Admin) once the campaign period ends, since there is no payment event to trigger closure automatically
- An "amount agreed" field captured for record-keeping, not enforced or collected

**Business rules**
- **REQUEST-001:** Confirming a request automatically blocks those dates against all other pending requests on the same hoarding.
- **REQUEST-002:** A Rejected or expired request releases its dates back to Available immediately.
- **REQUEST-003:** A request cannot move to Completed before its own start date.

### 7.5 Admin Module

**Functional requirements**
- Listing approval queue — Approve / Reject with a reason
- Publisher verification queue
- Platform counts dashboard: total listings, pending approvals, total requests, confirmation rate
- Ability to suspend a Publisher or delist a hoarding

**Business rules**
- **ADMIN-001:** No listing reaches Viewer search results without passing Admin approval.
- **ADMIN-002:** Suspending a Publisher does not cancel already-Confirmed requests; those complete as agreed, but the Publisher cannot create new listings while suspended.

### 7.6 Notifications

**Functional requirements**
- Events covered: new request received, request accepted/rejected, request expiring soon, listing approved/rejected
- Channels at MVP: push + one of SMS/email (pick one to avoid building all channels day one)

**Business rules**
- **NOTIF-001:** Every state change in the Request Engine triggers a notification to the affected Publisher or Viewer within a defined delay (e.g., under 5 minutes).

### 7.7 Content Protection

**Functional requirements**
- Every uploaded photo/video is passed through an automatic watermark pipeline (Publisher ID + geo + timestamp) before it is stored or served
- Unwatermarked originals are never exposed via a public URL

**Business rules**
- **CONTENT-001:** A listing cannot be submitted for Admin approval if any of its media assets have not completed watermarking.

Screenshot/download deterrents (right-click disable, blur-on-tab-switch) are explicitly **not** part of MVP — see §3.2.

## 8. Hoarding Type Taxonomy (Inventory Data)

Every listing has a `type`, and each type carries its own required fields on top of shared base fields (location, size, price, availability, photos).

**Static**

| Type | Type-specific fields |
|---|---|
| Unipole / Bulletin Billboard | pole height, facing direction, road name, visibility distance |
| Gantry | span width, road spanned, clearance height |
| Metro Pillar | metro line, pillar number, nearest station, platform-facing (Y/N) |
| Wall Wrap / Building Wrap | building name, wrap area, floors covered |
| Transit Media | vehicle type, route number, fleet operator, vehicle registration |
| Bus Queue Shelter | shelter ID, route(s) served |

**Digital** (data model supported; no live digital inventory at MVP launch — see §3.2)

| Type | Type-specific fields |
|---|---|
| Digital Billboard | resolution, pixel pitch, brightness, loop duration |
| Digital Screen (mall/transit) | network ID, zone |

### Site Intelligence Layer (captured at MVP, not yet consumed by pricing/AI)

Footfall count (with source: sensor / third-party / self-reported), traffic split (vehicular/pedestrian), demographics (age band, gender, SEC class), commute mode split, dwell time, peak/off-peak curve, nearby POIs, data recency, confidence flag.

**Business rule**
- **INVENTORY-001:** Type-specific required fields must be complete before a listing can be submitted for review.
- **INVENTORY-002:** Site Intelligence data is optional at MVP submission but flagged "incomplete" in the Admin queue if missing.

## 9. API Requirements

```text
POST  /api/v1/auth/register
POST  /api/v1/auth/verify-otp

GET   /api/v1/hoardings?type=&city=&maxDistance=&maxPrice=
GET   /api/v1/hoardings/{id}
POST  /api/v1/hoardings                    (Publisher)
PATCH /api/v1/hoardings/{id}                (Publisher)
POST  /api/v1/hoardings/{id}/media          (Publisher)

POST  /api/v1/requests                      (Viewer)
GET   /api/v1/requests/me                   (Viewer)
GET   /api/v1/publishers/me/requests        (Publisher)
PATCH /api/v1/requests/{id}                 (accept/reject/complete)

POST  /api/v1/admin/hoardings/{id}/approve
POST  /api/v1/admin/hoardings/{id}/reject
GET   /api/v1/admin/dashboard
```

## 10. Non-Functional Requirements (MVP-appropriate)

- **Performance:** Search and listing detail should feel responsive at 50–200 listings; no requirement yet for the scale-phase target of thousands of concurrent listings.
- **Availability:** Best-effort uptime at MVP; a formal 99.9% SLA is a scale-phase commitment, not a launch requirement.
- **Scalability:** Data model (esp. type-specific attributes as structured JSON — see `inventory.md` §8) must support new hoarding types and future payment fields without a schema rewrite.
- **Security:** OTP-based auth, standard encryption in transit, watermark pipeline isolated from public asset serving.

## 11. Edge Cases

- Two Viewers submit overlapping requests near-simultaneously on the same hoarding — the second must be blocked or queued, never silently Confirmed.
- Publisher ignores a request past the response SLA.
- Publisher tries to edit a listing while a request on it is Pending.
- A hoarding is deleted or paused while a request on it is Pending or Confirmed.
- Media upload succeeds but watermarking fails or times out.
- A physical hoarding plausibly fits two types (e.g., a mall-entrance digital screen).

## 12. Acceptance Criteria (Representative)

```text
Given a hoarding has a Confirmed request for 1–15 September
When a Viewer submits a request for 10–20 September on the same hoarding

Then the new request is accepted into the queue as Pending
But it cannot be moved to Confirmed until the conflict is resolved
```

```text
Given a Publisher uploads a photo for a new listing
When the watermarking pipeline has not yet completed

Then the listing cannot be submitted for Admin review
And the Publisher sees a "processing media" status, not an error
```

## 13. Dependencies

- Master PRD Framework (`SEEABLE_Hoardings_Master_PRD_Framework.md`) — source of the full-scope module list this MVP is a subset of
- BRD (`claude_SEEABLE_Hoardings_BRD.md`) — business objectives and success metrics this MVP is validating
- `docs/03-modules/inventory.md`, `docs/03-modules/owner-platform.md` — detailed module specs this PRD consolidates
- Watermarking pipeline (infra dependency, blocks listing approval if down)
- SMS/push notification provider (external integration)

## 14. Open Questions

- Which single notification channel (SMS or email) ships first alongside push?
- What is the exact response SLA before a Publisher's unanswered request auto-expires?
- Does Admin need bulk-approve for listings, or is one-by-one acceptable at 50-listing scale?
- Is there any in-app record of offline settlement (e.g., "mark as paid" checkbox for trust signaling), or is that fully outside the platform's concern at MVP?

## 15. Explicitly Deferred — What Ships Next

| Phase 2 addition | Plugs into |
|---|---|
| Online payment / escrow | Request Engine (`amount agreed` field already exists) |
| Agency platform | New module, reuses Viewer's search/request flow |
| Digital screens + CMS | New modules; Inventory schema already supports the `type` |
| AI recommendations | Site Intelligence data (already being captured) |
| Contracts | New module |
| Screenshot/DRM | Extends Content Protection |

## 16. Relationship to Full-Scope Framework

This PRD is a strict subset of the 18-module full-scope framework defined in the Master PRD Framework and detailed further in `docs/03-modules/`. Every MVP module maps 1:1 to a full-scope module with reduced functionality — no MVP decision requires a rebuild to reach full scope, only additive work, as laid out in `docs/01-product/mvp-scope.md` §7 (Rationale).

## 17. Requirement ID Index

```text
AUTH-001, AUTH-002
OWNER-001 – OWNER-004
VIEWER-001, VIEWER-002
REQUEST-001 – REQUEST-003
ADMIN-001, ADMIN-002
NOTIF-001
CONTENT-001
INVENTORY-001, INVENTORY-002
```

---

*End of MVP Product Requirements Document.*
