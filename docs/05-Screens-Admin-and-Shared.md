# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 05 of 9 — Page-by-Page UI Specifications: Admin Screens + Shared Auth/Account Screens

Same template as Files 03–04. Admin is desktop-only (per File 00 §3.3) — no mobile layout is specified for AD-* screens; a narrow-viewport visit shows a plain "SEEABLE Admin is designed for desktop use" notice rather than a broken responsive attempt.

---

## AD-01 — Admin Overview Dashboard

**Purpose:** A narrow, 4-metric operational snapshot — deliberately not a full BI dashboard, matching `admin-platform.md`'s explicit scope boundary.

**Primary User:** Admin (e.g., Priya, SEEABLE Operations).

**Entry Points:** Post-login default; left rail "Overview."

**Exit Points:** Each metric deep-links to the relevant filtered view on AD-02.

**Layout:** Left rail + a single row of 4 metric cards, no charts, no date-range picker, no secondary breakdowns — intentionally minimal.

**Wireframe Description:** Four cards, matching `admin-platform.md`'s scoped metric set: **Pending Publisher Verifications** (e.g., 2), **Pending Listing Approvals** (e.g., 4), **Active Publishers** (e.g., 37), **Live Campaigns** (e.g., 12 — Requests currently in Live status platform-wide). Below the cards, nothing else — no additional widgets are added even though a real admin dashboard might "want" more, per P2 (MVP-first, not MVP-small).

**Components Used:** Dashboard Metric Card (§10.4).

**Content:** As above.

**Interactions:** Card click → AD-02 pre-filtered (e.g., "Pending Listing Approvals" → AD-02, Listings sub-view, Pending Approval filter active).

**States:** Loading (skeleton cards), zero-state (e.g., "Pending Publisher Verifications: 0" is shown plainly as "0," not hidden — an admin needs to see a genuine all-clear, not an absent card that could be mistaken for a loading failure).

**Responsive Behavior:** N/A — desktop-only per above.

**Accessibility:** Standard heading hierarchy; counts are real text, not canvas/image-rendered numbers.

**Business Rules:** This is the complete admin dashboard scope per `admin-platform.md` — no request-level detail, no revenue/GMV figures (none exist, MVP has no payments), no audit log entry point from here.

**API/Data Dependencies:** Simple counts derived from existing Publisher/Hoarding/Request collections, scoped platform-wide (Admin-level access) rather than per-owner as in the Publisher dashboard. No new analytics endpoint required beyond these four counts.

---

## AD-02 — Publishers & Inventory Management

**Purpose:** Admin's single working screen for both Publisher-level actions (verify, suspend) and listing-level actions (approve, reject, delist) — combined into one screen because, per the reference screenshots and `admin-platform.md`'s narrow scope, Admin's entire moderation job fits comfortably in one list-based view rather than needing separate sections.

**Primary User:** Admin.

**Entry Points:** Left rail "Publishers & Inventory"; AD-01 metric deep-links.

