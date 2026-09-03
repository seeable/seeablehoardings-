# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 06 of 9 — Feature UX Deep-Dives

This file covers the six feature areas that cut across multiple screens from Files 03–05: the logic, taxonomy, and cross-screen rules behind Discovery, Hoarding Detail, Requests, Inventory Management, Dashboards, and Admin. Where Files 03–05 specify *what a screen looks like*, this file specifies *how the feature behaves as a system*.

---

## 9. Marketplace Discovery UX

### 9.1 Filter taxonomy

| Filter | Type | Values | Notes |
|---|---|---|---|
| Type | Multi-select | The 6 static hoarding types (§10.1 below) | The 2 digital types appear visually in the filter list but are shown disabled with a "Coming soon" tag rather than omitted — a Viewer should be able to see that digital inventory exists conceptually, just not transact on it yet. |
| Budget | Range slider | ₹ min–max per month (or normalized per-period — see §9.2) | Two listings priced "/month" vs "/2 weeks" must be compared on a normalized basis for this filter to be meaningful — see §9.2. |
| Distance | Radius from a point | 1km / 3km / 5km / 10km / city-wide | Requires location permission; degrades gracefully to city-wide when denied (VW-01 States, File 03). |
| Location text search | Free text | — | Matches against hoarding name and location/area text, not a structured geocoded search at MVP (a true geocoded "search this address" is a reasonable **Future Consideration** enhancement over simple text matching). |

