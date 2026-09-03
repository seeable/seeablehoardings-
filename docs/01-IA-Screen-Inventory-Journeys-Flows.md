# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 01 of 9 — Information Architecture, Screen Inventory, User Journeys, User Flows

---

## 4. Information Architecture

Each role gets its own navigation shell — there is no shared "one app, different permissions" chrome. This reflects that a Publisher's job (manage inventory, respond to demand) and a Viewer's job (discover, evaluate, request) are different enough that a merged nav would force compromises on both.

### 4.1 Viewer IA (mobile-first, bottom tab bar on mobile / left rail on desktop)

```
Viewer App
├── Discover                (default landing after login — VW-01)
│   └── Map View            (view toggle within Discover, not a separate tab — VW-02)
├── Shortlist                (VW-06)
├── My Requests              (VW-05)
│   └── Request Detail       (drill-in, not separate nav — part of VW-05)
└── Account                  (SH-01, avatar/profile menu, not a primary tab)
```

Hoarding Detail (VW-03) and Request Submission (VW-04) are always reached by drilling in from Discover, Map, or Shortlist — never top-level nav destinations, since they only make sense in context of a specific hoarding.

**Explicitly excluded from MVP nav** (seen in one reference screenshot, not in `mvp-prd.md` scope): **Marketplace** (as a tab separate from Discover), **Campaigns**, **Reports**, **Insights**, a standalone **Dashboard** tab. These imply post-booking campaign tracking and analytics that don't exist at MVP (no live campaign management, no payment/spend data to report on). They are named here only so a future build doesn't accidentally reintroduce them as if they'd been scoped. See File 08 §Future UX Considerations.

### 4.2 Publisher IA (desktop-first, left rail persistent nav)

```
Publisher App
├── Dashboard                (default landing — PB-01)
├── My Hoardings              (PB-02)
│   ├── Add Hoarding          (wizard — PB-03)
│   ├── Edit Hoarding         (PB-04, same wizard shell in edit mode)
│   └── Availability Calendar (PB-05, drill-in per hoarding)
├── Requests                  (PB-06 list → PB-07 detail)
└── Account                   (SH-01, includes Verification status — PB-08)
```

### 4.3 Admin IA (desktop-only, left rail)

```
Admin Console
├── Overview                       (AD-01, 4-metric dashboard)
├── Publishers & Inventory         (AD-02 — combined per source screenshot: Publisher list with
│                                    verify/suspend actions + their listings with approve/reject/delist actions)
│   ├── Publisher Verification     (AD-03, drill-in)
│   └── Listing Approval           (AD-04, drill-in)
└── Activity                       (AD-05, recent-events feed — not a full audit log, see File 08)
```

### 4.4 IA principles

- **No cross-role navigation.** A Publisher never sees a "browse as Viewer" mode and vice versa — a Publisher who also wants to advertise elsewhere's inventory would need a separate Viewer account (this is itself an unresolved product question, not a UX one — not addressed further here).
- **Two levels deep, maximum, from any nav item**, except the Add-Hoarding wizard, which is intentionally a focused, full-screen, linear flow that suspends the left rail.
- **Status is IA, not just page content.** My Hoardings and My Requests are both organized primarily by status (tabs/filters), because status is the single most important thing either role scans for.

---

## 5. Screen Inventory

Every screen below has a full page-by-page specification in Files 03 (Viewer), 04 (Publisher), or 05 (Admin + Shared). Screen IDs are referenced throughout this documentation set and should be carried into Figma page/frame names for traceability.

