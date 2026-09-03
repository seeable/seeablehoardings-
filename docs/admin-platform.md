# SEEABLE Hoardings — Admin Platform Module

**Document Type:** Module Specification (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.0
**Status:** Draft for Review
**Date:** 27 August 2026
**Related Documents:** `docs/01-product/mvp-prd.md`, `docs/01-product/mvp-brd.md`, `SEEABLE_Hoardings_Master_PRD_Framework.md`, `claude/SEEABLE_Hoardings_BRD.md` (full-scope), `README.md` (Documentation Index), `docs/03-modules/inventory.md` (referenced, unavailable), `docs/03-modules/owner-platform.md` (referenced, unavailable), `docs/03-modules/viewer-platform.md`, `docs/03-modules/request-engine.md`

> **Note on sourcing:** This document extracts and organizes Admin-side requirements that currently exist only inline in `mvp-prd.md` §4–§9 and `mvp-brd.md` §7.5, §8, §11, per the gap identified in the Documentation Index (`README.md`, Tier 1 item #3). `docs/03-modules/inventory.md` and `docs/03-modules/owner-platform.md` are referenced throughout as sibling specs this module depends on — for the type-specific listing fields Admin reviews, and for the Publisher-side mirror of the verification/suspension flow — but neither was available for direct cross-reading at the time of writing (this has now been checked three times across this session's module docs). Field names and structure attributed to them here are drawn instead from `mvp-prd.md` §7.2 and §8 directly. Once those module docs exist, their terminology should be reconciled against this document; any conflict should resolve in favor of `mvp-prd.md` as the authoritative source. No new product decisions are introduced — anything not already defined in the MVP PRD/BRD is explicitly marked as an **Open Question**, **Assumption**, or **Future Enhancement**. Two new rule IDs (**ADMIN-003**, **ADMIN-004**) are minted in §16, and both are explicitly flagged as formalizations of prose that already exists in `mvp-prd.md` §7.5 — not as new product decisions.

> **Source conflict noted — ID collision with the full-scope BRD:** `claude/SEEABLE_Hoardings_BRD.md` §7.13 defines its own **BR-ADMIN-001**, **BR-ADMIN-002**, and **BR-ADMIN-003**, and they mean something substantially larger than anything in this document. The full-scope BR-ADMIN-001 requires Admin to "manage users, organizations, inventory approval, campaign approval, creative approval, **payment administration, pricing administration**, content moderation, support, analytics, **audit logs**, and platform configuration from a dedicated administrative platform" — i.e., the full super-admin console. Full-scope BR-ADMIN-002 requires a granular, expandable RBAC permission system; BR-ADMIN-003 requires a full audit log of all administrative and financial actions. **None of this is MVP scope.** `mvp-brd.md` (the MVP-scoped BRD) has its own, unrelated **BR-ADMIN-001** ("no listing may reach Viewer search without Admin approval" → `ADMIN-001`) and **BR-ADMIN-002** ("the business requires visibility into platform health" → the dashboard, no PRD rule ID). Three different documents now use the string "BR-ADMIN-00X" for three different sets of meaning across two numbering scopes (full-scope vs. MVP-scope) that happen to collide on the first two numbers. This document uses only the MVP PRD's `ADMIN-001`/`ADMIN-002` and the MVP BRD's `BR-ADMIN-001`/`BR-ADMIN-002` (explicitly as the MVP-scoped ones), and treats every full-scope `BR-ADMIN-*` item as **Future Enhancement**, never as an MVP requirement. This collision is exactly the failure mode the Critical Product Boundary in this document's brief warns against — mistaking full-scope Admin ambition for MVP scope — and is worth fixing at the documentation level the next time the full-scope BRD or `mvp-brd.md` is revised.

> **Consistency note (Publisher-side authentication):** `viewer-platform.md` v1.1 introduced a demo/proof-of-concept variance to `AUTH-002`, deferring OTP verification for Viewer login in favor of email/mobile + password, and explicitly noted: *"AUTH-002 also governs Publisher verification... the same variance would need to be applied symmetrically on the Publisher side for the two flows to stay consistent — that is outside this module's scope to specify."* This document is the natural place that gap surfaces, because Publisher Verification (§8 below) is specified against the **approved `mvp-prd.md` target** — OTP-gated verification (`AUTH-002`, `BR-AUTH-002`, `OWNER-004`) — not against a Publisher-side demo variance, since no such variance has been formally written anywhere. If the current demo build also runs Publisher login without OTP, then in practice the Admin "Publisher verification queue" described in §8 may not be gated the way this document specifies. This is carried forward as an Open Question (§27) rather than silently assumed either way.

---

## 1. Module Overview

The Admin Platform is SEEABLE's internal-facing trust and moderation layer. It is operated by SEEABLE's own team, not by Publishers or Viewers, and it exists because the MVP has no payment or escrow step (`mvp-prd.md` §3.2, §15) to otherwise guarantee that a listing is real, that a Publisher is legitimate, or that a request completes as agreed. `mvp-brd.md` §10 states this plainly: *"Trust is the primary NFR at this phase... verification and approval are the only mechanisms standing between the platform and fraudulent or inaccurate listings."*

Concretely, the Admin Platform is the surface through which a single internal Admin role:

- Verifies Publisher accounts before their listings can reach Viewer search (§8)
- Approves or rejects individual hoarding listings submitted for review (§9)
- Suspends a Publisher or delists an individual hoarding when something goes wrong after approval (§11)
- Exercises the narrow, Request-Engine-granted authority to mark a request Completed (§12)
- Monitors basic platform health via a counts dashboard (§7)

It is deliberately **not** a general operations console. See §2 for what that boundary excludes.

## 2. Module Objective

The objective of the Admin Platform, per `mvp-brd.md` §4 ("Establish an early trust layer") and §10, is narrow and specific: **make Admin approval and verification a credible substitute for payment-based trust**, cheaply enough to run with a single internal role and no dedicated tooling beyond a queue and a dashboard.

This module explicitly does **not** aim to:

- Provide a general-purpose super-admin system with unrestricted database access
- Give Admin arbitrary request-state modification power (Admin's only Request Engine authority is Mark Completed — `request-engine.md` §4, §23)
- Administer payments, commissions, or financial settlement (all settlement is offline and outside platform scope — `mvp-prd.md` §1, §3.2)
- Provide CRM functionality, advanced analytics, or the full audit-log/RBAC system described in the full-scope BRD (see the Source Conflict note above)
- Resolve disputes procedurally — the operational runbook for that does not exist yet (`README.md` Tier 1 item #13)

Every capability below is scoped only to what `mvp-prd.md` §7.5 and §5, and `mvp-brd.md` §7.5 and §8, actually grant.

## 3. Admin Role

| Capability | Description | Source | MVP Status |
|---|---|---|---|
| Verify Publisher | Review a Publisher's account and approve or reject it; gates whether that Publisher can submit listings for approval | `mvp-prd.md` §7.5 ("Publisher verification queue"); `AUTH-002`, `OWNER-004`; `mvp-brd.md` §7.1 `BR-AUTH-002` | In scope (§8) |
| Approve / Reject Hoarding Listing | Review a submitted listing; approve (making it eligible for Viewer search) or reject with a reason | `mvp-prd.md` §7.5; `ADMIN-001`; `mvp-brd.md` §7.5 `BR-ADMIN-001` | In scope (§9) |
| Suspend Publisher | Block a Publisher from creating new listings; does not cancel that Publisher's already-Confirmed requests | `mvp-prd.md` §7.5; `ADMIN-002` | In scope (§11) |
| Delist Hoarding | Remove one already-approved listing from Viewer search, independent of any Publisher-level suspension | `mvp-prd.md` §7.5 ("...or delist a hoarding") | In scope (§11; formalized as `ADMIN-004` in §16) |
| Mark Request Completed | Jointly with the Publisher, mark an eligible request Completed once its campaign period ends | `mvp-prd.md` §7.4; cross-ref `REQUEST-003` | In scope, narrowly (§12) |
| View Platform Dashboard | View aggregate counts: total listings, pending approvals, total requests, confirmation rate | `mvp-prd.md` §7.5; `mvp-brd.md` §7.5 `BR-ADMIN-002` | In scope (§7) |
| Browse / search listings | Same read access to inventory as any user | `mvp-prd.md` §5 | In scope |
| Edit a listing "for moderation purposes" | Some unspecified edit capability on a Publisher's own listing content | `mvp-prd.md` §5 Roles & Permissions table | Partially defined — scope is an Open Question (§10, §27) |

**Explicitly not granted to Admin at MVP** (per the Critical Product Boundary and confirmed by the absence of any supporting requirement in `mvp-prd.md` or `mvp-brd.md`):

- Accepting, rejecting, or otherwise changing the state of an individual Viewer request, beyond the Mark Completed action above (`request-engine.md` §4, §23)
- General visibility into individual, non-aggregate requests (`request-engine.md` §4 draws this line explicitly and flags it as an Open Question tied to the unwritten Support/Dispute Handling Runbook)
- Any payment, commission, invoicing, or financial administration
- Bulk operations of any kind (bulk-approve is explicitly still an open question in `mvp-prd.md` §14, not a granted capability)
- Managing other Admin accounts, granular permissions, or platform configuration (full-scope BR-ADMIN-001/002, not MVP)
- Producing or reviewing an audit log (full-scope BR-ADMIN-003, not MVP — see §20)

## 4. MVP Scope

### 4.1 In Scope

- Publisher verification queue and approve/reject decision (§8)
- Hoarding listing approval queue and approve/reject-with-reason decision (§9)
- The platform counts dashboard: total listings, pending approvals, total requests, confirmation rate (§7)
- Publisher suspension (§11)
- Individual hoarding delisting (§11)
- Participation in the Request Engine's Mark Completed action, jointly with the Publisher (§12)

### 4.2 Out of Scope

The following are explicitly deferred for the platform as a whole (`mvp-prd.md` §3.2, `mvp-brd.md` §5.2) or are full-scope-only capabilities per the Source Conflict note in the header, and therefore do not appear anywhere in the Admin experience at MVP:

- Payment, escrow, and commission administration
- Contract generation or management
- CRM functionality of any kind
- A full audit-log system (full-scope `BR-ADMIN-003`)
- Granular, expandable RBAC / multiple Admin permission tiers (full-scope `BR-ADMIN-002`) — MVP has exactly one Admin role
- Content Moderation Guidelines as a defined rubric — none exist yet (`README.md` Tier 1 item #12); Admin approval at MVP can only be judged against the structural completeness rules that do exist (`INVENTORY-001`, `CONTENT-001` — see §9, §10)
- A Support / Dispute Handling Runbook or any dispute-resolution tooling — does not exist yet (`README.md` Tier 1 item #13)
- Advanced analytics beyond the four dashboard counts named in `mvp-prd.md` §7.5
- Bulk approval/rejection of listings — open in `mvp-prd.md` §14, not decided
- Digital screen, device, or CMS administration (no live digital inventory at MVP — `mvp-prd.md` §3.2, §8)

Any Admin-facing capability not listed in §4.1, and not covered elsewhere in `mvp-prd.md`/`mvp-brd.md`, should be treated as out of scope for this module until the source documents say otherwise.

## 5. Admin User Journey

`mvp-prd.md` does not define a single end-to-end "Admin journey" the way it does for Publisher (§6.1) and Viewer (§6.2) — Admin's involvement is instead described as discrete touchpoints inside the Publisher journey. This section reconstructs those touchpoints as journeys, without inventing steps beyond what §6.1, §7.5, and §7.4 already state.

### 5.1 Publisher Verification Journey

```text
Publisher registers and requests verification
    ↓
Publisher appears in Admin's Publisher verification queue
    ↓
Admin reviews  →  Verify  /  Reject
    ↓
Verified: Publisher can now submit listings for approval (OWNER-004)
Rejected: Publisher remains unable to submit listings — outcome after rejection is undefined (§27)
```

### 5.2 Listing Approval Journey

```text
Publisher submits a hoarding listing for review
    (requires: verified Publisher — OWNER-004; complete type-specific fields — INVENTORY-001;
     completed watermarking — CONTENT-001)
    ↓
Listing appears in Admin's listing approval queue
    ↓
Admin reviews  →  Approve  /  Reject (with a reason — see ADMIN-003, §16)
    ↓
Approved: listing becomes eligible for Viewer search (ADMIN-001)
Rejected: listing does not appear in Viewer search; whether/how the Publisher can resubmit is undefined (§27)
```

### 5.3 Suspension / Delisting Journey

```text
Admin identifies a problem with a Publisher or a specific listing
    (mechanism for identifying the problem is undefined — no dispute tooling exists yet, §4.2)
    ↓
Admin suspends the Publisher (blocks new listing creation only — ADMIN-002)
    and/or
Admin delists the specific hoarding (removes it from Viewer search — ADMIN-004)
    ↓
Already-Confirmed requests on that Publisher's listings complete as agreed (ADMIN-002)
```

### 5.4 Completion Journey

```text
A Confirmed request reaches Live and its campaign period ends
    ↓
Publisher or Admin marks the request Completed (jointly available — mvp-prd.md §7.4)
    ↓
Request reaches its terminal Completed state (REQUEST-003 floor: not before the request's own start date)
```

## 6. Admin Information Architecture

`mvp-prd.md` does not specify Admin-side screens (unlike the Viewer's map/search/detail surfaces in §7.3). The screens below are the minimum surface implied by the granted capabilities in §3 — nothing is added beyond what those capabilities require.

| Screen | Purpose | Populated from |
|---|---|---|
| Dashboard (home) | The four counts in §7 | `mvp-prd.md` §7.5 |
| Publisher Verification Queue | List of Publishers awaiting verification; Verify/Reject action | `mvp-prd.md` §7.5 |
| Listing Approval Queue | List of listings submitted for review; Approve/Reject-with-reason action; Site Intelligence completeness flag (`INVENTORY-002`) | `mvp-prd.md` §7.5, §8 |
| Publisher Management | Find a Publisher; Suspend action | `mvp-prd.md` §7.5 |
| Hoarding Management | Find a listing; Delist action | `mvp-prd.md` §7.5 |

**Not included, and not assumed:** a general request browser/inbox (Admin has no individual-request visibility beyond Mark Completed — `request-engine.md` §4), a dispute/ticket screen (no Support Runbook exists — §4.2), an audit log viewer (full-scope only — §20), and a bulk-action toolbar (open question, not a decision — `mvp-prd.md` §14).

## 7. Admin Dashboard

`mvp-prd.md` §7.5 defines the dashboard's contents exactly:

| Metric | Definition |
|---|---|
| Total listings | Count of all hoarding listings, regardless of approval status (Assumption — `mvp-prd.md` does not state whether this counts only Approved listings or every listing ever submitted; the more useful "platform health" reading, consistent with `mvp-brd.md` §10, is all listings — flagged in §27) |
| Pending approvals | Count of listings currently awaiting an Admin approve/reject decision |
| Total requests | Count of all requests created in the Request Engine, across all states |
| Confirmation rate | Proportion of requests that reach Confirmed, out of total requests created |

No other metric is defined as an MVP dashboard requirement.

**Gap noted — BRD KPI list is broader than the PRD dashboard spec.** `mvp-brd.md` §14 lists MVP success KPIs that go well beyond these four: number of Publishers onboarded and verified, number of Viewer accounts created, median Publisher response time to a request, and repeat usage. None of these appear in `mvp-prd.md` §7.5's dashboard functional requirement. This is not necessarily a contradiction — the BRD may intend these to be measured outside the in-app Admin dashboard, e.g., via the still-unwritten Analytics & Event Tracking Plan (`README.md` Tier 1 item #11) — but as written, the two documents describe different sets of numbers under the same "platform health visibility" objective (`BR-ADMIN-002`). This is carried into §27 as an Open Question rather than resolved by assumption.

## 8. Publisher Verification

**Functional basis:** `mvp-prd.md` §7.5 lists "Publisher verification queue" as a distinct Admin capability, separate from listing approval. `mvp-brd.md` §7.1 `BR-AUTH-002` states: *"A Publisher must complete lightweight verification (OTP at minimum) before any listing of theirs can go live"* — mapped to `AUTH-002` and `OWNER-004`. `OWNER-004` itself states: *"An unverified Publisher can draft listings but cannot submit them for Admin approval."*

**What is defined:** verification gates listing submission (`OWNER-004`), and the baseline verification mechanism is OTP (`AUTH-002`, `BR-AUTH-002`).

**What is not defined, and is a genuine Open Question, not an assumption this document resolves:** `BR-AUTH-002`'s phrase "OTP **at minimum**" and `mvp-prd.md` §7.5's separate mention of a "Publisher verification **queue**" (a queue implies something for Admin to manually review, whereas OTP verification is a self-service, automatic, instant check with nothing for Admin to look at) together suggest two distinct things may be happening: (1) an automatic OTP check that gates certain actions per `AUTH-002`, and (2) a separate, manual Admin review step of unspecified criteria. Whether these are the same gate, or two independent gates, is not stated anywhere in `mvp-prd.md` or `mvp-brd.md`. This document does not invent verification criteria (no KYC, GST, or bank-account verification is specified anywhere in scope, and none is introduced here) — it treats the manual queue's actual review criteria as undefined and carries this forward as an Open Question (§27).

**Consistency with the Publisher-side demo variance:** see the Consistency Note at the top of this document. If Publisher login in the current demo build also runs without OTP (mirroring the Viewer-side variance in `viewer-platform.md`), the OTP half of this gate would not exist in the current build either, though this has not been formally specified anywhere and is not assumed here.

**Publisher verification states** (constructed from `OWNER-004` and `mvp-prd.md` §7.2's "verification status" field — see §14 for the full state model):

| State | Meaning | Effect |
|---|---|---|
| Unverified | Default state on registration | Publisher can draft listings but cannot submit them for approval (`OWNER-004`) |
| Verified | Admin (and/or OTP, per the Open Question above) has cleared the Publisher | Publisher can submit listings for approval |
| Suspended | Admin has suspended the Publisher (§11) | Publisher cannot create new listings (`ADMIN-002`); existing Confirmed requests are unaffected |

What happens after a verification **rejection** — can the Publisher retry, is the account permanently blocked, is there a cooldown — is not defined anywhere in the source documents. Carried to §27.

## 9. Hoarding Listing Approval

**Functional basis:** `mvp-prd.md` §7.5: "Listing approval queue — Approve / Reject with a reason." Business rule `ADMIN-001`: "No listing reaches Viewer search results without passing Admin approval." `mvp-brd.md` §7.5 `BR-ADMIN-001` mirrors this at the business level.

**Preconditions a listing must already satisfy before it can even reach the approval queue** (owned by other modules, not by Admin, but relevant context for what Admin is and isn't verifying):

- The submitting Publisher is Verified (`OWNER-004`)
- All type-specific required fields for the listing's hoarding type are complete (`INVENTORY-001`)
- All media has completed the watermarking pipeline (`CONTENT-001`)

Because these are enforced upstream, Admin's approval decision is **not** a check of structural completeness (that has already passed) — it is a judgment call on accuracy, legitimacy, and quality, for which, as noted in §10, no defined criteria exist yet.

**Site Intelligence completeness flag:** per `INVENTORY-002`, Site Intelligence data is optional at submission, but a listing missing it is flagged "incomplete" in the Admin queue. This is a visibility flag, not a blocking gate — `INVENTORY-002` does not say an Admin must reject a listing for missing Site Intelligence data, only that the queue must surface the gap.

**Approve:** the listing becomes eligible for Viewer search (`ADMIN-001`). No further Admin-specific requirement is defined for what happens on approval.

**Reject:** `mvp-prd.md` §7.5 requires a reason to accompany a reject decision ("Approve / Reject with a reason"). See `ADMIN-003` in §16 for the formalization of exactly which action the reason attaches to.

**Bulk approval:** `mvp-prd.md` §14 asks this directly as an open question — *"Does Admin need bulk-approve for listings, or is one-by-one acceptable at 50-listing scale?"* — and does not answer it. This document does not assume an answer either way; bulk actions are out of scope until this is resolved (§4.2, §27).

**Resubmission after rejection:** not defined. Whether a rejected listing can be edited and resubmitted as the same listing record, or must be recreated, is an Open Question (§27) that also touches `OWNER-003` (core listing fields cannot be edited while a request is pending — not directly applicable here, but the same family of "what can a Publisher edit, and when" question).

## 10. Listing Moderation Rules

`mvp-prd.md` §5's Roles & Permissions table gives Admin "edit for moderation only" on listings — the only edit permission Admin has anywhere in the source documents. No elaboration of this exists anywhere in `mvp-prd.md`, `mvp-brd.md`, or the full-scope BRD's discussion of MVP scope. This document does **not** invent a moderation-edit feature set (e.g., "Admin can redact contact info from a listing description," "Admin can crop/remove an individual photo") — none of that is stated, and per the Critical Product Boundary, unstated capabilities are not manufactured here. The existence and exact scope of Admin's edit-for-moderation capability is carried forward as an Open Question (§27).

Separately, and just as unresolved: `README.md` Tier 1 item #12 confirms that **Content Moderation Guidelines do not exist as a document** — meaning there is currently no defined rubric for *what* should cause Admin to reject a listing beyond the structural gates already covered in §9 (`INVENTORY-001`, `CONTENT-001`). Judgment calls on accuracy, appropriateness, or quality are therefore entirely undefined at MVP. This module does not attempt to supply that rubric — it is out of this document's scope and belongs in the still-unwritten Content Moderation Guidelines.

## 11. Publisher Suspension

**Functional basis:** `mvp-prd.md` §7.5: "Ability to suspend a Publisher or delist a hoarding." Business rule `ADMIN-002`: "Suspending a Publisher does not cancel already-Confirmed requests; those complete as agreed, but the Publisher cannot create new listings while suspended."

This is a **Critical Product Boundary** restated from the brief governing this document: Publisher suspension must never cancel an already-Confirmed request. `ADMIN-002` is unambiguous on this point and this document does not weaken it anywhere.

**What suspension does, per `ADMIN-002` exactly as written:**

- Blocks the Publisher from creating new listings
- Does **not** cancel or otherwise affect already-Confirmed requests, which complete as agreed

**What suspension does not explicitly address** (already flagged as an Open Question in `request-engine.md` §33, not repeated as a new finding here, only cross-referenced): whether a suspended Publisher can still accept or reject a request that is still Pending (`REQUESTED`) at the moment of suspension. `ADMIN-002` only speaks to already-Confirmed requests.

**Delisting is treated as an independent action, not a cascade of suspension — see `ADMIN-004` below.** `mvp-prd.md` §7.5 phrases the capability as "suspend a Publisher **or** delist a hoarding" — two items joined by "or," read here as two independent powers rather than one triggering the other. See §16 for the formalization and the alternative reading this document flags as still open.

**What happens to a suspended Publisher's other, still-Approved listings** (the ones that are not individually delisted) is not stated. Under the independent-actions reading in `ADMIN-004`, those listings would remain visible in Viewer search unless separately delisted — this is the literal consequence of treating the two capabilities as independent, not a new decision, but it is surfaced explicitly in §27 since it may not match the intended trust-and-safety outcome.

## 12. Request/Completion Administration

This section deliberately mirrors, rather than re-derives, `request-engine.md` §4's definition of Admin's authority — that document is the owning spec for the Request Engine's state machine and actor permissions, and this document does not restate or reinterpret its rules independently.

Per `mvp-prd.md` §7.4 and §7.5, and as already formalized in `request-engine.md` §4, Admin's authority over requests is limited to exactly two things:

1. **Mark Completed** — jointly available with the Publisher, once a Confirmed/Live request's campaign period has ended (`mvp-prd.md` §7.4: "Manual 'Mark Completed' action (Publisher **or** Admin)"). This exists because there is no payment event to trigger closure automatically (`BR-REQUEST-003`). The `REQUEST-003` floor applies: a request cannot move to Completed before its own start date.
2. **Aggregate dashboard visibility** — total requests and confirmation rate, as counts only (§7), never as a browsable list of individual requests.

**Admin does not have, and this document does not grant:**

- General visibility into individual Viewer or Publisher requests
- Any ability to accept, reject, or otherwise alter a request's state outside Mark Completed
- Any mediation or dispute-resolution action on a request — no such tooling or runbook exists (`README.md` Tier 1 item #13)

`request-engine.md` §33 already carries the exact scope of "Admin's view/manage requests capability beyond Mark Completed and aggregate counts" as an Open Question connected to the unwritten Support/Dispute Handling Runbook. This document does not reopen that question independently — it is the same open question, referenced here because it bears directly on what an Admin Platform UI would need to support.

## 13. Inventory Visibility Rules

For a Viewer, only Admin-approved, available listings are ever visible (`ADMIN-001`, restated in `viewer-platform.md` §8, §16). Admin's own visibility is necessarily broader than a Viewer's, since Admin must be able to see listings that have **not yet** been approved in order to act on the approval queue (§9) — this is a structural necessity of the approval workflow itself, not a new rule requiring its own ID.

**Assumption (not stated explicitly anywhere, but required for the approval queue to function):** Admin can see listings in every state — Draft, Pending Approval, Approved, Rejected, and Delisted (see the state model in §14) — while a Viewer can only ever see Approved and not-otherwise-unavailable listings. This is flagged as an Assumption rather than a confirmed rule because `mvp-prd.md` never explicitly enumerates Admin's read scope; it is the only reading consistent with the approval queue (§9) and the verification queue (§8) being able to function at all.

## 14. Admin State Models

`mvp-prd.md` does not define formal state machines for either Publisher verification status or hoarding listing approval status the way it does for the Request Engine (`mvp-prd.md` §7.4). The models below are constructed from the fields and rules that do exist (`OWNER-004`, `ADMIN-001`, `ADMIN-002`, the "verification status" field in §7.2, and the approve/reject functional requirement in §7.5); every transition not directly supported by those sources is marked as an Assumption or Open Question rather than presented as decided.

### 14.1 Publisher Verification State

```text
Unverified  →  Verified  →  Suspended
     ↓
  Rejected  (terminal? retry path undefined — Open Question)
```

| State | Entry | Exit | Effect |
|---|---|---|---|
| Unverified | Account registration (default) | Admin verifies or rejects (§8) | Can draft, cannot submit listings (`OWNER-004`) |
| Verified | Admin verification decision | Admin suspends (§11) | Can submit listings for approval |
| Suspended | Admin suspension decision (§11) | **Undefined** — no "un-suspend" action is described anywhere | Cannot create new listings (`ADMIN-002`); Confirmed requests unaffected |
| Rejected | Admin verification decision | **Undefined** | Cannot submit listings; retry path not specified |

Whether Suspended is reversible (an "un-suspend" action) is not addressed in any source document — carried to §27 as an Open Question, consistent with `request-engine.md`'s own practice of not inventing recovery paths that aren't stated.

### 14.2 Hoarding Listing Approval State

```text
Draft  →  Pending Approval  →  Approved  →  Delisted
                  ↓
              Rejected  (resubmission path undefined)
```

| State | Entry | Exit | Effect |
|---|---|---|---|
| Draft | Publisher creates a listing (`mvp-prd.md` §7.2) | Publisher submits for review (requires Verified Publisher — `OWNER-004`; complete fields — `INVENTORY-001`; watermarking done — `CONTENT-001`) | Not visible to Viewers |
| Pending Approval | Publisher submission | Admin approves or rejects (§9) | Not yet visible to Viewers |
| Approved | Admin approval | Admin delists (§11), or Publisher pauses/deletes (`mvp-prd.md` §7.2, owned by the Publisher Module, not restated here) | Eligible for Viewer search (`ADMIN-001`) |
| Rejected | Admin rejection (with reason — `ADMIN-003`) | **Undefined** — resubmission path not specified | Not visible to Viewers |
| Delisted | Admin delisting decision (§11, `ADMIN-004`) | **Undefined** — no "re-list" action is described | Not visible to Viewers, independent of the owning Publisher's own suspension status |

This state model is this document's own construction, not a direct transcription of a source diagram (none exists) — it should be reconciled against `inventory.md` and `owner-platform.md` once those documents are available, per the sourcing note at the top of this document.

## 15. Roles & Permissions

Restated directly from `mvp-prd.md` §5 (the authoritative, PRD-level table) and cross-checked against `mvp-brd.md` §8 (the business-level table, which is consistent with it):

| Action | Publisher | Viewer | Admin |
|---|---:|---:|---:|
| Create/edit own listing | Yes | No | No (edit for moderation only — scope undefined, §10) |
| Browse/search listings | Yes | Yes | Yes |
| Submit date request | No | Yes | No |
| Accept/reject request | Yes (own listings) | No | No |
| Approve/reject listing | No | No | Yes |
| Verify Publisher | No | No | Yes |
| View platform-wide counts | No | No | Yes |

No row in this table, in either source document, grants Admin the ability to accept/reject a *request* — that authority belongs to the Publisher alone (`mvp-prd.md` §5, `request-engine.md` §4). Admin's only Request Engine authority is Mark Completed, which is not a row in this permissions table at all — it is stated separately in §7.4's functional requirements, not in the §5 permissions matrix. This is worth noting explicitly because a reader relying on the permissions table alone could miss that Admin has any Request Engine role whatsoever.

## 16. Admin Business Rules

The Admin Module's own rules, preserved exactly as defined in `mvp-prd.md` §7.5:

### ADMIN-001
No listing reaches Viewer search results without passing Admin approval.

### ADMIN-002
Suspending a Publisher does not cancel already-Confirmed requests; those complete as agreed, but the Publisher cannot create new listings while suspended.

**New Admin Platform rules formalized in this document:**

### ADMIN-003
When an Admin rejects a hoarding listing, the system must require and store a rejection reason before the rejection can be completed. **Formalization note:** `mvp-prd.md` §7.5 states the functional requirement as a single bullet — "Approve / Reject with a reason" — without specifying whether the reason is mandatory for both actions or only for Reject. This rule formalizes the reason requirement for **Reject only**, since a rejection reason is the case where the Publisher needs actionable feedback to fix and resubmit, whereas an approval needs no corrective feedback. This allocation (reason required on Reject, not required on Approve) is this document's own reasonable reading of the source bullet, not a stated rule — it is flagged here as an Assumption within the formalization, and carried to §27 for confirmation. `ADMIN-003` is not a new product decision; it makes explicit, as its own rule, a requirement `mvp-prd.md` §7.5 already states in prose but never assigned an ID.

### ADMIN-004
Suspending a Publisher does not, by itself, delist any of that Publisher's already-Approved hoarding listings. Delisting an individual hoarding is a separate, independent Admin action from suspending a Publisher. **Formalization note:** `mvp-prd.md` §7.5 lists the capability as "Ability to suspend a Publisher **or** delist a hoarding" — phrased as two items joined by "or," the natural reading of which is two independent capabilities rather than one cascading into the other. `ADMIN-004` makes that reading explicit as its own rule. This is this document's interpretation of the literal source wording, not an independently stated rule — the alternative reading (suspension automatically delists all of that Publisher's listings) is equally plausible from a trust-and-safety standpoint and is not ruled out by any source text. Both readings are carried into §27 as an open question the business should confirm, rather than one this document silently resolves in only one direction.

Cross-referenced rules owned by other modules, not restated:

| Rule | Owning module | Relevance here |
|---|---|---|
| AUTH-002 | Auth & Roles | OTP verification gates Publisher listing submission (§8) — subject to the demo-variance consistency note at the top of this document |
| OWNER-004 | Publisher Module | An unverified Publisher can draft but not submit listings for approval (§8) |
| INVENTORY-001 | Inventory | Type-specific required fields must be complete before a listing reaches the approval queue (§9) |
| INVENTORY-002 | Inventory | Missing Site Intelligence data is flagged "incomplete" in the approval queue, not blocked (§9) |
| CONTENT-001 | Content Protection | A listing cannot be submitted for approval until watermarking is complete (§9) |
| REQUEST-003 | Request Engine | A request cannot be marked Completed before its own start date (§12) |
| NOTIF-001 | Notifications | Nominally covers Request Engine state changes; see the scope gap noted in §17 |

## 17. Notifications

`NOTIF-001` states: "Every state change in the Request Engine triggers a notification to the affected Publisher or Viewer within a defined delay." `mvp-prd.md` §7.6's functional requirement, however, lists the covered events as: "new request received, request accepted/rejected, request expiring soon, **listing approved/rejected**."

**Gap noted:** listing approval and rejection are Admin actions on the Inventory/Listing model, not Request Engine state changes — `NOTIF-001` as literally worded ("state change in the Request Engine") does not cover them, yet §7.6's own functional requirement explicitly lists "listing approved/rejected" as a covered notification event. This is a drafting gap in `mvp-prd.md` itself: the one defined notification business rule (`NOTIF-001`) is narrower than the one defined notification functional requirement (§7.6) it is meant to support. This document does not resolve the gap by assumption (e.g., by silently treating `NOTIF-001` as if it already covered listing events, or by minting a new `NOTIF-002`) — it flags it as an Open Question (§27) for the Notifications module or `mvp-prd.md` itself to resolve, since inventing a new notification rule ID here would go beyond this document's Admin Platform scope.

In practice, the Admin actions that should trigger a notification, per §7.6's functional requirement (regardless of which rule ID technically covers them):

| Event | Recipient | Trigger |
|---|---|---|
| Listing approved | Publisher | Admin approves a Pending Approval listing (§9) |
| Listing rejected | Publisher | Admin rejects a Pending Approval listing, with the `ADMIN-003` reason (§9) |

Publisher verification outcomes (verified/rejected, §8) and suspension/delisting (§11) are not listed anywhere in §7.6's event list — whether these should also notify the Publisher is undefined and carried to §27.

## 18. Data Requirements

Field-level detail is drawn from `mvp-prd.md` §7.2 and §7.5 directly, since `inventory.md` and `owner-platform.md` were unavailable (see the sourcing note at the top of this document). This is a minimum data shape implied by the capabilities in §3 — not a full schema, which belongs in the still-unwritten Database Design document (`README.md` Tier 1 item #5).

**Publisher (fields relevant to Admin):**

```text
Publisher {
  id
  name
  phone
  business_name          (optional — mvp-prd.md §7.2)
  verification_status    (Unverified | Verified | Rejected | Suspended — §14.1)
  verified_at            (Assumption — not stated, needed for the dashboard/audit trail)
  suspended_at           (Assumption — not stated, needed to know when suspension began)
}
```

**Hoarding Listing (fields relevant to Admin):**

```text
Hoarding {
  id
  publisher_id
  type                       (mvp-prd.md §8 taxonomy)
  approval_status            (Draft | Pending Approval | Approved | Rejected | Delisted — §14.2)
  rejection_reason           (required when approval_status = Rejected — ADMIN-003)
  site_intelligence_complete (boolean flag — INVENTORY-002)
  approved_at                (Assumption — not stated)
  delisted_at                (Assumption — not stated)
}
```

No field for "who approved/rejected this" (an approving Admin's identity) is specified anywhere — relevant to the audit-log gap discussed in §20. Not invented here; carried to §27.

## 19. API Dependencies

`mvp-prd.md` §9 defines exactly three Admin-facing endpoints:

```text
POST  /api/v1/admin/hoardings/{id}/approve
POST  /api/v1/admin/hoardings/{id}/reject
GET   /api/v1/admin/dashboard
```

**Gap noted:** §7.5's functional requirements describe four Admin capabilities (listing approval, Publisher verification, dashboard, suspend/delist), but §9's endpoint list only covers two of them (listing approve/reject, dashboard). There is no endpoint listed anywhere in `mvp-prd.md` §9 for **Publisher verification**, **Publisher suspension**, or **hoarding delisting** — despite all three being explicit §7.5 functional requirements. This is a real gap between the functional requirements and the API surface as currently drafted, not a decision this document can resolve — it belongs to the still-unwritten Full API Specification (`README.md` Tier 1 item #6), and is carried forward to §27 so it isn't lost.

## 20. Auditability

The full-scope BRD's `BR-ADMIN-003` requires that "all significant administrative and financial actions must be captured in an audit log for accountability and dispute resolution." **No MVP-scoped requirement exists anywhere in `mvp-prd.md` or `mvp-brd.md` for an audit log of Admin actions** — this is a full-scope-only requirement (see the Source Conflict note at the top of this document) and is not carried into MVP scope here.

This is worth flagging as more than a routine gap: `mvp-brd.md` §17 names "no-recourse disputes without payment/escrow" as a named risk, with "strong Admin moderation now" as the stated mitigation direction. Moderation actions (approve/reject/suspend/delist) that leave no audit trail would make it harder to investigate exactly that class of dispute later. This document does not add an audit-log requirement on its own initiative — doing so would be inventing a new product decision, which the brief governing this document explicitly prohibits — but flags it as a **Future Enhancement** worth prioritizing early in Phase 2, and carries the tension to §27.

## 21. Security & Access Control

`mvp-prd.md` describes Admin only as an "internal Admin" role (§4) operated by "SEEABLE Admin / Operations" (`mvp-brd.md` §6) — there is no self-registration flow for Admin described anywhere, unlike Publisher and Viewer (`mvp-prd.md` §7.1). The reasonable reading, consistent with "internal," is that Admin accounts are provisioned directly by SEEABLE (seeded or created out-of-band), not created through the public registration flow that `AUTH-001`/`AUTH-002` govern — this is an **Assumption**, since `mvp-prd.md` never states it explicitly, and it is carried to §27.

MVP has exactly one Admin role with the full capability set in §3 — there is no tiering (e.g., "junior moderator" vs. "senior admin") anywhere in the source documents. The full-scope BRD's granular, expandable RBAC system (`BR-ADMIN-002`, full-scope) is explicitly not MVP scope (see the Source Conflict note at the top of this document).

No Admin-specific security requirement beyond the platform-wide baseline exists: `mvp-prd.md` §10 states standard requirements — encryption in transit, and (per `AUTH-002`) OTP-based auth for the roles it governs. This document inherits that baseline rather than adding an Admin-specific security requirement, since none is stated.

## 22. Edge Cases

Admin-specific edge cases not already owned by `request-engine.md` (which covers request-lifecycle edge cases directly):

| # | Scenario | Behavior | Basis |
|---|---|---|---|
| 1 | A listing is missing Site Intelligence data at submission | Flagged "incomplete" in the queue; not blocked from approval | `INVENTORY-002` |
| 2 | A listing is missing a required type-specific field | Cannot be submitted for review at all — never reaches the queue | `INVENTORY-001` |
| 3 | Admin rejects a listing without providing a reason | Blocked by `ADMIN-003` — rejection cannot be submitted without one | `ADMIN-003` (this document) |
| 4 | A rejected Publisher account attempts to resubmit for verification | **Open Question** — no retry/appeal path defined | §14.1, §27 |
| 5 | A rejected listing is edited and resubmitted | **Open Question** — same listing record reopened, or a new one created | §9, §27 |
| 6 | A Publisher is suspended while they have a still-Pending (not yet Confirmed) request | **Open Question**, already flagged in `request-engine.md` §33 — `ADMIN-002` only addresses already-Confirmed requests | Cross-ref only, not re-derived here |
| 7 | A Publisher is suspended; their other Approved listings (not individually delisted) remain live per `ADMIN-004`'s independent-actions reading | Listings remain visible in Viewer search unless separately delisted — a literal consequence of `ADMIN-004`, flagged as possibly unintended | §11, §16, §27 |
| 8 | Two Admins act on the same queue item at the same time | **Open Question** — no concurrency/locking behavior defined for the approval or verification queues | Not addressed anywhere in source |
| 9 | A suspended Publisher attempts to log in | **Open Question** — whether suspension blocks login entirely, or only blocks new-listing creation as `ADMIN-002` literally states, is not defined | `ADMIN-002`, §27 |
| 10 | A hoarding is delisted while it has a Pending request | **Open Question**, mirrors the already-flagged case in `request-engine.md` §25 (#8–#9) for pausing/deleting a listing with a Pending request — delisting is not explicitly distinguished from those cases anywhere | Cross-ref, `request-engine.md` §25 |

## 23. Non-Functional Requirements

`mvp-prd.md` §10 defines NFRs at the platform level, not per-module; none are Admin-specific. This document applies the same baseline to the Admin Platform rather than inventing dedicated Admin NFRs:

- **Performance:** search/queue browsing should feel responsive at the MVP's 50–200 listing scale (§10) — the same target given for Viewer search, since the underlying dataset is the same.
- **Availability:** best-effort uptime; no formal SLA at MVP (§10).
- **Security:** standard encryption in transit (§10); Admin-specific access control per §21 above.

No Admin-specific performance target (e.g., maximum queue processing time, dashboard refresh interval) is defined anywhere — not invented here.

## 24. Acceptance Criteria (Representative)

```text
Given a hoarding listing has all required type-specific fields complete
  and its media has finished watermarking
  and its Publisher is Verified
When the Publisher submits it for review

Then the listing appears in the Admin listing approval queue as Pending Approval
And it does not appear in Viewer search until an Admin approves it
```

```text
Given a listing is Pending Approval
When an Admin attempts to reject it without entering a reason

Then the rejection is not accepted
And the Admin must supply a reason before the rejection can complete (ADMIN-003)
```

```text
Given a Publisher has an already-Confirmed request
When an Admin suspends that Publisher

Then the Confirmed request is unaffected and completes as agreed (ADMIN-002)
And the Publisher can no longer create new listings
```

```text
Given a Publisher has two Approved listings, A and B
When an Admin suspends that Publisher without individually delisting either listing

Then, per ADMIN-004, listings A and B remain visible in Viewer search
And they are only removed from Viewer search if separately delisted
```

## 25. MVP vs Future

| Capability | MVP (this document) | Future (full-scope BRD / Master PRD Framework) |
|---|---|---|
| Listing approval | Approve/Reject with a reason, single queue | Same, plus content moderation guidelines/rubric |
| Publisher verification | Single-step verify/reject, criteria undefined | Formal KYC-style verification, business documentation |
| Suspension/delisting | Two independent actions, no audit trail | Full audit log of all administrative actions (`BR-ADMIN-003`) |
| Dashboard | Four counts | Full analytics suite; BRD-level KPIs (Publishers onboarded, response time, repeat usage) |
| Admin roles | Single internal role, no RBAC | Granular, expandable RBAC (`BR-ADMIN-002`) |
| Request administration | Mark Completed only, no individual visibility | General request/dispute management, tied to a Support Runbook |
| Financial administration | None — fully out of scope | Payment administration, pricing administration, commission management (`BR-ADMIN-001`, full-scope) |
| Platform configuration | None | Full super-admin platform configuration (`BR-ADMIN-001`, full-scope) |

## 26. Dependencies

**Auth & Roles → Admin Platform**
Publisher verification (§8) is tied to `AUTH-002`, subject to the demo-variance consistency note at the top of this document. Admin's own authentication mechanism is assumed internal/provisioned, not self-registered (§21).

**Publisher Module → Admin Platform**
`OWNER-004` gates listing submission on verification status; the Publisher profile fields Admin reviews (name, phone, business name, verification status) are defined in `mvp-prd.md` §7.2, not in a dedicated Owner Platform module doc (unavailable — see sourcing note).

**Inventory → Admin Platform**
`INVENTORY-001` and `INVENTORY-002` govern what Admin sees and can act on in the listing approval queue (§9). `inventory.md` was unavailable for this document (see sourcing note); field-level detail is drawn from `mvp-prd.md` §8 directly.

**Request Engine → Admin Platform**
Grants Admin exactly the Mark Completed authority and the aggregate dashboard figures (§12); does not grant broader request visibility. `request-engine.md` is the owning spec for this boundary and is cross-referenced, not reinterpreted, here.

**Notifications → Admin Platform**
Listing approval/rejection are expected to trigger notifications per `mvp-prd.md` §7.6's functional requirement, though the scope gap in `NOTIF-001` noted in §17 means the exact rule coverage is unresolved.

**Content Protection → Admin Platform**
`CONTENT-001` gates listing submission on completed watermarking, which is a precondition Admin's approval queue relies on but does not itself enforce.

**Still-unwritten documents this module connects to:**
`docs/03-modules/inventory.md`, `docs/03-modules/owner-platform.md` (both referenced but unavailable — third confirmation this session), Content Moderation Guidelines (`README.md` Tier 1 item #12), Support / Dispute Handling Runbook (Tier 1 item #13), Full API Specification (Tier 1 item #6 — see the endpoint gap in §19), Database Design / ERD (Tier 1 item #5), Analytics & Event Tracking Plan (Tier 1 item #11 — see the dashboard/KPI gap in §7).

## 27. Open Questions

Genuine unresolved decisions only, compiled from every gap surfaced while writing this module:

- Whether the Admin "Publisher verification queue" is the same gate as OTP verification (`AUTH-002`) or a separate manual review step, and if separate, what criteria it actually applies (§8).
- Whether the current demo build's Viewer-side OTP deferral (`viewer-platform.md` v1.1) also applies symmetrically to Publisher-side verification, which would change what §8 actually gates in practice today (Consistency Note, top of document).
- What happens after a Publisher verification rejection — retry path, cooldown, or permanent block (§8, §14.1, §22 #4).
- Whether Publisher Suspended is reversible via an "un-suspend" action (§14.1).
- Whether a rejected listing can be edited and resubmitted as the same record, or must be recreated (§9, §14.2, §22 #5).
- Whether Admin needs bulk-approve for listings, or one-by-one is acceptable at 50-listing scale — `mvp-prd.md` §14 asks this directly and does not answer it (§9).
- The exact scope of Admin's "edit for moderation only" capability on a listing — completely unelaborated in any source document (§3, §10).
- Whether suspending a Publisher should cascade to delist their other Approved listings, or whether the two actions are genuinely independent as `ADMIN-004` reads them literally (§11, §16, §22 #7).
- Whether a suspended Publisher can still accept/reject a request that was already Pending at the moment of suspension (cross-ref `request-engine.md` §33 — not re-opened independently here, only surfaced as relevant to this module).
- Whether Publisher suspension blocks login entirely or only blocks new-listing creation, as `ADMIN-002` literally states (§21, §22 #9).
- Concurrency behavior when two Admins act on the same verification/approval queue item simultaneously (§22 #8).
- Whether the total-listings dashboard count includes all listings ever submitted, or only currently-Approved ones (§7).
- Whether `mvp-brd.md` §14's broader KPI list (Publishers onboarded/verified, Viewer accounts, response time, repeat usage) is meant to be surfaced on the in-app Admin dashboard, or measured separately via the still-unwritten Analytics & Event Tracking Plan (§7).
- The `NOTIF-001` scope gap — the rule text covers only "Request Engine state changes," but `mvp-prd.md` §7.6 also lists listing approved/rejected as a covered notification event, which are not Request Engine state changes (§17).
- Whether Publisher verification outcomes and suspension/delisting decisions should also trigger a notification — not listed in §7.6's event set at all (§17).
- The missing API endpoints for Publisher verification, Publisher suspension, and hoarding delisting — `mvp-prd.md` §9 lists endpoints for listing approve/reject and the dashboard only, despite §7.5 naming all four as functional requirements (§19).
- Whether an MVP-appropriate lightweight audit trail (who approved/rejected/suspended what, and when) should be added ahead of the full-scope audit log (`BR-ADMIN-003`), given the no-recourse dispute risk `mvp-brd.md` §17 already names (§20).
- Whether Admin accounts are provisioned internally/out-of-band rather than through the public registration flow — a reasonable inference from "internal Admin" language, but never stated explicitly (§21).

If any of these are already resolved in a document outside this session's available context (e.g., `inventory.md`, `owner-platform.md` once available, or the Content Moderation Guidelines / Support Runbook once written), this list should be reconciled against them rather than treated as still open.

## 28. Requirement ID Index

```text
ADMIN-001
ADMIN-002
ADMIN-003
ADMIN-004
```

`ADMIN-003` and `ADMIN-004` are the two new IDs introduced in this document (§16). Both formalize requirements `mvp-prd.md` §7.5 already states in prose ("Approve / Reject with a reason"; "suspend a Publisher or delist a hoarding") but never assigned an ID of their own — neither is a new product decision, and both carry an explicit Assumption/interpretation note in §16 rather than presenting the formalization as settled fact.

Cross-referenced rules owned by other modules, not renumbered:

```text
AUTH-002
OWNER-004
INVENTORY-001
INVENTORY-002
CONTENT-001
REQUEST-003
NOTIF-001
```

---

*End of SEEABLE Hoardings — Admin Platform Module.*
