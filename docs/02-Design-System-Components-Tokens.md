# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 02 of 9 — Design System, Component Library, Design Tokens

---

## 8. Reconciling the Visual-Language Sources — A Note Before the System Itself

Three visual-language sources exist for SEEABLE, and they disagree on theme:

1. **The master brief for this documentation (authoritative for the product UI)** explicitly specifies: *premium white and very light neutral background, deep charcoal typography, subtle SEEABLE brand yellow/gold accent used restrainedly, rounded cards, thin borders, soft shadows, excellent spacing, modern typography, high information clarity.* This is a **light theme**.
2. **The "Seeable — UI/UX Design System Documentation" reference doc** is explicitly scoped, in its own text, to the **marketing website** — it specifies a **dark theme** (near-black background, warm gold accent, white/gray text).
3. **Reference screenshots** are mixed: Admin and Publisher screens (dashboard, calendar, Add Hoarding wizard, Publishers & Inventory) are light-themed and match source (1). A subset of Viewer-facing screens — the two Viewer journey diagrams, the map view, the login/splash page, and one Hoarding Detail variant — are dark-themed and match source (2). A second Hoarding Detail variant and the My Hoardings / My Requests list screens are light-themed.

**Resolution used throughout this documentation:** The **light theme is canonical for the SEEABLE HOARDINGS application** — Publisher, Viewer, and Admin, with no exceptions — because the master brief states this explicitly and directly for the product, while source (2) states just as explicitly that it describes the marketing website, a different surface. The dark-themed Viewer screenshots are treated as either (a) marketing-site touchpoints that sit outside the authenticated app (the login/splash page, per the "not-yet-logged-in" framing of AUTH-01, plausibly belongs to the marketing site's visual identity rather than the app's), or (b) an earlier design exploration that predates the master brief's explicit light-theme instruction. This is flagged as an **OPEN QUESTION** (File 08): *should the pre-login marketing/landing experience (AUTH-01) use the dark marketing-site identity while the authenticated app (everything after login) uses the light product identity, i.e., a deliberate two-theme system with a hard seam at login — or should the light theme extend all the way to the first pixel a visitor sees?* This documentation specifies **AUTH-01 in the light theme**, for a single consistent design system end-to-end with zero seams, because the master brief's instruction is unqualified ("the product") and a hard visual seam at login is a bigger UX risk (jarring, feels like two different products) than the smaller inconsistency of not matching a dark marketing reference. If the business intends AUTH-01 specifically as marketing-site real estate, the dark system in the reference doc can be applied there without touching anything past login — the two systems are written to not conflict token-for-token if that path is chosen later.

The Typography reference doc (Inter / Inter Tight / Anton) is theme-agnostic and is adopted as-is for both light and any future dark surface.

---

## 9. Design System

### 9.1 Color

All hex values below were checked for WCAG 2.1 contrast against their documented pairing; ratios are stated so Figma/dev can verify rather than re-derive them.

#### Neutrals ("Ink" and "Surface")

| Token | Hex | Usage |
|---|---|---|
| `ink-900` | `#1E1C1A` | Primary text; primary button fill. 16.99:1 on white. |
| `ink-800` | `#2A2724` | Hover/active state of `ink-900` fills. |
| `ink-700` | `#57534C` | Secondary text, sub-labels, icons. 7.64:1 on white. |
| `ink-500` | `#8A857C` | Tertiary text, placeholders, disabled text. 3.67:1 on white — **body-text minimum only; do not use for text below 14px bold / 18px regular.** |
| `ink-300` | `#B8B3A9` | Disabled borders, disabled icon fills. Decorative only, never text. |
| `border` | `#E7E3DC` | Hairline borders, dividers, card outlines. |
| `surface-0` | `#FAF9F6` | Page background (the "very light neutral background" from the brief). |
| `surface-1` | `#FFFFFF` | Card/panel/modal background (the "premium white" from the brief). |
| `surface-2` | `#F2F0EB` | Subtle fill: input backgrounds, table row hover, chip backgrounds. |

#### Accent — "SEEABLE Gold" (restrained use)

