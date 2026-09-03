# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 07 of 9 — Cross-Cutting UX Systems

These are the systems every screen in Files 03–05 was built against. Where an earlier file says "per File 07 §X," this is where that rule actually lives.

---

## 17. Forms

**Validation timing:** field-level validation fires on blur (not on every keystroke, which is noisy, and not only on submit, which delays feedback too long on a multi-field form like PB-03). An exception: password-strength and confirm-password-match fields validate live as the Viewer/Publisher types, since those benefit from immediate feedback more than they're harmed by transient "invalid" states while mid-entry.

**Error display:** inline, directly beneath the offending field, in `danger-700` `caption` text with a small alert icon, and the field border switches to `danger-700`. Never a top-of-form summary list as the *only* error surface (a summary list may be added for long forms as a supplement, but the inline error is mandatory) — a user should never have to hunt for which field a generic "There were errors" banner refers to.

**Required vs. optional marking:** mark **optional** fields explicitly with an "(optional)" label suffix, and leave required fields unmarked (no asterisk clutter) — since in every form in this documentation, most fields are required and only a few are optional (Site Intelligence fields, a Request's message, a Reject reason from a Publisher), marking the minority is less visual noise than asterisking the majority.

**Autosave / progress preservation:** the Add Hoarding wizard (PB-03) is the one form in this documentation long and effortful enough to warrant autosave — progress persists on every step transition, not only on an explicit "Save as Draft" click, so a Publisher who closes the tab mid-Step-3 doesn't lose Steps 1–2. Shorter forms (Submit Request, Sign Up, Account Settings) do not need autosave; their content is quick enough to re-enter if abandoned.

**Multi-step form pattern:** PB-03 is this documentation's one multi-step form and its exemplar pattern: a persistent Stepper, back-navigable without data loss, a final Review step that summarizes every prior step with per-section "Edit" jump links, and a submission-readiness checklist rather than a wall of validation errors sprung only at the final submit click.

**Destructive-adjacent confirmations inside forms:** leaving a form with unsaved changes (closing PB-03, navigating away from a partially-edited Account Settings field) prompts "Save as Draft before leaving?" (PB-03) or a simple "Discard changes?" (short forms) — never a silent loss of input.

---

## 18. Tables

Applies to PB-02 (My Hoardings), PB-06/AD-02's listing tables, AD-02's Publisher table, and AD-05's activity feed (a degenerate single-column table).

**Row density:** default/comfortable density (44px row height minimum on desktop, matching the touch-target minimum even though desktop tables aren't touch — consistency of rhythm matters more than saving vertical space at MVP's inventory scale of 50–200 listings).

**Sorting:** column headers are clickable where a sort is meaningful (Name, Price, Submitted Date) with a small caret indicating direction; default sort is always stated explicitly per table (e.g., PB-06 Pending tab default-sorts by SLA urgency, not submission time — see File 04).

**Pagination:** at MVP's target inventory scale (50–200 listings city-wide, a single Publisher realistically managing single digits to low tens of listings), infinite scroll or simple "Load more" is sufficient — full numbered pagination is unnecessary complexity for lists this size and is not specified. Admin's platform-wide Publisher/Listing tables may grow larger over time; the same "Load more" pattern still applies rather than introducing numbered pages solely for Admin.

**Row actions:** an icon-triggered (⋯) action menu on desktop; on mobile, per File 04 PB-02, action menus expand to a full-width "Manage" affordance rather than a small icon target, per the 44px touch-target accessibility rule (§24.3).

**Responsive collapse:** every table in this documentation collapses to a stacked card list below the `md` breakpoint (768px), preserving the same fields vertically rather than horizontally scrolling a table on a phone (horizontal table scroll on mobile is treated as a pattern to avoid, not a fallback to rely on).

**Empty and loading states:** every table has its own per-filter empty-state copy (never one generic "No data" message reused across every tab — File 04 PB-02 and File 05 AD-02 both specify this), and skeleton rows (not a spinner) while loading, matching the eventual row structure so layout doesn't jump on load-complete.

---

## 19. Modals & Drawers

Four overlay patterns exist in this documentation, and the choice between them follows one decision rule:

| Pattern | Use when | Mobile equivalent | Examples |
|---|---|---|---|
| **Modal** | A single, focused decision with a small, fixed amount of content | Bottom sheet | Submit Request (VW-04), Suspend/Delist confirmations (AD-02) |
| **Drawer** | Richer content, and/or content the user benefits from viewing alongside the list it came from | Full-screen push | Request Detail (PB-07, VW-05 drill-in), Verification Detail (AD-03), Listing Approval Detail (AD-04), Notifications (SH-02) |
| **Confirmation dialog** (a minimal Modal variant) | A single yes/no decision with a consequence that needs spelling out, no form fields | Same, full-width bottom-anchored | Suspend/Delist/Un-suspend (AD-02) |
| **Inline expansion** (not a true overlay) | A small, optional secondary input attached to an action already in view | N/A — same on all breakpoints | Publisher's optional Reject-reason field (PB-07) |

**Rule of thumb:** if closing the overlay should return the user to exactly where they were with no information lost (a list, mid-scroll), and the content is substantial enough to want breathing room, use a Drawer. If the interaction is a single decision that doesn't need the surrounding context visible, use a Modal. Never use a full-page navigation for something reversible and quick (this is why Submit Request is a modal/sheet, not its own screen).

**Stacking:** overlays never stack more than one deep in this documentation — an action inside a Drawer (e.g., Reject from AD-04) opens as an inline expansion within that same Drawer, never a second Modal on top of it.

---

## 20. Notifications

Three distinct notification surfaces exist, and this documentation is precise about which one to use for what, since conflating them is a common source of a noisy or under-informative product:

1. **Toast** — transient (auto-dismiss after ~4 seconds), bottom-center (mobile) / bottom-right (desktop), for confirming the result of an action the user just took in the current screen (e.g., "Request confirmed," a Shortlist-toggle failure). Never used for information the user didn't just cause.
2. **Persistent inline banner** — for an ongoing account-level state that should stay visible until resolved (the "pending verification" banner on PB-01/02/03, File 04 PB-08). Dismissable only where the underlying state can actually change soon; a state like "Rejected — please resubmit" is not dismissable, since dismissing it without acting would hide something the Publisher still needs to do.
3. **In-app Notification Panel (SH-02)** — the durable, revisitable record of everything that happened while the user wasn't looking (a Request status change, a listing approval) — this is the one surface with history; toasts and banners are ephemeral/current-state-only.

**Push/SMS/email channel mix:** `NOTIF-*` rules in `mvp-prd.md` establish the need for out-of-app notification (a Publisher must learn about a new Request even if they're not in the app, given the SLA clock) but do not settle which channel(s) — flagged as an **OPEN QUESTION** in File 08. This documentation's screens are channel-agnostic by design: SH-02 is the single in-app source of truth regardless of which external channel(s) are eventually wired up to alert the user to check it.

**Toast queueing:** if multiple toasts would fire in quick succession, they queue and display one at a time (max 1 visible) rather than stacking, to avoid a cluttered corner of the screen during, e.g., a batch of Shortlist toggles.

---

## 21. Loading, Empty, and Error States

### 21.1 Loading

**Skeleton screens**, not spinners, for any content-bearing view (lists, cards, detail pages) — a skeleton matching the eventual layout's shape (photo blocks, text-line placeholders) reduces perceived wait and prevents layout shift on load-complete. **Spinners** are reserved for actions with no meaningful layout to skeleton (a button's own loading state, a modal's submit action).

### 21.2 Empty

Every empty state in this documentation follows one anatomy: a short, specific headline (never a bare "No data"), one sentence of context or next step, and — where relevant — a single clear action button. No decorative illustrations are used anywhere in this documentation (consistent with P3's "clarity over decoration" and the brief's restrained, high-information-clarity direction) — an empty state is plain text plus, at most, a simple line icon, not a custom illustration. Empty states are **tonally differentiated** by what "empty" means in context: a genuinely neutral empty (My Shortlist, a new account) reads plainly; a positive empty (Admin's approval queue at zero) is framed as good news ("You're all caught up"); a filtered-to-nothing empty (Discover with narrow filters) offers a way out ("Clear filters") rather than just reporting the fact.

### 21.3 Error

Three distinct error categories are used throughout this documentation, and they are never visually or tonally interchangeable:

1. **Validation errors** (user input problem) — inline, at the field, calm tone, tells the user exactly what to fix.
2. **Expected business-outcome states** (not really "errors" at all, even though they arise from a failed action) — the Accept-race and Submit-Request-race states (Files 03/04) are the canonical examples: specific, named, non-alarming copy that explains what happened and what to do next, styled with `warning`/`info` tones rather than `danger` red, since nothing actually went wrong with the system — someone else was simply faster.
3. **System/network errors** (something actually failed) — a retry-affordance pattern: inline for a partial-page failure (a widget or list section that failed to load while the rest of the page is fine), full-page only when nothing on the page could load at all. Copy avoids technical detail ("Something went wrong loading your requests" + [Retry], not an error code or stack trace) but never blames the user.

---

## 22. Access Control UX

**Route guarding:** each role's screens are only reachable while authenticated as that role; a Viewer navigating to a Publisher or Admin URL directly is redirected to their own Discover home, not shown a "403 Forbidden" technical page — the redirect itself is the access-control UX (silent, not punitive, since this is far more likely an old bookmark or a curious click than an attack attempt worth alarming the user over).

**Suspended Publisher access:** a Suspended Publisher can still log in and see their own dashboard/listings (read access preserved) — they are not locked out of the account entirely, only prevented from the specific actions a suspension is meant to block (new listings going live, per `ADMIN-002`). PB-01/PB-02 show a persistent `danger-50` banner: "Your account is suspended. Your listings are hidden from Discover and you can't submit new ones. Contact SEEABLE support for details." Existing Confirmed Requests remain fully visible and manageable (mark-Completed still works), consistent with `ADMIN-002`'s "never cancels Confirmed Requests" guarantee — the UI must not accidentally hide or disable those in a blanket "everything's locked" suspension treatment.

**Unverified Publisher access:** not a restriction in the same sense — an unverified Publisher has full access to build listings, only Submit-for-Approval is gated (File 01 §6.3), so no broad "locked" banner treatment is used, only the narrower Step-6 blocker messaging (File 04 PB-03).

**Field-level access (Admin sees more than Viewer):** rather than the same component silently rendering different fields per role (a maintenance risk and a real disintermediation risk if a projection mistake ever leaked a Publisher's phone number to a Viewer), the public Hoarding/Publisher projection used in VW-* screens and the full projection used in PB-*/AD-* screens are treated as **two distinct data shapes**, not one shape with client-side field-hiding — this mirrors the actual API design (`api-specification.md` §11.2 vs the fuller Publisher/Admin fields) and is called out here explicitly as a UX/engineering handoff point: the disintermediation boundary must be enforced server-side in the API response itself, never only hidden in the UI layer.

---

## 23. Responsive Design

**Breakpoints:** `sm` <640px (mobile), `md` 640–1024px (tablet / narrow desktop), `lg` >1024px (desktop). Admin screens are desktop-only (File 05 note) and do not define a mobile layout.

**Touch targets:** minimum 44×44px for any tappable element on a touch surface, applied consistently (this is why table row actions expand to full-width "Manage" on mobile rather than staying as a small ⋯ icon, per §18).

**Role-appropriate device priority (restated from File 00 §3, applied concretely):** Viewer screens (Files 03) are specified mobile-first, with desktop as an enhancement (multi-column layouts, persistent side panels). Publisher and Admin screens (Files 04–05) are specified desktop-first, with Publisher screens additionally required to degrade gracefully to mobile (since Publishers do need mobile access for Request responses, per source docs), while Admin does not need a mobile mode at all.

**Common adaptation patterns used throughout:** table → stacked card list (§18); modal → bottom sheet, drawer → full-screen push (§19); multi-column dashboard → single stacked column; persistent left rail (Publisher/Admin desktop) → bottom tab bar (Viewer mobile) or a collapsed hamburger-free simplified top bar (Publisher mobile, since Publisher's nav has more items than fit a bottom bar — a "More" overflow is used rather than forcing all of Dashboard/My Hoardings/Requests/Account into 4 bottom-tab slots).

---

## 24. Accessibility

**Target:** WCAG 2.1 Level AA across the product. Every color pairing specified in File 02 §9.1 was checked against this bar; component states specified throughout Files 03–06 (focus rings, error states, status pills) were designed with it as a constraint, not an afterthought applied at the end.

**24.1 Color:** never the sole carrier of meaning — every status pill, every SLA-urgency cue, every calendar-cell state pairs color with text or icon (§10.3/§10.6 in File 02; restated at point of use in Files 03–05).

**24.2 Keyboard and focus:** every interactive element is reachable and operable by keyboard alone; modals/drawers trap focus while open and return it to the triggering element on close; the visible focus style is a 2px `gold-700` outline with offset (File 02 §10.1/§10.2) — never `outline: none` without a replacement, a common and specifically prohibited anti-pattern in this documentation.

**24.3 Touch targets:** 44×44px minimum, per §23.

**24.4 Screen reader support:** semantic HTML first (real `<button>`, `<table>`, `<nav>`, `<dl>` elements over generic `<div>`s with ARIA bolted on); live regions (`aria-live="polite"`) for state changes that occur without a page navigation (VW-04's success/error swap, a toast appearing, an SLA countdown's static equivalent per File 03 VW-05); accessible names on every icon-only control (Shortlist heart, notification bell, table row action menu).

**24.5 Motion:** the only motion specified anywhere in this documentation is functional (card lift on hover, drawer slide-in, toast appearance) at the `--duration-fast`/`--duration-base` tokens from File 02 — no decorative animation. All motion respects `prefers-reduced-motion` (transitions collapse to instant state changes, no slide/fade, for users who've set that preference).

**24.6 Forms:** every input has a real, visible, programmatically-associated `<label>` (§17; placeholder-as-label is explicitly avoided, per File 04 PB-03/File 05 AUTH-* as the pattern to follow everywhere).

---

## 25. UX Writing Guidelines

**Tone:** plain, factual, calm — never hype, urgency-manufacturing, or salesy language (P1, P3). "Available from 15 Sep," not "Only 1 spot left, book now!" This applies even in Admin's own copy (destructive-action confirmations spell out real consequences, never manufacture drama).

**Capitalization:** sentence case for all UI text — headings, button labels, field labels, status names as displayed (e.g., "Pending approval" in prose, though the Status Badge component (File 02 §10.3) itself may render the exact enum-derived label as supplied by `status_label`, which should itself be authored in sentence case at the source).

**Buttons:** verb-first, specific, never generic. "Submit for Approval," not "Submit"; "Send Request," not "OK"; "Delist," not "Confirm." A Cancel/secondary action is always literally labeled "Cancel" (not "No" or "Back," which are ambiguous about what they cancel).

**Errors:** state what happened, in plain language, then what to do — never blame the user, never show a raw system/error code in front-end copy. "These dates were just booked by another advertiser," not "Conflict: 409."

**Numbers, currency, dates:** currency in ₹ with Indian digit grouping (₹85,000, ₹1,40,000 — not ₹85000 or ₹140,000) throughout every screen and example in this documentation, matching real Indian conventions. Dates in absolute form with month name (15 Sep 2026), never ambiguous numeric-only formats (15/09/26 could be misread by a US-convention reader as 9 Oct); relative time ("2 hours ago") is supplementary only, alongside an absolute equivalent, never the sole representation of a deadline (File 03 VW-05's SLA rule, generalized here).

**Status-name collisions:** as flagged in File 06 §11.3, a Listing's "Pending Approval" and a Request's "Pending" must never be shortened to the same bare word "Pending" in any UI copy where both could plausibly appear together (dashboards, notifications) — always qualify ("listing pending approval" vs. "request pending").

---

## 26. Image & Media Guidelines

**Aspect ratio:** 16:9 for the primary Hoarding Card thumbnail and carousel hero image (consistent grid rhythm across Discover); additional detail-page photos may be any aspect ratio within a constrained max-height, shown in the carousel.

**Minimum count:** 3 photos minimum to enable listing Submission (File 04 PB-03 Step 4, flagged as a UX ASSUMPTION/Open Question on the exact number).

**Watermarking:** applied automatically, client-side, on every upload (File 06 §10.4) — never a Publisher-toggleable option at MVP.

**Alt text:** every photo requires an accessible text equivalent; where a Publisher supplies a caption at upload, that caption is reused as alt text; otherwise, a generated fallback ("[Hoarding name] photo N of N") is used rather than leaving alt text empty (File 03 VW-03 §Accessibility).

**Broken/failed image handling:** a failed-to-load photo shows a neutral `surface-2` placeholder block with a small icon (not a broken-image browser glyph, not a blank hole in the layout) — applies to any card or carousel position throughout the app.

**File constraints:** exact max file size/format (JPEG/PNG/WebP, size cap) is an implementation detail not specified at the UX level in reviewed source docs — a reasonable engineering default (e.g., 10MB/file, common web formats) should be applied and surfaced as a clear inline hint at the upload control, per §17.

---

## 27. Map & Location UX

**Map style:** per the theme reconciliation in File 02 §8, the map uses a **light**, minimal basemap consistent with the rest of the light product — not the "Dark Gold" dark-themed map style seen in the reference screenshot, which belongs to the separate dark marketing-site identity. Markers and clusters use the `gold-700`/`ink-900` tokens exactly as specified in File 03 VW-02.

**Precision, deliberately:** unlike marketplaces for private spaces (which often fuzz an exact location until after booking), a hoarding is a fixed piece of physical infrastructure visible to anyone standing on the street — there is no privacy rationale for obscuring its exact pin, and doing so would actively harm the product's core promise of letting a Viewer assess a specific site before committing. **This documentation shows the precise map pin to every Viewer at every stage**, pre- and post-Request, with no gated/approximate-then-precise pattern. This is stated explicitly because it's the kind of "obviously good UX pattern from an adjacent industry" that would be a mistake to copy here without checking it against what OOH advertising actually is.

**Location permission:** requested only when the Viewer actively engages a location-dependent feature (the Distance filter, "Use my current location" on the map) — never on app load as an unprompted permission dialog. Denial degrades gracefully to city-wide/default-centered behavior (File 03 VW-01/VW-02 States) rather than blocking any part of Discovery.

**Geocoding/search:** Location text search in Discovery (§9.1) is a simple text match against stored location strings, not a full geocoding-powered "search this address and show a radius" feature at MVP — the latter is a reasonable enhancement, not a redesign, if added later.

---

## 28. Edge Cases

A consolidated reference table for QA. Each row restates, in one place, an edge case specified in context somewhere in Files 03–06.

| Edge case | Where handled | Resolution |
|---|---|---|
| Two Viewers try to Request overlapping dates simultaneously | File 03 VW-04 | Server-side re-validation at submit; loser sees a named, non-alarming "dates just taken" state, input preserved |
| Publisher Accepts a Request whose dates were just Confirmed elsewhere | File 04 PB-07 | Auto-resolves to Rejected server-side (`REQUEST-004`); Publisher sees a specific explanatory state, Viewer is notified |
| A Pending Request's SLA expires while a Publisher has the detail screen open | File 06 §11 | Background job transitions status to Expired; UI should reflect fresh status on next fetch/focus rather than allow a stale-state Accept — an in-flight Accept against an already-Expired request is rejected server-side with the same race-handling pattern as above |
| Publisher is Suspended while holding Confirmed Requests | File 07 §22 | Confirmed Requests unaffected and remain fully manageable (`ADMIN-002`); only new listing visibility/Submission is blocked |
| A hoarding is Delisted while sitting in a Viewer's Shortlist | File 03 VW-06 | Remains visible in Shortlist with a "No longer available" overlay rather than silently disappearing; Viewer removes it manually |
| A hoarding's type doesn't cleanly fit one taxonomy category ("fits two types") | File 06 §10.1 (flagged) | Not resolved by any source doc; **OPEN QUESTION** (File 08) — this documentation's working assumption is the Publisher picks the closer-fitting type at listing time, and Admin can Reject with a reason if miscategorized, since no "listing type" edit-after-creation flow is designed (type is set at PB-03 Step 1 and not revisited in PB-04's edit mode per this documentation's scope) |
| Network loss during Submit Request / Accept / Approve actions | Not previously stated — new here | The action button's loading state should be idempotency-safe (a retried submit must not create a duplicate Request/duplicate approval) — an implementation requirement more than a UX one, but the UI-visible consequence (a hung loading button, then a clear success or error resolution, never a silent double-submission) is specified here as the required visible behavior |
| Timezone handling | Not previously stated — new here | Single-city (Bengaluru) MVP: all dates/times are treated and displayed in IST throughout, with no timezone selector or indicator needed anywhere in the product |
| A Publisher edits a listing's non-frozen fields (e.g., description) while it simultaneously receives a new Request that would freeze commercial fields | File 06 §12.3 | The edit-freeze check is evaluated at save time, not only at page-load time, so a save attempt on a now-frozen field fails gracefully with an explanatory message rather than silently succeeding against stale page state |
| A brand-new Publisher account with zero listings | File 04 PB-01 | Dashboard shows a single "Add your first hoarding" prompt in place of the normal 4-metric-card empty state, not four zero-value cards |

---

*Continue to File 08 for the governance sections: UX Decision Log, Requirement-to-UX Traceability Matrix, Final Screen Inventory, UX Quality Audit, consolidated Open Questions & UX Assumptions, and Future UX Considerations.*
