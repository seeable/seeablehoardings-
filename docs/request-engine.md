# SEEABLE Hoardings — Request Engine Module

**Document Type:** Module Specification (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.0
**Status:** Draft for Review
**Date:** 27 August 2026
**Related Documents:** `docs/01-product/mvp-prd.md`, `docs/01-product/mvp-brd.md`, `docs/03-modules/viewer-platform.md`, `docs/03-modules/inventory.md`, `docs/03-modules/owner-platform.md`, `README.md` (Documentation Index)

> **Note on sourcing:** This document extracts and organizes Request Engine requirements that currently exist only inline in `mvp-prd.md` §7.4 and across §7.2 (Publisher), §7.3 (Viewer), §7.5 (Admin), §11 (edge cases), and §12 (acceptance criteria), per the gap identified in the Documentation Index. `docs/03-modules/inventory.md` and `docs/03-modules/owner-platform.md` are referenced throughout as sibling specs, but — as when `docs/03-modules/viewer-platform.md` was written — they were not available for direct cross-reading at the time of writing. Anything attributed to Inventory or Publisher behavior here is drawn from `mvp-prd.md` directly. No new product decisions are introduced — anything not already defined in the MVP PRD/BRD is explicitly marked as an **Open Question**, **Assumption**, or **Future Enhancement**.

> **Source conflict noted:** `mvp-brd.md` reuses the IDs **BR-OWNER-001** and **BR-OWNER-002** twice with different content — once in §7.2 (BR-OWNER-001: type-specific listing detail → INVENTORY-001; BR-OWNER-002: manage availability/pause → OWNER module) and again in §11's "Business Rules (Representative Set)" (BR-OWNER-001: no double-confirmation for overlapping dates; BR-OWNER-002: a request stays Pending until response or SLA expiry). This module does not resolve that collision — it is a BRD-internal documentation defect, not a Request Engine decision — and instead relies exclusively on the unambiguous `mvp-prd.md` IDs (**REQUEST-001/002/003**, **OWNER-001/002/003**) and on `mvp-brd.md` §7.4's non-colliding **BR-REQUEST-001/002/003** for business-rule traceability. This conflict is repeated in §33 (Open Questions) and should be fixed at the source the next time `mvp-brd.md` is revised.

> **Consistency note (Viewer authentication):** `docs/03-modules/viewer-platform.md` v1.1 records a demo/proof-of-concept variance to **AUTH-002**: OTP verification is currently deferred, and Viewer login uses email/mobile + password instead. The Request Engine itself does not implement authentication, but §8 (Request Creation) and §32 (Dependencies) note where this variance touches request-creation preconditions. The approved `mvp-prd.md` target — OTP verification required before a Viewer can send a request — remains the rule this module is written against; the demo variance is flagged inline, not treated as a redefinition.

---

## 1. Module Overview

The Request Engine is the system that manages the MVP's **booking-lite request lifecycle** between Viewers and Publishers. It is the core system referenced — but never given its own specification — inline across `mvp-prd.md` §7.4 (Request Engine module requirements), §7.2 (Publisher accept/reject and conflict rules), §7.3 (Viewer request submission and tracking), and §7.5 (Admin completion authority).

Its responsibilities:

- Creating Viewer requests
- Validating requested dates
- Managing request states
- Preventing conflicting confirmations
- Allowing Publishers to accept/reject requests
- Expiring unanswered requests
- Releasing dates when requests are rejected or expired
- Moving confirmed requests into their live (campaign) period
- Completing requests after the campaign period ends
- Triggering the request-state notification events that the Notifications module delivers

**The Request Engine is not the payment system.** It has no role in collecting money, calculating commission, generating invoices, or enforcing that a Viewer has paid — those are explicitly deferred (`mvp-prd.md` §3.2, §15).

## 2. Core MVP Definition

> A **Request** is a structured, date-based request for one hoarding. It acts as a booking-lite date hold/request mechanism in the MVP and does not represent payment, escrow, commission, contract execution, or financial settlement.

Explicitly, per `mvp-prd.md` §1, §3.2 and `mvp-brd.md` §5.2, §18:

- Payment is not handled by the Request Engine.
- Commercial settlement happens offline, between Viewer and Publisher, outside SEEABLE.
- The MVP is focused on a **single-hoarding** request — one request, one hoarding, one date range.
- Multi-hoarding campaign management is deferred.
- Online payment and escrow are deferred.
- Contracts are deferred.

## 3. Module Objective

The Request Engine exists to digitize the request workflow and replace unstructured phone/email coordination with a structured, trackable date-request flow (`mvp-brd.md` §4.1, objective 2). It solves two problems that are otherwise unsolved without it:

1. Give Viewers a reliable way to request specific dates on a hoarding.
2. Prevent a Publisher from accidentally confirming the same hoarding to multiple Viewers for overlapping dates.

The Request Engine is therefore responsible, above everything else in this document, for **request integrity and date-conflict safety** — the guarantee that the platform never shows a hoarding as double-booked.

## 4. Actors

### Viewer

Can:
- Create requests (`mvp-prd.md` §7.3)
- View their own requests (§7.3)
- See request status (§7.3)
- Receive request notifications (NOTIF-001)

Cannot:
- Accept requests
- Reject requests
- Complete requests

(`mvp-prd.md` §5 — Viewer has no accept/reject/completion permission.)

### Publisher

Can:
- View requests for their own listings (§7.2, "Request inbox")
- Accept requests (§7.2, §5)
- Reject requests (§7.2, §5)
- Mark eligible requests as Completed (§7.4, "Manual 'Mark Completed' action (Publisher or Admin)")

### Admin

Can, per what `mvp-prd.md` explicitly grants:
- Mark eligible requests as Completed (§7.4, jointly with Publisher)
- View aggregate request counts and confirmation rate via the platform dashboard (§7.5: "total requests, confirmation rate")

**What is not explicitly granted:** `mvp-prd.md` §7.5 does not give Admin a general capability to browse or manage *individual* Viewer/Publisher requests — only the two items above (Mark Completed, and aggregate dashboard figures). Whether Admin needs individual-request visibility for operational or dispute purposes is not defined here; it connects directly to the still-unwritten Support/Dispute Handling Runbook (`README.md` Tier 1 item #13) and is carried into §33 as an Open Question rather than assumed. Admin is not given any arbitrary state-modification power beyond the two rules above (see §23).

## 5. Request Lifecycle

The MVP state model, per `mvp-prd.md` §7.4:

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

And the expiry path:

```text
REQUESTED
    ↓
EXPIRED
```

- **AVAILABLE** describes the inventory/date availability *before* a request exists. It is not a status a Request record ever holds — see the distinction drawn in §6.
- **REQUESTED** is the request's Pending state (labeled "Pending" to the Viewer, per `viewer-platform.md` §14).
- **CONFIRMED** means the Publisher accepted the request and the dates are held.
- **REJECTED** means the Publisher declined the request.
- **EXPIRED** means the Publisher did not respond within the response SLA (exact value undefined — §33).
- **LIVE** means the confirmed request has reached its campaign period (labeled "Campaign Period" to the Viewer, per `viewer-platform.md` §14; no Publisher-facing label is defined, since `owner-platform.md` is unavailable — noted as an Assumption gap).
- **COMPLETED** means the period has ended and the request has been manually marked complete.

No additional MVP states — `PAYMENT_PENDING`, `PAID`, `CONTRACTED`, `CANCELLED_BY_PAYMENT`, `ESCROWED`, or similar — are introduced. These belong to Phase 2 once payment exists (`mvp-prd.md` §15) and would extend, not replace, this lifecycle.

## 6. State Definitions

The table below distinguishes **request status** (a property of the Request record) from **inventory/date availability** (a property of the hoarding's calendar, which the Request Engine influences but which is not itself a Request field). AVAILABLE is included for completeness because it is the starting condition every request begins from, but it is a description of the hoarding's calendar, not a value the `status` field ever takes.

| State | Meaning | Entry condition | Allowed next states | Actor/action | Inventory effect | Notification |
|---|---|---|---|---|---|---|
| *AVAILABLE (calendar condition, not a Request status)* | The date range on this hoarding has no Confirmed request against it. | Default state of any date range with no Request, or after REJECTED/EXPIRED/dates released. | (A new Request enters REQUESTED against these dates.) | Viewer selects dates and submits (§8). | None yet — no Request exists. | None. |
| REQUESTED | The request is Pending; awaiting Publisher decision. | A Viewer submits a valid request (§8). | CONFIRMED, REJECTED, EXPIRED | System creates the Request on Viewer submission. | Dates are **not yet** blocked from other Pending requests (see §9–§11); they are only blocked once Confirmed. | Yes — request created (NOTIF-001; Publisher-facing "new request received," per `mvp-prd.md` §7.6). |
| CONFIRMED | Publisher accepted; dates are held for this Viewer. | Publisher accepts a REQUESTED request that re-validates as conflict-free (§12). | LIVE | Publisher action ("Accept"). | Dates become blocked against all other Pending requests on the same hoarding (REQUEST-001). | Yes — request accepted (NOTIF-001). |
| REJECTED | Publisher declined the request. | Publisher rejects a REQUESTED request (§13). | *(terminal)* | Publisher action ("Reject"). | Dates release back to Available immediately (REQUEST-002). | Yes — request rejected (NOTIF-001). |
| EXPIRED | Publisher did not respond within the response SLA. | System-triggered when the SLA elapses on a still-REQUESTED request (§14). | *(terminal)* | System (automatic, not actor-triggered). | Dates release back to Available immediately (REQUEST-002). | Yes — request expired (NOTIF-001); a prior "expiring soon" notice is also defined at the platform level (`mvp-prd.md` §7.6). |
| LIVE | The confirmed request's dates are current/underway. | Assumption: system-triggered when the current date reaches the Confirmed request's start date (§18 — no manual "Mark Live" action is defined anywhere in `mvp-prd.md`, unlike Completion). | COMPLETED | System (assumed automatic — see §18). | Dates remain blocked for the confirmed period. | Not explicitly defined — flagged in §33. |
| COMPLETED | The campaign period has ended and been marked complete. | Publisher or Admin manually marks the request Completed, and only once the request's own start date has passed (REQUEST-003). | *(terminal)* | Publisher or Admin action ("Mark Completed"). | No further inventory effect — dates were already blocked/held through LIVE and are not automatically released back to Available on Completion (nothing in `mvp-prd.md` says a Completed request's dates return to the market). | Not explicitly defined — flagged in §33. |

## 7. State Transition Rules

### AVAILABLE → REQUESTED

- **Triggered by:** Viewer, by submitting a valid date request (§8).
- **Preconditions:** Listing is approved (ADMIN-001) and not paused/delisted; requested dates have no Confirmed request against them (assumption — see §9); Viewer does not already have a Pending request on this listing (VIEWER-002).
- **Validation:** Per §8's creation checklist.
- **State change:** A new Request record is created with status REQUESTED.
- **Inventory effect:** None yet — see §9 on why Pending does not block the calendar.
- **Notification:** Request created, to both Viewer (confirmation) and Publisher (new request received) — NOTIF-001.
- **Failure behaviour:** If validation fails (unapproved/unavailable listing, duplicate Pending request, invalid dates), no Request is created and the Viewer sees a clear reason (`viewer-platform.md` §20–§21).

### REQUESTED → CONFIRMED

- **Triggered by:** Publisher, by accepting the request (§12).
- **Preconditions:** Request is currently REQUESTED; listing is still approved and not delisted.
- **Validation:** The system **must re-check availability/conflicts at the moment of acceptance** — the availability shown when the Viewer originally submitted the request cannot be assumed still valid (§12, formalized as REQUEST-004 in §34).
- **State change:** Status becomes CONFIRMED.
- **Inventory effect:** Dates become blocked against all other Pending requests on the same hoarding (REQUEST-001); any other Pending request whose dates overlap can no longer be confirmed while this one stands.
- **Notification:** Request accepted, to the Viewer — NOTIF-001.
- **Failure behaviour:** If re-validation finds a conflict (e.g., another request on overlapping dates was Confirmed first), the acceptance fails with a clear reason and the request remains REQUESTED — it is not silently confirmed (§10, §12).

### REQUESTED → REJECTED

- **Triggered by:** Publisher, by rejecting the request (§13).
- **Preconditions:** Request is currently REQUESTED.
- **Validation:** None beyond confirming the Publisher owns the listing.
- **State change:** Status becomes REJECTED.
- **Inventory effect:** Dates release back to Available immediately (REQUEST-002).
- **Notification:** Request rejected, to the Viewer — NOTIF-001.
- **Failure behaviour:** Not applicable — rejection has no conflict to fail against.

### REQUESTED → EXPIRED

- **Triggered by:** The system, automatically, when the response SLA elapses without a Publisher decision (§14).
- **Preconditions:** Request is currently REQUESTED and the SLA clock (start-trigger undefined — §33) has elapsed.
- **Validation:** None — this is a time-based system check, not an actor action.
- **State change:** Status becomes EXPIRED.
- **Inventory effect:** Dates release back to Available immediately (REQUEST-002).
- **Notification:** Request expired, to the Viewer — NOTIF-001; an "expiring soon" warning is also expected before this point (`mvp-prd.md` §7.6).
- **Failure behaviour:** Not applicable.

### CONFIRMED → LIVE

- **Triggered by:** Assumption — the system, automatically, when the current date reaches the request's confirmed start date (see §18; no manual trigger is defined in `mvp-prd.md`).
- **Preconditions:** Request is currently CONFIRMED and today ≥ start date.
- **Validation:** None beyond the date check.
- **State change:** Status becomes LIVE.
- **Inventory effect:** No change — dates remain blocked, as they were while CONFIRMED.
- **Notification:** Not explicitly defined (§33).
- **Failure behaviour:** Not applicable.

### LIVE → COMPLETED

- **Triggered by:** Publisher or Admin, via the manual "Mark Completed" action (`mvp-prd.md` §7.4).
- **Preconditions:** Request is currently LIVE (or, at minimum, CONFIRMED and past its own start date — see REQUEST-003); the campaign period has ended is the expected real-world condition, though `mvp-prd.md` only hard-enforces the start-date floor, not an end-date floor (see §19).
- **Validation:** REQUEST-003 — a request cannot become Completed before its own start date. **A request cannot become Completed before its own start date; whether it must also wait until its own end date has passed is not explicitly stated and is flagged in §33.**
- **State change:** Status becomes COMPLETED.
- **Inventory effect:** None defined — dates are not stated to release back to Available on Completion.
- **Notification:** Not explicitly defined (§33).
- **Failure behaviour:** An attempt to mark Completed before the start date is rejected with a clear error (§25, edge cases #15–#16).

## 8. Request Creation

The Viewer flow, per `mvp-prd.md` §6.2, §7.3 and `viewer-platform.md` §13:

1. Open an approved/available hoarding.
2. Select a start date.
3. Select an end date.
4. Submit the request.
5. Receive confirmation.
6. See the request in their request list.

**Required validation**, split between what `mvp-prd.md` states and what is structurally necessary for a date range to be meaningful:

| Validation | Status |
|---|---|
| Valid Viewer account (logged in) | Approved — implicit in Viewer role (§4) |
| Verification complete before submitting | Approved MVP target: AUTH-002 (OTP) required before a Viewer can send a request (`mvp-prd.md` §7.1). **Current demo build variance:** per `viewer-platform.md`'s Demo Scope Note, OTP is deferred and email/mobile + password login stands in for this gate — see the Consistency Note at the top of this document. |
| Listing is Admin-approved | Approved — ADMIN-001 |
| Listing is available (not paused/delisted) | Approved — implicit in "browse and search all approved, available listings" (`mvp-prd.md` §7.3) |
| Start date is a valid date | Structural necessity, not a distinct product decision |
| End date is a valid date | Structural necessity |
| Start date is before end date | Structural necessity |
| Requested range does not fall entirely in the past | Structural necessity (reasonable minimum; exact "how far in advance" rules are not defined — see below) |
| No duplicate Pending request by the same Viewer on the same listing | Approved — VIEWER-002 |
| Requested dates do not conflict with an existing **Confirmed** request | Approved principle — REQUEST-001/REQUEST-004; **whether this is enforced by blocking the submission outright, or by some other means, is an Assumption — see §9** |
| Requested dates overlapping an existing **Pending** request from a *different* Viewer | Allowed — accepted as a second Pending request, per `mvp-prd.md` §11's own edge case (see §9–§10) |

Not defined anywhere in `mvp-prd.md`, and therefore **not** treated as approved validation rules: a minimum lead time before the start date, a maximum request duration, blackout dates, or a minimum/maximum number of days per request. These are listed as Open Questions in §33 rather than invented here.

## 9. Date & Availability Logic

This is the section the brief that produced this document called out as critical, and it deserves the same care here.

The Request Engine must determine availability by checking:

- **Existing Confirmed requests** on the same hoarding — a genuine block (REQUEST-001).
- **Existing Pending requests** on the same hoarding — per `mvp-prd.md` §11's own worked edge case, these do **not** block a new submission; a second, overlapping Pending request is accepted into the queue, not rejected outright. It simply cannot itself become Confirmed while the conflict exists.
- **Paused listings** — a paused listing is not available for new requests (consistent with "browse and search all approved, available listings," `mvp-prd.md` §7.3); the effect on requests already Pending/Confirmed against a listing that is *later* paused is not defined — see §21.
- **Deleted/delisted listings** — same reasoning; effect on existing requests is likewise not defined — see §21.
- **Overlapping date ranges** — any date-range intersection between two requests on the same hoarding counts as an overlap (§10 defines this precisely).
- **Concurrent request submissions** — two Viewers submitting near-simultaneously must both be evaluated against the same conflict rules; neither is silently favored, and both may end up Pending simultaneously if neither conflicts with an existing Confirmed request (§10, §25 edge case #1).

**Assumption, clearly flagged as such:** `mvp-prd.md` never explicitly states whether a *new* request submission against dates that are **already Confirmed** for someone else is blocked outright at submission (returned as "unavailable," never created) versus accepted into a Pending state that can never realistically be confirmed. The state model's own definition of AVAILABLE ("describes the inventory/date availability before a request exists") and the Viewer Module's scope ("browse and search all approved, **available** listings") together suggest that Confirmed dates are not "available" and a submission against them should be blocked at creation, consistent with how a Viewer should never be shown dates as requestable that are already spoken for. This module treats that as the sensible default behavior, but it is an inference, not a stated rule — flagged in §33.

**The invariant that must never be violated, regardless of any of the above:** the Request Engine must never silently allow two Viewers to become Confirmed for overlapping dates on the same hoarding. This is formalized as **REQUEST-004** in §34.

## 10. Conflict Detection

**What constitutes an overlap:** any two date ranges where `start_A ≤ end_B` and `start_B ≤ end_A` (i.e., the ranges share at least one day). `mvp-prd.md` §12's own acceptance-criteria example uses exactly this logic:

```text
Hoarding A
Viewer 1: 1 September → 15 September   (Pending)
Viewer 2: 10 September → 20 September  (Pending)
```

If the Publisher confirms Viewer 1:

```text
Viewer 1 → CONFIRMED
1–15 September → blocked

Viewer 2 → remains PENDING
10–20 September → cannot be CONFIRMED while conflict exists
```

This matches `mvp-prd.md` §12 exactly: "the new request is accepted into the queue as Pending, but it cannot be moved to Confirmed until the conflict is resolved."

**When conflicts are checked:**
1. At submission — against existing **Confirmed** requests only (per the Assumption in §9).
2. At acceptance — against existing **Confirmed** requests again, as a final re-validation (REQUEST-004), because time has passed since submission and another request may have been confirmed in the interim.

**What happens during simultaneous submissions:** both submissions are evaluated independently against the current Confirmed state; if neither conflicts with a Confirmed request, both become Pending (even if they overlap each other) — consistent with §9.

**What happens during simultaneous Publisher acceptance attempts on overlapping requests:** only one can succeed. Whichever acceptance is processed and validated first becomes CONFIRMED and blocks the dates; the second acceptance attempt must fail the accept-time re-validation (REQUEST-004) and return a clear "no longer available" response rather than silently double-confirming.

**How the system prevents race conditions at the business-rule level:** by requiring that every REQUESTED → CONFIRMED transition re-check for Confirmed conflicts as a precondition, not just relying on the state at submission time. The specific implementation mechanism (database-level locking, transaction isolation, optimistic vs. pessimistic concurrency control) is deliberately **not** specified here — that belongs in the future System Architecture / Database Design documents (`README.md` Tier 1 items #4–#5). What this module fixes as a requirement is the outcome, not the mechanism:

> **No two overlapping requests may both become Confirmed for the same hoarding.**

**What response is returned when confirmation cannot occur:** the Publisher's accept action fails with a clear, specific reason (dates no longer available / already confirmed elsewhere) rather than a generic error, and the request remains REQUESTED so the Publisher can still reject it or the Viewer can await its natural expiry.

## 11. Pending Requests

Existing MVP rules (`mvp-prd.md` §7.3):

- A Viewer can have multiple Pending requests across different listings (VIEWER-001).
- A Viewer cannot submit another request on the same listing while they already have a Pending request there (VIEWER-002).
- Pending requests remain unresolved until Publisher response or SLA expiry (§14).
- Pending requests that are rejected or expired must not create a permanent inventory block (REQUEST-002) — they were never blocking the calendar in the first place (§9).

**What Pending means, by perspective:**

| Perspective | Meaning |
|---|---|
| Viewer | "I've asked; I'm waiting on the Publisher." The Viewer can hold several of these at once (VIEWER-001) but only one per listing (VIEWER-002). |
| Publisher | An item in the request inbox (`mvp-prd.md` §7.2) awaiting Accept/Reject. Multiple Pending requests can exist on the same hoarding simultaneously, even with overlapping dates (§9–§10) — the Publisher's decision is what resolves the conflict, not the system pre-filtering it away. |
| Inventory | No effect. A Pending request does not remove or reserve the dates from the calendar — the hoarding continues to show as available (subject to the §9 Assumption about Confirmed-date blocking) until a request on it is actually Confirmed. |

## 12. Publisher Accept Flow

```text
Publisher opens request
        ↓
System validates request
        ↓
System re-checks date conflict
        ↓
Publisher accepts
        ↓
Request = CONFIRMED
        ↓
Dates become blocked
        ↓
Affected conflicting Pending requests are prevented from confirmation
        ↓
Notification sent
```

The acceptance action **must** perform a final availability/conflict validation (REQUEST-004). The system does not assume that the availability shown when the Viewer originally submitted the request is still valid when the Publisher acts on it — another request may have been confirmed in the meantime (§10).

## 13. Publisher Reject Flow

- Publisher opens the request.
- Publisher rejects it.
- Request becomes REJECTED.
- Requested dates are released immediately (REQUEST-002).
- Viewer is notified (NOTIF-001).
- Viewer is free to pursue another listing or date range.

**Open Question, not invented here:** `mvp-prd.md` does not state whether a Publisher must provide a rejection reason. (By contrast, Admin listing rejection explicitly has a reason field per §7.5.) Whether Publisher request-rejection carries a reason is left open — see §33, and cross-referenced from `viewer-platform.md` §15/§28.

## 14. Request Expiry

The MVP requires unanswered requests to automatically expire after a response SLA (OWNER-002, REQUEST-002).

```text
REQUESTED
    ↓
EXPIRED
    ↓
Dates released
    ↓
Viewer notified
```

**Mechanism:** the system tracks elapsed time against a configurable SLA threshold for every REQUESTED request. When the threshold is reached without a Publisher decision, the system automatically transitions the request to EXPIRED, releases the dates, and notifies the Viewer.

**What is deliberately not defined here, per `mvp-prd.md` §14's own open question:**

- The exact SLA duration (hours/days) — this is a configurable, open product value, not invented in this document.
- What event starts the SLA clock — request creation is the most natural reading, but `mvp-prd.md` never says explicitly whether the clock starts at request creation or at some other event (e.g., delivery of the "new request" notification to the Publisher) — flagged in §33.

## 15. Date Release Rules

Dates must be released back to Available when:

- The request is **Rejected** (REQUEST-002).
- The request **expires** (REQUEST-002).

Confirmed dates remain blocked for the confirmed period and are **not** released merely because another Viewer submits a new request against them (that new request simply cannot be Confirmed while the block stands — §9–§10).

## 16. Confirmed Request

A Confirmed request means:

- The Publisher accepted the request.
- The requested dates are held for that Viewer.
- The same hoarding cannot be Confirmed to another Viewer for overlapping dates (REQUEST-001, REQUEST-004).
- The commercial transaction still happens entirely offline (`mvp-prd.md` §1, §6.2).
- No payment is processed by the platform.
- No contract is automatically generated (`mvp-prd.md` §3.2).

**Date confirmation and financial transaction are two separate things.** Confirmation is a scheduling/date-holding guarantee enforced by the Request Engine; whether the Viewer ever actually pays, and whether the Publisher ever actually delivers the campaign, is entirely outside the Request Engine's authority or knowledge (`mvp-brd.md` §12's disintermediation and no-recourse risk framing applies here directly).

## 17. Amount Agreed

The Request Engine contains an `amount_agreed` field (`mvp-prd.md` §7.4). It is:

- Record-keeping only.
- Not collected by SEEABLE.
- Not enforced by SEEABLE.
- Not a trigger for payment.
- Not the basis for an invoice.
- Not used to calculate commission.
- Not evidence that the Viewer has paid.

**Open Question, explicitly not invented here:** `mvp-prd.md` does not define who enters this value (Viewer at submission, Publisher at acceptance, either party after the fact) or at what stage of the lifecycle it is captured. This is carried over unchanged from `viewer-platform.md` §17/§28, which flagged the identical gap.

## 18. Live State

```text
CONFIRMED
    ↓
LIVE
```

**Who/what triggers the transition:** not explicitly stated in `mvp-prd.md`. This document assumes it is system-triggered, automatically, when the current date reaches the Confirmed request's start date — because no manual "Mark Live" action appears anywhere in the functional requirements (unlike Completion, which is explicitly manual, §19). This is an Assumption, not a stated rule, and is listed in §33.

**What the Viewer sees:** the request's status shown as "Campaign Period" (`viewer-platform.md` §14).

**What the Publisher sees:** not defined — no equivalent Publisher-facing label exists since `owner-platform.md` is unavailable; assume the same underlying LIVE status, exact copy undefined.

**Whether notifications are required:** not explicitly defined by `mvp-prd.md` §7.6's notification event list (which names request created/accepted/rejected/expiring, and listing approved/rejected — not a Live transition). Flagged in §33.

`LIVE` represents nothing more than the confirmed request being within its agreed date period — no campaign-management functionality (creative tracking, proof-of-display, performance metrics) is introduced here, consistent with `mvp-prd.md` §3.2.

## 19. Completion

The MVP requires a manual completion step because there is no payment event to automatically close the request (`mvp-prd.md` §7.4).

Rules:

- Publisher or Admin can mark the request Completed where permitted (§4, §23).
- A request cannot become Completed before its own start date (REQUEST-003).
- Completion should occur after the campaign/request period ends — but note that `mvp-prd.md` only explicitly hard-enforces the **start**-date floor (REQUEST-003); it does not explicitly state that the system must also block Completion before the request's **end** date. This module does not invent that additional floor as an approved rule — it is listed as an Open Question in §33, since allowing early completion mid-campaign seems undesirable but is not textually prohibited.
- Completion is a status update, not proof of successful payment or campaign performance. No automated proof-of-display or campaign-performance logic is introduced (`mvp-prd.md` §3.2).

## 20. Request Cancellation

Viewer cancellation of a Pending request is **not** introduced as an MVP feature. `mvp-prd.md` does not clearly define whether a Viewer can withdraw a Pending request before the Publisher responds or the SLA expires.

This is recorded as an **Open Question** (§33, consistent with `viewer-platform.md` §15/§28's identical gap). Since it is not approved, the MVP Request Engine must not implement Viewer-initiated cancellation as a required feature — a Viewer's only paths out of a Pending state at MVP are Publisher rejection or SLA expiry.

## 21. Listing Changes During Request

| Scenario | Status |
|---|---|
| Listing paused while a request on it is Pending | **Open Question.** `mvp-prd.md` §11 names this as an edge case ("a hoarding is deleted or paused while a request on it is Pending or Confirmed") without stating the resolution. |
| Listing deleted while a request on it is Pending | **Open Question**, same source. |
| Listing edited while a request on it is Pending | **Approved** — OWNER-003: core listing fields cannot be edited while a request on that listing is pending confirmation. This protects the Viewer from evaluating a listing that changes underneath a live request. |
| Listing becomes unavailable (paused/delisted) between a Viewer's date selection and submission | **Approved principle** — the submission must be blocked with a clear reason rather than silently accepted (`mvp-prd.md` §11; `viewer-platform.md` §21). |
| Listing suspended by Admin (via Publisher suspension) | **Partially approved** — ADMIN-002: suspending a Publisher does not cancel already-**Confirmed** requests, which complete as agreed; the Publisher is only blocked from creating *new* listings while suspended. What happens to a still-**Pending** request on a listing whose Publisher is suspended mid-flight (can the Publisher still accept/reject it?) is **not stated** — Open Question. |
| Listing changes price while a request on it is Pending | Falls under OWNER-003 (core listing fields, which would include price, cannot be edited while a request on that listing is pending confirmation) — **Approved**, by extension of OWNER-003 rather than a separate rule. |

Where `mvp-prd.md` does not define the exact result, this module records it as an Open Question rather than inventing behavior, per the brief this document was written against.

## 22. Notifications

The Request Engine defines the notification **events**; the Notifications module owns delivery (channel, timing infrastructure) per NOTIF-001 and `mvp-prd.md` §7.6.

| Event | Recipient | Trigger | State change | Required? |
|---|---|---|---|---|
| Request created | Publisher (new request received); Viewer (submission confirmed) | Viewer submits a valid request | (none) → REQUESTED | Yes — NOTIF-001 |
| Request accepted | Viewer | Publisher accepts | REQUESTED → CONFIRMED | Yes — NOTIF-001 |
| Request rejected | Viewer | Publisher rejects | REQUESTED → REJECTED | Yes — NOTIF-001 |
| Request approaching expiry | Publisher (implied — they are the one who can still act) | SLA threshold nears | (none — still REQUESTED) | Yes, per `mvp-prd.md` §7.6's "request expiring soon" event; exact lead time not defined |
| Request expired | Viewer | SLA threshold reached | REQUESTED → EXPIRED | Yes — NOTIF-001 |
| Request becomes Live | — | Confirmed request reaches start date | CONFIRMED → LIVE | **Not explicitly required** — `mvp-prd.md` §7.6's event list does not name this transition; §33 |
| Request completed | — | Publisher/Admin marks Completed | LIVE → COMPLETED | **Not explicitly required**, same reasoning — §33 |

This section does not define the complete push/SMS/email delivery infrastructure — that is `mvp-prd.md` §7.6's and the Notifications module's concern, not the Request Engine's. `viewer-platform.md` §18 already narrows this same event list to the Viewer-relevant subset; this table is the superset that also includes the Publisher-facing "new request received" event, which `viewer-platform.md` correctly excluded as not Viewer-relevant.

## 23. Permissions

| Action | Viewer | Publisher | Admin |
|---|---:|---:|---:|
| Create request | Yes | No | No |
| View own request | Yes | No | No |
| View requests on own inventory | No | Yes | Yes, where operationally required *(see §4 — the exact scope of this is an Open Question, §33)* |
| Accept | No | Yes | No |
| Reject | No | Yes | No |
| Mark Completed | No | Yes | Yes |
| Modify state arbitrarily | No | No | No |

No permission beyond this matrix is granted to any actor. In particular, Admin cannot accept, reject, or otherwise arbitrarily change a request's state outside the Mark Completed action explicitly given to it by `mvp-prd.md` §7.4.

## 24. Business Rules

The Request Engine's own rules, preserved exactly as defined in `mvp-prd.md` §7.4:

### REQUEST-001
Confirming a request automatically blocks those dates against all other Pending requests on the same hoarding.

### REQUEST-002
A Rejected or expired request releases its dates back to Available immediately.

### REQUEST-003
A request cannot move to Completed before its own start date.

Cross-referenced rules owned by other modules, not restated:

| Rule | Owning module | Relevance here |
|---|---|---|
| VIEWER-001 | Viewer Platform | A Viewer may hold multiple simultaneous Pending requests (§11). |
| VIEWER-002 | Viewer Platform | A Viewer cannot submit a duplicate Pending request on the same listing (§8, §11). |
| OWNER-001 | Publisher Module | A Publisher cannot accept two requests with overlapping dates on the same hoarding — the Publisher-side mirror of REQUEST-001. |
| OWNER-002 | Publisher Module | An unanswered request auto-expires past the response SLA (§14). |
| OWNER-003 | Publisher Module | Core listing fields cannot be edited while a request on that listing is pending confirmation (§21). |
| ADMIN-002 | Admin Module | Suspending a Publisher does not cancel already-Confirmed requests (§21). |
| `BR-REQUEST-001/002/003` | `mvp-brd.md` §7.4 | Business-level mirrors of REQUEST-001/002/003; used here in preference to the colliding `BR-OWNER-001/002` IDs in `mvp-brd.md` §11 (see the Source Conflict note at the top of this document). |

**New Request Engine-specific rule introduced in this document:**

### REQUEST-004
Before a request may transition from Requested to Confirmed, the system must re-validate that the requested dates have no conflicting Confirmed request on the same hoarding — a Publisher's acceptance is never based on availability data captured at the time of the request's original submission. This formalizes the module's stated critical principle (§10, §12): **for a single hoarding, two overlapping requests must never both reach Confirmed status.** REQUEST-004 is not a new product decision — it makes explicit, as its own rule, a requirement `mvp-prd.md` §7.4 and §12 already describe in prose (REQUEST-001's blocking effect, and the acceptance-time re-validation duty) but never assigned an ID.

## 25. Edge Cases

| # | Trigger | Expected result | State | Inventory effect | Notification |
|---|---|---|---|---|---|
| 1 | Two Viewers submit overlapping requests simultaneously | Both are accepted as separate Pending requests (neither conflicts with a Confirmed request) | Both REQUESTED | No block yet | Both Viewers + Publisher notified of their own creation |
| 2 | Two Viewers submit the exact same dates | Same as #1 — both Pending; only one can ever be Confirmed | Both REQUESTED | No block yet | Same as #1 |
| 3 | Publisher accepts one request while another overlapping one is Pending | The accepted request becomes Confirmed; the other remains Pending but can no longer be Confirmed | One CONFIRMED, one REQUESTED | Confirmed dates blocked | Viewer of accepted request notified |
| 4 | Publisher attempts to accept a request after another overlapping request has already been Confirmed | Rejected by the accept-time re-validation (REQUEST-004); acceptance fails with a clear reason | Attempted request remains REQUESTED | No change | Publisher sees a failure message, not a silent no-op |
| 5 | Request expires while the Publisher is actively attempting to respond | Race condition between the SLA timeout and the Publisher's action; whichever completes first should win — **exact tie-break behavior is not defined in `mvp-prd.md`** (Open Question, §33) | REQUESTED → EXPIRED or REQUESTED → CONFIRMED/REJECTED, whichever wins | Dates release (if expired) or block (if confirmed first) | Per whichever transition occurs |
| 6 | Publisher rejects a request after another overlapping request has become Confirmed | Rejection proceeds normally — rejecting a request that could no longer be confirmed anyway has no special effect | REQUESTED → REJECTED | Dates release (though they were never blocked by this request) | Viewer notified of rejection |
| 7 | Viewer submits a duplicate Pending request on the same listing | Blocked by VIEWER-002; the Viewer is shown their existing request instead | No new request created | None | None (rejected at submission) |
| 8 | Listing becomes paused while a request on it is Pending | **Open Question** — not defined in `mvp-prd.md` (§21, §33) | Undefined | Undefined | Undefined |
| 9 | Listing becomes deleted/delisted while a request on it is Pending | **Open Question** — same as #8 | Undefined | Undefined | Undefined |
| 10 | Listing becomes unavailable between date selection and submission | Submission is blocked with a clear reason, not silently accepted then rejected (`mvp-prd.md` §11) | No request created | None | Viewer shown an Unavailable state |
| 11 | Publisher attempts to accept an unavailable/already-conflicting request | Rejected by re-validation (REQUEST-004), same as #4 | Remains REQUESTED | No change | Publisher sees a failure message |
| 12 | Network failure occurs during Viewer request creation | The Viewer must be told clearly whether the request was created or not, to avoid an unintended duplicate submission attempt — exact retry/idempotency mechanism is an Open Question (§33, carried from `viewer-platform.md` §21) | Undefined until resolved | Undefined | Undefined |
| 13 | Network failure occurs during Publisher acceptance | Same reasoning as #12, applied to the Publisher side — not explicitly defined | Undefined | Undefined | Undefined |
| 14 | A request is already Confirmed when another Viewer submits overlapping dates | Per the §9 Assumption, the new submission is blocked at creation as unavailable (rather than accepted as a doomed Pending request) — this is an inference, not a stated rule | No new request created (per Assumption) | No change | Viewer shown dates as unavailable |
| 15 | Completion is attempted before the request's start date | Blocked — REQUEST-003 | Remains CONFIRMED/LIVE | No change | Actor sees a clear rejection, not a silent failure |
| 16 | Completion is attempted before the request's end date (but after its start date) | **Not explicitly blocked by `mvp-prd.md`** — REQUEST-003 only enforces the start-date floor; whether an end-date floor also applies is an Open Question (§19, §33) | Ambiguous | Ambiguous | Ambiguous |
| 17 | Request has no Publisher response before the SLA | Auto-expires (OWNER-002, REQUEST-002) | REQUESTED → EXPIRED | Dates release | Viewer notified |
| 18 | Publisher account is suspended while it has Confirmed requests | Those Confirmed requests complete as agreed; the Publisher just cannot create new listings while suspended (ADMIN-002) | No state change | No change | Not explicitly defined for this specific event |

## 26. Data Requirements

These are module-level data requirements — what the Request Engine needs to represent to implement the approved behavior above — not a database schema. `mvp-prd.md` does not itself enumerate a Request schema; the fields below are the minimum necessary to enforce REQUEST-001–004, OWNER-002, and VIEWER-001/002, not an independently invented data model.

```text
Request
├── id
├── viewer_id
├── publisher_id
├── hoarding_id
├── start_date
├── end_date
├── status
├── amount_agreed
├── created_at
├── updated_at
├── responded_at
└── completed_at
```

| Field | Why it's needed |
|---|---|
| `id` | Uniquely identifies the request (referenced by the API in §27). |
| `viewer_id` | Enforces VIEWER-001/002 (per-Viewer, per-listing Pending checks) and request ownership (§23). |
| `publisher_id` | Identifies who can accept/reject/complete this request (§4, §23) — denormalized from the hoarding for convenience; the hoarding is the source of truth for ownership. |
| `hoarding_id` | Identifies which listing's calendar this request affects — required for all conflict detection (§9–§10). |
| `start_date` / `end_date` | The requested date range — required for conflict detection (§10) and the REQUEST-003 start-date check. |
| `status` | The current lifecycle state (§5–§6). |
| `amount_agreed` | Record-keeping field per §17 — not enforced, not payment. |
| `created_at` | Needed to compute SLA expiry (§14) — assuming the clock starts here (Open Question, §33). |
| `updated_at` | General last-modified tracking. |
| `responded_at` | When the Publisher accepted/rejected — needed if the SLA clock instead starts from a different event, and useful for the BRD's "median Publisher response time" KPI (`mvp-brd.md` §14). |
| `completed_at` | When the request was marked Completed — needed to enforce and audit REQUEST-003. |

The Database Design document (`README.md` Tier 1 item #5) will define tables, keys, indexes, foreign keys, constraints, transactions, and database-level locking — none of that is decided here.

## 27. API Dependencies

Per `mvp-prd.md` §9, the Request Engine's endpoints are:

```text
POST  /api/v1/requests                      (Viewer)
GET   /api/v1/requests/me                   (Viewer)
GET   /api/v1/publishers/me/requests        (Publisher)
PATCH /api/v1/requests/{id}                 (accept/reject/complete)
```

| Endpoint | Product-level purpose |
|---|---|
| `POST /api/v1/requests` | Viewer creates a new request (§8); enforces the creation validation in §8 and returns the created request in REQUESTED status, or a clear failure reason. |
| `GET /api/v1/requests/me` | Viewer lists their own requests (§11, `viewer-platform.md` §15). |
| `GET /api/v1/publishers/me/requests` | Publisher lists requests on their own listings (their "inbox," `mvp-prd.md` §7.2). |
| `PATCH /api/v1/requests/{id}` | Publisher accepts/rejects, or Publisher/Admin marks Completed — a single endpoint covering three distinct transitions (§12, §13, §19); the exact request body shape that distinguishes these actions is not specified here (that is an API Specification concern, `README.md` Tier 1 item #6). |

### API Gaps / Open Questions

Carried forward from, and consistent with, `viewer-platform.md` §23:

- No endpoint for retrieving a single request's full detail (`GET /api/v1/requests/{id}`) distinct from the list endpoints above.
- No endpoint distinct from `PATCH /api/v1/requests/{id}` is defined for Admin's Mark Completed action — whether Admin uses this same endpoint with elevated authorization, or a separate `/api/v1/admin/...` route (matching the pattern used for listing approval), is undefined.
- No endpoint is defined for retrieving request state-history/audit trail, relevant to §29.

## 28. Non-Functional Requirements

### Data Integrity
No double confirmation of overlapping dates (REQUEST-001, REQUEST-004) — this is the single most important integrity property of the module.

### Consistency
State transitions must not silently fail — every attempted transition either succeeds and is reflected in the request's status, or fails with a reason visible to the actor who attempted it (§7, §12).

### Reliability
A successfully submitted request must not disappear — the Viewer's confirmation of submission (§8) must correspond to a durably created record.

### Concurrency Safety
Simultaneous requests and simultaneous Publisher actions must produce deterministic outcomes — exactly one of two conflicting acceptance attempts succeeds, never both, and never neither without a clear reason (§10).

### Auditability
Important state changes should be timestamped and attributable to the responsible actor (§26, §29) — this is a reasonable minimum consistent with `mvp-brd.md` §10's emphasis on data integrity as a trust substitute at MVP, though a full structured audit-log feature is not itself an approved MVP requirement (§29).

### Security
Only authorized actors can perform their allowed request actions, per the permissions matrix in §23 — a Viewer cannot accept/reject/complete, and a Publisher cannot act on another Publisher's listing.

### Performance
Request creation and state transitions should be responsive at MVP scale (50–200 listings, per `mvp-prd.md` §10) — no enterprise-scale or formal uptime SLA target is introduced here, consistent with `mvp-prd.md` §10's explicit statement that a 99.9% SLA is a scale-phase commitment, not an MVP requirement.

## 29. Audit / State History

Candidate events worth recording when a Request changes state:

```text
Request Created
Request Accepted
Request Rejected
Request Expired
Request Became Live
Request Completed
```

For each: previous status, new status, actor, timestamp, and reason where applicable (e.g., a Publisher rejection reason, if §13's open question is ever resolved in favor of requiring one).

**This is recorded as an Assumption/Open Question, not an approved MVP requirement.** `mvp-prd.md` does not mention an audit log or state-history feature anywhere. The per-request timestamp fields in §26 (`created_at`, `updated_at`, `responded_at`, `completed_at`) are justified as necessary to enforce already-approved rules (SLA expiry, REQUEST-003); a full multi-row, per-transition history table is a further step this document does not silently promote to an MVP requirement.

## 30. Acceptance Criteria

```text
Request Creation

Given a Viewer has an approved, available hoarding open
When they select 5–10 October and submit a request
Then a new request is created with status Pending (Requested)
And the Viewer sees confirmation that the request was submitted
And the request appears in the Viewer's request list.
```

```text
Duplicate Prevention

Given a Viewer already has a Pending request for 5–10 October on Hoarding X
When the same Viewer attempts to submit another request for any dates on Hoarding X
Then the platform prevents the second request
And the Viewer is shown their existing Pending request instead.
```

```text
Conflict Prevention

Given Hoarding X has a Confirmed request for 1–15 September
When a different Viewer's request for 10–20 September on Hoarding X is later considered for acceptance
Then that acceptance is rejected by the accept-time re-validation
And the request remains Pending, never becoming Confirmed.
```

```text
Publisher Acceptance

Given a valid Pending request for 1–15 September on Hoarding X with no conflicting Confirmed request
When the Publisher accepts it
Then the request becomes Confirmed
And 1–15 September on Hoarding X is blocked against all other Pending requests
And the Viewer is notified.
```

```text
Publisher Rejection

Given a Pending request for 1–15 September on Hoarding X
When the Publisher rejects it
Then the request becomes Rejected
And 1–15 September on Hoarding X is released back to Available
And the Viewer is notified.
```

```text
Expiry

Given a Pending request has received no Publisher response within the configured response SLA
When the SLA is reached
Then the request automatically becomes Expired
And its dates are released back to Available
And the Viewer is notified.
```

```text
Completion

Given a Confirmed request's start date is 1 October
When a Publisher or Admin attempts to mark it Completed on 28 September
Then the action is rejected because the start date has not yet passed
And the request remains Confirmed.
```

```text
Live Transition

Given a Confirmed request runs from 1–15 October
When the current date reaches 1 October
Then the request's status becomes Live
And the Viewer sees it labeled "Campaign Period."
```

```text
Notification

Given any Request Engine state change covered by NOTIF-001 occurs
When the change is committed
Then the affected Publisher or Viewer receives a notification within the defined delay.
```

```text
Concurrent Requests

Given two Viewers submit overlapping requests for Hoarding X within moments of each other, and neither conflicts with an existing Confirmed request
When both submissions are processed
Then both requests are created as Pending
And neither is silently Confirmed ahead of a Publisher decision.
```

```text
Unavailable Listing

Given Hoarding X is paused or delisted
When a Viewer attempts to submit a request against it
Then the request is not created
And the Viewer is shown that the listing is no longer available.
```

## 31. MVP vs Future

### MVP
- Date requests
- Pending (Requested)
- Confirmed
- Rejected
- Expired
- Live
- Completed
- Conflict prevention (REQUEST-001, REQUEST-004)
- Publisher accept/reject
- Manual completion (Publisher or Admin)
- Amount agreed record (uncollected, unenforced)
- Notifications (event triggers; delivery owned by the Notifications module)

### Future
- Online payment
- Escrow
- Commission calculation
- Automated contracts
- Campaign-level booking
- Multi-hoarding campaigns
- Agency workflows
- Automated payment-triggered completion
- Advanced cancellation/refund rules
- Dynamic pricing
- Financial reconciliation

No future item above is treated as an MVP requirement anywhere in this document.

## 32. Dependencies

**Viewer Platform → Request Engine**
Creates requests and displays request states to the Viewer (`viewer-platform.md` §13–§15). The Request Engine is the sole owner of request state; the Viewer Platform surfaces it without redefining it (`viewer-platform.md` §27 makes the same statement in the other direction).

**Publisher Platform → Request Engine**
Provides Publisher accept/reject/complete actions and listing availability data. (`owner-platform.md` was unavailable at the time of writing — see the sourcing note at the top of this document.)

**Inventory Module → Request Engine**
Provides hoarding and availability data the Request Engine validates requests against (§8–§9). (`inventory.md` was likewise unavailable — field-level detail is drawn from `mvp-prd.md` §8 instead.)

**Notifications → Request Engine**
Receives the events defined in §22 and delivers them per NOTIF-001; the Request Engine does not itself implement push/SMS/email delivery.

**Admin Platform → Request Engine**
Provides the Mark Completed capability (jointly with Publisher, §19) and the Publisher-suspension behavior that ADMIN-002 says does not cancel Confirmed requests (§21).

**Auth & Roles → Request Engine**
Determines who is authorized to create or manage requests (§4, §23). Per the approved `mvp-prd.md` target, AUTH-002 (OTP) gates Viewer request submission; the current demo build substitutes email/mobile + password per `viewer-platform.md`'s Demo Scope Note (see the Consistency Note at the top of this document and §8).

**Database → Request Engine**
Stores Request state and the fields listed in §26; enforces the concurrency and integrity properties described in §10 and §28 at the implementation level (System Architecture / Database Design documents, not decided here).

## 33. Open Questions

Genuine unresolved decisions only — several already known from `mvp-prd.md` §14 and `viewer-platform.md` §28, carried forward in their Request Engine-specific form, plus a few that surfaced directly while writing this module:

- Exact Publisher response SLA duration (`mvp-prd.md` §14).
- What event starts the SLA clock — request creation, or something else (e.g., notification delivery to the Publisher)? (§14, §26)
- Whether Publisher rejection requires a reason (§13).
- Who enters `amount_agreed`, and at what stage of the flow (§17).
- Whether Viewer cancellation of a Pending request is supported (§20).
- Exact behavior when a listing is paused or deleted while a request on it is Pending (§21, §25 #8–#9).
- Whether a suspended Publisher can still accept/reject a still-Pending request on a listing that predates the suspension (§21) — ADMIN-002 only addresses already-Confirmed requests.
- Whether new request submissions against dates that are already Confirmed are blocked outright at creation, or accepted as a Pending request that can never be Confirmed (§9, §25 #14 — this document assumes the former).
- Whether notifications are required for the Live and Completed transitions (§18, §19, §22).
- Whether Completion requires the request's own **end** date to have passed, or only its start date (REQUEST-003 only explicitly enforces the start-date floor) (§19, §25 #16).
- Exact retry/idempotency behavior after a network failure during request creation or Publisher acceptance (§25 #12–#13).
- Exact tie-break behavior when SLA expiry and a Publisher's response happen near-simultaneously (§25 #5).
- Whether a soft cap on simultaneous Pending Viewer requests should exist (`mvp-brd.md` §12/§17 frames this as an unresolved business decision, not yet made).
- The exact scope of Admin's "view/manage requests" capability beyond Mark Completed and aggregate dashboard counts (§4, §23) — connects directly to the still-unwritten Support/Dispute Handling Runbook (`README.md` Tier 1 item #13).
- The `mvp-brd.md` BR-OWNER-001/002 ID collision between §7.2 and §11 (see the Source Conflict note at the top of this document) — should be corrected at the BRD level.

If any of these are already resolved in a document outside this session's available context (e.g., `inventory.md`, `owner-platform.md` once available, or a future Admin Platform module doc), this list should be reconciled against them rather than treated as still open.

## 34. Requirement ID Index

```text
REQUEST-001
REQUEST-002
REQUEST-003
REQUEST-004
```

`REQUEST-004` is the one new ID introduced in this document (§24) — it formalizes the accept-time re-validation duty and the "no two overlapping Confirmed requests" invariant that `mvp-prd.md` §7.4 and §12 already describe in prose but never assigned an ID of their own. No other new IDs are introduced.

Cross-referenced rules owned by other modules, not renumbered:

```text
VIEWER-001
VIEWER-002
OWNER-001
OWNER-002
OWNER-003
ADMIN-002
NOTIF-001
```

---

*End of SEEABLE Hoardings — Request Engine Module.*