| Token | Hex | Usage |
|---|---|---|
| `gold-800` | `#5C4210` | High-contrast text on gold tints where extra weight is needed. 9.37:1 on white. |
| `gold-700` | `#7A5816` | **Primary accent color for text/icons/links/focus rings on light surfaces.** 6.49:1 on white — passes AA for all text sizes and UI components. |
| `gold-500` | `#C9A227` | **Decorative fill only** — selected-tab underline, brand mark, chart accent, badge tint edge. Always paired with `ink-900` text on top (7.02:1), **never** white text on it (2.42:1 — fails). |
| `gold-100` | `#F7ECD2` | Tint background for accent badges/highlights, paired with `gold-700` text (5.53:1). |

**Restraint rule:** gold appears on at most one or two elements per screen — a "Verified" badge, the active nav indicator, a focused input's outline, a key metric on the Admin dashboard. It is never the fill color of a primary button (see §9.4) and never used for large background blocks. This directly implements the brief's "restrained use of accent color."

#### Semantic (status, feedback)

| Token | Text hex | Tint bg hex | Contrast (text/tint) | Usage |
|---|---|---|---|---|
| `success-700` / `success-50` | `#1E6B3C` | `#E8F5EC` | 6.51:1 (on white) | Approved, Confirmed |
| `warning-700` / `warning-50` | `#8A5A00` | `#FBF1DC` | 5.93:1 (on white) | Pending Approval, Pending (Request) |
| `danger-700` / `danger-50` | `#B3261E` | `#FBEAE9` | 6.54:1 (on white) | Rejected, Delisted, Suspended |
| `info-700` / `info-50` | `#1D5B8F` | `#E9F2FA` | ≥4.5:1 (on white, verified against same formula) | Live (campaign currently running) |
| `neutral-700` / `neutral-50` | `#57534C` (=`ink-700`) | `#F2F0EB` (=`surface-2`) | 7.64:1 | Draft, Paused, Completed, Expired |

#### Status → color mapping (used everywhere a status pill appears — see §10.3)

| Status | Applies to | Color |
|---|---|---|
| Draft | Listing | Neutral |
| Pending Approval | Listing | Warning |
| Approved | Listing | Success |
| Paused | Listing | Neutral (Publisher-chosen, not a problem state) |
| Rejected | Listing | Danger |
| Delisted | Listing | Danger |
| Pending | Request | Warning |
| Confirmed | Request | Success |
| Rejected | Request | Danger |
| Live | Request | Info (distinguishes "happening now" from "confirmed, upcoming") |
| Completed | Request | Neutral |
| Expired | Request | Neutral (muted — a missed SLA, not an active problem) |
| Verified | Publisher | Success (badge, not a full pill — see §10.3) |
| Pending Verification | Publisher | Warning |
| Suspended | Publisher | Danger |

### 9.2 Typography

Adopted from the SEEABLE Typography reference doc, applied consistently across the light-theme product.

- **Inter** — the workhorse UI/body typeface for both roles' applications: body copy, form fields, table content, buttons, nav labels.
- **Inter Tight** — headings and section titles within the app (H1–H4). Its tighter tracking gives dashboard and list-page headings a crisper, denser feel appropriate to a data-forward B2B tool, without the visual weight of a display face.
- **Anton** — reserved for **marketing/brand moments only**: the AUTH-01 landing hero headline (e.g., "MAKE EVERY LOCATION SEEABLE"). **UX ASSUMPTION:** Anton is not used anywhere inside the authenticated app (dashboards, lists, forms) — a heavy condensed display face at that scale would work against the brief's "high information clarity" and "modern, restrained" instruction for the working product. It appears once, at the top of the funnel.

Font stack fallback (from source doc, retained): `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` for Inter/Inter Tight; `"Anton", Impact, sans-serif` for Anton.

#### Type scale

