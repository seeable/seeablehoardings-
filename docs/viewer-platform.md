# SEEABLE Hoardings — Viewer Platform Module

**Document Type:** Module Specification (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.1
**Status:** Draft for Review
**Date:** 26 August 2026
**Related Documents:** `docs/01-product/mvp-prd.md`, `docs/01-product/mvp-brd.md`, `README.md` (Documentation Index), `docs/03-modules/inventory.md`, `docs/03-modules/owner-platform.md`, `docs/03-modules/request-engine.md` (planned)
**Revision Note (v1.1):** Introduces a demo/proof-of-concept variance to AUTH-002 — OTP verification is deferred in favor of email/mobile + password login — per explicit product direction. See the Demo Scope Note immediately below.

> **Note on sourcing:** This document extracts and organizes Viewer-side requirements that currently exist only inline in `mvp-prd.md` §4–§9 and `mvp-brd.md` §7.3, per the gap identified in the Documentation Index. `docs/03-modules/inventory.md` and `docs/03-modules/owner-platform.md` are referenced throughout as the sibling specs this module depends on, but were not available for direct cross-reading at the time of writing — field names and structure attributed to them here are instead drawn from the Hoarding Type Taxonomy in `mvp-prd.md` §8. Once those module docs exist, their terminology should be reconciled against this document; any conflict should be resolved in favor of `mvp-prd.md` as the authoritative source. No new product decisions are introduced — anything not already defined in the MVP PRD/BRD is explicitly marked as an **Open Question**, **Assumption**, or **Future Enhancement**.

> **Demo Scope Note (product direction, not from `mvp-prd.md`):** For this initial build, the purpose is to demonstrate and validate the core discovery → request loop, not to run real Publisher/Viewer trust at scale. On that direction, **OTP verification (AUTH-002) is deferred for now.** Viewer registration and login instead use **email or mobile number + password** — a standard credential check, but with no OTP, no phone/email ownership verification, and no lightweight-verification gate before a request can be submitted. This is a deliberate, explicit variance from the approved `mvp-prd.md` AUTH-002 requirement, not a redefinition of it — AUTH-002 remains the target for any build that handles real inventory or real user data. `mvp-brd.md` §10 frames verification/trust as "the primary NFR at this phase" precisely because there is no payment protection at MVP; that tradeoff still applies once this moves beyond a demo, and OTP verification should be restored before then. AUTH-002 also governs Publisher verification (`mvp-prd.md` §7.1); this note only updates the Viewer-facing document, but the same variance would need to be applied symmetrically on the Publisher side for the two flows to stay consistent — that is outside this module's scope to specify. Every section below that referenced OTP has been updated accordingly and flagged inline.

---

## 1. Module Overview

The Viewer Platform is the demand-side experience of SEEABLE Hoardings. It is the surface through which advertisers/media buyers, operating as **Viewers**, find and act on Bengaluru hoarding inventory listed by **Publishers**.

At MVP, a Viewer:

- Searches for advertising inventory
- Filters available hoardings
- Explores inventory on a map
- Opens hoarding details
- Evaluates price, specifications, and site information
- Selects a date range
- Submits a request
- Tracks the request status

The Viewer does **not** directly purchase inventory through SEEABLE at MVP. Commercial settlement — payment, invoicing, contracts — happens offline, outside the platform (`mvp-prd.md` §1, §3.2; `mvp-brd.md` §5.2). The Viewer Platform's job is to get a Viewer from "I need a hoarding" to "I have a confirmed date hold," and no further.

The Viewer is **not** a campaign-management user. Multi-hoarding campaign planning, budget allocation across sites, and campaign tracking are explicitly deferred (`mvp-prd.md` §3.2). At MVP, a Viewer interacts with inventory one hoarding, one request, at a time.

## 2. Module Objective

The MVP business objective this module serves is stated directly in `mvp-brd.md` §4.1: **reduce discovery friction** by letting Viewers find and compare Bengaluru hoarding inventory in one place, instead of contacting individual Publishers manually.

The Viewer Platform optimizes for one path, and nothing beyond it:

**Discover → Search → Filter → Evaluate → Request → Track**

Every capability in this document exists to support that path. Functionality that doesn't move a Viewer along it — campaign planning, negotiation tools, payment, agency workflows — is out of scope by design, not by oversight (see §4.2).

## 3. Viewer Role

Per `mvp-prd.md` §4–§5 and `mvp-brd.md` §6, §8, the Viewer is defined as follows.

| Capability | Viewer |
|---|---|
| Demand-side user | Yes |
| Search/browse inventory | Yes |
| Submit date requests | Yes |
| Track own requests | Yes |
| Create or manage inventory | No |
| Approve listings | No |
| Accept/reject requests | No |
| Access Publisher functionality | No |
| Access Admin functionality | No |
| Hold both Publisher and Viewer roles on one account | No — **AUTH-001** |

**AUTH-001** (`mvp-prd.md` §7.1) governs account behavior for the Viewer role and is treated here as authoritative and cross-referenced, not restated as a Viewer-specific rule (see §16). **AUTH-002** (OTP verification) is the approved MVP PRD requirement, but is varied for this demo build per the Demo Scope Note above — see §16 and §19.

## 4. Scope

### 4.1 In Scope

The following are supported by `mvp-prd.md` §3.1, §6.2, and §7.3:

- Viewer registration/login via email or mobile number + password (OTP deferred for this demo build — see Demo Scope Note; AUTH-002 remains the approved MVP PRD target)
- Browse approved inventory
- Search
- Filtering (hoarding type, distance, budget/price ceiling)
- Map discovery
- Listing detail
- Date-range request
- Request tracking
- Request status visibility (Pending / Confirmed / Rejected, plus Request Engine states that affect the Viewer — see §14)
- Viewer-relevant notifications (per NOTIF-001)

### 4.2 Out of Scope

The following are explicitly deferred for the platform as a whole (`mvp-prd.md` §3.2, `mvp-brd.md` §5.2) and therefore do not appear anywhere in the Viewer experience at MVP:

- Online payment
- Escrow
- Commission
- Campaign management
- Multi-hoarding campaign planning
- Agency platform
- AI recommendations
- Contract generation
- Advanced analytics
- Digital-screen purchasing (digital inventory types exist in the data model per `mvp-prd.md` §8, but no digital inventory is live for Viewers to request at MVP)
- Advanced personalization beyond what is described in §7

Any Viewer-facing feature not listed in §4.1 and not covered elsewhere in `mvp-prd.md` should be treated as out of scope for this module until the source documents say otherwise.

## 5. Viewer User Journey

The MVP Viewer flow, per `mvp-prd.md` §6.2:

```text
Register
    ↓
Login (email/mobile + password — OTP deferred for this demo build)
    ↓
Browse / Search / Filter
    ↓
Map or List Results
    ↓
Open Hoarding Detail
    ↓
Select Date Range
    ↓
Submit Request
    ↓
Pending
    ↓
Publisher Response
    ↓
Confirmed / Rejected
    ↓
Campaign Period
    ↓
Completed
```

| Phase | What happens | Platform involvement |
|---|---|---|
| **Discovery** | Viewer browses, searches, filters, and explores the map to find candidate hoardings. | Fully in-platform. |
| **Evaluation** | Viewer opens hoarding detail, reviews specs, price, media, and Site Intelligence to decide whether the site fits their need. | Fully in-platform. |
| **Request** | Viewer selects a date range and submits a request. Request enters Pending. | Fully in-platform; this is the primary conversion action. |
| **Confirmation** | Publisher accepts or rejects; conflict rules and SLA expiry apply (see §13–§14). | In-platform (Publisher-side action, Viewer-side visibility). |
| **Offline settlement** | Once Confirmed, commercial terms (price, payment, contract) are finalized directly between Viewer and Publisher, outside SEEABLE. | Explicitly **not** in-platform (`mvp-prd.md` §1, §6.2). |
| **Completion** | The campaign period runs; the request is manually marked Completed by the Publisher or Admin once the period ends (REQUEST-003). | In-platform status only; the underlying campaign activity itself is offline. |

A Viewer's request is a **date hold, not a paid booking** — this distinction is load-bearing throughout this document and matches the MVP glossary in `mvp-brd.md` §18 ("Request — the MVP's booking-lite mechanism, a date hold without payment").

## 6. Information Architecture

```text
Viewer Platform
├── Home / Discover
├── Search
├── Map
├── Search Results
├── Hoarding Detail
├── My Requests
│   └── Request Detail
├── Notifications
├── Profile
└── Settings
```

| Page | Purpose | Primary actions | Information displayed | Navigates to | Access |
|---|---|---|---|---|---|
| Home / Discover | Entry point; orient the Viewer toward search | Start search, browse categories | Search entry, hoarding categories, nearby inventory (see §7) | Search, Search Results, Map | Viewer (authenticated) |
| Search | Structured query entry | Enter location/keyword, apply filters | Search input, active filters | Search Results | Viewer |
| Map | Spatial discovery | Pan/zoom, select marker, adjust radius | Inventory markers, radius overlay | Hoarding Detail | Viewer |
| Search Results | Compare candidate listings | Sort/filter (where defined), switch to map, open a listing | Result cards (§11) | Hoarding Detail, Map | Viewer |
| Hoarding Detail | Full evaluation of one listing | Request Dates | Specs, media, price, Site Intelligence, Publisher info (§12) | Date Request flow, My Requests | Viewer |
| My Requests | Track all of the Viewer's own requests | Open a request, view status | List of requests with status (§15) | Request Detail | Viewer |
| Request Detail | Full detail on one request | View status/history | Hoarding info, dates, status, Publisher response | Hoarding Detail | Viewer (own requests only) |
| Notifications | Surface request/listing events relevant to the Viewer | Open related request/listing | Notification list (§18) | Request Detail, Hoarding Detail | Viewer |
| Profile | Manage own account info | Edit profile fields | Name, phone/email, city (§19) | — | Viewer |
| Settings | Account-level preferences | Session/notification settings where applicable | Minimal at MVP | — | Viewer |

Only pages directly justified by `mvp-prd.md` §7.3 and the Viewer journey (§5) are included. A Viewer cannot reach any Publisher or Admin surface (§3).

## 7. Viewer Home / Discovery

`mvp-prd.md` §7.3 establishes that a Viewer must be able to "browse and search all approved, available listings." The Home/Discover screen is the entry point into that capability.

Supported elements:

- Search entry point
- Location context (city — Bengaluru at MVP, per `mvp-prd.md` §3.3)
- Hoarding categories (the type taxonomy in §12)
- Nearby inventory (a location-scoped view of approved listings — a direct application of the distance filter in §9, not a separate recommendation feature)
- Basic inventory discovery leading into Search Results or Map

Recommendation engines, personalized ranking, and "recently relevant" logic driven by usage history are **not defined in the MVP PRD** and are explicitly deferred (`mvp-prd.md` §3.2, "AI recommendations"). Any such behavior is a **Future Enhancement**, not an MVP requirement.

## 8. Search

`mvp-prd.md` §7.3 requires that Viewers can "browse and search all approved, available listings." Search operates only over listings that have passed Admin approval (ADMIN-001) and are not paused or otherwise unavailable.

| Aspect | Behavior |
|---|---|
| Search input | Location/keyword-based, consistent with the inventory location model used across Filters (§9) and Map (§10). |
| Search behaviour | Returns approved, available listings matching the query; combines with active filters (§9). |
| Location search | Supported — search is location-centric, matching the "distance from a chosen point" filter and the single-city (Bengaluru) launch scope (`mvp-prd.md` §3.3). |
| Search results | Rendered as the result cards defined in §11. |
| Empty search results | The Viewer sees an explicit empty state (§20) rather than a blank screen; no results are silently withheld. |
| Invalid search | The Viewer sees a clear message rather than a generic error; the search action does not proceed to Results. |
| Search loading state | The Viewer sees a loading indicator while results are fetched (§20). |

Exact search ranking logic, autocomplete behavior, and typo-tolerance are not defined in `mvp-prd.md`. These are implementation details, not scope questions — where a decision is needed and undocumented, it is listed under §28.

## 9. Filters

`mvp-prd.md` §7.3 defines exactly three MVP filters. No others are in scope.

| Filter | Input type | Available values | Multi-select | Effect on results | Reset |
|---|---|---|---|---|---|
| Hoarding type | Category selector | The static types in §12 (Unipole/Bulletin Billboard, Gantry, Metro Pillar, Wall Wrap/Building Wrap, Transit Media, Bus Queue Shelter); digital types exist in the data model but have no live inventory at MVP (`mvp-prd.md` §3.2, §8) | Not specified in `mvp-prd.md` — see §28 (Open Question) | Restricts results to matching type(s) | Clears back to "all types" |
| Distance | Radius from a chosen point | Not numerically specified in `mvp-prd.md` | Single value (a radius, not a set) | Restricts results to hoardings within the radius | Clears back to no distance constraint |
| Budget / price ceiling | Numeric/range input | Not numerically specified in `mvp-prd.md` | Single ceiling value (a maximum, per "price ceiling" wording in §7.3) | Excludes listings priced above the ceiling | Clears back to no price constraint |

Filters combine (AND logic is the natural reading of "search and filter inventory by type, distance, and budget" in `mvp-brd.md` §7.3, though this is an inference, not an explicit statement — flagged in §28 for confirmation). No additional enterprise-style filters (illumination, audience, orientation, material, etc.) are introduced here even though they appear in the full-scope Master PRD Framework's Discovery Module — those are full-scope capabilities not carried into the MVP PRD, and are out of scope per §4.2.

## 10. Map-Based Discovery

`mvp-prd.md` §7.3 requires a "map view with markers, distance-based radius visualization."

| Aspect | Behavior |
|---|---|
| Map entry point | Reachable from Home/Discover and Search Results (list/map switching, §11). |
| Marker behaviour | Each marker represents one approved, available hoarding. |
| Marker selection | Selecting a marker surfaces a listing preview. |
| Listing preview | Shows enough information to decide whether to open the full detail page — aligned with the result-card fields in §11. |
| Opening listing details | From the preview, the Viewer can navigate to Hoarding Detail (§12). |
| Radius selection | The Viewer can set a distance radius, visualized on the map, corresponding to the Distance filter (§9). |
| List/map relationship | Map and Search Results reflect the same underlying filtered result set; switching views does not change the active filters. |
| Empty map state | No markers shown when no listings match; an explicit empty-state message is shown (§20). |
| Loading state | A loading indicator is shown while listings/markers load (§20). |
| Location permission | Not addressed in `mvp-prd.md`. If browser/device location is used to center the map or set a default radius origin, permission handling is required — flagged as an **Open Question** (§28) rather than an assumed behavior. |

No routing, geofencing, or advanced GIS layers (heatmaps, catchment overlays) are defined in the MVP PRD and are therefore out of scope.

## 11. Search Results

`mvp-brd.md` §7.3 (BR-VIEWER-002) requires that "search results must show enough standardized information... to support like-for-like comparison across Publishers," specifically: location, size, price, type. `mvp-prd.md` §7.3 additionally names photos as part of listing detail; a listing image on the result card is a reasonable extension of that for comparison purposes.

| Field | Source |
|---|---|
| Location | BR-VIEWER-002 |
| Hoarding type | BR-VIEWER-002 |
| Size | BR-VIEWER-002 |
| Price | BR-VIEWER-002 |
| Availability (where applicable) | Consistent with "approved, available listings" scope (`mvp-prd.md` §7.3) |
| Listing image | Extension of the media requirement in §12; watermarked per CONTENT-001 |

| Aspect | Status |
|---|---|
| Result card | As above. |
| Sorting | **Not defined in `mvp-prd.md`.** Not treated as an MVP requirement here — see §28. |
| Availability indicators | Shown on the card so a Viewer does not open an unavailable listing expecting to request it. |
| Distance | Shown when a location/radius context is active (§9–§10). |
| Price display | Flat price per listing, per `mvp-prd.md` §7.2 ("flat pricing per listing, no dynamic/seasonal pricing at MVP") — displayed as-is, no range or dynamic display logic. |
| Map/list switching | Supported (§10). |
| Pagination / infinite scroll | **Not defined in `mvp-prd.md`.** Given the MVP NFR target of 50–200 listings (`mvp-prd.md` §10), some form of result paging is likely necessary but the mechanism is unspecified — see §28. |
| Empty state | Explicit empty state, not a blank screen (§20). |

## 12. Hoarding Detail Page

The Hoarding Detail page is the Viewer's primary evaluation surface. All fields below are grounded in `mvp-prd.md` §7.3 and §8.

### Basic Information

- Hoarding type
- Location
- Size
- Price (flat, per listing — `mvp-prd.md` §7.2)
- Availability

### Media

- Watermarked photos (CONTENT-001 requires watermarking before any media is served publicly)
- Additional approved media: `mvp-prd.md` §7.7 covers "every uploaded photo/video," so watermarked video may also appear where a Publisher has uploaded it — treated as supported, not assumed beyond what CONTENT-001 already implies

### Location

- Map (the same map component/behavior as §10, scoped to this one listing)
- Area
- Other location context already captured on the listing (address-level detail owned by the Inventory Module)

### Type-Specific Specifications

Per the taxonomy in `mvp-prd.md` §8, using **only** the static types with live MVP inventory:

| Type | Type-specific fields |
|---|---|
| Unipole / Bulletin Billboard | Pole height, facing direction, road name, visibility distance |
| Gantry | Span width, road spanned, clearance height |
| Metro Pillar | Metro line, pillar number, nearest station, platform-facing (Y/N) |
| Wall Wrap / Building Wrap | Building name, wrap area, floors covered |
| Transit Media | Vehicle type, route number, fleet operator, vehicle registration |
| Bus Queue Shelter | Shelter ID, route(s) served |

Digital types (Digital Billboard, Digital Screen) exist in the data model but have no live inventory for a Viewer to view or request at MVP (`mvp-prd.md` §3.2, §8) — the Hoarding Detail page does not need to render a Viewer-facing digital request flow at this stage.

### Site Intelligence

Per `mvp-prd.md` §8, captured fields include: footfall (with source: sensor / third-party / self-reported), traffic split (vehicular/pedestrian), demographics (age band, gender, SEC class), commute mode split, dwell time, peak/off-peak curve, nearby POIs, data recency, and a confidence flag.

The detail page shows this as a **Site Intelligence summary**, as named in `mvp-prd.md` §7.3. Per INVENTORY-002, Site Intelligence is optional at submission — a listing may show partial Site Intelligence data, or note that some fields are unavailable, rather than presenting incomplete data as if it were complete.

**Site Intelligence is informational only at MVP.** It is captured so it can be consumed by pricing or AI logic later, but no such logic exists yet (`mvp-prd.md` §3.2, §8). The Viewer uses it to evaluate a site manually; it does not drive ranking, pricing, or recommendations.

### Publisher Information

`mvp-prd.md` does not define exactly which Publisher fields a Viewer sees. What is defined: a Publisher profile includes name, phone, business name (optional), and verification status (`mvp-prd.md` §7.2). A reasonable, minimally-scoped reading is that the Viewer sees enough to trust the listing (e.g., business name and verification status) without necessarily seeing direct contact details before a request exists.

This is called out explicitly rather than assumed silently: `mvp-brd.md` §12 identifies **disintermediation** (Viewer and Publisher connecting via SEEABLE and then transacting offline, repeatedly, outside the platform) as the single biggest structural risk of a payment-free MVP. Exposing direct Publisher contact information on the detail page, before a request even exists, would plausibly increase that risk. Whether Publisher contact details are visible pre-request, only after a request is submitted, or only after Confirmed, is **not defined** — see §28.

### Primary Action

**Request Dates** is the primary action, per `mvp-prd.md` §7.3 and §6.2. No other primary action (e.g., "Contact Publisher," "Add to shortlist") is defined in the MVP PRD, so none is included here.

## 13. Date Request Flow

The core conversion flow, per `mvp-prd.md` §6.2, §7.3, and the Request Engine (§7.4):

1. Open a hoarding
2. View availability
3. Select a date range
4. Submit a request
5. Receive confirmation that the request was submitted (enters **Pending** / `REQUESTED`)
6. Track the request (§15)
7. Receive Publisher response (Accept/Reject, per `mvp-prd.md` §7.2)
8. See **Confirmed** or **Rejected** status

This flow is governed by the Request Engine's rules (`mvp-prd.md` §7.4), not by separate Viewer-side conflict logic. The Viewer Platform surfaces Request Engine outcomes; it does not duplicate them.

| Scenario | What happens (per Request Engine rules) |
|---|---|
| Dates are available | The Viewer can submit a request; it enters Pending. |
| Dates overlap an existing **Confirmed** request | The hoarding is not offered as available for those dates; per REQUEST-001, confirming a request blocks those dates against all other pending requests on the same hoarding. |
| Another request is already **Pending** on those dates from a different Viewer | Per `mvp-prd.md` §11 edge cases, a second overlapping request is accepted into the queue as Pending but cannot move to Confirmed until the conflict resolves — it is never silently Confirmed. |
| The Viewer submits a duplicate request on a listing where they already have a Pending request | Blocked per **VIEWER-002** — the Viewer is shown their existing request instead. |
| The Publisher does not respond | The request remains Pending until the response SLA is reached (exact SLA value is an **Open Question**, `mvp-prd.md` §14). |
| The request expires | Per OWNER-002/REQUEST-002, an unanswered request past the SLA auto-expires and its dates release back to Available immediately; the Viewer sees an Expired status (§14–§15). |

Per `mvp-prd.md` §7.4, an "amount agreed" field exists on a request for record-keeping only — it is not enforced or collected by the platform. **Exactly which party captures this value, and at what step of this flow, is not defined in `mvp-prd.md`** — flagged in §28 rather than assumed.

This is a date hold, not a paid booking (§5) — nothing in this flow implies or triggers payment.

## 14. Request Status

The Request Engine's state machine, per `mvp-prd.md` §7.4:

```text
AVAILABLE
    ↓
REQUESTED
    ↓
CONFIRMED / REJECTED
    ↓
LIVE
    ↓
COMPLETED
```

`mvp-prd.md` §7.3 and §6.2 use Viewer-facing labels that map onto this same state machine:

| Request Engine state | Viewer-facing label | Source |
|---|---|---|
| AVAILABLE | (dates shown as available on the listing; not yet a request) | §7.3 |
| REQUESTED | **Pending** | §7.3 |
| CONFIRMED | **Confirmed** | §6.2, §7.3 |
| REJECTED | **Rejected** | §6.2, §7.3 |
| LIVE | **Campaign Period** | §6.2 |
| COMPLETED | **Completed** | §6.2 |

An **Expired** outcome is also Viewer-visible: OWNER-002 and REQUEST-002 establish that an unanswered request auto-expires past the SLA and releases its dates, distinct in cause from an explicit Rejected but identical in effect (dates released).

| Status | Meaning (Viewer perspective) | What Viewer sees | What Viewer can do | What causes the next state | Notification? |
|---|---|---|---|---|---|
| (Available) | The date range is open on this hoarding. | Availability indicator on listing/detail. | Select the range and submit a request. | Viewer submits a request → Pending. | No |
| Pending | Request submitted; awaiting Publisher decision. | Request in My Requests, marked Pending. | View status; cannot submit a second request on the same listing (VIEWER-002). | Publisher accepts/rejects, or SLA expires. | Yes — request submitted (NOTIF-001) |
| Confirmed | Publisher accepted; dates are held for this Viewer. | Confirmed status, dates, (amount agreed if visible — §28). | Proceed to offline settlement; view request detail. | Campaign start date arrives → Campaign Period (LIVE). | Yes — request accepted (NOTIF-001) |
| Rejected | Publisher declined the request. | Rejected status. | View status; free to request other dates/listings. | Terminal. | Yes — request rejected (NOTIF-001) |
| Expired | No Publisher response within the SLA. | Expired status. | View status; free to request again. | Terminal (dates release per REQUEST-002). | Yes — expiring/expired (NOTIF-001) |
| Campaign Period (LIVE) | The confirmed dates are current/underway. | Campaign Period status. | View request detail. | End of period + manual "Mark Completed" action (Publisher or Admin, REQUEST-003). | Not explicitly defined — see §28 |
| Completed | The campaign period has ended and been marked complete. | Completed status. | View historical request. | Terminal. | Not explicitly defined — see §28 |

No payment-related states exist at MVP, consistent with §4.2.

## 15. My Requests

Per `mvp-prd.md` §7.3, the Viewer must be able to "track own requests: Pending / Confirmed / Rejected." Per the Request Engine (§14), Expired, Campaign Period (Live), and Completed are also valid, Viewer-visible states.

**Request list** shows, per request: hoarding (with enough identifying info to recognize it without reopening it), requested dates, current status, and last update.

**Request detail** shows:

- Hoarding information (summary, linking back to Hoarding Detail)
- Requested dates
- Amount agreed, **if visible to the Viewer** — visibility is not explicitly defined in `mvp-prd.md` (§28)
- Publisher response (accept/reject, and any reason on rejection — `mvp-prd.md` §7.5 gives Admin a "reason" field for listing rejection; whether Publisher rejection of a request also carries a reason is not defined — §28)
- Current status (§14)
- Relevant actions (at MVP, primarily viewing — the Viewer does not accept/reject/cancel their own request in the documented flow; whether a Viewer can withdraw a Pending request is not defined — §28)

## 16. Viewer Business Rules

### VIEWER-001

A Viewer can hold multiple simultaneous Pending requests across different listings. (`mvp-prd.md` §7.3)

### VIEWER-002

A Viewer cannot submit a second request on a listing while an existing request from them on that listing is still Pending. (`mvp-prd.md` §7.3)

These are the only two Viewer-specific business rules defined in the MVP PRD. No additional VIEWER-XXX rules are introduced in this document, to avoid presenting a new product decision as if it were already approved.

### Cross-module rules affecting Viewer behavior

These are owned by other modules and are referenced, not restated, here:

| Rule | Owning module | Effect on Viewer |
|---|---|---|
| AUTH-001 | Auth & Roles | A Viewer account cannot also act as a Publisher. |
| AUTH-002 *(varied for this demo build — see Demo Scope Note)* | Auth & Roles | Approved MVP PRD rule: a Viewer must complete OTP verification before submitting a request. For this demo build, email/mobile + password login substitutes for OTP; no verification gate exists before a request is submitted. |
| OWNER-001 | Publisher Module | A hoarding cannot be Confirmed to two Viewers for overlapping dates. |
| OWNER-002 | Publisher Module | An unanswered request auto-expires past the response SLA and releases its dates. |
| REQUEST-001 | Request Engine | Confirming a request blocks those dates against all other Pending requests on the same hoarding. |
| REQUEST-002 | Request Engine | A Rejected or expired request releases its dates back to Available immediately. |
| REQUEST-003 | Request Engine | A request cannot move to Completed before its own start date. |
| ADMIN-001 | Admin Module | Only Admin-approved listings ever appear in Viewer search. |
| ADMIN-002 | Admin Module | If a Publisher is later suspended, a Viewer's already-Confirmed request with that Publisher still completes as agreed — suspension only blocks the Publisher from creating *new* listings. |
| INVENTORY-001 / INVENTORY-002 | Inventory Module | Governs what listing data is complete/visible when the Viewer views it. |
| CONTENT-001 | Content Protection | Only watermarked media is ever shown to a Viewer. |
| NOTIF-001 | Notifications | Every Request Engine state change relevant to the Viewer triggers a notification within the defined delay. |

## 17. Roles & Permissions

Per `mvp-prd.md` §5:

| Action | Viewer | Publisher | Admin |
| --- | ---: | ---: | ---: |
| Browse inventory | Yes | Yes | Yes |
| Search inventory | Yes | Yes | Yes |
| View listing | Yes | Yes | Yes |
| Create/edit own listing | No | Yes | No (moderation edits only) |
| Submit request | Yes | No | No |
| View own requests | Yes | No | No |
| Accept/reject request | No | Yes (own listings) | No |
| Approve/reject listing | No | No | Yes |
| Verify Publisher | No | No | Yes |
| View platform-wide counts | No | No | Yes |

## 18. Notifications

Per `mvp-prd.md` §7.6, events covered platform-wide include: new request received, request accepted/rejected, request expiring soon, listing approved/rejected. Of these, the Viewer-relevant subset is:

| Event | Relevant to Viewer? | Notes |
|---|---|---|
| Request submitted (confirmation of Viewer's own action) | Yes | Confirms the request entered Pending. |
| Request accepted | Yes | Triggers move to Confirmed. |
| Request rejected | Yes | Triggers move to Rejected. |
| Request expiring soon | Yes | Warns before SLA-driven auto-expiry. |
| New request received | No | Publisher-side event. |
| Listing approved/rejected | Only indirectly | Relevant to a Viewer only if it affects a listing they have already requested or are tracking (e.g., a listing later delisted by Admin) — not a general Viewer notification. |

Per **NOTIF-001**, every relevant Request Engine state change triggers a notification within a defined delay (target: under 5 minutes, per `mvp-prd.md` §7.6). Channels at MVP are push plus one of SMS/email — **which one is not yet decided** (`mvp-prd.md` §14, carried into §28 here). This document does not invent a full communications platform beyond what §7.6 defines.

## 19. Viewer Profile

Per `mvp-prd.md` §7.1, the minimal Viewer profile at MVP is:

- Name
- Phone/email
- City

For this demo build, a **Password** field is also captured, since login is email/mobile + password rather than OTP (see Demo Scope Note). This field is a demo-scope addition, not part of the approved `mvp-prd.md` §7.1 profile — a production build following AUTH-002 would not need a stored password for this flow.

No additional profile fields (company/organization info, saved searches, preferences, payment details) are defined in `mvp-prd.md` for the Viewer role. A full CRM-style or company-management profile is out of scope at MVP (§4.2, "Advanced personalization").

## 20. UI States

### Loading

Shown on Search, Search Results, Map, Hoarding Detail, and My Requests while data is fetched from the backend (§22–§23).

### Empty

- Search Results: no listings match the current search/filters.
- Map: no markers in the current view/radius.
- My Requests: the Viewer has no requests yet.

### Error

- Search/API failures show a clear, non-technical message; the Viewer is not left on an unexplained blank or frozen screen.
- Request submission failure (§21) is distinguished from a successful submission that is merely Pending.

### Success

- Request submission: explicit confirmation that the request was received and is now Pending (`mvp-prd.md` §7.3, §12).

### Unavailable

- A listing becomes unavailable (paused, delisted, or dates blocked) after the Viewer has opened it or begun a request — the Viewer is told the listing/dates are no longer available rather than allowed to submit against stale data (§21).

### Expired

- A Pending request that passes the response SLA is shown as Expired (§14), with dates released per REQUEST-002.

Exact copy, timing, and visual treatment for each state are implementation details left to design/engineering; this section defines what each state must communicate, not its pixel-level form.

## 21. Edge Cases

Grounded in `mvp-prd.md` §11 and `mvp-brd.md` §12, applied to the Viewer:

- Two Viewers submit overlapping requests near-simultaneously on the same hoarding — the second is accepted as Pending but cannot be Confirmed while the conflict exists; neither is silently Confirmed (`mvp-prd.md` §11).
- A Viewer submits a duplicate request on a listing where they already have a Pending request — blocked by VIEWER-002.
- A listing becomes unavailable (paused/delisted) after the Viewer opens it — the Viewer is shown an Unavailable state (§20) rather than allowed to proceed.
- A listing becomes unavailable between date selection and request submission — the submission is blocked with a clear reason, not silently accepted then rejected.
- The Publisher rejects the request — the Viewer sees Rejected (§14) and is free to request elsewhere.
- The Publisher does not respond — the request auto-expires past the SLA (OWNER-002); the Viewer sees Expired.
- The request expires — dates release immediately (REQUEST-002); nothing further is owed by either party.
- A listing is paused while the Viewer is actively viewing it — the Viewer should not be able to submit a request against a listing that has just gone unavailable (same handling as the "unavailable after opening" case above).
- A listing is removed after being viewed — if the Viewer later revisits it (e.g., via My Requests or a bookmark), it should not resolve to a broken reference; exact removed-listing UX is not defined in `mvp-prd.md` (§28).
- Media fails to load — the Viewer sees a clear media-unavailable state, not a broken layout.
- Map fails to load — the Viewer can still fall back to list-based Search Results (§11); map failure should not block discovery entirely.
- No inventory exists in the selected location — treated as an empty state (§20), not an error.
- The Viewer loses network connection during request submission — the Viewer should be told clearly whether the request went through or not, to avoid an unintended duplicate submission attempt; exact retry/idempotency behavior is not defined in `mvp-prd.md` (§28).

`mvp-brd.md` §12 also flags a business-level edge case worth noting here even though it does not translate into a Viewer-facing platform rule at MVP: a Viewer could submit requests they never intend to honor, tying up a Publisher's calendar. The BRD explicitly frames a possible mitigation (a soft cap on simultaneous Pending requests) as something "the business should decide," not as an approved requirement — see §28.

## 22. Data Requirements

This is a module-level data requirement, not a database schema (that lives in `docs/05-technical/database-design.md`, per the Documentation Index).

### Listing Data

- ID
- Type
- Location
- Size
- Price
- Availability
- Media (watermarked)
- Type-specific attributes (per §12)
- Site Intelligence summary
- Approval status

### Request Data

- Request ID
- Listing ID
- Viewer ID
- Start date
- End date
- Status
- Amount agreed (where applicable, per `mvp-prd.md` §7.4)
- Created timestamp
- Response timestamp

## 23. API Dependencies

Per `mvp-prd.md` §9, the Viewer-relevant endpoints are:

```text
GET   /api/v1/hoardings?type=&city=&maxDistance=&maxPrice=
GET   /api/v1/hoardings/{id}
POST  /api/v1/requests
GET   /api/v1/requests/me
```

Registration/verification uses the shared Auth endpoints (`POST /api/v1/auth/register`, `POST /api/v1/auth/verify-otp`).

### API Gaps / Open Questions

The following are needed for a complete Viewer experience as described in this document but are **not currently defined** in `mvp-prd.md` §9, so they are not treated as approved:

- No endpoint for map-scoped/geospatial queries beyond the `maxDistance` parameter already listed — whether this is handled entirely client-side against the same `GET /api/v1/hoardings` response or needs a dedicated endpoint is undefined.
- No endpoint distinct from `GET /api/v1/hoardings/{id}` for a "listing preview" (map marker click) versus full detail — may reuse the same endpoint, but this is an assumption, not a stated decision.
- No endpoint for retrieving a single request's full detail (`GET /api/v1/requests/{id}`) distinct from the list endpoint (`GET /api/v1/requests/me`) — needed for the Request Detail page in §15.
- No notification-retrieval endpoint is listed in §9, despite Notifications being an in-scope MVP module.

## 24. Non-Functional Requirements

Per `mvp-prd.md` §10, scoped to the Viewer experience:

- Responsive search and listing detail at 50–200 listings (no scale-phase performance target at MVP)
- Secure authentication — OTP-based per the approved `mvp-prd.md` §7.1/AUTH-002; email/mobile + password for this demo build (see Demo Scope Note), which should still follow standard password-storage practice (hashing, not plaintext) even though OTP itself is deferred
- Reliable request submission (a submitted request must not be silently lost)
- Data integrity — listing information (price, size, availability) is self-reported by Publishers and reviewed only by Admin approval; the Viewer platform itself does not independently verify it
- Clear availability information — a Viewer should never be able to submit a request against dates the system already knows are unavailable
- Mobile usability (implied by the map/location-centric nature of discovery, though not separately specified as a distinct NFR beyond general responsiveness)

A formal 99.9% uptime SLA is explicitly a scale-phase commitment, not an MVP requirement (`mvp-prd.md` §10), and is not applied here.

## 25. Acceptance Criteria

```text
1. Registration (demo build — see Demo Scope Note)

Given a new Viewer provides a valid phone or email, name, city, and sets a password
When they submit registration
Then a Viewer account is created with name, phone/email, city, and password
And the Viewer can proceed to browse and search inventory.
Note: this replaces OTP verification (AUTH-002) for this demo build only.
```

```text
1a. Login (demo build — see Demo Scope Note)

Given a Viewer has a registered account
When they enter their email/mobile number and correct password
Then they are logged in and returned to Home/Discover
And an incorrect password is rejected with a clear error, not a silent failure.
```

```text
2. Search

Given approved, available listings exist in Bengaluru
When a Viewer performs a search
Then only approved, available listings matching the query are returned
And the Viewer sees a loading state while results are fetched.
```

```text
3. Filtering

Given a Viewer applies a hoarding type, distance, and/or budget filter
When the filters are active
Then only listings matching all active filters are shown
And clearing a filter returns results to the prior unfiltered state for that dimension.
```

```text
4. Map discovery

Given approved listings exist within the Viewer's selected radius
When the Viewer opens the map view
Then markers are shown for each matching listing
And selecting a marker shows a listing preview
And opening the preview navigates to the full Hoarding Detail page.
```

```text
5. Listing detail

Given a Viewer opens an approved listing
When the Hoarding Detail page loads
Then the Viewer sees basic information, media, location, type-specific specs, Site Intelligence summary, and Publisher information
And the primary action available is "Request Dates."
```

```text
6. Date selection

Given a Viewer is on the Hoarding Detail page
When they select a date range
Then the system reflects whether those dates are currently available
And the Viewer can proceed to submit a request only for available dates.
```

```text
7. Request submission

Given a Viewer has selected an available date range on a listing
When the Viewer submits a request
Then the request is created with status Pending
And the Viewer receives confirmation that the request was submitted
And the request appears in My Requests.
```

```text
8. Duplicate request prevention

Given a Viewer has an existing Pending request on a listing
When the Viewer attempts to submit another request for the same listing
Then the platform prevents the duplicate request
And the Viewer is shown the existing request's status.
```

```text
9. Request tracking

Given a Viewer has one or more requests in any status
When the Viewer opens My Requests
Then each request is shown with its hoarding, dates, and current status
And selecting a request opens its full Request Detail.
```

```text
10. Request status changes

Given a Viewer has a Pending request
When the Publisher accepts or rejects it, or the response SLA is reached
Then the request status updates to Confirmed, Rejected, or Expired accordingly
And the Viewer receives a notification of the change.
```

```text
11. Error handling

Given a search, filter, or request-submission action fails
When the failure occurs
Then the Viewer sees a clear, non-technical error message
And no partial or duplicate request is silently created.
```

```text
12. Unavailable inventory

Given a listing the Viewer has opened becomes paused or delisted
When the Viewer attempts to select dates or submit a request on it
Then the Viewer is shown that the listing is no longer available
And the request is not accepted.
```

## 26. MVP vs Future

| Capability | MVP | Future |
| --- | --- | --- |
| Browse inventory | Yes | — |
| Search | Yes | Advanced search (ranking, autocomplete) |
| Map | Yes | Advanced GIS (heatmaps, catchment analysis) |
| Filters | Yes (type, distance, budget) | Advanced audience/illumination/orientation filters (full-scope Master PRD Framework) |
| Site Intelligence display | Yes (informational) | AI-driven pricing/recommendation use of Site Intelligence (`mvp-prd.md` §3.2, §15) |
| Date request | Yes | — |
| Online payment | No | Phase 2 (`mvp-prd.md` §15) |
| Campaign management | No | Future |
| Agency workflows | No | Future |
| AI recommendations | No | Future |
| Advanced analytics | No | Future |
| Contract generation | No | Future (`mvp-prd.md` §15) |
| Digital-screen requests | No (data model only) | Future, once digital inventory is onboarded |

## 27. Dependencies

**Auth & Roles → Viewer Platform**
The Viewer Platform depends on Auth & Roles for account creation and role assignment (AUTH-001). Per the approved `mvp-prd.md` target, it would also depend on OTP verification (AUTH-002) before a Viewer can submit requests; for this demo build, email/mobile + password login substitutes for that dependency (see Demo Scope Note).

**Inventory Module → Viewer Platform**
The Viewer consumes approved inventory and standardized inventory/type-specific fields from the Inventory Module. This document treats `mvp-prd.md` §8 as the field-level source of truth in the absence of an available `inventory.md`.

**Publisher Platform → Viewer Platform**
Listings the Viewer sees originate from Publisher actions (create, price, manage availability, pause). Publisher accept/reject actions drive the Viewer-visible request status.

**Request Engine → Viewer Platform**
The Viewer's request state (Pending/Confirmed/Rejected/Expired/Live/Completed) and conflict handling are entirely owned by the Request Engine (§13–§14, §16). The Viewer Platform surfaces this state; it does not independently define it.

**Admin Platform → Viewer Platform**
Only listings that pass Admin approval (ADMIN-001) are ever visible to a Viewer.

**Notifications → Viewer Platform**
Viewer-relevant request and listing events are delivered per NOTIF-001 (§18).

**Content Protection / Watermarking → Viewer Platform**
All media shown to a Viewer is watermarked; unwatermarked originals are never served (CONTENT-001).

**Maps/location services → Viewer Platform**
Underlies Search location behavior (§8), Filters/Distance (§9), and Map discovery (§10). The specific provider is not named in `mvp-prd.md` (§28).

## 28. Open Questions

The following are genuine unresolved decisions, not manufactured to lengthen this document. Several are already listed as open in `mvp-prd.md` §14 and are carried forward here in their Viewer-specific form; the rest arise directly from gaps identified while writing this module.

- Exact map provider/technology (not named in `mvp-prd.md`)
- Exact search/sort ordering, if any, for Search Results (not defined — §11)
- Whether the hoarding-type filter supports multiple simultaneous values (not defined — §9)
- Exact pagination/infinite-scroll mechanism for Search Results at 50–200 listings (not defined — §11)
- Exact notification channel — SMS or email, alongside push (`mvp-prd.md` §14)
- Exact response SLA before a Pending request auto-expires (`mvp-prd.md` §14)
- Whether Publisher rejection of a request includes a reason visible to the Viewer, mirroring Admin's listing-rejection reason (§15)
- Which party captures the "amount agreed" value, and at what step of the request flow (§13)
- Whether Publisher contact details are visible to a Viewer pre-request, post-request, or only post-Confirmation, given the disintermediation risk in `mvp-brd.md` §12 (§12)
- Whether the Viewer can withdraw/cancel their own Pending request (§15)
- Whether location permission is required for map-centered discovery, and how it's handled if declined (§10)
- Whether a soft cap on simultaneous Pending requests per Viewer is needed to deter non-serious requests — explicitly framed in `mvp-brd.md` §12/§17 as a business decision, not yet made
- Whether notifications fire for Campaign Period (Live) and Completed transitions, or only for Pending/Confirmed/Rejected/Expiring (§14, §18)
- Exact retry/idempotency behavior if network connectivity is lost mid-submission (§21)
- When (and whether) OTP verification (AUTH-002) is reinstated for this build, and what triggers that decision — the Demo Scope Note above defers it for demo/validation purposes only, not permanently
- Password reset/forgot-password flow — not defined anywhere for the demo build's email/mobile + password login

If any of these are already resolved in a document outside this session's available context (e.g., `docs/03-modules/request-engine.md` once written, or `inventory.md`/`owner-platform.md`), this list should be reconciled against them rather than treated as still open.

## 29. Requirement ID Index

```text
VIEWER-001
VIEWER-002
```

No additional Viewer-specific requirement IDs are introduced in this document. Where this module depends on rules owned elsewhere, they are cross-referenced by their existing IDs (§16) rather than renumbered:

```text
AUTH-001, AUTH-002 (varied for this demo build — see Demo Scope Note)
OWNER-001, OWNER-002
REQUEST-001, REQUEST-002, REQUEST-003
ADMIN-001, ADMIN-002
INVENTORY-001, INVENTORY-002
CONTENT-001
NOTIF-001
```

---

*End of SEEABLE Hoardings — Viewer Platform Module.*
