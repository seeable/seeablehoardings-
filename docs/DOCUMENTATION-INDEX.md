# SEEABLE Hoardings — Documentation Index

**Purpose:** Single tracking point for every document the project needs — what exists, what's missing, and what order to close the gaps in. Update the status column as documents land.

**Legend:** ✅ Complete · 🟡 Partial · 🔲 Required — not started

---

## Tier 0 — Foundational (Full Scope, already exist)

| Document               | Location       | Status |
| ---------------------- | -------------- | ------ |
| Master PRD Framework   | (project root) | ✅     |
| Full-Scope BRD         | (project root) | ✅     |
| Brand Vision & Mission | (project root) | ✅     |

## Tier 1 — MVP Product & Business (built so far)

| Document                         | Location                            | Status                                    |
| -------------------------------- | ----------------------------------- | ----------------------------------------- |
| MVP PRD                          | `docs/01-product/mvp-prd.md`        | ✅                                        |
| MVP BRD                          | `docs/01-product/mvp-brd.md`        | ✅                                        |
| MVP Scope (index)                | `docs/01-product/mvp-scope.md`      | ✅                                        |
| Inventory Module                 | `docs/03-modules/inventory.md`      | ✅                                        |
| Owner/Publisher Platform Module  | `docs/03-modules/owner-platform.md` | ✅                                        |
| Discovery UI (working prototype) | `seeable-discovery-map.html`        | ✅ — reference implementation, not a spec |

## Tier 1 — Still Required Before / During MVP Build

These are real gaps, not filler — each one below was referenced inline in `mvp-prd.md` or `mvp-brd.md` but never got its own document the way Inventory and Owner Platform did.

| #   | Document                                | Location                                          | Why it's needed                                                                                                                                                                                                                                                |
| --- | --------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Viewer Platform module doc              | `docs/03-modules/viewer-platform.md`              | Requirements exist only inline in `mvp-prd.md` §7.3 — no standalone spec                                                                                                                                                                                       |
| 2   | Request Engine module doc               | `docs/03-modules/request-engine.md`               | The state machine and conflict rules are documented inline only, across two files                                                                                                                                                                              |
| 3   | Admin Platform module doc               | `docs/03-modules/admin-platform.md`               | Same gap — approval/verification flow has no dedicated spec                                                                                                                                                                                                    |
| 4   | System Architecture                     | `docs/05-technical/system-architecture.md`        | Engineering can't start without an agreed architecture                                                                                                                                                                                                         |
| 5   | Database Design / ERD                   | `docs/05-technical/database-design.md`            | `inventory.md` names entities but there's no schema, keys, or relationships defined                                                                                                                                                                            |
| 6   | Full API Specification                  | `docs/05-technical/api-specification.md`          | `mvp-prd.md` §9 lists endpoint names only — no request/response schemas, auth, or error codes                                                                                                                                                                  |
| 7   | UI/UX Design System + remaining screens | `docs/05-technical/` or design tool               | Only the Discovery/map screen exists — Publisher dashboard, listing form, request inbox, Admin queue, and auth/onboarding screens are unbuilt                                                                                                                  |
| 8   | Security & Data Privacy                 | `docs/05-technical/security.md`                   | OTP auth and Publisher/Viewer personal data need a defined policy before real users onboard                                                                                                                                                                    |
| 9   | Terms of Service / Legal                | (legal doc, outside `/docs`)                      | **Highest priority of this list** — with no payment protection, SEEABLE needs to explicitly disclaim it isn't party to the offline transaction (this is the direct mitigation for the disintermediation and no-recourse risks flagged in `mvp-brd.md` §12/§17) |
| 10  | QA / Test Plan                          | `docs/07-quality/test-requirements.md`            | No test cases exist yet against any acceptance criteria in `mvp-prd.md`                                                                                                                                                                                        |
| 11  | Analytics & Event Tracking Plan         | `docs/06-ai/` or new `docs/analytics-tracking.md` | The KPIs defined in `mvp-brd.md` §14 (request-to-confirmation rate, response time, repeat usage) can't be measured without a defined event/tracking spec                                                                                                       |
| 12  | Content Moderation Guidelines           | `docs/04-business/`                               | Admin approves/rejects listings per `mvp-prd.md` §7.5, but no criteria exist anywhere for _what_ gets rejected and why                                                                                                                                         |
| 13  | Support / Dispute Handling Runbook      | `docs/08-operations/support.md`                   | Operational answer to the no-recourse dispute edge case in `mvp-brd.md` §12 — what does Admin actually do when a Viewer or Publisher reports a problem?                                                                                                        |

## Tier 2 — Useful Soon, Not Blocking Build

| Document                         | Notes                                          |
| -------------------------------- | ---------------------------------------------- |
| Publisher onboarding guide / FAQ | Reduces support load once real Publishers join |
| Viewer help content              | Same, demand side                              |

## Tier 3 — Full Scope, Deliberately Deferred

Already mapped in `mvp-prd.md` §15 — listed here only for completeness, not to be started yet:

Payment & Pricing · Commission Model · Contract Management · Agency Platform · Digital Screen / CMS / Device Management · AI Recommendation & Creative Engines · Full Analytics Suite · Scale-phase Security & Infrastructure.

---

## Recommended Sequence to Close the Tier 1 Gaps

1. **Viewer, Request Engine, and Admin module docs** — fast, follows the exact pattern already set by `inventory.md` and `owner-platform.md`; completes the spec set with no new decisions required.
2. **API Specification + Database Design** — unblocks engineering from actually starting.
3. **Terms of Service + Security doc** — must exist before any real Publisher data or listing goes live, not after.
4. **Content Moderation Guidelines + Support Runbook** — needed before Admin starts approving real listings, not after the first dispute happens.
5. **QA Test Plan + Analytics Tracking Plan** — parallel track; needed by launch to actually measure whether the MVP hypothesis worked.
6. **Remaining UI screens** — can run in parallel with engineering build.

---

_Update this file's status column as each document is produced — it's meant to be the one place that answers "what's left."_