| Token | Font | Size / Line-height | Weight | Usage |
|---|---|---|---|---|
| `display` | Anton | 48px / 52px | 400 | Marketing hero only (AUTH-01) |
| `h1` | Inter Tight | 28px / 36px | 600 | Page titles (Discover, Dashboard, My Hoardings) |
| `h2` | Inter Tight | 22px / 30px | 600 | Section headings within a page |
| `h3` | Inter Tight | 18px / 26px | 600 | Card titles, modal titles |
| `h4` | Inter Tight | 16px / 24px | 600 | Sub-section labels |
| `body-l` | Inter | 16px / 24px | 400 | Primary reading text, hoarding descriptions |
| `body-m` | Inter | 14px / 20px | 400 | Default UI text: table cells, form values, list items |
| `body-s` | Inter | 13px / 18px | 400 | Secondary/support text, timestamps |
| `label` | Inter | 13px / 16px | 500 | Form labels, filter chips, tab labels |
| `caption` | Inter | 12px / 16px | 400 | Helper text, field hints, image captions |
| `overline` | Inter | 11px / 14px | 600, uppercase, 0.04em tracking | Eyebrow labels ("STATUS", "SITE INTELLIGENCE") |
| `button` | Inter | 14px / 20px | 600 | All button labels |
| `mono-data` | ui-monospace fallback | 13px / 20px | 400 | Price figures and dates in tables where digit alignment matters |

### 9.3 Spacing, Radius, Elevation

**Spacing scale** (4px base unit): `space-1`=4px, `space-2`=8px, `space-3`=12px, `space-4`=16px, `space-5`=24px, `space-6`=32px, `space-7`=48px, `space-8`=64px, `space-9`=96px. Card internal padding defaults to `space-4` (16px) on mobile, `space-5` (24px) on desktop. Page gutters: `space-4` on mobile, `space-6` on desktop.

**Radius scale**: `radius-sm`=6px (inputs, chips, small buttons), `radius-md`=10px (buttons, cards inside dense lists), `radius-lg`=14px (primary cards — hoarding cards, dashboard panels), `radius-xl`=20px (modals, bottom sheets), `radius-full`=9999px (pills/badges, avatars, the round "+" add-hoarding button).

