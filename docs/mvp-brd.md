# SEEABLE Hoardings — MVP Business Requirements Document (BRD)

**Document Type:** Business Requirements Document (MVP Scope)
**Product:** SEEABLE Hoardings
**Version:** 1.0
**Status:** Draft for Review
**Prepared For:** SEEABLE Hoardings Founders, Product, and Stakeholder Teams
**Date:** 26 August 2026
**Related Documents:** claude_SEEABLE_Hoardings_BRD.md (full-scope BRD), docs/01-product/mvp-prd.md (MVP PRD), docs/01-product/mvp-scope.md

---

## 1. Document Control

| Field | Detail |
|---|---|
| Document Title | SEEABLE Hoardings — MVP Business Requirements Document |
| Version | 1.0 |
| Status | Draft |
| Prepared By | Product Team, with reference to the full-scope BRD and Master PRD Framework |
| Distribution | Founders, Product, Engineering, Design, Operations |

This document narrows the full-scope BRD to what the business needs from the **first shippable version** of SEEABLE Hoardings. It is not a replacement for the full BRD — it is the subset the business has chosen to validate first.

---

## 2. Executive Summary

The full-scope BRD lays out SEEABLE's ambition to become the operating layer for the OOH industry. That ambition depends on an unproven assumption: that Publishers will trust a digital platform enough to list real inventory, and that Viewers will use it to find and request that inventory, ahead of any payment guarantee, escrow, or commission structure. This MVP BRD defines the leanest version of the business that tests that assumption directly — a two-sided marketplace covering **Publisher** (supply) and **Viewer** (demand) roles, with **Admin** as a thin trust layer, and **no payment processing**. Every requirement here exists to answer one question: will the core listing-to-request loop work before SEEABLE invests further?

## 3. Business Background and Problem Statement

The problems described in the full-scope BRD — fragmented inventory, manual negotiation, no centralized discovery, poor utilization visibility for owners — are real, but not all of them need solving simultaneously. The MVP isolates the two problems most directly testable without payment infrastructure:

- **Publishers** cannot easily list inventory, reach buyers, or manage incoming interest without going through intermediaries or manual outreach.
- **Viewers** cannot discover and compare inventory across owners from a single place, and have no structured way to request specific dates.

Problems tied to agencies, digital screens, campaign tracking, contracts, and industry-wide standardization are real but explicitly deferred — see §5.2.

## 4. Business Objectives (MVP Subset)

Of the eight business objectives in the full-scope BRD, four apply directly to this phase:

1. **Reduce discovery friction** — Viewers should be able to find and compare Bengaluru hoarding inventory in one place, without manual outreach to individual owners.
2. **Digitize the request workflow** — replace phone-and-email negotiation with a structured, trackable date-request flow, even without payment attached.
3. **Increase inventory visibility for owners** — give Publishers a single dashboard to list, manage, and respond to demand, reducing the manual burden of vacant, unmanaged inventory.
4. **Establish an early trust layer** — listing verification and watermarking build the foundation for "every listing is real," ahead of the platform being able to back that promise with payment protection.

Objectives 5–8 in the full-scope BRD (network effects at scale, digital infrastructure, AI, industry system of record) are **not MVP objectives** — they depend on proving 1–4 first.

## 5. Scope

### 5.1 In Scope

- Publisher registration, verification, and inventory listing (static hoarding types only — see `docs/03-modules/inventory.md` for the full type taxonomy)
- Viewer registration, search, filtering, and map-based discovery
- A date-request workflow with manual Publisher accept/reject and automatic conflict prevention
- Admin-side listing approval and Publisher verification
- Watermarking of listing media
- Notifications for request and approval events

### 5.2 Out of Scope (Deferred)

| Deferred | Business reason |
|---|---|
| Payment, escrow, commissions | The business has chosen to validate demand before building financial infrastructure |
| Digital screens / CMS / device management | No digital inventory partners onboarded at this phase |
| Agency platform | Single-advertiser flow is sufficient to test the core loop |
| Campaign management | MVP tests single-hoarding requests, not multi-site campaign planning |
| AI recommendations | Requires usage data this MVP is meant to generate first |
| Contracts | Manual/offline agreements accepted at this scale |
| Full analytics suite | Basic operational counts are sufficient to run the business at this stage |

### 5.3 Scale Assumption

The business is targeting **50+ live, approved hoardings** in Bengaluru as the threshold at which the marketplace becomes genuinely useful to a Viewer (below this, search and filtering add little value over a manual list).

## 6. Stakeholders

