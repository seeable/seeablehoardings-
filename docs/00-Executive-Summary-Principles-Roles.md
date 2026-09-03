# SEEABLE HOARDINGS — UI/UX Design Documentation

**Document set:** 9 files | **Scope:** MVP (Bengaluru launch) | **Prepared:** August 2026
**Status:** Implementation-ready — for Figma, front-end build, and QA reference

This is **File 00 of 9**. See the companion index at the end of this file for the full document map.

---

## 0. How to Read This Documentation

This documentation is built strictly from SEEABLE HOARDINGS' existing product documents: `mvp-brd.md`, `mvp-prd.md`, `inventory.md`, `request-engine.md`, `viewer-platform.md`, `admin-platform.md`, `system-architecture.md`, `docs/05-technical/api-specification.md`, and `seeable_free_first_techstack.md`. Where those documents left a decision open, this documentation makes the smallest reasonable UX decision needed to keep the MVP buildable and labels it clearly:

- **UX ASSUMPTION:** a judgment call made to fill a gap, consistent with existing rules, that the product team should confirm.
- **OPEN QUESTION:** a genuine unresolved decision, carried forward from source docs or newly surfaced, that needs a product/business answer before or shortly after build.
- **Future Consideration:** a capability that is explicitly out of MVP scope. It is named so it isn't silently designed into the MVP, not because it is committed to a roadmap.

Nothing in this documentation invents a feature, screen, or business rule beyond what the source documents establish or what is the minimum reasonable UX glue between established rules. Where source documents conflict, resolution follows this priority: **explicit MVP requirement > mvp-prd.md > mvp-brd.md > technical constraints (system-architecture.md / api-specification.md) > reasonable UX convention.**

Two full-scope documents — `SEEABLE_Hoardings_Master_PRD_Framework.md` and `claude/SEEABLE_Hoardings_BRD.md` — describe SEEABLE's long-term ambition (payments, campaign management, agencies, AI). They are **not** MVP requirements and are referenced only to correctly label Future Considerations.

### Recurring example data used throughout this documentation

For consistency, every wireframe description, content example, and edge case in this documentation set reuses the same fictional-but-realistic Bengaluru OOH dataset instead of Lorem Ipsum or a new example each time:

| Entity | Examples used throughout |
|---|---|
| Publishers (Media Owners) | **Namma Outdoor Media** (verified, established), **Bangalore Ad Spaces** (new, pending verification) |
| Listings | **Premium Unipole — Hosur Road** (Unipole), **Silk Board Gantry** (Gantry), **Indiranagar Wall Wrap** (Wall Wrap), **Hebbal Flyover Unipole** (Unipole), **Koramangala Bus Shelter** (Street Furniture), **ORR Digital Screen** (Digital Screen — data-model-only at MVP, see §Future Consideration notes) |
| Viewer/Advertiser persona | **Aarav Patel**, Brand Marketing Manager at a D2C skincare brand launching in Bengaluru |
| Admin persona | **Priya**, SEEABLE Operations (internal role, not a named external stakeholder) |

---

## 1. Executive Summary

SEEABLE HOARDINGS is a B2B marketplace connecting **Advertisers (Viewers)** who need Out-of-Home advertising space in Bengaluru with **Publishers (Media Owners)** who own hoardings, unipoles, gantries, wall wraps, and street furniture. The MVP replaces the fragmented, phone-and-WhatsApp-driven process of discovering inventory, getting quotes, and negotiating bookings with a single searchable catalog and a lightweight **Request** mechanism — a structured "I'm interested, hold this date range for me" flow that is explicitly **not** a payment or a binding booking system. All commercial settlement (price, contract, payment) happens **off-platform** at MVP.

Three roles are in scope: **Publisher** (lists and manages inventory, responds to Requests), **Viewer** (discovers inventory, submits Requests), and **Admin** (verifies Publishers, moderates listings, resolves disputes narrowly). Agencies, Technicians, and Operators are explicitly out of scope for MVP.

The product's single riskiest structural property is that it creates commercial introductions without ever handling money: this is called **disintermediation risk** in `mvp-brd.md` — the risk that a Viewer and Publisher, once introduced, transact directly and never return to the platform. Every UX decision in this documentation that touches contact information, off-platform communication, or trust signaling is made with that risk in view: Publisher contact details are never exposed to Viewers before a Request is submitted, and even after acceptance, SEEABLE surfaces just enough identity (business name, verification badge) to build trust without becoming a pure directory of phone numbers.

This documentation specifies, screen by screen, how a Publisher lists a hoarding and gets it approved; how a Viewer discovers, filters, and requests one; how a Request moves through its lifecycle from Pending to Live to Completed; and how Admin verifies, moderates, and intervenes — all within a light, restrained, high-clarity visual language appropriate to a professional B2B tool used by people making real advertising-budget decisions, most often on the move.

### MVP scope at a glance