| ID | Screen | Role | Type |
|---|---|---|---|
| AUTH-01 | Landing / Marketing entry | Public | Full page |
| AUTH-02 | Log in | Public | Full page |
| AUTH-03 | Sign up (role selection + form) | Public | Full page |
| AUTH-04 | Forgot / reset password | Public | Full page |
| SH-01 | Account & Profile Settings | Publisher, Viewer | Full page (role-variant content) |
| SH-02 | Notifications panel | Publisher, Viewer, Admin | Drawer/panel, not full page |
| VW-01 | Discover (marketplace browse — list/grid) | Viewer | Full page |
| VW-02 | Discover — Map view | Viewer | Full page (view toggle of VW-01) |
| VW-03 | Hoarding Detail | Viewer | Full page |
| VW-04 | Submit Request | Viewer | Modal / bottom sheet over VW-03 |
| VW-05 | My Requests (list + detail) | Viewer | Full page + drill-in panel |
| VW-06 | My Shortlist | Viewer | Full page |
| PB-01 | Publisher Dashboard | Publisher | Full page |
| PB-02 | My Hoardings (list) | Publisher | Full page |
| PB-03 | Add Hoarding wizard (6 steps) | Publisher | Full-screen focused flow |
| PB-04 | Edit Hoarding | Publisher | Full-screen focused flow (PB-03 shell, edit mode) |
| PB-05 | Availability Calendar | Publisher | Full page (drill-in from PB-02) |
| PB-06 | Incoming Requests (list) | Publisher | Full page |
| PB-07 | Request Detail (Publisher view) | Publisher | Drill-in panel from PB-06 |
| PB-08 | Publisher Verification | Publisher | Full page / persistent banner state |
| AD-01 | Admin Overview dashboard | Admin | Full page |
| AD-02 | Publishers & Inventory Management | Admin | Full page |
| AD-03 | Publisher Verification detail | Admin | Drill-in / modal from AD-02 |
| AD-04 | Listing Approval detail | Admin | Drill-in / modal from AD-02 |
| AD-05 | Activity log | Admin | Full page |

**24 screens total** (4 shared/auth, 6 Viewer, 8 Publisher, 5 Admin, 1 shared panel). This count is restated and reconciled against the requirement traceability matrix in File 08 §Final Screen Inventory.

---

## 6. User Journeys

These are the two end-to-end journeys the MVP exists to support, matching the shape of the Publisher and Viewer journey diagrams in the source reference material, reconciled with the exact rule IDs from `mvp-prd.md`, `inventory.md`, and `request-engine.md`.

### 6.1 Publisher journey — "List a hoarding and get a Request"

```
1. Sign up as Publisher (AUTH-03)
        ↓
2. Submit identity/business verification (PB-08)  — AUTH-002 gate: cannot submit a
   listing for Admin review until Admin has verified the Publisher (or, per
   UX ASSUMPTION below, can draft while pending — see §6.3)
        ↓
3. Add Hoarding — 6-step wizard (PB-03): Type → Details → Location → Media →
   Pricing & Availability → Review
        ↓
4. Submit for Admin approval  →  status: Pending Approval
        ↓
5. Admin approves (AD-04) → status: Approved, visible in marketplace
   [or Admin rejects with reason → Publisher edits and resubmits]
        ↓
6. Listing appears in Discover (VW-01) to Viewers matching its location/type/price
        ↓
7. Viewer submits a Request → Publisher receives notification (PB-06)
        ↓
8. Publisher reviews Request detail (PB-07), Accepts or Rejects
        ↓
9. If Accepted → Request status Confirmed → dates blocked on Publisher's calendar (PB-05)
        ↓
10. Campaign period arrives → Request auto-transitions to Live
        ↓
11. Campaign period ends → Publisher (jointly with Admin) marks Completed
```

### 6.2 Viewer journey — "Find a hoarding and request it"