**Elevation** (soft shadows only — no hard drop shadows, consistent with "premium" brief):

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(30,28,26,0.04), 0 1px 1px rgba(30,28,26,0.03)` | Resting cards on `surface-0` |
| `shadow-md` | `0 4px 12px rgba(30,28,26,0.08)` | Dropdowns, popovers, sticky sub-nav |
| `shadow-lg` | `0 12px 32px rgba(30,28,26,0.14)` | Modals, bottom sheets, the mobile Request drawer |

Because cards sit on a very light background with thin borders already doing most of the visual separation (per the brief), shadows are intentionally subtle — `border` + `shadow-sm` together, not shadow alone, is the default resting card treatment.

### 9.4 Iconography

**UX ASSUMPTION (recommendation, not mandated by source docs):** a single open-source line-icon set (e.g., Lucide) at 20px (inline with body text) and 24px (standalone/nav) sizes, 1.5px stroke weight, `ink-700` default color, `gold-700` only when an icon itself communicates the brand accent (e.g., the Verified checkmark badge, which uses a filled `gold-500` circle with a white check, sized 16px, always paired with the word "Verified" in text — never icon-only, for accessibility).

---

## 10. Component Library

This section defines each component's **visual anatomy and variants**. Interaction rules, validation timing, and state-machine behavior for these components (form validation, table sorting/pagination, modal vs. drawer selection, toast queueing, skeleton-loading patterns) are specified once in **File 07** and referenced from every screen spec — they are not repeated per-component here.

### 10.1 Buttons

| Variant | Fill | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `ink-900` | white | none | One per screen/section — the single most important action ("Submit Request", "Approve", "Save & Continue") |
| Secondary | `surface-1` | `ink-900` | 1px `border` | Secondary actions ("Cancel", "Save as Draft") |
| Tertiary / Ghost | transparent | `ink-900` | none | Low-emphasis actions inside dense rows (table row actions) |
| Destructive | `surface-1` | `danger-700` | 1px `danger-700` at 30% opacity | "Reject", "Suspend Publisher", "Delist" — never filled red, to avoid the alarm-fatigue of a bright red button appearing routinely in an admin workflow |
| Accent (rare) | `gold-100` | `gold-800` | none | Reserved for the single highest-affinity brand moment per flow, e.g. "Get Verified" prompt — used sparingly, per §9.1 restraint rule |

Sizes: `sm` (32px height, `body-s`), `md` (40px height, `button` type, default), `lg` (48px height, primary CTAs on mobile for thumb targets ≥44px). States: default, hover (`ink-800` fill for Primary; `surface-2` fill for Secondary/Tertiary), active (scale 0.98 + darken), focus (2px `gold-700` outline, 2px offset), disabled (`ink-300` fill/text, `surface-2` bg, no pointer events), loading (label replaced by a centered spinner, button width preserved to prevent layout shift).

### 10.2 Inputs

Text input, textarea, select/dropdown, date/date-range picker, phone input (India +91 prefix fixed), search input (with leading search icon and clear "×"). Anatomy: 13px `label` above field, 40px-height field (`radius-sm`, 1px `border`, `surface-1` bg, `surface-2` bg when disabled), 12px `caption` helper text below, error state swaps helper text to `danger-700` with a small alert icon and swaps the field border to `danger-700`. Focus state: `gold-700` 2px outline (never a colored border-only focus state — a full outline is used for accessibility visibility). Full validation-timing rules in File 07 §Forms.

### 10.3 Status Badge / Pill

`radius-full`, `body-s` weight 500, horizontal padding `space-3`, height 24px, tint background + matching text color per the §9.1 status-color mapping (e.g., Confirmed = `success-50` bg, `success-700` text). Always text-first (the word "Confirmed", not a color alone) — never conveys status by color alone, per accessibility requirements (File 07 §Accessibility). The **Verified** badge is a distinct compact variant: a 16px filled gold circle-check icon immediately followed by the word "Verified" in `gold-800` `caption` weight 600, no pill background — visually lighter than a full status pill since it appears inline next to a Publisher's name very frequently and must not compete with the actual listing/request status pill on the same card.

### 10.4 Cards

- **Hoarding Card** (Discover grid, Shortlist): photo (16:9, `radius-lg` top corners only), overlay top-right = Shortlist heart toggle, body = hoarding name (`h4`), location line (`body-s`, `ink-700`, map-pin icon), type + size chip row, price (`body-m` weight 600) with unit ("/month" or "/2 weeks" per rate structure), Publisher business name + Verified badge (`caption`), bottom-right status of availability ("Available from 15 Sep" in `success-700` or "Fully booked through Oct" in `ink-500`).
- **Listing Card / Row** (My Hoardings): denser, table-like on desktop, card-like on mobile; leads with status pill, thumbnail, name, and a right-aligned action menu (⋯).
- **Request Card** (My Requests / Incoming Requests): leads with status pill and hoarding name, shows counterpart identity (Viewer's `full_name` on Publisher's view; Publisher's `business_name` + Verified badge on Viewer's view), the requested date range in `mono-data`, and the SLA countdown when Pending.
- **Dashboard Metric Card** (Publisher/Admin dashboards): large `h1`-scale number, `label` above it, optional small trend caption below, `surface-1` bg, `shadow-sm`.

All cards: `radius-lg`, 1px `border`, `shadow-sm` at rest, `shadow-md` on hover (desktop only) with a 1px lift, no hover elevation change on touch devices.

### 10.5 Navigation

- **Desktop left rail** (Publisher, Admin): 240px fixed width, `surface-1` bg, 1px right `border`, logo top, nav items (`icon` 20px + `label`) with active state = `gold-500` 3px left-edge bar + `surface-2` bg + `ink-900` text (bold), inactive = `ink-700` text.
- **Mobile bottom tab bar** (Viewer): 4 items max (Discover, Shortlist, My Requests, Account) + a fixed center placement is not used (no create action needed in Viewer bottom nav), 56px height, `surface-1` bg with top `border`, active tab = `gold-700` icon + label, inactive = `ink-500`.
- **Tabs** (status filters on My Hoardings, My Requests, Publishers & Inventory): underline style, active = `ink-900` text + `gold-500` 2px underline, inactive = `ink-700` text, includes a count badge per tab (e.g., "Pending Approval (3)").

### 10.6 Availability Calendar

A month-grid calendar component shared by PB-05 (Publisher, edit mode) and VW-03/VW-04 (Viewer, read + select mode). Day cell states: **Available** (`surface-1` bg, `ink-900` text, selectable), **Requested/Pending-hold** (`warning-50` bg, diagonal-hatch texture, not selectable by a new Viewer — communicates "someone else is asking" without falsely implying it's booked), **Confirmed/Booked** (`ink-300` bg, `ink-500` text, not selectable, tooltip "Booked"), **Past** (`surface-2` bg, `ink-300` text, not selectable), **Selected range** (`gold-100` bg fill across the range, `gold-700` range-end date circles). This single component's states are the visual expression of the `REQUEST-004` no-overlap invariant — see File 06 §Request UX for the full interaction spec.

### 10.7 Overlays

**Modal** (centered, `radius-xl`, `shadow-lg`, max-width 480–640px depending on content) for focused single-decision actions (Submit Request, Approve/Reject confirmations). **Drawer/bottom sheet** (slides from bottom on mobile, from right on desktop, `radius-xl` on the leading edge only) for richer multi-field or browsable content (Request Detail drill-in, Notifications panel). Selection rule between the two is specified in File 07 §Modals & Drawers.

### 10.8 Empty / Loading / Table components

Skeleton loaders, empty-state illustrationless blocks, and the Admin data-table component (sortable headers, row-hover `surface-2`, sticky header on scroll, row-level action menu) are specified in full in File 07 §Tables and §Loading/Empty/Error States, since their behavior (not just appearance) is the part that needs specifying.

---

## 11. Design Tokens (reference table)

The full token set, ready to translate into CSS custom properties, a Tailwind config, or Figma variables. Naming mirrors the component sections above.

```
/* Color — Neutral */
--color-ink-900: #1E1C1A;
--color-ink-800: #2A2724;
--color-ink-700: #57534C;
--color-ink-500: #8A857C;
--color-ink-300: #B8B3A9;
--color-border: #E7E3DC;
--color-surface-0: #FAF9F6;
--color-surface-1: #FFFFFF;
--color-surface-2: #F2F0EB;

