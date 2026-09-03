# SEEABLE Hoardings — Inventory Module

## Document Metadata

**Document Type:** Module Specification (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.0
**Status:** Draft for Review
**Date:** 27 August 2026
**Related Documents:** `docs/01-product/mvp-prd.md`, `docs/01-product/mvp-brd.md`, `docs/03-modules/owner-platform.md` (referenced, unavailable), `docs/03-modules/viewer-platform.md`, `docs/03-modules/request-engine.md`, `docs/03-modules/admin-platform.md`, `README.md` (Documentation Index)

> **Note on sourcing:** This document extracts and organizes Inventory-side requirements that currently exist only inline in `mvp-prd.md` §7.2 (Publisher Module) and §8 (Hoarding Type Taxonomy), cross-checked against `mvp-brd.md` §5.1, §7.2–§7.3, and §11. Both `mvp-prd.md` §9 and `mvp-brd.md` §5.1 already refer forward to `docs/03-modules/inventory.md` as if it existed ("see `docs/03-modules/inventory.md` for the full type taxonomy"; "structured JSON... see `inventory.md` §8") — this document is written to satisfy exactly that forward reference, using the field-level detail `mvp-prd.md` §8 already contains, not inventing beyond it. `docs/03-modules/owner-platform.md` is referenced throughout as the sibling spec for Publisher-side UI and workflow, but was not available for direct cross-reading at the time of writing — the fourth time this gap has been confirmed this session (after `viewer-platform.md`, `request-engine.md`, and `admin-platform.md`). Everything attributed to Publisher-side behavior here is drawn from `mvp-prd.md` §7.2 directly. This document is also the reconciliation point three sibling documents were waiting on: `admin-platform.md` §14.2 and §26, and `request-engine.md` §21 and §32, each explicitly flagged their own inventory-adjacent state models and field guesses as provisional pending this document — those are cross-checked against this document below, not silently left standing. No new product decisions are introduced; anything not already defined in the MVP PRD/BRD is explicitly marked as an **Open Question**, **Assumption**, or **Future Enhancement**. One new rule ID (**INVENTORY-003**) is minted in §18, explicitly flagged as a formalization of prose that already exists in `mvp-prd.md`, not a new product decision.

---

## 1. Module Overview

The Inventory Module is the authoritative data and business layer for SEEABLE's physical out-of-home (OOH) advertising inventory. It defines what a **hoarding listing** is, what information it must and may contain, what state it can be in, when it counts as available, and how it is exposed to every other part of the platform.

This module does not have a dedicated user-facing surface of its own — no one "opens the Inventory Module" the way a Viewer opens Search or a Publisher opens their dashboard. Instead, it is the **shared data foundation** underneath four other modules that each interact with it differently:

- **Publisher Module** — creates, edits, prices, and manages the availability of listings it owns
- **Admin Platform** — reviews listings for approval, flags incompleteness, and can delist a listing independent of its own state
- **Viewer Platform** — reads only the subset of inventory that is Approved and available, for search, filtering, and map discovery
- **Request Engine** — reads a listing's availability to validate new requests, and (via Confirmed requests) writes back to that availability

Answering the question this module exists to answer: **"What exactly is an inventory item on SEEABLE, what information does it contain, what state can it be in, when is it available, and how is it exposed to the rest of the platform?"**

### Inventory record vs. Publisher vs. Listing vs. Request vs. Campaign

These five terms are easy to conflate, and the source documents themselves use "listing" and "hoarding" interchangeably (see §3), so it's worth being precise here:

- **Publisher** is an *account* — the supply-side actor (`mvp-prd.md` §4). A Publisher does not represent inventory; a Publisher *owns* inventory.
- **Inventory record / Hoarding / Listing** is the *asset record* this module owns — the standardized representation of one physical advertising space, including its type, location, size, price, availability, media, and Site Intelligence. This document uses "Hoarding" and "Listing" interchangeably, matching source usage (§3).
- **Request** is a *date-specific demand interaction* against exactly one Hoarding, created by a Viewer and entirely owned by the Request Engine (`request-engine.md` §2: "a structured, date-based request for one hoarding... does not represent payment, escrow, commission, contract execution, or financial settlement"). A Request references a Hoarding; it is not a Hoarding, and the Inventory Module does not own or duplicate Request state (§16).
- **Campaign** does not exist at MVP in any form. It is a full-scope-only concept — multi-hoarding planning, budget allocation, creative tracking (`mvp-prd.md` §3.2) — and the Inventory Module makes no provision for it. A Hoarding at MVP is requested and confirmed one at a time, by one Viewer, for one date range (`request-engine.md` §2).

Standardized inventory data matters because it is the foundation `mvp-brd.md` §4's first objective ("reduce discovery friction") and its second business rule (`BR-VIEWER-002`: "search results must show enough standardized information... to support like-for-like comparison across Publishers") both depend on. Without a consistent, type-aware data model, a Viewer cannot meaningfully compare a Metro Pillar listing to a Gantry listing, and Search/Filter (`viewer-platform.md` §9, §11) has nothing reliable to operate over.

## 2. Module Objective

The Inventory Module's MVP objective is to:

- Standardize OOH inventory across six static hoarding types (§7)
- Enforce required type-specific fields before a listing can be submitted for review (`INVENTORY-001`)
- Store location, size, price, availability, and media consistently across every listing (§8)
- Support Site Intelligence as optional, informational data (`INVENTORY-002`, §10)
- Expose inventory data consistently to Search, Filter, and Map discovery (§17)
- Support the Admin approval workflow with the data it needs to make a decision (§14)
- Represent date-based availability in a form the Request Engine can read and validate against (§16)
- Provide a foundation that extends cleanly to digital inventory, dynamic pricing, and AI-driven Site Intelligence consumption later, without requiring a schema rewrite (`mvp-prd.md` §10) — while shipping none of that now

**The objective is explicitly not** to build the complete future OOH industry data standard described in the full-scope Master PRD Framework. Fields, types, or structures that would only matter for the full-scope marketplace (illumination, orientation, material, audience-measurement partnerships, programmatic ad-serving metadata, device/CMS attributes beyond the two placeholder digital types) are not introduced here, per the Critical MVP Boundary against adding fields "merely because they might be useful in a future full-scale OOH marketplace."

## 3. Inventory Terminology

| Term | Definition | Source | Notes |
|---|---|---|---|
| Inventory | The complete set of hoarding listings on the platform, of any status. | `mvp-prd.md` §8 (section title), `README.md` #3 | Used both as a mass noun (the inventory) and loosely as a synonym for an individual listing. |
| Hoarding | One physical OOH advertising asset and its listing record. | `mvp-prd.md` §7.2, §8 | The base term; "listing" is used interchangeably (see below). |
| Listing | Same referent as Hoarding — the record a Publisher creates and Admin approves. | `mvp-prd.md` §7.2 ("hoarding listings"), §7.5 ("listing approval") | **Terminology note:** `mvp-prd.md` and `mvp-brd.md` never distinguish "Hoarding" from "Listing" — they are used as synonyms throughout every source document and every sibling module doc. This document treats them as one entity, not two related entities, and uses whichever term reads more naturally in context. |
| Hoarding Type | The category that determines which type-specific fields a listing requires. | `mvp-prd.md` §8 | Every listing has exactly one type (Critical Boundary #3). |
| Static Inventory | The six hoarding types with live MVP inventory: Unipole/Bulletin Billboard, Gantry, Metro Pillar, Wall Wrap/Building Wrap, Transit Media, Bus Queue Shelter. | `mvp-prd.md` §8 | Requestable by Viewers at MVP. |
| Digital Inventory | Digital Billboard and Digital Screen types. | `mvp-prd.md` §8 | Exist in the data model; **not live, not Viewer-requestable at MVP** (Critical Boundary #2). |
| Available | A date range on an Approved, non-Paused, non-Delisted hoarding with no Confirmed request against it. | `mvp-prd.md` §7.3; `request-engine.md` §6 | A property of the calendar, not a status the Hoarding record itself holds as a single value — see §16. |
| Unavailable | Any date range that is not Available — because it's Confirmed to someone else, or the listing itself is Paused/Delisted/Rejected/not yet Approved. | Inferred from `mvp-prd.md` §7.3's "approved, available listings" | Not a single source-defined term; this document uses it as the natural negation of Available. |
| Paused | A Publisher-initiated, reversible state in which an Approved listing is temporarily withheld from Viewer search without losing its Approval or being deleted. | `mvp-prd.md` §7.2 ("add/edit/pause/delete") | See §15 for full disambiguation against Delete and Delist. |
| Draft | A listing that has been created but not yet submitted for Admin review. | Constructed — `mvp-prd.md` §7.2 describes listing creation and `OWNER-004` describes what an unverified Publisher "can draft," implying a pre-submission state, but does not name it explicitly. | Named "Draft" here for clarity, consistent with `admin-platform.md` §14.2's use of the same term. |
| Pending Approval | A listing that has been submitted and awaits an Admin approve/reject decision. | `mvp-prd.md` §7.5 ("listing approval queue") | Matches `admin-platform.md` §6, §14.2 exactly. |
| Approved | A listing Admin has approved; eligible for Viewer search. | `mvp-prd.md` §7.5; `ADMIN-001` | |
| Rejected | A listing Admin has rejected, with a reason. | `mvp-prd.md` §7.5; `ADMIN-003` (`admin-platform.md` §16) | Resubmission path undefined — cross-ref §14, §27. |
| Delisted | A listing Admin has removed from Viewer search independent of Publisher suspension. | `mvp-prd.md` §7.5; `ADMIN-004` (`admin-platform.md` §16) | See §15 for how this differs from Publisher-initiated Pause/Delete. |
| Site Intelligence | Optional, informational location-quality data captured on a listing: footfall, traffic split, demographics, commute mode split, dwell time, peak/off-peak curve, nearby POIs, data recency, confidence flag. | `mvp-prd.md` §8 | Informational only at MVP (Critical Boundary #8) — see §10. |
| Media Asset | A watermarked photo or video attached to a listing. | `mvp-prd.md` §7.2, §7.7 | Inventory stores the reference; watermarking is owned by Content Protection — see §11. |
| Availability Calendar | The Publisher-managed set of blocked/unblocked dates on a listing. | `mvp-prd.md` §7.2 ("simple availability calendar (block/unblock dates)") | See §13, §16 for its relationship to Request Engine-driven blocking. |
| Flat Pricing | A single, non-dynamic, non-seasonal price per listing. | `mvp-prd.md` §7.2 | See §12. |

**Terminology discrepancy flagged, per the brief's instruction to surface rather than silently resolve:** `mvp-prd.md` §7.2 gives the Publisher a "delete" action ("add/edit/pause/delete hoarding listings"), while §7.5 gives Admin a "delist" action ("ability to suspend a Publisher or delist a hoarding"). These are two different words, used by two different actors, and neither source document states whether they produce the same underlying effect (permanent removal) or different ones (Publisher delete = hard removal; Admin delist = soft, reversible hiding — or vice versa). This document does not assume they are the same mechanism reused by two actors, nor that they are wholly independent mechanisms — see the full disambiguation in §15.

## 4. Inventory Scope

### 4.1 In Scope

- Inventory record creation, as a data capability the Publisher Module invokes (§7.2 creates it; this module defines its shape)
- Hoarding type selection and enforcement of type-specific required fields (§7, §9)
- Shared base fields: location, size, price, availability, photos (§8)
- Type-specific fields for the six static types and two digital-model-only types (§7)
- Location data sufficient for map/distance search (§8, §17)
- Flat, per-listing price (§12)
- Availability calendar, Publisher-managed block/unblock (§13)
- Media references to watermarked assets (§11)
- Site Intelligence, captured optionally, surfaced with a completeness flag (§10)
- Listing completeness validation ahead of submission (`INVENTORY-001`, §9)
- Approval/visibility state (Draft → Pending Approval → Approved/Rejected → Delisted) (§14)
- Pause behavior and its effect on Viewer visibility (§15)
- The disambiguation of Delete vs. Delist as distinct lifecycle actions (§15)
- A Viewer-readable representation sufficient for Search, Filter, and Map (§17)
- Search/filter-compatible field exposure: type, location/distance, price, availability (§17)

### 4.2 Out of Scope

Explicitly excluded, per the Critical MVP Boundaries and consistent with `mvp-prd.md` §3.2 and `mvp-brd.md` §5.2:

- Online payments, escrow, or any collection mechanism
- Dynamic or seasonal pricing
- Auctions or bidding
- Campaign management or multi-site campaigns
- AI recommendations or AI-driven pricing
- Digital-screen purchasing or live digital inventory (data model support only — §7)
- CMS or device management
- Programmatic DOOH or impression-based billing
- Advanced audience analytics beyond the Site Intelligence fields already named in `mvp-prd.md` §8
- Automated valuation of any kind
- Contracts, invoicing, or commission calculation
- Full CRM functionality
- Enterprise inventory management (bulk import, multi-location portfolios, franchise/network hierarchies)

Any Inventory-adjacent capability not listed in §4.1, and not covered elsewhere in `mvp-prd.md`/`mvp-brd.md`, is out of scope until the source documents say otherwise.

## 5. Inventory Ownership & Responsibility

| Responsibility | Inventory | Publisher | Admin | Viewer | Request Engine |
|---|---|---|---|---|---|
| Define inventory structure (types, base fields, required fields) | Yes | No | No | No | No |
| Create a listing | Data capability (validates structure) | Yes (initiates) | No | No | No |
| Edit own listing | Supports (enforces `OWNER-003` while a request is Pending) | Yes | Edit "for moderation only" — scope undefined (`admin-platform.md` §10, §27) | No | No |
| Approve / reject a listing | No (supplies the data reviewed) | No | Yes | No | No |
| Delist a listing | Supports (holds the Delisted flag) | No | Yes (`ADMIN-004`) | No | No |
| Pause / unpause a listing | Supports (holds the Paused flag) | Yes | No | No | No |
| Delete a listing | Supports (defines what deletion does to the record — §15) | Yes (initiates) | No | No | No |
| Search inventory | Supplies filterable/searchable data | Yes (own + others, per §5 permissions) | Yes | Yes | No |
| Manage availability calendar | Stores the calendar | Yes | No | No | Reads (validates requests against it — §16) |
| Store price | Yes | Sets | Reads (moderation-edit scope undefined) | Reads | Reads (informs `amount_agreed`, not enforced — `request-engine.md` §17) |
| Store media references | Yes | Uploads | Reviews (approval decision) | Views only Approved/watermarked media | No |
| Flag Site Intelligence completeness | Yes (`INVENTORY-002`) | Supplies the data | Sees the flag in the approval queue | Sees partial data, not the flag itself | No |
| Request dates | No | No | No | Yes | Owns the request |
| Manage request state | No | No | Mark Completed only (`request-engine.md` §4) | No | Yes |

The key principle carried through this entire document: **Inventory owns the inventory data model. It does not own the workflows that consume that data** — listing UI belongs to `owner-platform.md`, discovery UI belongs to `viewer-platform.md`, the request lifecycle belongs to `request-engine.md`, and moderation workflow belongs to `admin-platform.md`. This document defines the shape and rules of the data those workflows read and write.

## 6. Inventory Entity Model

```text
Hoarding
├── Identity
│   ├── id
│   └── type
├── Ownership
│   └── publisher_id
├── Location
│   ├── address / area (map/search — §17)
│   └── geo-coordinates (Open Question — exact schema, §27)
├── Physical Specifications
│   ├── size (Open Question — unit, §8)
│   └── type-specific attributes (structured JSON — §9, per mvp-prd.md §10)
├── Commercial Information
│   └── price (flat — §12)
├── Availability
│   └── availability_calendar (blocked/unblocked dates — §13)
├── Media
│   └── media_assets[] (watermarked references — §11)
├── Site Intelligence
│   ├── footfall (source: sensor / third-party / self-reported)
│   ├── traffic split (vehicular/pedestrian)
│   ├── demographics (age band, gender, SEC class)
│   ├── commute mode split
│   ├── dwell time
│   ├── peak/off-peak curve
│   ├── nearby POIs
│   ├── data recency
│   ├── confidence flag
│   └── site_intelligence_complete (derived flag — INVENTORY-002)
├── Approval / Visibility
│   ├── approval_status (Draft | Pending Approval | Approved | Rejected — §14)
│   ├── rejection_reason
│   ├── delisted (boolean, independent axis — §15)
│   └── paused (boolean, independent axis — §15)
└── Timestamps
    ├── created_at
    ├── submitted_at
    ├── approved_at
    ├── rejected_at
    ├── delisted_at
    ├── paused_at
    └── updated_at
```

This tree is this document's own organizing construction — no source document lays out the entity this way — but every leaf is grounded in a specific source requirement, cited at each branch below (§8–§15). Nothing is added because it "might be useful"; where a field is included but its exact shape is undefined (e.g., geo-coordinates, size unit), that is called out explicitly rather than silently decided.

**Note on `approval_status` vs. `delisted`/`paused` as separate axes:** unlike `admin-platform.md` §14.2's single linear state list (Draft → Pending Approval → Approved → Delisted, with Rejected as a branch), this document models Delisted and Paused as **independent boolean flags layered on top of** `approval_status`, not as terminal states in the same chain. §14 and §15 explain why, and reconcile this with `admin-platform.md`'s existing construction rather than contradicting it.

## 7. Hoarding Type Taxonomy

Restated exactly from `mvp-prd.md` §8, which this document treats as the canonical taxonomy (this is the document `mvp-prd.md` and `mvp-brd.md` both point to for it):

**Static** (live, Viewer-requestable at MVP)

| Type | Type-specific fields |
|---|---|
| Unipole / Bulletin Billboard | Pole height, facing direction, road name, visibility distance |
| Gantry | Span width, road spanned, clearance height |
| Metro Pillar | Metro line, pillar number, nearest station, platform-facing (Y/N) |
| Wall Wrap / Building Wrap | Building name, wrap area, floors covered |
| Transit Media | Vehicle type, route number, fleet operator, vehicle registration |
| Bus Queue Shelter | Shelter ID, route(s) served |

**Digital** (data model supported; **not live, not Viewer-requestable at MVP** — Critical Boundary #2, `mvp-prd.md` §3.2, §8)

| Type | Type-specific fields |
|---|---|
| Digital Billboard | Resolution, pixel pitch, brightness, loop duration |
| Digital Screen (mall/transit) | Network ID, zone |

Every listing has exactly one `type` (Critical Boundary #3), and every type carries shared base fields (§8) plus its own type-specific fields (§9) on top of them (Critical Boundary #4).

**Edge case, carried from `mvp-prd.md` §11:** a physical hoarding may plausibly fit two types (the PRD's own example: "a mall-entrance digital screen"). `mvp-prd.md` does not define a resolution mechanism (e.g., a primary/secondary type, or a Publisher tie-break rule) — this is not invented here; see §23, §27.

## 8. Shared Base Fields

Per `mvp-prd.md` §8's own framing ("shared base fields on top of which each type carries its own required fields"): location, size, price, availability, photos.

| Field | Definition status |
|---|---|
| Location | Required for every listing. Exact schema (structured address, geo-coordinates, or both) is not specified in `mvp-prd.md` — a reasonable minimum, given the Distance filter and Map view (`viewer-platform.md` §9–§10) need to compute proximity, is that some form of geo-coordinate is captured alongside a human-readable address/area. This is an **Assumption** about the presence of geo-coordinates, not a stated field-level requirement — flagged in §27. |
| Size | Required for every listing (`BR-VIEWER-002` names it as a required standardized field for comparison). **Unit is not specified anywhere** (square feet vs. square meters vs. a named standard size class) — Open Question, §27. |
| Price | Required, flat per listing, in INR (`mvp-prd.md` §3.3, §7.2) — see §12. |
| Availability | Required — the Publisher-managed calendar described in §13. |
| Photos | Required in practice, since `CONTENT-001` blocks submission if media hasn't completed watermarking, implying at least one media asset must exist to submit at all — though `mvp-prd.md` never states a minimum photo count explicitly. Treated as an **Assumption** (at least one photo is functionally required) rather than a stated minimum — §27. |

These base fields apply uniformly across every hoarding type; they are not type-specific and are not duplicated in §9's type-specific tables.

## 9. Type-Specific Fields & Listing Completeness

Per `INVENTORY-001`: *"Type-specific required fields must be complete before a listing can be submitted for review."* The fields themselves are listed in full in §7 and are not repeated here.

**Representation:** `mvp-prd.md` §10 (Non-Functional Requirements) explicitly directs that type-specific attributes be stored "as structured JSON" so that "new hoarding types and future payment fields" can be added "without a schema rewrite." This document adopts that representation directly — it is a stated NFR, not an invention — meaning the Hoarding entity (§6) carries a single `type_specific_attributes` field whose shape varies by `type`, rather than a rigid column-per-field-per-type schema.

**What "complete" means:** every field listed for the listing's `type` in §7's tables must have a non-empty value before the listing can move from Draft to Pending Approval (§14). `INVENTORY-001` is a submission gate, not an approval criterion — Admin's approval decision (`admin-platform.md` §9) happens only after this gate has already passed, and is a judgment call on accuracy/legitimacy, not a second completeness check.

**What is not defined:** whether a listing's `type` can be changed after creation (and if so, whether previously-complete type-specific data must be re-validated against the new type's required fields), and how the "fits two types" edge case (§7, §23) is resolved at submission time. Neither is stated in `mvp-prd.md` — carried to §27.

## 10. Site Intelligence

Per `mvp-prd.md` §8, the Site Intelligence layer captures: footfall count (with source: sensor / third-party / self-reported), traffic split (vehicular/pedestrian), demographics (age band, gender, SEC class), commute mode split, dwell time, peak/off-peak curve, nearby POIs, data recency, and a confidence flag.

Governed by two rules:

- **`INVENTORY-002`:** Site Intelligence data is optional at MVP submission but flagged "incomplete" in the Admin queue if missing.
- **Critical Boundary #8:** Site Intelligence is informational at MVP and does not drive AI, pricing, or recommendations.

This means a listing can reach Pending Approval, and be Approved, with partial or entirely absent Site Intelligence data — `INVENTORY-002` is a visibility flag for Admin, not a submission gate the way `INVENTORY-001` is. `viewer-platform.md` §12 already establishes the Viewer-facing consequence: the Hoarding Detail page shows Site Intelligence as a summary that "may show partial... data, or note that some fields are unavailable, rather than presenting incomplete data as if it were complete."

No pricing, ranking, or recommendation logic reads Site Intelligence at MVP (Critical Boundary #8, `mvp-prd.md` §3.2, §8) — it is captured now purely so a future AI/pricing system can consume it later without requiring Publishers to re-supply it (`mvp-prd.md` §15).

## 11. Media & Content Protection Relationship

The Inventory Module stores **references** to media assets; it does not own the watermarking pipeline itself — that belongs to the Content Protection module (`mvp-prd.md` §7.7).

The relationship is a hard gate, not a soft dependency:

- **`CONTENT-001`:** A listing cannot be submitted for Admin approval if any of its media assets have not completed watermarking.
- Critical Boundary #15/#16: media must pass through watermarking before public exposure; unwatermarked originals must never be publicly exposed.

**What this means for the Inventory record:** each media asset reference carries a watermark status (pending / complete / failed), and the listing's overall submission-readiness check (alongside `INVENTORY-001`) includes "no media asset is still pending or failed watermarking." A listing whose media is mid-pipeline shows a "processing media" status rather than an error, per `mvp-prd.md` §12's own acceptance criterion: *"Given a Publisher uploads a photo for a new listing, when the watermarking pipeline has not yet completed, then the listing cannot be submitted for Admin review, and the Publisher sees a 'processing media' status, not an error."*

**Watermarking failure**, named as an edge case in `mvp-prd.md` §11 ("media upload succeeds but watermarking fails or times out"), is not resolved with a defined retry/escalation behavior anywhere in the source documents — carried to §27 as an Open Question, not invented here.

## 12. Pricing

Per `mvp-prd.md` §7.2: flat pricing per listing, no dynamic or seasonal pricing at MVP (Critical Boundary #9/#10). Price is denominated in INR (`mvp-prd.md` §3.3).

**Two distinct "price-shaped" values exist across the platform, and this document is careful not to conflate them:**

| Value | Owned by | Purpose |
|---|---|---|
| Listing price | Inventory Module (this document) | The Publisher's asking price for the hoarding, shown to every Viewer browsing/searching it. |
| `amount_agreed` | Request Engine (`request-engine.md` §17) | A record-keeping-only field captured on a specific Request, not enforced or collected, and not necessarily equal to the listing price (a Viewer and Publisher may negotiate offline). |

The Inventory Module has no visibility into, and no role in, whatever a Viewer and Publisher actually agree to pay offline (Critical Boundary #19; `mvp-prd.md` §1, §3.2). No auction, bidding, or price-negotiation mechanism exists anywhere in the platform at MVP.

## 13. Availability & Availability Calendar

Per `mvp-prd.md` §7.2: "Simple availability calendar (block/unblock dates)" — Publisher-managed (Critical Boundary #12).

The Availability Calendar is a set of date ranges the Publisher has explicitly blocked (e.g., for maintenance, an offline booking SEEABLE doesn't know about, or simply taking the listing off the market temporarily) versus left open. This is a **Publisher-authored** input, distinct from — but interacting with — the Request Engine's own date-blocking behavior:

| Mechanism | Who/what controls it | Effect |
|---|---|---|
| Publisher-blocked dates (this section) | Publisher, directly, via the availability calendar | Removes specific dates from Available regardless of any Request activity |
| Confirmed-request blocking (`REQUEST-001`) | Request Engine, automatically, when a request is accepted | Removes the Confirmed request's date range from Available for all other requests on that hoarding |

Both mechanisms feed the same underlying question — "is this hoarding available on date X?" — but they are triggered differently and owned by different modules. This document does not merge them into a single mechanism; it is important that the Publisher's manual calendar and the Request Engine's automatic blocking compose correctly (a date is Available only if **neither** mechanism marks it unavailable), and this composition rule is stated here explicitly because no single source document states it directly — it is the necessary combination of `mvp-prd.md` §7.2 and `REQUEST-001`.

## 14. Approval & Visibility State Model

This is the canonical version of the state model `admin-platform.md` §14.2 constructed provisionally (that document explicitly flagged it as "this document's own construction... should be reconciled against `inventory.md`... once available" — this is that reconciliation).

```text
Draft  →  Pending Approval  →  Approved
                  ↓
              Rejected
```

| State | Entry | Exit | Effect |
|---|---|---|---|
| Draft | Publisher creates a listing (`mvp-prd.md` §7.2) | Publisher submits for review — requires: Verified Publisher (`OWNER-004`); complete type-specific fields (`INVENTORY-001`); watermarking complete (`CONTENT-001`) | Not visible to Viewers |
| Pending Approval | Publisher submission | Admin approves or rejects (`admin-platform.md` §9) | Not yet visible to Viewers |
| Approved | Admin approval | *(no further `approval_status` exit — see below)* | Eligible for Viewer search, subject to the Paused/Delisted flags in §15 |
| Rejected | Admin rejection, with a reason (`ADMIN-003`) | **Undefined** — resubmission path not specified anywhere (`admin-platform.md` §9, §27) | Not visible to Viewers |

**Reconciliation note:** `admin-platform.md` §14.2 listed "Delisted" as a fifth state reachable from Approved. This document instead models Delisting (and Pausing) as **independent flags layered on Approved**, not as a transition out of the `approval_status` chain — see §15 for why. This is a refinement of `admin-platform.md`'s provisional model, not a contradiction of it: every transition `admin-platform.md` described (Approved can become effectively invisible via Admin action) still holds; this document is simply more precise about *how* that invisibility is represented, because Inventory — not Admin Platform — is the module that owns the underlying data shape. `admin-platform.md` should be read as consistent with this document going forward, per that document's own sourcing note.

Confirmed by `ADMIN-001`: "No listing reaches Viewer search results without passing Admin approval" — so `approval_status = Approved` is a necessary, but per §15 not sufficient, condition for Viewer visibility.

## 15. Pause, Delete, and Delist — Disambiguation

This section resolves — as far as the source documents allow — the terminology discrepancy flagged in §3. Three distinct actions exist across two different actors, and this document treats them as three genuinely different mechanisms rather than assuming any two are secretly the same:

| Action | Actor | Source | Reversible? | Effect on `approval_status` | Effect on Viewer visibility |
|---|---|---|---|---|---|
| Pause | Publisher | `mvp-prd.md` §7.2 | Yes — "block/unblock," i.e., pausing is explicitly reversible language | No change — an Approved listing stays Approved | Hidden from Viewer search while Paused (consistent with "approved, **available** listings," `mvp-prd.md` §7.3) |
| Delete | Publisher | `mvp-prd.md` §7.2 | **Undefined** — not stated | **Undefined** — not stated whether the record is hard-deleted or soft-removed | Hidden from Viewer search (at minimum) |
| Delist | Admin | `mvp-prd.md` §7.5; formalized as `ADMIN-004` in `admin-platform.md` §16 | **Undefined** — no "re-list" action described anywhere (`admin-platform.md` §14.2) | No change stated — `admin-platform.md` §14.2 treats it as independent of approval status, consistent with this document's §14 | Hidden from Viewer search |

**Why this document does not assume Delete and Delist are the same mechanism:** they are performed by different actors for different reasons (a Publisher voluntarily removing their own listing, versus Admin removing it as a moderation action), and conflating them risks a real bug — e.g., if "Delist" were implemented as calling the same code path as "Delete," an Admin's trust-and-safety action could accidentally destroy the historical listing record, breaking any Confirmed/Completed Request that still references it (`request-engine.md` §26 shows every Request carries a `hoarding_id`). This document's recommendation — flagged explicitly as an **Assumption/recommendation, not a stated product decision** — is that both Delete and Delist should be implemented as *soft* state changes (a flag, not a row deletion) precisely so that historical Request data remains intact. Whether the business intends Delete to be a genuine hard-delete is a real Open Question this document does not resolve unilaterally (§27).

**Why Pause is modeled as reversible and independent, while Delete/Delist's reversibility is unknown:** `mvp-prd.md` §7.2's own wording ("block/unblock dates" for the calendar, and listing pause as a named, distinct action from delete) implies Pause is meant to be toggled freely; no equivalent "unblock" language exists anywhere for Delete or Delist.

**Effect on already-Pending or already-Confirmed requests when a listing is Paused, Deleted, or Delisted:** not defined by any source document. `request-engine.md` §21 and §25 (#8–#9) already flag "listing paused/deleted while a request on it is Pending" as Open Questions; `admin-platform.md` §22 (#10) flags the Delisted case identically. This document does not re-derive an answer independently — it is the same open question, surfaced here because Inventory is the module whose flags are actually being changed when these actions occur.

## 16. Inventory Availability & Request Engine Interaction

**Critical Boundary #17:** Inventory does not own the Request Engine state machine. **Critical Boundary #18:** Inventory availability must interact correctly with Pending and Confirmed requests.

`request-engine.md` §6 defines AVAILABLE precisely as "the date range on this hoarding has no Confirmed request against it... a calendar condition, not a Request status." This document adopts that definition as authoritative for what "available" means from the Inventory side too — Inventory does not define a competing notion of availability; it supplies the calendar (§13) that the Request Engine reads.

The interaction is one-directional in ownership but bidirectional in data flow:

- **Request Engine reads** the Hoarding's availability (Publisher-blocked dates, §13, plus any existing Confirmed requests) to validate new submissions (`request-engine.md` §8–§9) and to re-validate at acceptance time (`REQUEST-004`).
- **Request Engine writes back** to what counts as "available" the moment a request becomes Confirmed — `REQUEST-001` blocks those dates against all other Pending requests on the same hoarding. This is not the Inventory Module directly mutating its own calendar; it is the Request Engine's own state (Confirmed requests) being one of the two inputs (alongside the Publisher's manual calendar, §13) that "available" is computed from.

This document does not restate or reinterpret `request-engine.md`'s own conflict-detection logic (§9–§10 there) — it only confirms that the Hoarding entity's calendar (§13) is the correct, sufficient data surface for that logic to operate against, and flags one dependency explicitly: `request-engine.md` §9 treats it as an **Assumption** (not a confirmed rule) that a new submission against already-Confirmed dates is blocked outright rather than accepted as a doomed Pending request. This document does not resolve that Assumption independently — it is `request-engine.md`'s open question, not this module's to answer, since it concerns Request creation behavior, not Inventory data shape.

## 17. Viewer-Readable Inventory Representation

Confirms that the fields defined in this document are sufficient for the Viewer-facing surfaces already specified in `viewer-platform.md`:

| Viewer surface | Fields required | Covered by |
|---|---|---|
| Filters (`viewer-platform.md` §9) | Hoarding type, location/distance, price ceiling | §7 (type), §8 (location, price) |
| Search Results card (`viewer-platform.md` §11) | Location, hoarding type, size, price, availability, listing image | §8 (location, size, price, availability, photos) |
| Map markers (`viewer-platform.md` §10) | Geo-location, approval + availability status | §8 (location — geo-coordinates, per the Assumption there), §14–§15 |
| Hoarding Detail (`viewer-platform.md` §12) | Basic info, media, location, type-specific specs, Site Intelligence summary | §8, §9, §10, §11 |

Only listings where `approval_status = Approved` and neither `paused` nor `delisted` is true are ever exposed through this representation — the composition rule stated in §16 and formalized as `INVENTORY-003` in §18.

**Distance-based search** depends on the geo-coordinate field this document flags as an Assumption in §8 — if geo-coordinates are not actually part of the Publisher's listing form (`owner-platform.md`, unavailable), the Distance filter and Map radius visualization (`viewer-platform.md` §9–§10) would have no data to compute against. This is surfaced as an Open Question rather than silently assumed to already be solved (§27).

## 18. Inventory Business Rules

The Inventory Module's own rules, preserved exactly as defined in `mvp-prd.md` §8:

### INVENTORY-001
Type-specific required fields must be complete before a listing can be submitted for review.

### INVENTORY-002
Site Intelligence data is optional at MVP submission but flagged "incomplete" in the Admin queue if missing.

**New Inventory rule formalized in this document:**

### INVENTORY-003
A hoarding listing is eligible to appear in Viewer search results only when all of the following hold simultaneously: `approval_status = Approved` (`ADMIN-001`), `paused = false`, and `delisted = false`. **Formalization note:** no single source document states this conjunction as one rule — `ADMIN-001` establishes the approval half ("no listing reaches Viewer search results without passing Admin approval"), while the Paused and Delisted conditions are each implied separately by `mvp-prd.md` §7.3's "approved, **available** listings" phrasing and by `ADMIN-004`'s independent-delisting behavior (`admin-platform.md` §16), but nothing ties all three into a single Viewer-visibility eligibility rule. `INVENTORY-003` makes that combination explicit, since it is the Inventory Module's own data (the three flags in §6, §14–§15) that actually determines it. This is not a new product decision — every individual condition it combines is already independently approved — it is a formalization of how three separately-stated rules compose into the one check Search (§17) actually needs to run.

Cross-referenced rules owned by other modules, not restated:

| Rule | Owning module | Relevance here |
|---|---|---|
| OWNER-001 | Publisher Module | A Publisher cannot accept two overlapping-date requests on the same hoarding — the Publisher-side mirror of `REQUEST-001`, reliant on this module's availability data (§16). |
| OWNER-003 | Publisher Module | Core listing fields (which this document defines the shape of) cannot be edited while a request on that listing is Pending. |
| OWNER-004 | Publisher Module | An unverified Publisher can draft listings (§14, Draft state) but cannot submit them for approval. |
| ADMIN-001 | Admin Platform | No listing reaches Viewer search without approval — the approval half of `INVENTORY-003`. |
| ADMIN-004 | Admin Platform | Delisting is an Admin action independent of Publisher suspension — the delisted half of `INVENTORY-003`; see §15's fuller disambiguation. |
| CONTENT-001 | Content Protection | A listing cannot be submitted for approval until all media has completed watermarking (§11). |
| REQUEST-001 / REQUEST-004 | Request Engine | Confirmed-request date blocking, which composes with this module's Publisher-managed calendar to determine availability (§16). |

## 19. Roles & Permissions (Inventory-Specific View)

Restated and narrowed from `mvp-prd.md` §5 to the actions that operate directly on Inventory data:

| Action | Publisher | Viewer | Admin |
|---|---:|---:|---:|
| Create a listing | Yes | No | No |
| Edit own listing (core fields) | Yes, except while a request is Pending (`OWNER-003`) | No | No (moderation-edit scope undefined — `admin-platform.md` §10, §27) |
| Pause / unpause own listing | Yes | No | No |
| Delete own listing | Yes | No | No |
| Submit listing for approval | Yes, if Verified (`OWNER-004`) and complete (`INVENTORY-001`, `CONTENT-001`) | No | No |
| Approve / reject a listing | No | No | Yes |
| Delist a listing | No | No | Yes (`ADMIN-004`) |
| Read Approved/available listings | Yes (browse, per `mvp-prd.md` §5) | Yes | Yes |
| Read listings in any state | No — Publishers see only their own listings, in any of their own states (Assumption, not stated explicitly — §27) | No — only Approved and available, per `INVENTORY-003` | Yes — all states, a structural necessity for the approval queue (`admin-platform.md` §13) |

## 20. Data Requirements

The full canonical Hoarding entity — extending the minimal subset `admin-platform.md` §18 drew from `mvp-prd.md` directly, now consistent with (not contradicted by) that document:

```text
Hoarding {
  id
  publisher_id
  type                          (mvp-prd.md §8 taxonomy)

  // Base fields (§8)
  location_address
  location_geo                  (Assumption — exact schema undefined, §27)
  size                           (Assumption — unit undefined, §27)
  price
  media_assets[]                 (each with a watermark_status: pending | complete | failed)

  // Type-specific (§9)
  type_specific_attributes       (structured JSON, per mvp-prd.md §10)

  // Availability (§13)
  availability_calendar          (Publisher-blocked date ranges)

  // Site Intelligence (§10)
  site_intelligence {
    footfall, footfall_source
    traffic_split
    demographics
    commute_mode_split
    dwell_time
    peak_off_peak_curve
    nearby_pois
    data_recency
    confidence_flag
  }
  site_intelligence_complete     (derived flag — INVENTORY-002)

  // Approval / Visibility (§14–§15)
  approval_status                (Draft | Pending Approval | Approved | Rejected)
  rejection_reason
  paused                         (boolean, Publisher-controlled)
  delisted                       (boolean, Admin-controlled — ADMIN-004)

  // Timestamps
  created_at
  submitted_at
  approved_at
  rejected_at
  paused_at
  delisted_at
  updated_at
}
```

This reconciles directly with `admin-platform.md` §18's Hoarding fields (`id`, `publisher_id`, `type`, `approval_status`, `rejection_reason`, `site_intelligence_complete`, `approved_at`, `delisted_at`) — every field that document listed appears here, none contradicted, with the remaining Inventory-owned fields filled in. `admin-platform.md` §18 also flagged that no field records *which Admin* approved/rejected a listing — that gap is not resolved here either; it belongs to the audit-log discussion already carried in `admin-platform.md` §20, and this document does not duplicate or resolve it independently.

This is a minimum data shape implied by approved behavior, not a database schema — table design, keys, indexes, and constraints belong to the still-unwritten Database Design document (`README.md` Tier 1 item #5).

## 21. API Dependencies

Per `mvp-prd.md` §9, the Inventory-relevant endpoints are:

```text
GET   /api/v1/hoardings?type=&city=&maxDistance=&maxPrice=
GET   /api/v1/hoardings/{id}
POST  /api/v1/hoardings                    (Publisher)
PATCH /api/v1/hoardings/{id}                (Publisher)
POST  /api/v1/hoardings/{id}/media          (Publisher)

POST  /api/v1/admin/hoardings/{id}/approve
POST  /api/v1/admin/hoardings/{id}/reject
```

**Gap noted, consistent with `admin-platform.md` §19:** no endpoint anywhere in `mvp-prd.md` §9 covers Pause, Delete, or Delist as distinct actions. Pause and Delete (Publisher-initiated) might reasonably reuse `PATCH /api/v1/hoardings/{id}`, but nothing states this — and Delist (Admin-initiated, `ADMIN-004`) has no endpoint at all, mirroring the identical gap `admin-platform.md` §19 already flagged for Publisher suspension. This document does not invent these endpoints; it notes the same gap from the Inventory side and defers it to the still-unwritten Full API Specification (`README.md` Tier 1 item #6).

## 22. Non-Functional Requirements

Inherited from `mvp-prd.md` §10, applied to Inventory data specifically — not invented as Inventory-specific NFRs:

- **Performance:** search and listing detail should feel responsive at 50–200 listings (§10).
- **Scalability:** the data model — specifically type-specific attributes stored as structured JSON (§9) — must support new hoarding types and future payment fields without a schema rewrite. This is the one NFR that names the Inventory Module directly, and this document's `type_specific_attributes` field (§20) is built to satisfy it.
- **Security:** the watermark pipeline must be isolated from public asset serving (§11); standard encryption in transit applies to all Inventory data.

No Inventory-specific performance target (e.g., maximum listing-creation latency, media-upload size limits) is defined anywhere — not invented here.

## 23. Edge Cases

| # | Scenario | Behavior | Basis |
|---|---|---|---|
| 1 | A hoarding plausibly fits two types (e.g., a mall-entrance digital screen) | **Open Question** — no resolution mechanism defined | `mvp-prd.md` §11, §7, §9 |
| 2 | Media upload succeeds but watermarking fails or times out | Listing shows "processing media," cannot be submitted (`CONTENT-001`); no defined retry/escalation | `mvp-prd.md` §11–§12 |
| 3 | A listing is missing Site Intelligence data at submission | Flagged "incomplete" in the Admin queue; not blocked | `INVENTORY-002` |
| 4 | A listing is missing a required type-specific field | Cannot be submitted at all | `INVENTORY-001` |
| 5 | A Publisher changes a listing's `type` after creation | **Open Question** — whether previously-entered type-specific data must be re-validated against the new type's fields is undefined | §9 |
| 6 | A hoarding is Paused while it has a Pending request | **Open Question**, cross-ref `request-engine.md` §21, §25 (#8) | §15 |
| 7 | A hoarding is Deleted while it has a Confirmed request | **Open Question** — if Delete is a hard delete, this would orphan a live Request's `hoarding_id` reference; this document recommends against hard-delete for exactly this reason (§15), but does not decide it | §15, §26 |
| 8 | A hoarding is Delisted while it has a Pending request | **Open Question**, cross-ref `admin-platform.md` §22 (#10) | §15 |
| 9 | A rejected listing is resubmitted | **Open Question** — same record reopened, or a new one created; cross-ref `admin-platform.md` §9, §27 | §14 |
| 10 | A listing has geo-coordinates missing or malformed | **Open Question** — Distance/Map search behavior undefined if location data is incomplete | §8, §17 |

## 24. Acceptance Criteria (Representative)

```text
Given a Publisher has filled in all base fields and all required type-specific fields
  and all media has completed watermarking
When the Publisher submits the listing for review

Then the listing moves from Draft to Pending Approval
And it does not appear in Viewer search until Admin approves it
```

```text
Given a listing is missing one required type-specific field for its hoarding type
When the Publisher attempts to submit it for review

Then submission is blocked (INVENTORY-001)
And the Publisher is shown which field is missing
```

```text
Given an Approved listing is missing Site Intelligence data
When it appears in the Admin approval queue

Then it is flagged "incomplete" (INVENTORY-002)
But this does not block Admin from approving it
```

```text
Given a listing is Approved, not Paused, and not Delisted
When a Viewer searches inventory matching its type, location, and price

Then the listing appears in the Viewer's search results (INVENTORY-003)
```

```text
Given an Approved listing is Paused by its Publisher
When a Viewer searches inventory that would otherwise match it

Then the listing does not appear in Viewer search (INVENTORY-003)
And its approval_status remains Approved
```

```text
Given a Publisher's account is suspended (ADMIN-002) without any individual listing being delisted
When a Viewer searches inventory

Then that Publisher's Approved listings still appear in Viewer search, per ADMIN-004's independent-actions reading
And they are only removed if separately Delisted
```

## 25. MVP vs Future

| Capability | MVP (this document) | Future |
|---|---|---|
| Hoarding types | 6 static, live; 2 digital, data-model-only | Live digital inventory; CMS/device attributes |
| Pricing | Flat, per listing | Dynamic/seasonal pricing, auctions, bidding |
| Site Intelligence | Captured, informational only | Consumed by AI pricing/recommendation engines |
| Availability | Publisher calendar + Request Engine blocking | Blackout-date rules, minimum lead time, campaign-aware scheduling |
| Type-specific attributes | Structured JSON, 8 known types | Fully extensible type registry, admin-configurable field schemas |
| Media | Watermarked photos/video, manual review | Automated content moderation, DRM-grade protection |
| Listing lifecycle | Draft / Pending Approval / Approved / Rejected, plus Paused/Delisted flags | Full audit trail of every state change; formal resubmission workflow |
| Search exposure | Type, distance, price, availability | Advanced filters (illumination, orientation, audience), ranking/recommendation |

## 26. Dependencies

**Publisher Module → Inventory**
Creates and edits listings against the entity shape this document defines (§6, §20); `OWNER-003`/`OWNER-004` gate editing and submission. `owner-platform.md` was unavailable for this document (see sourcing note) — the fourth confirmation of this gap this session.

**Admin Platform → Inventory**
Reads Pending Approval listings and the `INVENTORY-002` completeness flag to make approval decisions (`admin-platform.md` §9); writes `approval_status`, `rejection_reason`, and the `delisted` flag (`ADMIN-004`). This document's §14–§15 formally reconciles the provisional state model `admin-platform.md` §14.2 constructed pending this document's availability.

**Viewer Platform → Inventory**
Reads only listings satisfying `INVENTORY-003` for Search, Filter, and Map (§17); reads full listing detail for the Hoarding Detail page.

**Request Engine → Inventory**
Reads the availability calendar (§13) and interacts with it per the composition rule in §16; does not write to the Hoarding entity itself — Confirmed-request blocking is Request Engine state, not an Inventory field mutation.

**Content Protection → Inventory**
Owns the watermarking pipeline; Inventory stores only the resulting media references and their watermark status (§11), gated by `CONTENT-001`.

**Still-unwritten documents this module connects to:**
`docs/03-modules/owner-platform.md` (referenced but unavailable), Database Design / ERD (`README.md` Tier 1 item #5 — this document's §20 is a strong input to it), Full API Specification (Tier 1 item #6 — see the Pause/Delete/Delist endpoint gap in §21), System Architecture (Tier 1 item #4).

## 27. Open Questions

Genuine unresolved decisions only, compiled from every gap surfaced while writing this module:

- Exact geo-coordinate schema for location data — whether it's captured at all, and at what precision (§8, §17, §23 #10).
- The unit for the `size` field — square feet, square meters, or a named size class (§8).
- Whether at least one photo is a hard minimum for submission, or merely a practical consequence of `CONTENT-001` (§8).
- Whether a listing's `type` can be changed after creation, and whether that re-triggers `INVENTORY-001` validation against the new type's fields (§9, §23 #5).
- How the "hoarding plausibly fits two types" case is resolved at submission (§7, §23 #1).
- What happens on watermarking failure/timeout beyond the "processing media" status — retry, escalation, or manual intervention (§11, §23 #2).
- Whether Delete is a hard delete (destroying the record) or a soft/reversible removal — this document recommends soft-delete to preserve historical Request references, but does not decide it (§15, §23 #7).
- Whether Delist is reversible via a "re-list" action (§14, §15).
- Whether Pause, Delete, or Delist while a request is Pending or Confirmed has a defined effect — cross-referenced from `request-engine.md` §21/§25 and `admin-platform.md` §22, not re-opened independently (§15, §23 #6, #7, #8).
- Whether a rejected listing can be edited and resubmitted as the same record, or must be recreated — cross-ref `admin-platform.md` §9, §27 (§14, §23 #9).
- Whether a Publisher can see their own listings across every state (Draft/Pending/Approved/Rejected/Paused/Delisted), or only some subset — reasonable inference, not stated (§19).
- Who records which Admin approved/rejected/delisted a given listing — cross-ref `admin-platform.md` §18, §20's audit-trail gap, not resolved independently here (§20).
- Whether the missing Pause/Delete/Delist API endpoints should extend `PATCH /api/v1/hoardings/{id}` or need dedicated routes — cross-ref `admin-platform.md` §19 (§21).

If any of these are already resolved in a document outside this session's available context (e.g., `owner-platform.md` once available, or the Database Design / API Specification documents once written), this list should be reconciled against them rather than treated as still open.

## 28. Requirement ID Index

```text
INVENTORY-001
INVENTORY-002
INVENTORY-003
```

`INVENTORY-003` is the one new ID introduced in this document (§18) — it formalizes the combination of `ADMIN-001`'s approval gate with the Paused/Delisted flags this document defines into the single Viewer-visibility eligibility check that `viewer-platform.md` §8 and §17 above both rely on. It is not a new product decision; every condition it combines was already independently approved elsewhere.

Cross-referenced rules owned by other modules, not renumbered:

```text
OWNER-001
OWNER-003
OWNER-004
ADMIN-001
ADMIN-002
ADMIN-004
CONTENT-001
REQUEST-001
REQUEST-004
```

---

*End of SEEABLE Hoardings — Inventory Module.*