**OPEN QUESTION** (File 08): whether additional filters (Illuminated Yes/No, minimum size) are needed is not settled in source docs beyond the type-specific fields captured at listing time — this documentation scopes the filter set to the four above as the minimum that makes Discovery usable, since over-filtering a catalog of 50–200 listings (the MVP's target inventory size, per `mvp-brd.md`) risks empty-result frustration more than it risks overwhelming choice.

### 9.2 The rate-normalization problem

Because different hoarding types are priced on different natural cycles (a Unipole "/month," a short-term Wall Wrap "/2 weeks"), a Budget filter and any price-based sort must compare like with like. **UX ASSUMPTION:** all prices are normalized to a per-month equivalent for filtering/sorting purposes only (display always shows the Publisher's actual entered rate and period, never a normalized figure, to avoid misrepresenting the real commercial terms) — flagged in File 08 since source docs don't specify a normalization method.

### 9.3 Sort options

Default sort: **Newest first** (surfaces fresh inventory, which matters in a thin two-sided marketplace at MVP scale where every new listing deserves visibility). Additional options: Price (low→high, high→low), Distance (only available once a location/search-area context exists). No "Most popular" or "Most requested" sort exists at MVP — it would require exposing demand signals that could itself leak competitive information between Publishers, and no source doc requests it.

### 9.4 Map and List are the same result set

VW-01 (List) and VW-02 (Map) are two renderings of one filtered/sorted query, never two independently-maintained views — switching views mid-session preserves every active filter exactly, and a result excluded by a filter on one view is excluded on the other. This is stated explicitly because it's an easy consistency bug to introduce (e.g., a map that "shows everything" while the list respects filters) and would directly undermine trust in the filtering system.

### 9.5 What Discovery deliberately does not do at MVP

No personalized ranking, no AI-suggested hoardings, no "similar to what you viewed" recommendations — these appear in the full-scope framework document's long-term ambition but are named here only as **Future Considerations** (File 08), not built. Discovery at MVP is a transparent, filterable catalog — the entire trust model (P1) depends on a Viewer being able to reason about *why* a result appears where it does, which an opaque recommendation ranking would undermine before the marketplace has enough data to make one trustworthy anyway.

---

## 10. Hoarding Detail UX

### 10.1 The hoarding taxonomy

Per `mvp-prd.md`, 8 hoarding types exist in the data model: 6 fully listable static types and 2 digital types that exist as data-model entries but are not listable/publishable at MVP (§10.2 below). The static types used consistently as canonical examples throughout this documentation are:

| Type | Example listing used in this documentation | Distinguishing type-specific fields (Step 2 of PB-03) |
|---|---|---|
| Unipole | Premium Unipole — Hosur Road, Hebbal Flyover Unipole | Pole height, facing direction, illumination |
| Gantry (overhead) | Silk Board Gantry | Span width, clearance height, number of faces |
| Wall Wrap | Indiranagar Wall Wrap | Wall dimensions, surface material |
| Hoarding / Billboard (large-format static) | — | Panel dimensions, illumination |
| Street Furniture | Koramangala Bus Shelter | Furniture sub-type (bus shelter, kiosk, etc.), footfall context |
| *[6th static type]* | — | *Exact name and fields to be confirmed against `inventory.md`'s canonical taxonomy table — this documentation's research pass captured 5 static types with confidence from repeated examples across source screenshots and documents; the 6th is referenced in `mvp-prd.md`'s "8 hoarding types" count but its exact label was not re-verified in this pass. **OPEN QUESTION**, File 08 — do not build against a guessed name; confirm against `inventory.md` directly before Figma/dev handoff.* |
| Digital Screen | ORR Digital Screen | Data-model-only, see §10.2 |
| *[2nd digital type]* | — | Data-model-only, see §10.2. Exact label similarly to be confirmed. |

This is the one place in this documentation where a source-fact gap (an unconfirmed exact label) is carried forward rather than silently filled with a plausible-sounding guess — per Rule 8 of the master brief, an incorrect invented name would be worse than a flagged gap.

### 10.2 Digital types are data-model-only at MVP

`inventory.md` and `mvp-prd.md` both include 2 digital-screen hoarding types in the data model, but MVP does not support the operational complexity a real digital-screen listing implies (loop scheduling, proof-of-play, real-time availability by slot rather than by date range). This documentation therefore treats digital types as:
- **Visible as a disabled option** in PB-03 Step 1 and the VW-01 Type filter (so the taxonomy isn't invisible — future Publishers/Viewers should know it's coming), but
- **Not listable to Approved/visible status** — a digital-type listing can only ever reach Draft, never Submit for Approval, and never appears in Discover.

This is explicitly named as scoping, not a bug, everywhere it's referenced (File 03 VW-01, File 04 PB-03 Step 1). Full digital-screen support (scheduling, proof-of-play reporting) is a named **Future Consideration** (File 08).

### 10.3 Site Intelligence — purpose and display rule

Site Intelligence data (traffic volume, visibility rating, nearby landmarks, and any additional fields `mvp-prd.md` scopes beyond the three used as canonical examples throughout this documentation) exists to let a Viewer assess a hoarding's advertising value without a site visit — the single biggest information gap Discovery needs to close versus the old phone-and-photos process. Two UX rules govern it everywhere it appears (PB-03 Step 3, VW-03, AD-04):
1. **Optional at entry, honest at display** — a Publisher is never forced to fill every field, and the display never implies completeness it doesn't have (the partial-data-omission rule from `api-specification.md` §11.3, detailed in File 03 VW-03).
2. **Never a ranking or score** — Site Intelligence is presented as discrete labeled facts (Traffic Volume: High), never rolled up into a single "quality score" out of 10, because a single invented score would imply a proprietary methodology SEEABLE doesn't have at MVP and would function as exactly the kind of unearned trust signal P1 warns against.

### 10.4 Photos and watermarking

Every photo uploaded through PB-03 Step 4 is watermarked client-side (browser-side, per `system-architecture.md`) before it's stored — this protects Publishers' photos from being lifted and reused off-platform (a real, named concern in a market this fragmented) without requiring server-side image processing infrastructure the MVP doesn't budget for. The watermark is applied uniformly and is not a Publisher-configurable option at MVP (no custom watermark text/logo) — a **Future Consideration**.

---

## 11. Request UX

### 11.1 The full lifecycle

```
                     ┌────────────┐
   Viewer submits →  │  PENDING   │  ← SLA clock starts (exact trigger: OPEN QUESTION, File 08)
                     └─────┬──────┘
                No response within SLA │  Publisher responds
                           ▼           ▼
                     ┌──────────┐  ┌───────────┐
                     │ EXPIRED  │  │ CONFIRMED │──or──▶ ┌──────────┐
                     └──────────┘  └───────────┘        │ REJECTED │
                                         │               └──────────┘
                              Campaign start date arrives
                                         ▼
                                    ┌────────┐
                                    │  LIVE  │  (system-driven transition, background job)
                                    └───┬────┘
                              Campaign end date passes +
                              Publisher/Admin jointly mark Completed
                                         ▼
                                   ┌───────────┐
                                   │ COMPLETED │
                                   └───────────┘
```

Two entry-to-terminal paths exist for a Pending request that don't reach Confirmed: **Rejected** (Publisher declines, or automatically per the Accept-race resolution in File 04 PB-07) and **Expired** (no response within SLA). Both are terminal — neither reopens.

### 11.2 The core invariant, and why the UI treats it as a first-class concern

`REQUEST-004`: two overlapping Requests for the same hoarding must never both reach Confirmed. This is enforced at the database level (a Postgres `EXCLUDE USING gist` constraint, per `system-architecture.md`) — the strongest possible guarantee, stronger than anything client-side validation alone could offer. Because of this, every screen that lets a Viewer select dates or a Publisher accept a Request is designed around the **assumption that a server-side rejection of an otherwise-valid-looking action is a normal, expected outcome**, not a rare edge case to bolt on later:
- VW-04 (Submit Request) has a named, specific UI state for "these dates were just taken" (File 03).
- PB-07 (Accept) has a named, specific UI state for "this request auto-resolved to Rejected because a competing request was Confirmed first" (File 04).

This reflects P5 (one honest source of availability) directly: the UI never tries to be a second source of truth about what's bookable, only a fast, usually-correct preview of the same server state, with graceful, well-labeled handling on the occasions it's stale.

### 11.3 Status label conventions

Every Request and Listing status is rendered from a server-supplied human label (`status_label`, per `api-specification.md` §16.3) rather than the UI deriving display text from the raw `status` enum value client-side. This matters for two reasons: it keeps copy centrally controlled and consistent (a wording change doesn't require a client release), and it avoids the exact naming collision flagged in File 04 PB-01 (a listing's "Pending Approval" vs. a request's "Pending" reading confusingly similar in a dense dashboard).

### 11.4 What a Request explicitly is not

Every screen that touches a Request (VW-04, VW-05, PB-06, PB-07) carries language reinforcing that a Request is an interest-and-date-hold mechanism, not a payment or contract: no price confirmation step, no "amount charged" field, no invoice. **OPEN QUESTION** (File 08, carried from `request-engine.md`): who captures `amount_agreed` and when — today it is implicitly negotiated off-platform and never enters the UI at all, which this documentation treats as the correct MVP behavior (consistent with "no payment processing at MVP"), but flags because a future in-app record of the agreed amount (even without processing payment) could materially improve dispute-resolution capability for Admin (see §14.3 below).

---

## 12. Inventory Management UX

### 12.1 Two independent state layers

`inventory.md` establishes that a hoarding's visibility is governed by **two independent layers**, and the UI must never conflate them:

1. **Approval pipeline state** (Publisher- and Admin-driven): Draft → Pending Approval → Approved *or* Rejected. Rejected can be edited and resubmitted (loops back to Pending Approval).
2. **Independent boolean flags layered on top of Approved**: **Paused** (Publisher-controlled, reversible, "I'm temporarily not accepting bookings") and **Delisted** (Admin-controlled, a moderation action per `ADMIN-004`).

A listing's actual visibility in Discover is the composite `INVENTORY-003` rule: **Approved AND NOT Paused AND NOT Delisted** (and, per §14.2, the owning Publisher must not be Suspended). Every screen that shows a listing's status (PB-02, AD-02, VW-01) must be able to represent this composite correctly rather than collapsing it to a single misleading label — this is why PB-02 and AD-02 both show a secondary annotation ("Approved (Paused by Publisher)") rather than just the primary pipeline status when a flag is layered on top.

### 12.2 Pause vs. Delete vs. Delist — disambiguated

| Action | Who | Reversible | Effect | Where |
|---|---|---|---|---|
| **Pause** | Publisher | Yes, any time | Hides from Discover; listing remains fully intact and editable | PB-02 action menu |
| **Delete** | Publisher | N/A (destructive) | Removes a listing **only** allowed while it's still in Draft — never after any submission history exists | PB-02 action menu, Draft tab only |
| **Delist** | Admin | Per File 05 AD-02, reversal is an **OPEN QUESTION** | Hides from Discover; independent of Publisher's own Pause state and of Publisher suspension | AD-02 action menu |

The UI never offers a Publisher a "Delete" action on anything beyond Draft, and never offers "Pause" as an undo for a Delist (they're different actors' actions with different authority — a Publisher cannot un-delist their own listing by toggling Pause off, and the UI's disabled/absent-button states make this unambiguous rather than allowing a confusing no-op click).

### 12.3 Edit-freeze behavior

Detailed in File 04 PB-02/PB-04: a listing with `pending_request_count > 0` freezes its commercial fields (price, type, dimensions) to prevent a Publisher from changing terms out from under a Viewer with an active Request. This is a trust mechanism as much as a data-integrity one — it directly supports P1.

---

## 13. Dashboard UX

Both dashboards that exist at MVP (PB-01, AD-01) follow one shared philosophy, applied at two very different scales:

**A dashboard answers "what do I need to do right now," not "show me everything about my data."** Neither dashboard is a BI/analytics surface. This is why PB-01 leads with "Needs Your Attention" above "Recent Activity" (action before information), and why AD-01 is four numbers and nothing else rather than growing into a richer admin BI tool — `admin-platform.md` explicitly scopes it that way, and this documentation resists the natural temptation to "improve" it with charts, trends, or breakdowns that would be genuinely useful in a later product phase but aren't requested for MVP (P2).

The two dashboards differ in urgency framing because the two roles' relationships to the platform differ: a Publisher's dashboard is operationally urgent (an unanswered Request has a ticking SLA with real consequences), so it foregrounds time pressure; an Admin's dashboard is a health check with no per-item urgency of its own (a queue of 4 pending approvals isn't "urgent" the way an individual SLA deadline is) — this is why AD-01 has no countdown/urgency treatment anywhere, while PB-01/PB-06 do.

---

## 14. Admin UX

### 14.1 Why the admin surface is narrow, on purpose

`admin-platform.md` is explicit that SEEABLE's Admin console is intentionally minimal at MVP: verify Publishers, moderate listings (approve/reject/delist), suspend Publishers, and jointly mark Requests Completed. This documentation does not expand that surface with plausible "an admin console would probably also need X" additions — no bulk actions, no payment administration (none exists to administer), no RBAC tiers (single undifferentiated Admin role), no full audit log (AD-05 is explicitly a lightweight feed, not that). Every one of these exclusions is named directly in File 05 AD-* specs rather than left to be silently assumed.

### 14.2 The "Admin can complete but not see" workflow gap

The permission matrix in `api-specification.md` §6.6 confirms a real, currently-unaddressed operational gap: Admin can perform the joint **Mark Completed** action on a Request, but has **no general endpoint to view or list individual Requests** outside of that specific action's context. In practice, this means: if a Viewer contacts SEEABLE support with a dispute about a specific Request (e.g., "the Publisher never delivered the campaign as agreed"), Admin currently has **no screen in this documentation** — or in the underlying API — that lets them look that Request up directly to investigate. AD-01/AD-02 give Admin visibility into Publishers and listings, but not into the Request layer itself beyond the narrow Mark-Completed action surface.

This is surfaced here prominently, not just as a footnote, because it's a genuine pre-launch product risk: a payment-free marketplace whose main dispute-resolution mechanism is "Admin looks at the Request" doesn't actually have that capability yet. This documentation does not invent a Request-inbox screen to paper over the gap (that would be designing past a stated API limitation, which Rule 3 of the master brief prohibits) — instead it is carried forward explicitly as a **flagged operational gap** in File 08, with a recommendation that product/engineering decide whether to add a minimal Admin Request-lookup capability before launch, given the disintermediation and dispute-risk context named throughout `mvp-brd.md`.

### 14.3 What would close the gap (not designed here, named for completeness)

A minimal **Future Consideration**: a read-only Admin Request search/detail view (by hoarding, Publisher, or Viewer) would resolve §14.2 without expanding Admin's *authority* (it wouldn't need to grant new write actions, just visibility) — flagged in File 08 as a candidate for a fast-follow rather than full MVP scope, since it directly serves the platform's own risk-mitigation needs identified in `mvp-brd.md` (disintermediation, dispute handling) rather than being a nice-to-have.

---

*Continue to File 07 for the cross-cutting UX systems — Forms, Tables, Modals & Drawers, Notifications, Loading/Empty/Error States, Access Control, Responsive Design, Accessibility, UX Writing, Media Guidelines, Map/Location UX, and Edge Cases — that every screen in this documentation set relies on.*
