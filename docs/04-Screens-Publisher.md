# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 04 of 9 — Page-by-Page UI Specifications: Publisher Screens

Same template as File 03. Publisher is desktop-first; layouts describe desktop first, mobile second (reverse of the Viewer file, reflecting each role's real primary device per File 00 §3).

---

## PB-01 — Publisher Dashboard

**Purpose:** Landing screen giving a Publisher an instant read on their inventory health and anything needing action today.

**Primary User:** Publisher (e.g., Namma Outdoor Media's inventory manager).

**Entry Points:** Post-login default; left-rail "Dashboard" item.

**Exit Points:** Metric cards and activity rows deep-link to My Hoardings (PB-02) or Requests (PB-06) filtered to the relevant subset.

**Layout:** Left rail (persistent) + main content: a metric-card row (4 cards) followed by a two-column split — "Needs Your Attention" list (left, wider) and "Recent Activity" feed (right, narrower).

**Wireframe Description:** Metric cards: "Active Listings" (e.g., 5), "Pending Approval" (e.g., 1), "Open Requests" (e.g., 2 — tappable, deep-links to PB-06 filtered Pending), "This Month's Confirmed Campaigns" (e.g., 3). "Needs Your Attention" surfaces the two things a Publisher must act on: Requests approaching their SLA deadline (e.g., "Silk Board Gantry — request from Aarav Patel, respond by 6:00 PM today") and any listing rejected by Admin needing edits. "Recent Activity" is a simple reverse-chronological feed: "Your request for Indiranagar Wall Wrap was Confirmed", "Premium Unipole — Hosur Road was approved by SEEABLE".

**Components Used:** Dashboard Metric Card (§10.4), list rows with a small status pill, activity feed rows.

**Content:** As above, using the canonical example dataset.

**Interactions:** Each metric card and attention-list row is clickable, deep-linking with the correct filter pre-applied (e.g., "Pending Approval" card → PB-02 filtered to that tab).

**States:** Loading (skeleton metric cards + rows), Empty (a brand-new Publisher with zero listings sees a single prominent "Add your first hoarding" prompt replacing the whole dashboard body rather than four zero-value metric cards, which would read as broken/discouraging), Error (retry pattern, cards degrade to "—" rather than blocking the page).

**Responsive Behavior:** Metric cards: 4-across desktop, 2×2 tablet, stacked single column mobile. Two-column attention/activity split stacks vertically on mobile (attention list first, since it's actionable).

**Accessibility:** Metric cards are landmarks with a clear heading hierarchy (`h2` "Overview" above the card row); numbers are never color-only indicators of good/bad (e.g., "Pending Approval: 1" uses neutral styling, not implicitly alarming red, since a Pending Approval count on its own isn't a problem state).

**Business Rules:** "Pending Approval" here refers to the Publisher's own listing(s) awaiting Admin review — not to be confused with Request status "Pending" shown in "Open Requests"; the dashboard's own labels are written to avoid this ambiguity (see File 07 §UX Writing Guidelines for the general status-naming-collision rule).

**API/Data Dependencies:** Aggregated counts drawn from the Publisher's own listing and Request collections (`api-specification.md` §11/§16, scoped to the authenticated Publisher). No new aggregate/analytics endpoint is designed here beyond simple counts already derivable from those two resource lists.

---

## PB-02 — My Hoardings

**Purpose:** The Publisher's full inventory list, organized by status — the operational home base for managing every listing.

**Primary User:** Publisher.

**Entry Points:** Left rail "My Hoardings"; dashboard deep-links.

**Exit Points:** "+ Add Hoarding" → PB-03; row tap → PB-04 (Edit) for Draft/Rejected, or a read-only detail/PB-05 (Calendar) for Approved listings — see Interactions; row action menu → Pause/Unpause, Delete Draft, or "View Calendar".

**Layout:** Status tabs (**All, Draft, Pending Approval, Approved, Paused, Rejected, Delisted** — mirroring the exact states from `inventory.md`) → a table (desktop) / card list (mobile) → "+ Add Hoarding" primary button top-right.

**Wireframe Description:** Table columns: Photo thumbnail, Name, Type, Status pill, Price, Pending Requests count (a small numeral badge — this is the `pending_request_count` field from `api-specification.md` §11.3, surfaced specifically because it explains *why* a listing might be edit-frozen), Last Updated, action menu (⋯). Example rows: **Premium Unipole — Hosur Road** (Approved, ₹85,000/mo, 1 pending request), **Silk Board Gantry** (Approved, ₹1,40,000/mo, 2 pending requests), **Hebbal Flyover Unipole** (Draft, —), **Indiranagar Wall Wrap** (Rejected — reason: "Photos too low-resolution to verify condition"), **Koramangala Bus Shelter** (Paused).

**Components Used:** Tabs (§10.5), data table (behavior detailed in File 07 §Tables), status pill, action menu.

**Content:** As above.

**Interactions:** Row click on Draft/Rejected → reopens PB-03 wizard shell pre-filled at the Review step (fast path back to fixing and resubmitting). Row click on Approved/Paused → a read-only summary view with a prominent "View Calendar" button to PB-05 (editing an Approved listing is possible but is a deliberate secondary action via the action menu, not the default click target, because most visits to an Approved row are "check its calendar," not "edit it"). Action menu "Pause"/"Unpause" toggles the Publisher-controlled visibility flag instantly (optimistic UI). Action menu "Delete" is only available for Draft (never for a listing that has ever been submitted — deleting a listing with any request history is not supported, only Pause/Delist, per `inventory.md`'s Pause/Delete/Delist disambiguation).

**States:** Loading (skeleton table rows), Empty per-tab ("No draft hoardings" etc. — each tab has its own empty copy, not one generic message), Empty overall (new Publisher — see PB-01's empty-dashboard note, which supersedes this screen's own empty state on a brand-new account), Error (retry pattern).

**Responsive Behavior:** Table → stacked cards below `md` breakpoint, each card showing the same fields vertically with the action menu as a full-width "Manage" button instead of an icon-only ⋯ (icon-only tap targets at 24px are too small/ambiguous on touch — File 07 §Accessibility touch-target rule).

**Accessibility:** Table has proper `<th scope="col">` headers; status pills retain text; the pending-requests count badge has an accessible label ("1 pending request") rather than a bare numeral in a colored circle.

**Business Rules:** A listing with `pending_request_count > 0` shows `is_edit_frozen: true` (per `api-specification.md` §11.3) for its core commercial fields (price, type, dimensions) — the Edit entry point still opens, but those specific fields are shown read-only with an inline note: "This listing has an active request — commercial details are locked until it's resolved, to keep pricing consistent for the requester." Non-commercial fields (photos, description) may still be editable; the exact frozen-field boundary beyond price/type/dimensions is an **OPEN QUESTION** (File 08) since source docs establish the concept but not the precise field list.

**API/Data Dependencies:** Publisher's own listing collection, full (non-public) projection per `api-specification.md` §11.2/§11.3 including `is_edit_frozen`, `pending_request_count`, `submission_readiness`.

---

## PB-03 — Add Hoarding Wizard

**Purpose:** Guided, type-aware listing creation — the single highest-effort task in the Publisher journey, so it is deliberately linear, saves progress at every step, and never loses work.

**Primary User:** Publisher.

**Entry Points:** "+ Add Hoarding" (PB-02); "Edit" action on a Draft/Rejected listing reopens the same shell (this is PB-04, sharing 100% of this spec except pre-filled values and an "Editing" title state).

**Exit Points:** "Save as Draft" (any step) → PB-02, Draft tab. "Submit for Approval" (Step 6 only) → PB-02, Pending Approval tab. "×" close → confirms if unsaved changes exist ("Save as Draft before leaving?").

**Layout:** Full-screen focused flow (left rail suspended) with a horizontal step indicator (Stepper component, §10 — six segments, current step filled `gold-500`/`ink-900`, completed steps show a check, future steps `ink-300`) and persistent "Save as Draft" (secondary) + "Back"/"Continue" (secondary/primary) footer buttons.

### Step 1 — Type
**Wireframe:** A grid of 8 type cards (icon + label): Unipole, Gantry/Overhead Gantry, Wall Wrap, Hoarding/Billboard (static large-format), Street Furniture (Bus Shelter, etc.), Pole Kiosk *(exact 6th static type name per `inventory.md`'s taxonomy — labeled generically here as the taxonomy's own naming should be used verbatim in build)*, and two Digital types (Digital Screen, Digital Gantry) shown with a "Coming Soon" tag and a disabled "Select" state plus a tooltip: "Digital listings can be saved as a draft now — full publishing support is coming soon" — consistent with File 06 §9's data-model-only scoping. Selecting a static type enables "Continue."

### Step 2 — Details
**Wireframe:** Fields render dynamically based on Step 1's type (per `api-specification.md` §11.5's data-driven `required_attribute_keys`) — e.g., selecting Unipole shows Height, Facing Direction, Illumination (Yes/No), while Wall Wrap shows Wall Dimensions and Surface Material. Common fields regardless of type: Hoarding Name (e.g., "Premium Unipole — Hosur Road"), Description (textarea), Size/Dimensions. **UX ASSUMPTION:** the size field's unit (feet vs. meters) is not specified in source docs — this documentation specifies feet, as the de facto Indian OOH industry standard, with the unit label always shown next to the input, flagged in File 08.

### Step 3 — Location
**Wireframe:** Address search input (autocomplete) + an interactive map for precise pin placement/drag-adjustment, capturing `latitude`/`longitude`. Below the map, Site Intelligence fields: Traffic Volume (select: Low/Medium/High), Visibility Rating (select: Fair/Good/Excellent), Nearby Landmarks (free text, e.g., "Electronic City Signal, 200m from Infosys gate"). All Site Intelligence fields are optional (consistent with VW-03's partial-data-omission display rule) but a helper note encourages completion: "Listings with Site Intelligence details get more Requests."

### Step 4 — Media
**Wireframe:** Drag-and-drop / tap-to-upload photo grid, each thumbnail showing an upload-progress ring then a check once watermarked (browser-side watermarking is applied automatically and shown as a brief "Watermarking…" state per photo, consistent with `system-architecture.md`). **UX ASSUMPTION:** a minimum of 3 photos is required to enable Step 6's Submit action (flagged as an **OPEN QUESTION** in File 08, since no source doc states an exact minimum) — fewer than 3 is allowed for Draft saves, just not for Submit.

### Step 5 — Pricing & Availability
**Wireframe:** Base Rate input (₹, with a unit selector: "/month" or "/2 weeks" — matching the rate-structures implied by example content across source docs) + an initial Availability Calendar (§10.6) defaulted to "Available from today," editable to block out any known-unavailable dates upfront (e.g., existing offline commitments). **UX ASSUMPTION (flagged, File 08):** this step's exact content wasn't captured in the reference screenshots (which showed steps 1,2,3,4, and 6 only) — grouping pricing with initial availability here is the minimum reasonable content for a step between Media and Review that a Review screen would need to summarize.

### Step 6 — Review
**Wireframe:** Full read-only summary of all prior steps, grouped under mini-headings matching Steps 1–5, each with an "Edit" link that jumps back to that step without losing later-step data. Below the summary, a **Submission Readiness** checklist rendered from `submission_readiness.blockers[]` (per `api-specification.md` §11.3) — e.g., if fewer than 3 photos: "☐ Add at least 2 more photos"; if Publisher not yet verified: "☐ Your account must be verified before this listing can go live — you can still save as Draft." The primary button reads **"Submit for Approval"**, disabled until `blockers` is empty and the Publisher is verified (secondary "Save as Draft" is always enabled regardless of blockers, per the journey-level UX ASSUMPTION in File 01 §6.3).

**Components Used (all steps):** Stepper, type-selection cards, dynamic form fields (§10.2 Inputs), map pin picker, Site Intelligence inputs, photo upload grid, price input, Availability Calendar, review summary block, checklist.

**Interactions:** "Save as Draft" is available and functional from every step, not just at the end — the wizard is designed so a Publisher can start on desktop, get interrupted, and resume later without any data loss (auto-save on step transition, not only on explicit Save click, is recommended — flagged as a build recommendation, not a hard requirement, since offline/network-loss handling specifics belong to engineering).

**States:** Field-level validation errors (inline, on blur — File 07 §Forms), upload failure per-photo (retry affordance on that thumbnail only, doesn't block other uploads), Step 6 blockers list (as above), a resubmission-after-rejection state where Step 6 additionally shows Admin's rejection reason prominently at the top ("SEEABLE noted: Photos too low-resolution to verify condition — please review before resubmitting").

**Responsive Behavior:** Fully usable on mobile (the Publisher persona does sometimes list on the go, per source docs' "mobile access for Requests" note, and listing creation shouldn't be desktop-locked even though desktop is primary) — steps stack single-column, map picker becomes full-screen on tap for precision, Stepper collapses to a compact "Step 3 of 6: Location" text + progress bar instead of 6 visible segments.

**Accessibility:** Each step is its own labeled region (`aria-label="Step 3 of 6: Location"`); the map pin picker has a manual lat/long text-entry fallback for users who cannot use drag interactions; the Stepper's current step is announced on step change via a live region.

**Business Rules:** `AUTH-002` verification gate (Step 6 Submit disabled if unverified — see File 01 §6.3 UX ASSUMPTION for the Draft-while-pending allowance); dynamic required fields per hoarding type (`api-specification.md` §11.5); Digital types are draft-only at MVP (File 06 §9).

**API/Data Dependencies:** Creates/updates a Hoarding resource per `api-specification.md` §11.2/§11.3; reads the hoarding-type-reference endpoint (§11.5) to render Step 2's dynamic fields and Step 1's `is_listable` flag (used to grey out the two digital types); `submission_readiness` drives Step 6's checklist directly rather than the UI re-deriving completeness rules client-side (single source of truth for "is this submittable").

---

## PB-04 — Edit Hoarding

Shares 100% of PB-03's specification (same wizard shell, pre-filled with existing values, page title "Edit [Hoarding Name]" instead of "Add Hoarding"). The only behavioral difference: fields governed by `is_edit_frozen` (see PB-02 Business Rules) render read-only with the inline lock note when `pending_request_count > 0`, and the primary Step 6 button reads "Save Changes" (for an Approved listing being lightly edited) or remains "Submit for Approval" (if editing a Draft/Rejected listing that hasn't been approved yet).

---

## PB-05 — Availability Calendar

**Purpose:** A dedicated, full-size view of one hoarding's calendar — where a Publisher manages availability day-to-day, independent of the once-off wizard.

**Primary User:** Publisher.

**Entry Points:** "View Calendar" from PB-02 row or PB-01 dashboard deep-link.

**Exit Points:** Back → PB-02.

**Layout:** Page header with the hoarding name and a compact status pill, then the full month-grid Calendar component (§10.6) at a larger scale than the inline versions on VW-03/VW-04, with month-forward/back navigation and a legend (Available / Requested-hold / Booked / Past).

**Wireframe Description:** Example: **Premium Unipole — Hosur Road**, September 2026 grid, showing 1–14 as Booked (`ink-300`, an existing Confirmed request), 15–30 as Available, with a small side list below the grid: "Upcoming: Confirmed, 1–14 Sep — Aarav Patel-style Viewer example — [Viewer's full_name shown here, e.g., 'Rohan Mehta']."

**Components Used:** Calendar (§10.6), month navigator, upcoming-bookings side list.

**Content:** As above.

**Interactions:** Publisher can manually block dates (e.g., for maintenance) by selecting an Available range and choosing "Mark Unavailable" — this does not create a Request, it's a direct availability edit, visually similar to Booked but distinguishable via a different fill pattern (`ink-300` solid vs. a `ink-300` diagonal-hatch for "Publisher-blocked" — this distinction matters so a Publisher can tell their own maintenance block apart from an actual paying campaign at a glance).

**States:** Loading (skeleton grid), a hoarding with zero bookings ever (calendar shows fully Available, no side list — the side list section is omitted entirely rather than shown empty).

**Responsive Behavior:** Full month grid remains usable on mobile at a reduced cell size; the side list stacks below.

**Accessibility:** Same calendar-cell announcement pattern as §10.6; manually-blocked dates announce as "16 September, unavailable (blocked by you)" — distinct wording from "booked" so the Publisher's own screen-reader experience isn't ambiguous about whose action caused the block.

**Business Rules:** A Publisher cannot manually block dates that already have a Confirmed Request on them (the UI prevents selecting Booked cells at all, consistent with `REQUEST-004`).

**API/Data Dependencies:** Same availability source as VW-03/PB-02's `pending_request_count`, plus a Publisher-side availability-block mechanism whose exact endpoint shape is not detailed in the reviewed `api-specification.md` sections — treated as the minimal reasonable extension of the Hoarding resource's availability data, not a new subsystem.

---

## PB-06 — Incoming Requests

**Purpose:** The Publisher's action queue for every Request submitted against any of their listings.

**Primary User:** Publisher.

**Entry Points:** Left rail "Requests"; dashboard "Open Requests" metric card; a new-Request notification.

**Exit Points:** Row tap → PB-07 detail drawer.

**Layout:** Status tabs (**Pending, Confirmed, Live, Completed, Rejected, Expired**) → Request Card list, Pending tab sorted by SLA urgency (soonest deadline first) by default rather than by submission time, since urgency is the operationally important ordering here.

**Wireframe Description:** Example Pending row: "Silk Board Gantry — Request from Rohan Mehta — 15–30 Sep 2026 — Respond by 6:00 PM today" with the SLA countdown rendered in `warning-700` once inside a final-hours window (e.g., under 4 hours remaining) to visually distinguish urgent items, `ink-700` otherwise.

**Components Used:** Tabs, Request Card (§10.4), SLA countdown text.

**Content:** As above.

**Interactions:** Row tap opens PB-07; no bulk-accept/reject exists (out of scope, matches Admin's own no-bulk-actions scoping — consistency across roles).

**States:** Loading, Empty per-tab, Error (retry).

**Responsive Behavior:** List/detail pattern identical to VW-05 (drawer desktop, full-screen push mobile).

**Accessibility:** SLA urgency is signaled by color **and** the explicit countdown text, never color alone.

**Business Rules:** Only Requests targeting this Publisher's own listings ever appear — no cross-Publisher visibility.

**API/Data Dependencies:** Request resource list scoped to Publisher, per `api-specification.md` §16.3, including `available_actions[]` (server-recommended action set — e.g., `["accept","reject"]` for Pending, `["mark_completed"]` for Live past end-date) which the UI uses to decide which buttons to render on PB-07 rather than re-deriving allowed actions from status client-side.

---

## PB-07 — Request Detail (Publisher view)

**Purpose:** Full context on a single Request plus the Accept/Reject/Mark-Completed decision surface.

**Primary User:** Publisher.

**Entry Points:** PB-06 row tap.

**Exit Points:** Accept/Reject → returns to PB-06 with the row now reflecting new status; back arrow/× → PB-06 unchanged.

**Layout:** Drawer (desktop right-side, mobile full-screen push) with: header (hoarding name + status pill), Viewer identity block, requested date range, Viewer's message, and an action footer whose buttons are driven by `available_actions[]`.

**Wireframe Description:** Example: "Silk Board Gantry" / Pending pill. "Requested by Rohan Mehta." "Dates: 15–30 Sep 2026." "Message: 'Launching a skincare brand campaign, flexible on exact start date by a few days.'" Footer: [Reject] (destructive-outline) [Accept] (primary).

**Components Used:** Status pill, identity block, date-range display, message block, action buttons.

**Content:** As above.

**Interactions:** [Accept] → confirmation is **not** a separate modal (a single deliberate primary action on an already-focused detail view doesn't need a second confirmation layer, unlike Admin's Suspend/Delist which carry heavier consequences) — clicking Accept directly transitions status, shows a brief success toast ("Request confirmed — 15–30 Sep is now booked"), and returns to the list. [Reject] opens a lightweight inline expansion (not a full modal) with an **optional** reason textarea (per the UX ASSUMPTION in File 01 §7.3 that a reason is not required of a Publisher, unlike Admin) and a "Confirm Rejection" button.

**States:** The Accept-race failure state (server rejects because the range was Confirmed elsewhere in the interim, per `REQUEST-004`) — shown as a specific, named error, not generic: "These dates were just confirmed for a different request. This request has been automatically marked Rejected — [Viewer] has been notified." (Per `request-engine.md`, an overlapping Pending request that can no longer be honored once another is Confirmed for the same range is expected to resolve to Rejected, not remain indefinitely Pending — the UI reflects that resolution transparently rather than leaving the Publisher confused about a request that silently vanished.) A Live/past-end-date Request shows a single [Mark Completed] button instead of Accept/Reject, matching `available_actions`.

**Responsive Behavior:** Standard drawer/push pattern.

**Accessibility:** The reason textarea (Reject) is clearly optional in its label ("Reason (optional)") so its absence isn't read as an incomplete required field.

**Business Rules:** `REQUEST-004` no-overlap invariant enforced server-side on Accept; Reject reason optional (Publisher) vs. mandatory (Admin, `ADMIN-003`) — this asymmetry is intentional per source docs' differing rules for the two roles and is called out again in File 08 as a named, deliberate inconsistency worth a future product look, not a build error.

**API/Data Dependencies:** Request resource detail + transition actions per `api-specification.md` §16.3; all transitions execute through the SECURITY DEFINER Postgres functions noted in `system-architecture.md`, so the UI's job is strictly to call the right action and render the server's resulting state/error — never to compute the next status client-side.

---

## PB-08 — Publisher Verification

**Purpose:** Collect and track the identity/business verification Admin requires before a Publisher can submit listings for approval (`AUTH-002`).

**Primary User:** Publisher.

**Entry Points:** Prompted automatically right after signup; reachable anytime via Account settings (SH-01, File 05); surfaced as a banner on PB-01/PB-02/PB-03 while pending or if rejected.

**Exit Points:** Submit → returns to wherever the Publisher came from, now showing a "Verification Pending" banner state.

**Layout:** Simple single-column form: Business Name, Business Type (select), a document upload (business registration/ID proof — exact required document types are an implementation/legal detail not specified in the UX-relevant source docs; treat as a generic "Upload verification document" field), Contact Phone, Contact Email.

**Wireframe Description:** "Verify Your Business" `h1`, brief explainer ("SEEABLE verifies Publishers to build trust with advertisers. This usually takes 1–2 business days." — **UX ASSUMPTION:** the "1–2 business days" figure is illustrative copy, not a committed SLA; no source doc states a verification turnaround time, flagged in File 08), form fields as above, [Submit for Verification] primary button.

**Components Used:** Form inputs, file upload, banner (persistent state component, reused wherever verification status needs surfacing).

**States:**
- *Not started:* form as above, full-page or first-run modal (implementation choice — either works; specify as a full page for consistency with other Account-adjacent screens).
- *Pending:* form replaced by a status block: "Verification submitted — under review." Persistent banner variant: a slim `warning-50` bar at the top of PB-01/02/03: "Your account is pending verification. [Learn more]."
- *Verified:* status block: a `success-700` check + "Verified" + submission date. No banner (verified is the steady, unremarkable state — it should recede once achieved, not keep announcing itself).
- *Rejected:* status block shows Admin's reason and a "Resubmit" button reopening the form pre-filled.

**Responsive Behavior:** Single-column form scales naturally; no special breakpoints needed.

**Accessibility:** File upload has a clear accepted-format/size hint and a text-equivalent status ("business_license.pdf uploaded" rather than only a thumbnail).

**Business Rules:** `AUTH-002` — a Publisher cannot Submit a listing for Admin approval while unverified, but per the File 01 §6.3 UX ASSUMPTION, can still fully build and Save-as-Draft listings during this period. Whether Publisher login itself uses the OTP-deferred demo variance documented for Viewers is unresolved — flagged as an **OPEN QUESTION** in File 08; this screen is written to be agnostic to that (it's a post-login verification step regardless of how login itself works).

**API/Data Dependencies:** A Publisher verification resource/state is implied by `AUTH-002` and `admin-platform.md`'s verification queue but not detailed at the field level in the reviewed `api-specification.md` sections — the fields above represent the minimal reasonable set, not an invented rich KYC flow.

---

*Continue to File 05 for the full page-by-page UI specification of every Admin screen and the shared Auth/Account screens.*
