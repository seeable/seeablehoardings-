# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 03 of 9 — Page-by-Page UI Specifications: Viewer Screens

Every screen follows the same template: Purpose, Primary User, Entry Points, Exit Points, Layout, Wireframe Description, Components Used, Content, Interactions, States, Responsive Behavior, Accessibility, Business Rules, API/Data Dependencies. Design tokens and components referenced below are defined in File 02.

---

## VW-01 — Discover (Marketplace Browse)

**Purpose:** The Viewer's home screen and primary discovery surface — browse, search, and filter the full catalog of Approved, visible hoardings in Bengaluru.

**Primary User:** Viewer (e.g., Aarav Patel).

**Entry Points:** Post-login default landing page; bottom-nav "Discover" tab from anywhere in the app; brand logo tap (returns home).

**Exit Points:** Hoarding Card tap → VW-03 Hoarding Detail; Map toggle → VW-02; Shortlist heart tap → adds/removes from VW-06 without leaving the screen; bottom nav → VW-05/VW-06/Account.

**Layout:**
- *Mobile (primary):* Sticky top search bar with filter icon → horizontal scrollable filter-chip row (Type, Budget, Distance) → vertical single-column feed of Hoarding Cards → bottom tab bar.
- *Desktop:* Left filter sidebar (persistent, 280px) + main content area as a responsive card grid (2–3 columns) with a sort control top-right ("Newest", "Price: Low to High", "Price: High to Low") and a Map/List view toggle top-right.

**Wireframe Description:** Top bar reads "Discover" (`h1`) with a search input beneath it (placeholder: "Search by location, e.g. Hosur Road"). Filter chips: "All Types", "Unipole", "Gantry", "Wall Wrap", "Bus Shelter", "Digital" (disabled/grayed with a "Coming soon" tooltip per digital-type MVP scope, see File 06 §9), "Budget", "Distance from me". Below, a card grid: e.g. **Premium Unipole — Hosur Road** (₹85,000/month, Namma Outdoor Media ✓ Verified, "Available from 15 Sep"), **Silk Board Gantry** (₹1,40,000/month, Namma Outdoor Media ✓, "Available now"), **Indiranagar Wall Wrap** (₹45,000/2 weeks, Bangalore Ad Spaces, no badge, "Available now"), **Hebbal Flyover Unipole**, **Koramangala Bus Shelter**. Result count shown above the grid ("142 hoardings in Bengaluru").

**Components Used:** Search input, filter chips, Hoarding Card (§10.4), sort dropdown, view toggle, bottom tab bar / left rail.

**Content:** Real example listings as above. Copy tone: plain, factual, no promotional language ("Available from 15 Sep", not "Book now before it's gone!") — consistent with P1 (trust before transaction) and the UX Writing Guidelines in File 07.

**Interactions:** Typing in search live-filters by location text match (debounced, ~300ms) against hoarding name/area. Tapping a filter chip opens a bottom sheet (mobile) or inline popover (desktop) with the relevant control (type checklist, a budget dual-handle slider, a distance radius selector — distance requires location permission, see States below). Multiple filters combine with AND logic. Sort reorders in place without a full page reload.

**States:**
- *Loading:* skeleton Hoarding Cards (photo block + 3 text-line placeholders) — see File 07 §Loading States.
- *Empty (no results for current filters):* illustration-free empty block: "No hoardings match these filters. Try widening your budget or distance." + a "Clear filters" button. See File 07 §Empty States.
- *Empty (zero listings exist yet, e.g. new market/demo seed gap):* "New hoardings are added here as Publishers list them — check back soon."
- *Location permission denied (Distance filter):* Distance filter chip shows a disabled state with helper text "Enable location to filter by distance" rather than silently failing.
- *Error (network/API failure):* inline retry block, not a full-page error (the rest of a partially-loaded page, if any, is preserved). See File 07 §Error States.

**Responsive Behavior:** Filter sidebar (desktop) collapses into the filter-chip-row-plus-bottom-sheet pattern (mobile) at the `md` breakpoint (768px). Card grid: 1 column <640px, 2 columns 640–1024px, 3 columns >1024px.