/* Color — Accent (SEEABLE Gold) */
--color-gold-800: #5C4210;
--color-gold-700: #7A5816;
--color-gold-500: #C9A227;
--color-gold-100: #F7ECD2;

/* Color — Semantic */
--color-success-700: #1E6B3C; --color-success-50: #E8F5EC;
--color-warning-700: #8A5A00; --color-warning-50: #FBF1DC;
--color-danger-700:  #B3261E; --color-danger-50:  #FBEAE9;
--color-info-700:    #1D5B8F; --color-info-50:    #E9F2FA;

/* Typography */
--font-family-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-family-heading: "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-family-display: "Anton", Impact, sans-serif; /* AUTH-01 hero only */

--font-size-display: 48px; --line-height-display: 52px;
--font-size-h1: 28px; --line-height-h1: 36px;
--font-size-h2: 22px; --line-height-h2: 30px;
--font-size-h3: 18px; --line-height-h3: 26px;
--font-size-h4: 16px; --line-height-h4: 24px;
--font-size-body-l: 16px; --line-height-body-l: 24px;
--font-size-body-m: 14px; --line-height-body-m: 20px;
--font-size-body-s: 13px; --line-height-body-s: 18px;
--font-size-label: 13px; --line-height-label: 16px;
--font-size-caption: 12px; --line-height-caption: 16px;
--font-size-overline: 11px; --line-height-overline: 14px;

/* Spacing */
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;

/* Radius */
--radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px; --radius-full: 9999px;

/* Elevation */
--shadow-sm: 0 1px 2px rgba(30,28,26,0.04), 0 1px 1px rgba(30,28,26,0.03);
--shadow-md: 0 4px 12px rgba(30,28,26,0.08);
--shadow-lg: 0 12px 32px rgba(30,28,26,0.14);

/* Motion (see also File 07 for where motion is/isn't used) */
--duration-fast: 120ms;
--duration-base: 200ms;
--duration-slow: 320ms;
--easing-standard: cubic-bezier(0.2, 0, 0, 1);
```

---

*Continue to File 03 for the full page-by-page UI specification of every Viewer screen.*