```
1. Land on marketing/login entry (AUTH-01) → Log in or Sign up (AUTH-02/03)
        ↓
2. Discover (VW-01) — browse or search by location/type/budget; switch to Map (VW-02)
   to see hoardings geographically along a route or area of interest
        ↓
3. Open Hoarding Detail (VW-03) — review photos, Site Intelligence (traffic/visibility
   data), pricing, availability calendar, Publisher's verification badge
        ↓
4. Optionally add to Shortlist (VW-06) to compare later
        ↓
5. Select desired date range on the availability calendar → Submit Request (VW-04)
   with campaign details (dates, brief message, agreed-amount discussion is
   off-platform — see OPEN QUESTION on amount_agreed capture, File 08)
        ↓
6. Request enters Pending state → tracked in My Requests (VW-05)
        ↓
7. Publisher responds (accept/reject) → Viewer notified
        ↓
8. If Confirmed → Viewer sees Confirmed status and campaign dates in My Requests;
   coordinates creative/execution details with Publisher off-platform
        ↓
9. Campaign runs (Live) → completes (Completed) → Viewer can browse and request again
```

### 6.3 Journey-level UX ASSUMPTION

**UX ASSUMPTION:** A Publisher can complete Add Hoarding (PB-03) and hold it in **Draft** while verification is still pending, but cannot press **Submit for Approval** until Admin verification is complete — the wizard's final Review step (PB-03 step 6) shows a non-blocking banner ("Your account is pending verification — you can keep editing, but we can't publish this listing until you're verified") rather than locking the entire wizard. This keeps a new Publisher productively occupied during the verification wait rather than fully blocked, without contradicting the AUTH-002 gate. This is a judgment call filling a gap in `mvp-prd.md` and should be confirmed with product.

---

## 7. User Flows

Detailed, decision-point-level flows for the four operations that carry real business rules. These are the flows QA should write test cases from.

### 7.1 Flow: Publisher creates and submits a listing

```
Start: PB-02 "My Hoardings" → [+ Add Hoarding] button
  → PB-03 Step 1: Type
      Choose one of 8 hoarding types (6 fully listable static types;
      2 digital types are data-model-only at MVP — selecting a digital
      type shows an inline notice: "Digital screen listings are coming
      soon — you can save this as a draft" and routes to a reduced-field
      draft-only path). [INVENTORY taxonomy, mvp-prd.md]
  → PB-03 Step 2: Details
      Type-specific required fields render dynamically based on Step 1
      selection (per api-specification.md §11.5 data-driven
      required_attribute_keys) — e.g., a Unipole asks for pole height and
      facing direction; a Wall Wrap asks for wall dimensions.
  → PB-03 Step 3: Location
      Address search + map pin placement; latitude/longitude captured
      (confirmed present in DB schema per seeable_free_first_techstack.md,
      resolving an earlier open assumption). Site Intelligence fields
      (traffic volume estimate, visibility rating, nearby landmarks)
      entered here or Step 2 — see File 06 §Hoarding Detail UX for the
      full Site Intelligence field list and partial-data-omission rule.
  → PB-03 Step 4: Media
      Photo upload (minimum count — UX ASSUMPTION: 3 photos minimum to
      submit, flagged as OPEN QUESTION in File 08 since source docs don't
      state a number); browser-side watermarking applied automatically
      on upload per system-architecture.md.
  → PB-03 Step 5: Pricing & Availability
      Base rate entry + initial availability calendar setup (default:
      available from today). UX ASSUMPTION: step order/grouping — source
      screenshots confirmed Steps 1,2,3,4, and 6 but did not capture
      Step 5's exact content; grouping pricing with initial availability
      here is the minimum reasonable grouping consistent with what a
      Review step (6) would need to display.
  → PB-03 Step 6: Review
      Full summary; submission_readiness.blockers[] (per
      api-specification.md §11.3) surfaces as a checklist of anything
      still missing (e.g., "Add at least 1 more photo", "Verification
      pending — you can save as Draft now and submit once verified").
      [Submit for Approval] enabled only when blockers[] is empty AND
      Publisher is verified.
  → Decision: Save as Draft  |  Submit for Approval
      - Draft → status: Draft, editable anytime, not visible to anyone else.
      - Submit → status: Pending Approval → routed to AD-04 queue.
End
```

### 7.2 Flow: Admin approves or rejects a listing