**Exit Points:** Verify action → AD-03 (modal/drawer); Approve/Reject action → AD-04 (modal/drawer); Suspend/Delist → inline confirmation modals (specified here directly, since they're simple confirmations rather than full drill-in screens).

**Layout:** A top-level toggle between two sub-views sharing the same page chrome: **Publishers** and **Listings**. Each sub-view has its own status tabs and table, consistent with the table pattern established in PB-02.

**Wireframe Description — Publishers sub-view:** Tabs: **All, Pending Verification, Verified, Suspended.** Table columns: Business Name, Contact info (Admin *is* permitted to see full contact details — the disintermediation boundary applies to Viewer↔Publisher visibility, not to Admin, which needs contact info to operate), Verification Status pill, Listings Count, Joined Date, action menu. Example rows: **Namma Outdoor Media** (Verified, 5 listings), **Bangalore Ad Spaces** (Pending Verification, 2 listings, both currently Draft since they can't submit yet).

**Wireframe Description — Listings sub-view:** Tabs: **All, Pending Approval, Approved, Rejected, Delisted.** Table columns: Photo thumbnail, Name, Publisher, Type, Status pill, Submitted Date, action menu. Example rows: **Silk Board Gantry** (Pending Approval, Namma Outdoor Media), **Indiranagar Wall Wrap** (Rejected — "Photos too low-resolution to verify condition," Bangalore Ad Spaces).

**Components Used:** Sub-view toggle (segmented control), tabs, data table, status pill, confirmation modal (§10.7).

**Content:** As above.

**Interactions:**
- Publishers row, Pending Verification → action menu "Review Verification" → AD-03.
- Publishers row, Verified → action menu "Suspend" → confirmation modal (see Flow 7.4, File 01): *"Suspend Namma Outdoor Media? This will immediately hide all 5 of their listings from Discover and block new Requests. Already-Confirmed Requests will NOT be cancelled — those campaigns continue as planned."* [Cancel] [Suspend Publisher] (destructive-outline).
- Publishers row, Suspended → action menu "Un-suspend" → simpler confirmation ("Restore Namma Outdoor Media's listings to Discover?"). **OPEN QUESTION** (File 08): source docs describe the Suspend action (`ADMIN-002`) but not an explicit reversal/un-suspend flow — this documentation includes it as the minimum reasonable counterpart to a reversible-sounding action, flagged for confirmation.
- Listings row, Pending Approval → "Review" → AD-04.
- Listings row, Approved → action menu "Delist" → confirmation modal: *"Delist Silk Board Gantry? This removes it from Discover immediately and is independent of Namma Outdoor Media's account status."* [Cancel] [Delist] (destructive-outline).
- Listings row, Delisted → action menu "Re-list" (**OPEN QUESTION**, same reasoning as un-suspend above — `ADMIN-004` describes delisting but not a documented reversal path).

**States:** Loading (skeleton table), Empty per-tab ("No listings pending approval — you're all caught up." — a positive framing for an empty moderation queue, since empty here is good news, unlike an empty Viewer search which is neutral/negative), Error (retry).

**Responsive Behavior:** Desktop-only (see file header note).

**Accessibility:** Segmented control (Publishers/Listings) is a proper `radiogroup` or `tablist`; every destructive action requires an explicit confirmation modal with the consequence spelled out in plain language (never a bare "Are you sure?") per P4/P6.

**Business Rules:** `ADMIN-002` (Suspend never cancels Confirmed Requests), `ADMIN-004` (Delist is independent of Publisher suspension state), `INVENTORY-003` (composite visibility — this screen is where an Admin can see *why* a listing isn't visible: e.g., an Approved-but-Paused-by-Publisher listing shows a small secondary "(Paused by Publisher)" note next to its Approved status pill, since "Approved" alone would misleadingly suggest it's currently live in Discover). **OPEN QUESTION carried from source docs:** whether suspending a Publisher should cascade to delist their listings is explicitly flagged in `admin-platform.md` as a literal-reading gap (it currently does not cascade) that may be unintended — this documentation implements the literal (non-cascading) rule as specified, with the confirmation-modal copy above making that behavior explicit to the Admin performing the action, and restates the question in File 08 rather than silently "fixing" it with an assumption.

**API/Data Dependencies:** Publisher and Hoarding admin-scoped list/detail projections (full fields, unlike the public Viewer-facing projection) per `api-specification.md` §11; Suspend/Verify/Delist actions per the permission matrix in §6.6, which confirms Admin has no listing-edit endpoint at all (`admin-platform.md`'s "edit for moderation only" language is not matched by an actual API capability) — this documentation therefore does **not** design an "Admin edits listing content" interaction anywhere, only approve/reject/delist, correctly reflecting that gap rather than designing past it.

---

## AD-03 — Publisher Verification Detail

**Purpose:** The focused review surface for a single pending Publisher verification.

**Primary User:** Admin.

**Entry Points:** AD-02 "Review Verification" action.

**Exit Points:** Approve/Reject → returns to AD-02, Publishers sub-view, row updated.

**Layout:** Modal or right-drawer (drawer preferred, per File 07 §Modals vs. Drawers, since it involves reviewing a document — more content than a typical confirmation modal comfortably holds).

**Wireframe Description:** Business Name, Business Type, submitted document (viewable/downloadable), Contact Phone, Contact Email, Submitted Date. Footer: [Reject] (opens inline reason field, required) [Approve].

**Components Used:** Drawer, document viewer/download link, action buttons, required reason field (Reject).

**Interactions:** Reject requires a non-empty reason (this is a *Publisher verification* rejection, not a listing rejection — `ADMIN-003` specifically covers listing rejection reasons; requiring a reason here too is a **UX ASSUMPTION** applying the same trust-and-clarity logic consistently, flagged in File 08 since source docs state the listing-rejection-reason rule explicitly but don't separately restate it for verification rejection).

**States:** Standard form-validation state for the required Reject reason.

**Business Rules:** Approving unlocks the Publisher's ability to Submit listings (`AUTH-002` gate lifted).

**API/Data Dependencies:** Publisher verification resource, admin-scoped, per the minimal shape described in PB-08.

---

## AD-04 — Listing Approval Detail

**Purpose:** The focused review surface for a single pending listing — effectively the same content a Viewer would eventually see, plus Admin-only context.

**Primary User:** Admin.

**Entry Points:** AD-02 "Review" action.

**Exit Points:** Approve/Reject → returns to AD-02, Listings sub-view, row updated.

**Layout:** Drawer, structured identically to VW-03's content blocks (photos, details, Site Intelligence, pricing, calendar) plus an Admin-only header strip (Publisher name + verification status, Submitted Date).

**Wireframe Description:** Same content blocks as VW-03 for **Silk Board Gantry**, with an Admin header: "Submitted by Namma Outdoor Media ✓ Verified — 30 Aug 2026." Footer: [Reject] (opens required reason field) [Approve].

**Components Used:** Same content blocks as VW-03 (reused, not redesigned), drawer, required reason field.

**Interactions:** Approve is a single click (no secondary confirmation — matching PB-07's reasoning that a single deliberate action on an already-focused review screen doesn't need a second confirmation layer). Reject requires a reason (`ADMIN-003`, mandatory) before the [Confirm Rejection] button enables.

**States:** Same partial-Site-Intelligence-data omission behavior as VW-03 — Admin sees exactly what a Viewer would eventually see for that panel, which is precisely the point of reusing the content blocks (Admin should review what will actually be published, not a separate richer internal view that could drift from what goes live).

**Business Rules:** `ADMIN-003` (reason mandatory on reject). Approve transitions the listing directly to Approved/visible (no further step).

**API/Data Dependencies:** Same Hoarding resource, admin/full projection per `api-specification.md` §11.3.

---

## AD-05 — Activity Log

**Purpose:** A lightweight recent-events feed — explicitly **not** a full audit log (`admin-platform.md` names a full audit log as out of MVP scope).

**Primary User:** Admin.

**Entry Points:** Left rail "Activity."

**Exit Points:** None (terminal, reference-only screen); entries are not individually clickable beyond a plain-text description (no drill-down detail view is designed, consistent with the "lightweight" scoping).

**Layout:** A simple reverse-chronological list, no filters, search, or export (all would imply audit-log-grade capability beyond MVP scope).

**Wireframe Description:** Rows like: "Namma Outdoor Media's listing 'Silk Board Gantry' was approved — 31 Aug 2026, 10:14 AM." / "Bangalore Ad Spaces was verified — 30 Aug 2026, 4:02 PM." / "Koramangala Bus Shelter was delisted — 29 Aug 2026, 2:47 PM."

**Components Used:** Simple list rows (timestamp + plain-language description), no table, no pills (status pills would imply filterable/actionable content this screen doesn't offer).

**Content:** As above — every entry describes a completed Admin action, written in plain past-tense language, not a raw event-log format (`actor.action(target)`), since this is a human-readable feed, not a debugging tool.

**States:** Loading (skeleton rows), Empty ("No activity yet"), pagination or infinite scroll for older entries (implementation detail).

**Responsive Behavior:** Desktop-only.

**Accessibility:** Standard list semantics; timestamps in a consistent, unambiguous format (absolute date + time, not only relative "2 hours ago," per File 07 §UX Writing Guidelines).

**Business Rules:** Explicitly not a compliance-grade audit log (no immutability guarantee, no per-field change history, no export) — `admin-platform.md` and `README.md` both flag a real audit log as a gap/future need; this screen fills only the "what recently happened" glance need, nothing more, per P2.

**API/Data Dependencies:** A simple recent-events feed; exact backing mechanism (dedicated events table vs. derived from state-transition timestamps across resources) is an implementation detail not specified in the reviewed source sections.

---

## Shared Screens

### AUTH-01 — Landing / Marketing Entry

**Purpose:** The first screen anyone (logged out) sees — establishes brand and routes to Login or Signup.

**Primary User:** Prospective Publisher or Viewer, not yet authenticated.

**Entry Points:** Direct URL / app open, logged-out state.

**Exit Points:** [Log In] → AUTH-02; [Sign Up] → AUTH-03.

**Layout:** Full-bleed hero section (headline in `display`/Anton per §9.2, brief sub-headline, two CTAs) — per the theme-reconciliation decision in File 02 §8, this uses the **light** system end-to-end, not the dark marketing reference.

**Wireframe Description:** Headline example: "Bengaluru's outdoor advertising, in one place." (plain, descriptive — not the more abstract "MAKE EVERY LOCATION SEEABLE" line from the dark reference, since that copy's tone was paired with a dark, moodier visual system; a light, high-clarity system calls for equally plain, high-clarity headline copy per P3). Sub-headline: "Discover, compare, and request hoardings, unipoles, and street furniture from verified Publishers across the city." [Log In] (secondary) [Sign Up] (primary) buttons.

**Components Used:** Hero layout, primary/secondary buttons.

**States:** N/A (static marketing content; no data dependency).

**Responsive Behavior:** Hero stacks vertically on mobile, headline scales down (`display` 48px desktop → 32px mobile, still Anton, still a single scale step down rather than switching typefaces).

**Accessibility:** Headline is a real `<h1>`; sufficient contrast maintained even with a background image/texture behind the Anton headline (a light scrim if a background photo is used, verified ≥4.5:1 the same way as the rest of the palette).

**Business Rules:** None (public marketing surface).

**API/Data Dependencies:** None.

---

### AUTH-02 — Log In

**Purpose:** Authenticate an existing user (Publisher or Viewer — Admin is not reachable from this public entry point, per File 00 §3.3).

**Layout:** Centered single-column card on the light background: Email/Mobile field, Password field, [Log In] primary button, "Forgot password?" link, "New here? Sign up" link.

**Content:** Matches the **current demo build's** password-based approach (File 00 §3.6), not the OTP target end-state — a field-level note is intentionally *not* shown to end users explaining this is a demo variance (that's an internal/documentation-only distinction, not user-facing copy).

**States:** Invalid credentials (inline error, generic "Incorrect email/mobile or password" — never reveals which field was wrong, standard security practice), account locked/rate-limited (if implemented — not specified in source docs, not designed further here), loading (button shows spinner).

**Responsive Behavior:** Card is full-width with margins on mobile, fixed ~400px centered on desktop.

**Accessibility:** Password field has a show/hide toggle with an accessible label; form submits on Enter key.

**Business Rules:** Role is determined by the account, not chosen at login — successful login routes directly to PB-01 or VW-01 based on the account's role.

**API/Data Dependencies:** Standard email/mobile + password auth per Supabase Auth (`seeable_free_first_techstack.md`). The OTP step (AUTH-002 target end-state) is not built in this screen's current spec — flagged as a **Future Consideration** slot: the layout reserves room for an OTP-entry state to be inserted between credential entry and successful login without a redesign, but that state is not specified further here since it isn't in the current demo build.

---

### AUTH-03 — Sign Up

**Purpose:** New account creation, with an explicit role choice up front (Publisher vs. Viewer) since the two lead to entirely different app shells.

**Layout:** Step 1: two large role-choice cards ("I want to advertise" → Viewer / "I want to list my hoardings" → Publisher) with a one-line description each. Step 2: a standard form (Name, Business Name [Publisher only], Email, Mobile, Password).

**Content:** Role-choice copy: "**I want to advertise** — Discover and request outdoor advertising space across Bengaluru." / "**I want to list my hoardings** — Reach advertisers looking for space like yours."

**States:** Standard form validation (email format, password strength, duplicate-account detection with a clear "An account with this email already exists — log in instead?" message rather than a generic error).

**Responsive Behavior:** Role cards stack vertically on mobile, side-by-side on desktop.

**Accessibility:** Role cards are real radio-button-pattern controls (`role="radio"` within a `radiogroup`), not bare clickable divs.

**Business Rules:** Publisher accounts additionally route to PB-08 (Verification) immediately after signup, per `AUTH-002`. Viewer accounts route straight to VW-01.

**API/Data Dependencies:** Account creation per Supabase Auth; role stored at creation and immutable thereafter through any UI path specified in this documentation (switching roles on one account is not a designed capability).

---

### AUTH-04 — Forgot / Reset Password

**Purpose:** Standard password recovery.

**Layout:** Single field (email/mobile) → "check your inbox" confirmation state → (via emailed link, outside app) a new-password form.

**States:** Standard — request-sent confirmation, invalid/expired reset link, success.

**Business Rules / API Dependencies:** Standard Supabase Auth password-reset flow; no product-specific rules apply.

---

### SH-01 — Account & Profile Settings

**Purpose:** Shared shell for account-level settings, with role-specific content.

**Layout:** Left-side settings nav (Profile, Security/Password, and — Publisher only — Verification status linking to PB-08) + a right content panel.

**Content — Publisher variant:** Business Name, Contact Phone/Email (editable), Verification status block (mirrors PB-08's status states). **Content — Viewer variant:** Full Name, Contact Phone/Email (editable), no verification section (Viewers aren't verified at MVP, per File 00 §3.5).

**States:** Standard form save/success/error states.

**Business Rules:** Editing contact info here does not retroactively change what's shown to counterparties on existing Requests (a Request's embedded `viewer`/`publisher` summary reflects the account at Request-creation time or live-syncs — this specific behavior is an implementation detail not resolved in reviewed source docs; **OPEN QUESTION**, File 08).

**API/Data Dependencies:** Account resource, standard profile-field CRUD.

---

### SH-02 — Notifications Panel

**Purpose:** In-app notification history, since not every notification (Request accepted, listing approved) is acted on immediately from a push/email — the panel is the durable, revisitable record.

**Primary User:** All three roles (content differs by role).

**Entry Points:** Bell icon in the top bar (all roles) — a small unread-count badge (`gold-500` dot, not a numbered badge, to stay restrained per §9.1, unless the count exceeds a small threshold where a number becomes clearer than a dot — **UX ASSUMPTION**, minor).

**Layout:** Slide-out drawer from the top-right (all roles), reverse-chronological list.

**Wireframe Description — Viewer example:** "Namma Outdoor Media confirmed your request for Premium Unipole — Hosur Road" / "Your request for Indiranagar Wall Wrap was declined." **Publisher example:** "New request from Rohan Mehta for Silk Board Gantry — respond by 6:00 PM today." "Your listing Koramangala Bus Shelter was approved." **Admin example:** Admin does not need a notification panel in the same sense — Admin's "Needs Attention" is AD-01/AD-02 themselves; a minimal version (system errors, if any) is out of scope to design further here.

**Interactions:** Tapping a notification navigates directly to the relevant screen/detail (e.g., a Request notification opens that Request's detail drawer).

**States:** Empty ("No notifications yet"), unread vs. read visual distinction (a subtle `surface-2` bg on unread rows, removed once viewed).

**Responsive Behavior:** Full-screen on mobile, drawer on desktop.

**Accessibility:** New notifications update the bell's `aria-label` (e.g., "Notifications, 3 unread") rather than relying on a visual-only badge.

**Business Rules:** Notification **channel** (push vs. SMS vs. email, and which combination) is explicitly undecided in source docs (`NOTIF-*` rules name the need but not the final channel mix) — flagged as an **OPEN QUESTION** in File 08; this in-app panel is channel-agnostic and works as the durable record regardless of which delivery channels are ultimately chosen.

**API/Data Dependencies:** A Notification resource per role, scoped to the authenticated account; exact backing shape not detailed in reviewed `api-specification.md` sections beyond what `NOTIF-*` rules in `mvp-prd.md` imply.

---

*Continue to File 06 for feature-level UX deep-dives (Marketplace Discovery, Hoarding Detail, Request, Inventory Management, Dashboard, and Admin UX) that cut across the screens specified in Files 03–05.*