| Stakeholder | Role in the MVP business |
|---|---|
| Publisher | Supply-side user; the business needs their trust to list real inventory digitally |
| Viewer | Demand-side user; the business needs them to prefer requesting through SEEABLE over calling an owner directly |
| SEEABLE Admin / Operations | Runs the trust layer — approval and verification — that substitutes for payment-based trust at this phase |
| SEEABLE Founders / Business Sponsors | Own the decision to defer payment and validate demand first |
| Engineering, Design, QA | Downstream consumers of this BRD and the MVP PRD |

Advertising Agencies, Hoarding Operators, Technicians, and the Finance Team are **not active MVP stakeholders** — they re-enter at later phases per the full-scope BRD.

## 7. Business Requirements

Each requirement below maps to a technical requirement ID in `docs/01-product/mvp-prd.md` for traceability.

### 7.1 Account and Roles

- **BR-AUTH-001:** The platform must distinguish Publisher and Viewer accounts at registration, each with a tailored flow. *(→ AUTH-001)*
- **BR-AUTH-002:** A Publisher must complete lightweight verification (OTP at minimum) before any listing of theirs can go live, to protect early marketplace trust in the absence of payment-based accountability. *(→ AUTH-002, OWNER-004)*

### 7.2 Publisher / Inventory

- **BR-OWNER-001:** Publishers must be able to list a hoarding with type-specific details (metro pillar, unipole, gantry, transit, wall wrap, bus shelter) so listings are usable and comparable without contacting the owner. *(→ INVENTORY-001)*
- **BR-OWNER-002:** Publishers must be able to manage availability and pause listings without deleting them, since inventory frequently goes on and off market. *(→ OWNER module)*
- **BR-OWNER-003:** Publishers must see and act on incoming demand (accept/reject) from a single inbox, replacing scattered calls and messages. *(→ REQUEST-001)*

### 7.3 Discovery (Viewer)

- **BR-VIEWER-001:** Viewers must be able to search and filter inventory by type, distance, and budget without contacting each Publisher individually. *(→ Viewer module)*
- **BR-VIEWER-002:** Search results must show enough standardized information (location, size, price, type) to support like-for-like comparison across Publishers. *(→ INVENTORY-001)*

### 7.4 Requests (Booking-Lite)

- **BR-REQUEST-001:** The platform must prevent a hoarding from being confirmed to two Viewers for overlapping dates, even without a payment step to enforce this. *(→ REQUEST-001)*
- **BR-REQUEST-002:** A rejected or expired request must release its dates immediately so other Viewers are not blocked by inventory nobody actually holds. *(→ REQUEST-002)*
- **BR-REQUEST-003:** The business requires a manual "completed" step on each request, since there is no payment event to trigger campaign closure automatically. *(→ REQUEST-003)*

### 7.5 Trust and Moderation (Admin)

- **BR-ADMIN-001:** No listing may reach Viewer search results without Admin approval — this is the business's primary substitute for payment-based trust at this phase. *(→ ADMIN-001)*
- **BR-ADMIN-002:** The business requires visibility into platform health (listings, requests, confirmation rate) to judge whether the MVP hypothesis is working. *(→ ADMIN dashboard)*

### 7.6 Content Integrity

- **BR-CONTENT-001:** Listing photos must be watermarked before publication, so listing content cannot be freely lifted and reused elsewhere — an early, low-cost trust and IP-protection signal. *(→ CONTENT-001)*

## 8. Roles and Permissions (Business View)

| Feature | Publisher | Viewer | Admin |
|---|---:|---:|---:|
| List/manage inventory | Yes | No | Moderate only |
| Search inventory | Yes | Yes | Yes |
| Submit date request | No | Yes | No |
| Accept/reject request | Yes (own) | No | No |
| Approve listings | No | No | Yes |
| Verify Publishers | No | No | Yes |

## 9. Key Business Process Flows

**Publisher (business view):** Register → verify → list inventory → await approval → manage availability and pricing → respond to requests → settle offline → mark complete.

**Viewer (business view):** Register → search and compare → request dates on a listing → await Publisher response → settle offline once confirmed.

## 10. Non-Functional Business Requirements

- **Trust is the primary NFR at this phase.** With no payment protection, verification and approval (§7.5) are the only mechanisms standing between the platform and fraudulent or inaccurate listings — this makes moderation quality a business-critical requirement, not a nice-to-have.
- **Responsiveness:** search and request actions should feel immediate enough that Viewers prefer them to a phone call.
- **Data integrity:** listing accuracy (size, price, availability) must be trustworthy even though it's self-reported by Publishers, since the business has no independent verification at MVP beyond Admin review.

## 11. Business Rules (Representative Set)