```
Start: AD-02 Publishers & Inventory → filter: Pending Approval
  → AD-04 Listing Approval detail: full read-only view of the listing as
    a Viewer would eventually see it, plus internal-only fields.
  → Decision: Approve | Reject
      - Approve → status: Approved → immediately visible in VW-01 Discover
        (subject to Publisher not being suspended and hoarding not
        independently delisted — INVENTORY-003 composite visibility rule).
      - Reject → REQUIRED reason field (ADMIN-003 — rejection reason is
        mandatory, unlike Publisher's own rejection of a Request, which
        this documentation treats as NOT requiring a reason — see
        File 08 Open Questions) → status: Rejected → Publisher notified
        with the reason, can edit and resubmit (wizard reopens pre-filled,
        routes back to Step 6 Review after edits).
End
```

### 7.3 Flow: Viewer submits a Request; Publisher responds

```
Start: VW-03 Hoarding Detail → availability calendar shows open date ranges
  → Viewer selects start/end date → [Request This Hoarding] → VW-04 modal
      Fields: date range (pre-filled from selection, editable), campaign
      brief/message (optional free text), Viewer's contact preference is
      NOT collected here — Publisher will see Viewer's full_name and the
      Request's own message only, per the disintermediation boundary.
  → [Submit Request]
      Server re-validates the date range against the no-overlap invariant
      at submit time (a race is possible if two Viewers view the same open
      range simultaneously — see File 07 §Edge Cases) before creating the
      Request in status Pending, with an SLA deadline for Publisher
      response (sla_deadline field exists per api-specification.md §16.3;
      exact SLA duration is an OPEN QUESTION — File 08).
  → Request appears in PB-06 Incoming Requests for the Publisher, and in
    VW-05 My Requests for the Viewer, both showing status: Pending.
  → Publisher opens PB-07 Request Detail → Decision: Accept | Reject
      - Accept → status: Confirmed. Server enforces REQUEST-004: if the
        exact date range (or any overlap) was already Confirmed for a
        different Request on the same hoarding, this action is rejected
        server-side with an error — the UI must handle this as a real,
        expected failure mode, not an edge case to ignore (see File 07
        §Edge Cases, "Accept race").
      - Reject → status: Rejected. UX ASSUMPTION: no reason required for
        a Publisher rejecting a Request (contrast with Admin's mandatory
        rejection reason for listings) — flagged as OPEN QUESTION,
        File 08, since a reason would improve Viewer trust but isn't
        stated as required anywhere in source docs.
  → No response within SLA → status: Expired (system-driven transition,
    background job per system-architecture.md) → both parties notified.
  → Confirmed request's start date arrives → status auto-transitions to
    Live (background job) → end date passes → both Publisher and Admin
    can mark Completed (joint action per admin-platform.md).
End
```

### 7.4 Flow: Admin manages a Publisher (verify / suspend) and a hoarding (delist)

```
Start: AD-02 Publishers & Inventory
  → Publisher row → [Verify] (first-time) → AD-03: review submitted
    business/identity info → Approve (status: Verified, unlocks listing
    submission) | Reject (with reason, Publisher can resubmit).
  → Publisher row, already verified → [Suspend] → confirmation modal
    explains consequence per ADMIN-002: "Suspending will hide all of this
    Publisher's listings from Discover and block new Requests. It will
    NOT cancel any already-Confirmed Requests — those campaigns continue
    as planned." → Confirm → Publisher's listings drop out of Discover
    (via INVENTORY-003 composite check), existing Confirmed Requests
    unaffected.
  → Individual hoarding row → [Delist] → confirmation modal: "Delisting
    removes this hoarding from Discover immediately. This is independent
    of the Publisher's account status." (ADMIN-004) → Confirm → hoarding
    hidden regardless of its own Approved/Paused state.
End
```

---

*Continue to File 02 for the Design System, Component Library, and Design Tokens that every screen in Files 03–05 is built from.*