| In scope for MVP | Out of scope (Future Consideration) |
|---|---|
| 3 roles: Publisher, Viewer, Admin | Agency, Technician, Operator roles |
| Single city: Bengaluru | Multi-city expansion |
| 6 static hoarding types (full listing) + 2 digital types (data-model only, not listable at MVP — see §9 of File 06) | Live digital-screen booking, programmatic buying |
| Request lifecycle (interest + date-hold, no payment) | Online payment, escrow, invoicing |
| Publisher self-serve listing with Admin approval | Automated/AI-assisted moderation |
| Admin: verify Publisher, approve/reject listing, suspend Publisher, delist hoarding, mark Request Completed | Full admin console (audit log, RBAC tiers, bulk actions, financial admin) |
| Manual off-platform negotiation and contracting | In-app contracts, e-signature, campaign management |
| Browser-side image watermarking | DRM, licensing management |

---

## 2. Product UX Principles

These six principles govern every design decision in this documentation. Where a screen-level decision is ambiguous, resolve it by asking which option better serves these principles, in order.

### P1 — Trust before transaction
SEEABLE never handles money, so trust is the entire product. Every screen that shows a Publisher to a Viewer (or vice versa) leads with verification status, response reliability, and clear, honest information — never with urgency tactics, fake scarcity, or dark patterns. A Publisher's "Verified" badge, an accurate "responds within 24h" style signal, and a plainly stated Request status are worth more than any conversion trick.

### P2 — MVP-first, not MVP-small
This documentation specifies exactly what the source documents scope for MVP — no more. It resists the temptation to "just add" a nice-to-have screen, filter, or admin capability that isn't in `mvp-prd.md`. Where the full-scope framework docs describe a richer future (campaign dashboards, AI recommendations, agency workspaces), those are named explicitly as Future Considerations and never designed into an MVP screen "just in case."

### P3 — Clarity over decoration
SEEABLE is a working tool for people transacting real advertising budgets, often from a phone in the field. Every screen favors information density and scanability over visual flourish. Restrained use of the brand accent color, generous whitespace, and a strict content hierarchy (status and money-relevant facts first) matter more than illustration or motion.

### P4 — State is always visible
Because Requests, listings, and Publisher verification all move through multi-step lifecycles with real consequences (a missed SLA, a double-booked date range, a rejected listing), the UI must never leave a user guessing what state something is in or what happens next. Every status has a visible label, a plain-language explanation, and — where an action is available — a clear next step. Silent states (nothing happened, nothing to show) are designed as deliberately as busy ones.

### P5 — One honest source of availability
The calendar is the trust anchor of the whole marketplace: a Viewer must never be able to Request dates that are already Confirmed for someone else, and a Publisher must never see conflicting information about what's booked. UI always reflects the same server-enforced no-overlap invariant (`REQUEST-004`, enforced at the database level) — the UI does not attempt to be more permissive or more restrictive than that source of truth.

### P6 — Honest about what's undecided
Where the underlying product requirements leave a business rule genuinely open (an SLA duration, whether a Viewer can withdraw a Request, a notification channel), this documentation does not silently invent an answer and present it as settled. It makes the narrowest workable assumption to keep screens buildable, labels it, and flags it for a product decision — visibly, in context, not buried in an appendix only.

---

## 3. User Roles

Three roles exist at MVP. Role is assigned at signup and determines the entire navigation shell, not just permissions within a shared shell — a Publisher and a Viewer see structurally different applications, not the same app with hidden menu items. (Admin is internal-only and is not reachable from public signup.)

### 3.1 Publisher (Media Owner)

**Who they are:** An individual or small business that owns or manages physical OOH inventory in Bengaluru — a hoarding owner, a small outdoor-media agency's inventory manager, a street-furniture concessionaire. Typically desktop-first for listing creation (photo upload, form-filling) but needs mobile access for on-the-go Request approvals.

**Primary jobs:** List hoardings with accurate details, photos, and availability; get listings approved; respond to incoming Requests quickly (their response speed is a trust signal shown to Viewers); keep availability accurate; mark completed campaigns.

**Cannot do:** Process payments in-app, see other Publishers' inventory or performance, self-verify (Admin must verify), edit a listing that has pending Requests without those Requests being resolved first (`is_edit_frozen`, per api-specification.md §11.3), guarantee a Request outcome (Admin can delist independent of any Request state).

### 3.2 Viewer (Advertiser / Agency Buyer acting individually)

**Who they are:** A marketer, brand owner, or independent media buyer looking for OOH space — described in source docs and screenshots as a persona like **Aarav Patel**, a Brand Marketing Manager evaluating hoardings for a product launch. Primarily mobile, often researching while traveling the actual routes they're considering advertising on; desktop for detailed comparison.

**Primary jobs:** Discover hoardings by location, type, and budget; assess a hoarding's suitability from photos, traffic/visibility data ("Site Intelligence"), and price; shortlist candidates; submit a Request for specific dates; track Request status through to a confirmed campaign.

**Cannot do:** See a Publisher's phone number, email, or full name at any stage (only `business_name` and `is_verified` — see §3.4 disintermediation note); pay in-app; cancel/withdraw a submitted Request (not supported by any source document — flagged as an **OPEN QUESTION**, see File 08); Request a hoarding whose dates are already Confirmed for someone else (enforced server-side).