- **BR-OWNER-001:** A hoarding cannot be confirmed to two Viewers for the same overlapping period.
- **BR-OWNER-002:** A request remains Pending until the Publisher responds or the SLA expires.
- **BR-ADMIN-001:** An unapproved listing never appears in Viewer search.
- **BR-CONTENT-001:** Unwatermarked media is never publicly served.

Full technical detail for each lives in `docs/01-product/mvp-prd.md`.

## 12. Key Edge Cases the Business Must Account For

- **Disintermediation risk:** a Viewer and Publisher connect via SEEABLE, then settle and repeat future bookings entirely offline, cutting the platform out. This is the single biggest structural risk of a payment-free MVP and should be watched closely (see §17).
- **No-recourse disputes:** since settlement is offline, if a Viewer doesn't pay after a Publisher blocks the dates, or a Publisher doesn't deliver after being paid, SEEABLE currently has no enforcement mechanism — only reputational/manual resolution.
- A Publisher accepts a request in-app but privately arranges different terms offline.
- A Viewer submits requests they never intend to honor, tying up a Publisher's calendar (needs a rate-limit or reputation signal even without payment).

The business should decide, ahead of these occurring, whether any of this warrants intervention now (e.g., a soft cap on Pending requests per Viewer) or is acceptable MVP risk.

## 13. Assumptions and Constraints

### 13.1 Assumptions

- Publishers are willing to list real inventory digitally without payment guarantees, based on the value of exposure and demand alone.
- Viewers are willing to use a structured request flow instead of calling a known contact, provided discovery is genuinely easier.
- Offline settlement is an acceptable, temporary trust gap for a first version.

### 13.2 Constraints

- No payment/commission model exists yet, so there is no platform revenue at this phase — the MVP is a cost center by design, not a revenue driver.
- Single-city (Bengaluru) launch; inventory sourcing at 50+ listings will likely require manual/field outreach rather than pure self-serve onboarding.

## 14. Success Criteria and KPIs (MVP-Specific)

Since there is no payment activity to measure revenue against, MVP success is measured through leading indicators:

- Number of Publishers onboarded and verified
- Number of live, approved listings (target: 50+)
- Number of Viewer accounts created
- Number of date requests submitted
- Request-to-confirmation rate
- Median Publisher response time to a request
- Repeat usage — Viewers or Publishers returning for a second listing/request without prompting

These substitute for the full BRD's revenue- and commission-based KPIs (§14 of the full BRD), which only become measurable once payment exists.

## 15. Path to Phase 2 (Business View)

Once the MVP demonstrates that Publishers list and Viewers request at meaningful volume, the business should move to introduce payment/escrow first — before agencies, digital screens, or AI — since payment is what converts a validated request flow into actual revenue and closes the disintermediation gap described in §12. This sequencing matches the deferred-item mapping already defined in `docs/01-product/mvp-prd.md` §15.

## 16. Dependencies

- Full-scope BRD (`claude_SEEABLE_Hoardings_BRD.md`) — source of the long-term objectives this MVP is a first step toward
- MVP PRD (`docs/01-product/mvp-prd.md`) — technical requirement detail for every business requirement in §7
- Manual/field Publisher onboarding effort — required to reach the 50+ listing target without paid inventory acquisition channels

## 17. Risks

| Risk | Impact | Mitigation Direction |
|---|---|---|
| Disintermediation — Publishers and Viewers transact offline after first contact | Platform never captures revenue even if usage is high | Track repeat-usage KPI closely; move payment up in priority if leakage is high |
| No-recourse disputes without payment/escrow | Trust erosion, negative word-of-mouth among early Publishers/Viewers | Strong Admin moderation now; clear expectation-setting in onboarding copy that settlement is offline |
| Publisher supply doesn't reach 50+ listings | Marketplace never reaches the density needed for Viewer value | Manual/field onboarding push rather than relying on self-serve growth alone |
| Viewers submit non-serious requests, tying up Publisher calendars | Publisher trust in the platform drops | Consider a soft cap on simultaneous Pending requests per Viewer |

## 18. Glossary

| Term | Definition |
|---|---|
| Publisher | MVP term for Hoarding Owner — the supply-side user listing inventory |
| Viewer | MVP term for the demand-side user browsing and requesting inventory |
| Request | The MVP's booking-lite mechanism — a date hold without payment |
| Disintermediation | Users transacting outside the platform after connecting through it |
| MVP | Minimum Viable Product |

## 19. Relationship to Other Documents

This BRD sits between the full-scope BRD (business ambition) and the MVP PRD (technical requirement detail). It exists so Product, Engineering, and Operations share a single business rationale for what's being built now versus deferred — every requirement ID here is traceable into `docs/01-product/mvp-prd.md`.

---

*End of MVP Business Requirements Document.*