**Accessibility:** Search input has an associated `<label>` (visually hidden if using placeholder-as-label pattern is avoided per File 07 §Accessibility rule against placeholder-only labels — an actual visible label is preferred, positioned as a compact overline above the field). Filter chips are real toggle buttons (`aria-pressed`), not divs. Card grid is a semantic list (`<ul><li>`) so screen readers announce item count. Color is never the only signal for availability — "Available from 15 Sep" is always text, badge color is supplementary.

**Business Rules:** Only listings satisfying `INVENTORY-003` (Approved AND not Paused AND not Delisted, and Publisher not Suspended) appear here — this is a server-side filter, not a client-side hide, so no flash-of-hidden-content occurs. Digital-type hoardings (data-model-only at MVP) are excluded from results entirely, not shown-then-hidden (per File 06 §9 Future Consideration scoping).

**API/Data Dependencies:** Public hoarding list projection per `api-specification.md` §11.2 (narrow `publisher{id, business_name, is_verified}` fields only — never phone/email/full_name, per the disintermediation boundary in File 00 §3.4). Search/sort/pagination mechanics (page size, cursor vs. offset paging, exact relevance ranking) are not specified in source docs — flagged as an **OPEN QUESTION** in File 08.

---

## VW-02 — Discover: Map View

**Purpose:** Let a Viewer see hoardings geographically — critical for OOH, where "is this on my target commute route" matters more than a text address.

**Primary User:** Viewer.

**Entry Points:** Map/List toggle on VW-01 (state persists as a user preference within session).

**Exit Points:** Marker tap → info card → "View Details" → VW-03. Toggle back to List → VW-01.

**Layout:** Full-bleed map (MapLibre + OpenStreetMap tiles, per `system-architecture.md`/`seeable_free_first_techstack.md`) with the same filter-chip row floating at the top and a bottom sheet that peeks up showing a horizontally-scrollable strip of compact Hoarding Cards synced to the visible map bounds (tapping a card highlights its marker, and vice versa).