### 3.3 Admin (SEEABLE Operations)

**Who they are:** Internal SEEABLE staff (e.g., **Priya**, Operations). Desktop-first — this is a back-office tool, not a field tool.

**Primary jobs, deliberately narrow (per `admin-platform.md`):** Verify or reject a Publisher's identity; approve or reject a submitted listing (rejection requires a reason, `ADMIN-003`); suspend a Publisher for policy violations (`ADMIN-002` — never auto-cancels that Publisher's already-Confirmed Requests); delist an individual hoarding independent of Publisher suspension (`ADMIN-004`); jointly mark a Request Completed alongside the Publisher; view a 4-metric operational dashboard.

**Explicitly cannot do at MVP** (do not design these — call them out if a stakeholder expects them): view or manage individual Requests directly (Admin can action a mark-Completed but has no general Request inbox — a confirmed capability gap, see File 08 §Open Questions), bulk-approve/reject, manage payments, view a full audit log, operate under multiple permission tiers. `admin-platform.md` is explicit that this narrowness is intentional for MVP, not an oversight — this documentation does not "complete" the admin console with plausible-sounding screens that aren't in scope.

### 3.4 Cross-role rule: the disintermediation boundary

Because SEEABLE never touches payment, the single greatest risk to the business model is Viewers and Publishers discovering each other once and then transacting directly forever after, bypassing the platform. Per `api-specification.md` §23.4, the UI enforces this conservative default everywhere a person's data would otherwise be exposed:

- A Viewer sees a Publisher's `business_name` and `is_verified` badge — **never** phone, email, or personal full name — at any point in the discovery-to-Request flow, including after a Request is Confirmed.
- A Publisher sees a Viewer's `full_name` **only** on Viewer-submitted Requests targeted at their own listings — never a general directory of Viewers, never contact info beyond what a Request itself carries.
- This is still flagged as an **OPEN QUESTION** in source docs (should Confirmed-stage contact exchange eventually be allowed to unblock real-world execution of the campaign?) — but the conservative "never expose" default is what this documentation specifies for MVP, consistently, everywhere. See File 08 §Open Questions for the forward-looking note.

### 3.5 Role comparison at a glance

| | Publisher | Viewer | Admin |
|---|---|---|---|
| Primary device | Desktop-first, mobile for approvals | Mobile-first, desktop for comparison | Desktop-only |
| Sees inventory | Own listings only | All Approved + visible listings (marketplace-wide) | All listings, all states |
| Sees Requests | Requests against own listings | Own submitted Requests | None directly (only via Mark-Completed action) |
| Can create | Listings, availability blocks | Requests, Shortlist entries | Nothing (moderates only) |
| Identity shown to others | `business_name` + `is_verified` only | `full_name` on their own Requests only | Not customer-facing |
| Verification required | Yes (Admin-gated, blocks listing submission until verified — see File 06) | No (demo variance — see §AUTH-002 note below) | N/A (internal) |

### 3.6 Authentication scope note (AUTH-002 demo variance)

`viewer-platform.md` v1.1 records that the **approved MVP target** is OTP (one-time password) verification before a Publisher can submit a listing or a Viewer can submit a Request. The **current demo build**, however, explicitly defers OTP and uses email/mobile + password login instead, on the Viewer side. This documentation designs login/signup screens (File 05) to match the **current demo build** (password-based) since that is what will actually be built and shown, while flagging OTP as the target end-state so the password-based screens are built with OTP as a drop-in future step (e.g., a screen slot exists for OTP entry, not a redesign). Whether Publisher login follows the same demo variance is unresolved in source docs — flagged as an **OPEN QUESTION** in File 08.

---

## Document Index

This documentation is delivered as 9 Markdown files. Read them in order the first time; use them as independent references afterward.

| File | Contents |
|---|---|
| **00** (this file) | Executive Summary, Product UX Principles, User Roles |
| **01** | Information Architecture, Screen Inventory, User Journeys, User Flows |
| **02** | Design System — color, typography, spacing, elevation, iconography, Design Tokens, Component Library |
| **03** | Page-by-Page UI Specifications — Viewer screens |
| **04** | Page-by-Page UI Specifications — Publisher screens |
| **05** | Page-by-Page UI Specifications — Admin screens + shared Auth/Account screens |
| **06** | Feature UX Deep-Dives — Marketplace Discovery, Hoarding Detail, Request UX, Inventory Management UX, Dashboard UX, Admin UX |
| **07** | Cross-Cutting UX Systems — Forms, Tables, Modals & Drawers, Notifications, Loading/Empty/Error States, Access Control UX, Responsive Design, Accessibility, UX Writing Guidelines, Image & Media Guidelines, Map & Location UX, Edge Cases |
| **08** | Governance — UX Decision Log, Requirement-to-UX Traceability Matrix, Final Screen Inventory, UX Quality Audit, Open Questions & UX Assumptions (consolidated), Future UX Considerations |