**Wireframe Description:** Map centered on Bengaluru by default (or the Viewer's current location if permitted). Markers use `gold-700` pins with a small type-icon inside (unipole/gantry/wall-wrap glyphs), clustering into a numbered `ink-900` circle when zoomed out over dense areas (e.g., an Outer Ring Road cluster). Tapping a marker pops a compact card (photo, name, price, Verified badge) anchored above the pin.

**Components Used:** Map component (custom, not in §10 library since it's a single-purpose element — style rules only: `gold-700` markers, `ink-900` clusters, `surface-1` popup cards with `shadow-md`), filter chips, compact Hoarding Card variant.

**Content:** Same live dataset as VW-01, geographically plotted — e.g., **Silk Board Gantry** and **Hebbal Flyover Unipole** appear as distinct pins along the Outer Ring Road corridor, useful for a Viewer evaluating that specific commute route.

**Interactions:** Pan/zoom standard map gestures; filters applied here narrow the same result set as VW-01 (shared state, not a separate filter set); "Use my current location" button re-centers and (with permission) enables the Distance filter.

**States:** Loading (map tile skeleton + spinner), no results in current viewport ("No hoardings in this area — try zooming out"), location permission denied (map still works, centered on Bengaluru default, no error blocking the map itself), offline/tile-load failure (fallback message, does not crash the shell).

**Responsive Behavior:** Mobile: bottom sheet as described. Desktop: map on the right ~65% of viewport, a persistent list column on the left ~35% (map and list visible simultaneously — desktop doesn't need the List/Map toggle at all, only mobile does, since screen real estate allows both).

**Accessibility:** Map interactions are inherently pointer-centric; the synced list/bottom-sheet is the accessible-equivalent path (fully keyboard-and-screen-reader navigable) to every hoarding shown on the map — a screen-reader user is never limited to map-only content. Marker popups are reachable via the list, not solely by pointing at the map.

**Business Rules:** Same `INVENTORY-003` visibility filter as VW-01, plus (per File 00) coordinates now confirmed present in the schema (`latitude`/`longitude`) for every listed hoarding, so no listing is silently un-plottable.

**API/Data Dependencies:** Same public hoarding projection as VW-01, plus lat/long. Exact map provider tile source and clustering thresholds are implementation details owned by `system-architecture.md`, not redesigned here.

---

## VW-03 — Hoarding Detail

**Purpose:** The single most decision-critical screen in the Viewer journey — everything a Viewer needs to decide "is this the right hoarding for my campaign" and to act on that decision.

**Primary User:** Viewer.

**Entry Points:** Hoarding Card tap from VW-01, VW-02, or VW-06 (Shortlist).

**Exit Points:** Back → returns to the entry screen preserving scroll position/filters; "Request This Hoarding" → VW-04 modal; Shortlist heart toggle (no navigation); Publisher business name tap → does **not** navigate anywhere (no public Publisher profile page exists at MVP — the name is a text label with an adjacent Verified badge only, per the disintermediation boundary; this is intentional, not a missing link).

**Layout:**
- *Mobile:* vertical scroll — photo carousel (full-bleed) → sticky mini price/CTA bar appears on scroll-past-fold → name/location/type/price block → Publisher identity row → Site Intelligence panel → full description → Availability calendar → sticky bottom "Request This Hoarding" button.
- *Desktop:* two-column — left ~60% photo carousel + description + Site Intelligence + calendar; right ~40% sticky summary card (name, price, Publisher identity, primary CTA) that stays in view while the left column scrolls.

**Wireframe Description:** Example content for **Premium Unipole — Hosur Road**: photo carousel (4–6 watermarked images), `h1` "Premium Unipole — Hosur Road", location line with map-pin icon "Hosur Road, near Electronic City signal, Bengaluru", type + size chips ("Unipole", "20ft × 10ft"), price "₹85,000 / month", Publisher row "Namma Outdoor Media ✓ Verified", Site Intelligence panel with labeled stats (Traffic Volume: "High — arterial road", Visibility Rating: "Excellent — unobstructed, well-lit", Nearby Landmarks: "Electronic City Signal, 200m from Infosys gate"), full free-text description, Availability calendar (component from §10.6), sticky CTA.

**Components Used:** Photo carousel, chip, Publisher identity chip with Verified badge (§10.3), Site Intelligence stat block, Availability Calendar (§10.6), Shortlist toggle (heart icon button), sticky CTA bar/button.

**Content:** As above; description copy example: "Highly visible unipole facing southbound traffic on Hosur Road, one of Bengaluru's busiest arterial corridors connecting Electronic City to the city center. Steady vehicular and pedestrian footfall throughout the day, with peak visibility during evening commute hours."

**Interactions:** Carousel swipe/arrow navigation; tapping a Site Intelligence stat has no drill-down (it's display-only data, not a sub-page); calendar date-range selection feeds directly into the Request CTA (selecting a valid range changes the sticky button label to "Request 15–30 Sep" from a generic "Request This Hoarding," giving immediate feedback that the selection registered); Shortlist toggle is optimistic (instant visual change, syncs in background, reverts silently with a toast on failure — see File 07 §Notifications).

**States:**
- *Loading:* full skeleton matching the layout blocks above.
- *Partial data (Site Intelligence fields not fully filled in by Publisher):* per `api-specification.md` §11.3's partial-data-omission rule, only the Site Intelligence fields the Publisher actually provided are shown — an unfilled field is omitted entirely from the panel rather than shown as "Not provided" or a blank row, keeping the panel from looking broken or incomplete-by-neglect. If **no** Site Intelligence fields are provided at all, the entire panel is omitted, not shown empty.
- *Unavailable Publisher scenario (rare, race condition — hoarding delisted or Publisher suspended between list-load and detail-open):* a full-width inline banner: "This hoarding is no longer available." with a "Back to Discover" action, replacing the CTA area — the rest of the (cached) content can still render informationally but nothing is actionable.
- *Fully booked (no open date ranges within a reasonable look-ahead window):* CTA area shows "Fully booked through [date]" instead of the Request button, calendar still visible for transparency.

**Responsive Behavior:** As described in Layout — the sticky summary card (desktop) and sticky bottom CTA bar (mobile) both exist specifically so the primary action is always reachable without re-scrolling on a screen this content-dense.

**Accessibility:** Carousel is keyboard-navigable (arrow keys) with visible focus states and alt text per photo (Publisher-entered caption if provided, else a generic "[Hoarding name] photo N of N"); Site Intelligence stats are a definition list (`<dl>`), not a purely visual grid, so relationships (label → value) survive to screen readers; calendar cells are individually focusable/announced with their state ("15 September, available" / "16 September, booked").

**Business Rules:** Publisher fields shown are exactly `business_name` + `is_verified` (File 00 §3.4). `submission_readiness`/internal-only fields from the Publisher-side API shape are never rendered here (this is the public projection). Availability reflects the same server-side truth as the Request flow — no client-side-only "looks available" state that the server would then reject (P5).

**API/Data Dependencies:** Public hoarding detail shape per `api-specification.md` §11.2/§11.3, including the `site_intelligence` partial-omission behavior and the public `publisher{id,business_name,is_verified}` projection. Availability data sourced from the same Request/Availability source of truth referenced in File 06 §Request UX — not a separately cached "listing availability summary" that could drift from it.

---

## VW-04 — Submit Request

**Purpose:** Convert interest into a structured, trackable Request — the platform's core transaction primitive, explicitly not a payment or binding booking.

**Primary User:** Viewer.

**Entry Points:** "Request This Hoarding" / "Request 15–30 Sep" sticky CTA on VW-03.

**Exit Points:** Submit → confirmation state → auto-dismiss or manual close → returns to VW-03 with an inline "Request sent — track it in My Requests" confirmation, or deep-links directly to VW-05 (configurable; this documentation specifies returning to VW-03 with the inline confirmation, since the Viewer likely wants to keep browsing other candidates before checking status). Cancel/close (×) → returns to VW-03, selection preserved.

**Layout:** Modal (desktop, centered, `radius-xl`) / full-height bottom sheet (mobile) — per File 07 §Modals vs. Drawers, this is a focused single-decision flow so it uses the Modal pattern's mobile equivalent (bottom sheet), not a full-page navigation.

**Wireframe Description:** Title "Request Premium Unipole — Hosur Road". Date range field (pre-filled from the calendar selection on VW-03, still editable via an inline calendar re-opener). A "Message to Publisher" textarea, optional, placeholder: "e.g., Launching a skincare brand campaign, flexible on exact start date by a few days." A read-only summary line restating the listing name, Publisher business name + Verified badge, and price, so the Viewer confirms what they're requesting before sending. Primary button: "Send Request". Small print beneath the button: "This sends an interest request — it does not charge you or guarantee the booking. [Publisher name] will confirm availability and pricing details directly."

**Components Used:** Modal/bottom sheet shell, date-range input (reusing the Calendar component in read+edit mode), textarea, summary block, primary button.

**Content:** As above — the disclaimer line is deliberately explicit per P1/P6 (this is a genuinely novel mental model for anyone used to instant-booking travel/events apps, and mislabeling it risks real trust damage).

**Interactions:** Changing the date range re-validates against current availability live (in case time passed since VW-03 loaded); submitting shows a brief loading state on the button (not a full-modal spinner) then either the success state or a specific error state (see below).

**States:**
- *Success:* modal content swaps in-place to a confirmation: a `success-700` check icon, "Request sent to Namma Outdoor Media", "You'll be notified when they respond — usually within [SLA duration placeholder, see Business Rules]." + "View in My Requests" / "Done" buttons.
- *Validation error (message too long, date range invalid):* inline field-level errors, standard form pattern (File 07 §Forms).
- *Server rejection — dates no longer available (race condition, e.g. someone else's Request was Confirmed in the seconds since VW-03 loaded):* this is treated as an **expected, named failure**, not a generic error — the modal shows: "These dates were just booked by another advertiser. [Message to Publisher] wasn't sent." with a "Choose different dates" button that reopens the calendar within the same modal, preserving the typed message so the Viewer doesn't lose their work. See File 07 §Edge Cases.
- *Server error (generic/network):* standard retry pattern, message preserved.

**Responsive Behavior:** Bottom sheet on mobile occupies up to ~85% of viewport height with the summary/CTA always visible without scrolling past the fold when the keyboard is open for the textarea (the textarea and button are never both off-screen simultaneously — a common mobile-form failure this spec calls out explicitly).

**Accessibility:** Focus moves into the modal on open and is trapped within it (standard modal a11y); the disclaimer text is real paragraph text (not a tooltip-only disclosure) so it's always available to assistive tech; success/error state changes are announced via an `aria-live` region since the modal's content swaps in place rather than navigating.

**Business Rules:** Creates a Request in status **Pending**. Server-side re-validates the no-overlap invariant at submit time regardless of what the client believed was available (`REQUEST-004`) — this is why the race-condition state above is a first-class, designed state and not an afterthought. The exact SLA duration shown in the confirmation copy is an **OPEN QUESTION** (File 08) — until settled, use the non-committal phrasing above rather than inventing a specific number of hours.

**API/Data Dependencies:** Creates a Request resource per `api-specification.md` §16.3 (`sla_deadline` populated server-side on creation). Does **not** collect or transmit any Viewer contact field beyond what the account already has (`full_name`, used only in the Publisher's view of this Request) — no phone/email re-entry, per the disintermediation boundary.

---

## VW-05 — My Requests

**Purpose:** Let a Viewer track every Request they've submitted, across its full lifecycle, without needing to remember which hoarding or ask the Publisher directly.

**Primary User:** Viewer.

**Entry Points:** Bottom nav "My Requests" tab; "View in My Requests" from VW-04 success state; a Request-status push/in-app notification.

**Exit Points:** Request row tap → detail drill-in (same screen, expands/pushes a detail panel — not a separate screen ID, per the IA principle of keeping drill-ins non-top-level); "View Hoarding" from detail → VW-03.

**Layout:** Status filter tabs at top (**All**, **Pending**, **Confirmed**, **Live**, **Completed**, **Rejected/Expired** — the last two grouped into one tab since both are "didn't proceed" outcomes a Viewer scans together) → vertical list of Request Cards (§10.4) → tap opens a detail panel (drawer on desktop, full-screen push on mobile).

**Wireframe Description:** Example rows: **Hosur Road Unipole** — Confirmed, "15–30 Sep 2026", Namma Outdoor Media ✓; **Silk Board Gantry** — Pending, "SLA: respond by [date/time]"; **Indiranagar Wall Wrap** — Rejected, "Bangalore Ad Spaces declined this request." Detail panel for the Pending example additionally shows the original message sent and a plain-language explainer of what Pending means and what happens next (see Content below).

**Components Used:** Tabs (§10.5), Request Card (§10.4), status pill (§10.3), detail drawer (§10.7).

**Content:** Status explainer copy (shown in the detail panel, not just the pill, per P4 "state is always visible + explained"):
- *Pending:* "Waiting for Namma Outdoor Media to respond. They'll confirm availability and pricing directly with you."
- *Confirmed:* "Your campaign is booked for 15–30 Sep 2026. Coordinate creative and installation details directly with Namma Outdoor Media."
- *Rejected:* "Bangalore Ad Spaces declined this request. You can browse similar hoardings nearby."
- *Live:* "Your campaign is currently running (15–30 Sep 2026)."
- *Completed:* "This campaign ran 1–15 Aug 2026 and has been marked complete."
- *Expired:* "This request wasn't answered in time and has expired. You're welcome to submit a new request."

**Interactions:** Tab switch filters the list client-side if already loaded, or re-fetches (implementation detail); no Viewer-initiated cancel/withdraw action exists on a Pending request (see Business Rules) — the detail panel for Pending shows no destructive action at all, only informational content, so the absence of a "Cancel" button is a deliberate design choice, not an oversight to flag visually.

**States:** Loading (skeleton rows), Empty ("You haven't requested any hoardings yet — browse Discover to find your first one." + a "Browse Discover" button), Error (retry pattern).

**Responsive Behavior:** Detail panel is a right-side drawer on desktop (list stays visible alongside it) and a full-screen push with a back arrow on mobile (list-detail can't coexist on a small screen).

**Accessibility:** Tabs are a proper tablist (`role="tablist"`/`tab`/`tabpanel`) with arrow-key navigation; SLA countdowns (if shown as live-updating text) also have a static, screen-reader-friendly equivalent ("Respond by 6:00 PM, 2 Sep" rather than only a decrementing "3h 12m left" that's noisy for assistive tech — see File 07 §Accessibility for the general live-region rule).

**Business Rules:** No Viewer-side cancel/withdraw of a Pending Request is designed here because no source document (`mvp-prd.md`, `request-engine.md`) describes this capability — flagged as an **OPEN QUESTION** in File 08 rather than silently added or silently declared impossible.

**API/Data Dependencies:** Request resource list/detail per `api-specification.md` §16.3, including `status`, `status_label` (server-supplied human label, preferred over client-side status-string mapping so copy stays centrally controlled), `sla_deadline`, and embedded `hoarding`/`publisher` summary objects (narrow projection, same disintermediation boundary as VW-03).

---

## VW-06 — My Shortlist

**Purpose:** A lightweight personal comparison list — the MVP's answer to "I'm evaluating several hoardings before I commit to requesting one."

**Primary User:** Viewer.

**Entry Points:** Bottom nav "Shortlist" tab; heart-icon toggle on any Hoarding Card (VW-01, VW-02, VW-03).

**Exit Points:** Card tap → VW-03; heart toggle (remove) → stays on screen, card animates out.

**Layout:** Same card grid pattern as VW-01 (no separate list/map toggle needed here — it's a small, curated set, not a browse surface), with a persistent header "Your Shortlist (4)".

**Wireframe Description:** Grid of previously-shortlisted Hoarding Cards, e.g. **Premium Unipole — Hosur Road**, **Silk Board Gantry**, **Koramangala Bus Shelter** — same card component as Discover, so no new visual pattern is introduced for a feature this small.

**Components Used:** Hoarding Card (§10.4), empty state block.

**Content:** N/A beyond the shortlisted items themselves.

**Interactions:** Removing the last item empties the screen into the Empty state below; no reordering, notes, or comparison-table view is designed at MVP (`mvp-prd.md` scopes Shortlist as a simple save-list, not a comparison tool) — a side-by-side comparison table is named explicitly as a **Future Consideration** in File 08, not built here.

**States:** Loading (skeleton grid), Empty ("Nothing shortlisted yet. Tap the heart on any hoarding to save it here for later." + "Browse Discover" button), a shortlisted hoarding that becomes unavailable after being saved (delisted/suspended-publisher/fully booked) still appears in the Shortlist but with a "No longer available" badge overlay instead of being silently removed — removing it silently would be confusing ("where did it go?"); the Viewer removes it manually once they notice.

**Responsive Behavior:** Same grid breakpoints as VW-01.

**Accessibility:** Heart toggle button has an accessible name that changes with state (`aria-pressed`, "Remove from Shortlist" / "Add to Shortlist" — not just a icon with no label).

**Business Rules:** Purely client-account-scoped data; no interaction with the Request or Availability system beyond reflecting a hoarding's current visibility state.

**API/Data Dependencies:** A Shortlist entity/endpoint is implied by `mvp-prd.md`'s scope but not detailed in the sections of `api-specification.md` reviewed for this documentation — treated here as a simple Viewer-scoped save-list (hoarding ID + saved timestamp), the minimal shape consistent with the feature's scope.

---

*Continue to File 04 for the full page-by-page UI specification of every Publisher screen.*
