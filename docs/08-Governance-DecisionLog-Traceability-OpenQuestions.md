# SEEABLE HOARDINGS — UI/UX Design Documentation
## File 08 of 9 — Governance: Decision Log, Traceability Matrix, Final Screen Inventory, Quality Audit, Open Questions, Future Considerations

---

## 29. UX Decision Log

Every non-obvious decision made in this documentation, in one place, with its rationale and where it's applied. Use this as the changelog if any of these decisions is later revisited.

| # | Decision | Rationale | Applied in |
|---|---|---|---|
| D1 | Light theme is canonical for the entire authenticated app, including AUTH-01 | Master brief explicitly specifies light theme for "the product," unqualified; a dark-to-light seam at login is a bigger UX risk than not matching a dark reference doc that itself scopes to the marketing site | File 02 §8, File 05 AUTH-01 |
| D2 | Publisher can build and Draft-save a listing while verification is pending, but not Submit | Keeps a new Publisher productively occupied during verification wait without violating `AUTH-002` | File 01 §6.3 |
| D3 | Publishers and Listings combined into one Admin screen (AD-02) with a sub-view toggle | Matches the reference screenshot and `admin-platform.md`'s narrow, unified moderation scope — doesn't warrant two separate top-level screens | File 05 AD-02 |
| D4 | Publisher Suspend does not cascade to delist their other listings | Implements `ADMIN-002`/`ADMIN-004`'s literal, independent scoping exactly as specified in source docs, rather than silently "fixing" a possibly-unintended gap | File 06 §12.1, File 05 AD-02 |
| D5 | Publisher's Request rejection reason is optional; Admin's listing rejection reason is mandatory | Matches the differing explicit rules in source docs (`ADMIN-003` vs. no equivalent Publisher-side rule) rather than harmonizing them without a product decision to do so | File 01 §7.3, File 04 PB-07 |
| D6 | Admin's Publisher-verification rejection also requires a reason | Applies the same trust/clarity logic as `ADMIN-003` by analogy, even though no source doc separately states it for verification | File 05 AD-03 |
| D7 | Prices normalized to a per-month equivalent for filter/sort only, never for display | Different hoarding types price on different natural cycles; comparing "/month" and "/2 weeks" listings requires normalization somewhere, but the Publisher's actual entered terms must never be misrepresented | File 06 §9.2 |
| D8 | Digital hoarding types are shown, disabled, in Type selectors — never hidden entirely | Signals the taxonomy exists without falsely implying it's bookable; avoids surprising a Publisher/Viewer who later learns digital inventory exists | File 06 §10.2 |
| D9 | No decorative illustrations anywhere in the product | Directly implements the brief's "high information clarity" and restrained, premium direction; illustrations would also invite scope creep into brand-marketing territory that belongs to the separate marketing site | File 07 §21.2 |
| D10 | Status text is always sourced from the server (`status_label`), never derived client-side from a raw enum | Keeps copy centrally controlled and avoids the Listing-"Pending Approval"-vs-Request-"Pending" naming collision from ever surfacing inconsistently | File 06 §11.3, File 07 §25 |
| D11 | Precise map pins shown to all Viewers at all times, no location fuzzing | A hoarding is fixed public infrastructure, not a private space — unlike marketplaces that fuzz addresses pre-booking, there is no privacy rationale here, and precision serves the core discovery use case | File 07 §27 |
| D12 | Overlays never stack more than one deep; a nested action becomes an inline expansion, not a second modal | Prevents disorienting overlay-on-overlay navigation in dense Admin/Publisher review flows | File 07 §19 |
| D13 | Minimum 3 photos required to Submit (not to Draft-save) | A concrete, buildable number was needed where source docs are silent; 3 is the minimum that gives a Viewer a credible sense of a physical site from more than one angle | File 04 PB-03 Step 4, File 07 §26 |
| D14 | No Viewer-initiated cancel/withdraw of a Pending Request is designed | No source document describes this capability; adding it would be inventing a feature, not filling a genuine gap — the absence is deliberate, not an oversight | File 03 VW-05 |
| D15 | The "Admin can Mark Completed but cannot view/search Requests generally" gap is surfaced explicitly, not designed around | The underlying API limitation (`api-specification.md` §6.6) is real; building a Request-inbox screen the API can't back would be designing past a stated constraint, which the brief prohibits | File 06 §14.2 |

---

## 30. Requirement-to-UX Traceability Matrix

Maps the core, explicitly-numbered business rules this documentation was built against to the screens/sections implementing them. This is the subset of rule IDs used with confidence and consistency throughout Files 00–07; the full rule sets in `mvp-prd.md` (e.g., additional `VIEWER-*`, `OWNER-*`, `CONTENT-*`, `NOTIF-*`, and `BR-*` rules beyond the ones below) should be walked against this matrix's structure directly from that source document during Figma/dev handoff QA, since not every individual numbered rule from that document was retained at this level of granular ID precision through this documentation's drafting process — this matrix guarantees traceability for the rules that shape the most consequential UI decisions, and names where the remaining rule families are addressed thematically even where an exact ID isn't cited.

| Rule ID | Rule (summarized) | Implemented in |
|---|---|---|
| `AUTH-002` | Publisher/Viewer must be verified/authenticated per the approved flow before submitting a listing/Request; current demo build defers OTP to password-based login (Viewer-confirmed; Publisher-side status is an Open Question) | File 00 §3.6, File 04 PB-08, File 05 AUTH-02 |
| `INVENTORY-003` | Composite listing visibility = Approved AND NOT Paused AND NOT Delisted (AND Publisher not Suspended) | File 06 §12.1, File 03 VW-01, File 04 PB-02, File 05 AD-02 |
| `REQUEST-004` | Two overlapping Requests for the same hoarding must never both reach Confirmed (DB-enforced) | File 06 §11.2, File 03 VW-04, File 04 PB-07, File 07 §28 |
| `ADMIN-002` | Suspending a Publisher never cancels their already-Confirmed Requests | File 05 AD-02, File 07 §22 |
| `ADMIN-003` | Admin's listing rejection requires a mandatory reason | File 01 §7.2, File 05 AD-04 |
| `ADMIN-004` | Delisting a hoarding is independent of the owning Publisher's suspension status | File 01 §7.4, File 05 AD-02, File 06 §12.1 |
| *(Thematic coverage, exact IDs not individually re-cited)* `VIEWER-*` — Discovery, filtering, Shortlist, Request-submission behavior | File 03 (all Viewer screens), File 06 §9/§11 |
| *(Thematic coverage)* `OWNER-*` — Publisher listing lifecycle, availability management, Request response | File 04 (all Publisher screens), File 06 §10/§12 |
| *(Thematic coverage)* `CONTENT-*` — hoarding content/taxonomy/media requirements | File 04 PB-03, File 06 §10, File 07 §26 |
| *(Thematic coverage)* `NOTIF-*` — notification triggers (channel undecided, see §32) | File 07 §20 |
| *(Thematic coverage)* `BR-*` (mvp-brd.md business rules, e.g. disintermediation-driven contact visibility) | File 00 §3.4, File 03 (all), File 04 (all), File 07 §22 |

---

## 31. Final Screen Inventory

Reconciling the planned inventory (File 01 §5) against what was actually specified in Files 03–05 — confirms nothing was dropped or silently added during drafting.

**24 screens specified, matching the planned count exactly:**

- **Shared/Auth (4):** AUTH-01, AUTH-02, AUTH-03, AUTH-04 — all specified in File 05.
- **Shared, non-Auth (2):** SH-01, SH-02 — both specified in File 05.
- **Viewer (6):** VW-01, VW-02, VW-03, VW-04, VW-05, VW-06 — all specified in File 03.
- **Publisher (8):** PB-01, PB-02, PB-03 (+ its 6 internal steps), PB-04, PB-05, PB-06, PB-07, PB-08 — all specified in File 04.
- **Admin (5):** AD-01, AD-02 (with 2 sub-views), AD-03, AD-04, AD-05 — all specified in File 05.

No screen named in the planned inventory was left unspecified; no screen beyond the planned inventory was introduced during drafting (the Marketplace/Campaigns/Reports/Insights/standalone-Dashboard Viewer tabs seen in one reference screenshot were deliberately excluded per File 01 §4.1 and are catalogued as Future Considerations in §33 below, not built).

---

## 32. UX Quality Audit

A self-audit against the master brief's own rules (Rule 1–8) and this documentation's stated principles (File 00 §2).

| Check | Result |
|---|---|
| Built strictly from source docs; conflicts resolved by the stated priority order | **Pass.** Every business rule cited traces to `mvp-brd.md`, `mvp-prd.md`, `inventory.md`, `request-engine.md`, `admin-platform.md`, `viewer-platform.md`, `system-architecture.md`, or `api-specification.md`. The one deliberate conflict resolved (light vs. dark theme) is documented with its reasoning in File 02 §8, following the priority order (explicit MVP instruction over a doc that itself scopes elsewhere). |
| MVP-first — no invented features | **Pass, with one deliberate exception surfaced for transparency:** every capability beyond source-doc scope is explicitly labeled **Future Consideration** (consolidated in §33). The narrow admin surface, the absence of payment UI, and the absence of a Viewer cancel/withdraw action are all preserved as scoped, not "improved." |
| Implementation-ready | **Pass.** Every screen carries the full 13-field template (Purpose/User/Entry/Exit/Layout/Wireframe/Components/Content/Interactions/States/Responsive/Accessibility/Business Rules/API Dependencies); design tokens are copy-paste-ready CSS custom properties (File 02 §11); contrast ratios are computed, not asserted. |
| Consistency — patterns defined once, referenced elsewhere | **Pass.** Forms, Tables, Modals/Drawers, Notifications, Loading/Empty/Error, Access Control, Responsive, and Accessibility rules live once in File 07 and are cited (not re-explained) from every screen spec in Files 03–05. |
| Clarity over decoration | **Pass.** No decorative illustrations anywhere (D9); restrained gold-accent rule enforced with computed contrast pairings, not just asserted "use sparingly" language. |
| Realistic Indian OOH content; no Lorem Ipsum | **Pass.** A single recurring example dataset (Premium Unipole — Hosur Road, Silk Board Gantry, Indiranagar Wall Wrap, Hebbal Flyover Unipole, Koramangala Bus Shelter, Namma Outdoor Media, Bangalore Ad Spaces, Aarav Patel/Rohan Mehta) is reused across all 9 files rather than inventing fresh examples per screen. |
| Bengaluru-first | **Pass.** Every location example is a real Bengaluru-area reference (Hosur Road, Silk Board, Indiranagar, Hebbal, Koramangala, Outer Ring Road, Electronic City). |
| Uncertainty explicitly labeled, not silently resolved | **Pass.** 15 UX Assumptions and 23 Open Questions are labeled in-context and consolidated below (§33) — none were silently decided and presented as settled fact. |
| **Self-identified gaps in this documentation itself** (an honest audit finding, not a pass/fail line item) | Two items were carried forward as unconfirmed rather than guessed: the exact name of the 6th static hoarding type and the 2nd digital type (File 06 §10.1), and the exact full Site Intelligence field list beyond the three fields used consistently as examples (File 06 §10.3). Both should be verified directly against `inventory.md`'s canonical taxonomy/field tables before Figma or dev work begins on PB-03 Step 1/2/3 and VW-03's Site Intelligence panel — this is flagged here as the single most important verification step before build, since an incorrect guess in either spot would propagate into real component/field naming. |

---

## 33. Open Questions & UX Assumptions (Consolidated)

Every item below appears in context somewhere in Files 00–07; this section exists purely so a reviewer can scan all of them in one place without hunting file-by-file.

### 33.1 UX Assumptions (judgment calls made to keep the MVP buildable — confirm with product)

1. A Publisher may Draft-save while verification is pending but cannot Submit until verified (File 01 §6.3).
2. PB-03 Step 5's exact content (grouped as "Pricing & Availability") was inferred to fill a gap between the confirmed Step 4 (Media) and Step 6 (Review) screenshots (File 04 PB-03).
3. The hoarding size field's unit is feet, the de facto Indian OOH standard (File 04 PB-03 Step 2).
4. Minimum 3 photos required to Submit a listing (File 04 PB-03 Step 4 / File 07 §26).
5. A Publisher's Request rejection does not require a reason, unlike Admin's mandatory listing-rejection reason (File 01 §7.3 / File 04 PB-07).
6. Admin's Publisher-verification rejection requires a reason, by analogy with `ADMIN-003` (File 05 AD-03).
7. Prices are normalized to a per-month equivalent for filtering/sorting only, never for display (File 06 §9.2).
8. AUTH-01 (pre-login landing) uses the light theme rather than the dark marketing-site reference, for a single seamless system (File 02 §8) — also listed as an Open Question below, since the alternative (a deliberate two-theme split at login) is equally defensible and worth a business decision.
9. Un-suspend (Publisher) and Re-list (hoarding) reversal actions are included as the minimum reasonable counterparts to Suspend/Delist, though no source doc explicitly describes them (File 05 AD-02).
10. The "fits two types" taxonomy edge case resolves to the Publisher picking the closer-fitting type, with Admin able to reject-with-reason if miscategorized; no type-change-after-creation flow is designed (File 07 §28).
11. Lucide (or an equivalent open-source line-icon set) is recommended for iconography (File 02 §9.4).
12. The unread-notification indicator is a dot, not a number, below an unspecified small-count threshold (File 05 SH-02).
13. Publisher-verification turnaround copy ("1–2 business days") is illustrative, not a committed SLA (File 04 PB-08).
14. Editing contact info in Account Settings does not retroactively change what's shown on already-existing Requests (treated as most-likely correct but unconfirmed) (File 05 SH-01).
15. A digital-type Publisher account can still Draft-save with a reduced field set even though Submission is blocked (File 06 §10.2 / File 04 PB-03 Step 1).

### 33.2 Open Questions (genuine unresolved decisions — need a product/business answer)

1. **Exact Publisher-response SLA duration** for a Pending Request (File 03 VW-04, File 06 §11.2).
2. **SLA clock start-trigger** — exact moment it begins (File 06 §11.1).
3. **Whether a Viewer can cancel/withdraw a Pending Request** — not supported by any source doc; currently designed as unsupported (File 03 VW-05).
4. **Who captures `amount_agreed` and when**, if ever, inside the product (File 06 §11.4).
5. **Exact search/sort/pagination mechanics** for Discovery beyond this documentation's own reasonable defaults (File 06 §9.1/§9.3).
6. **Notification channel mix** (push, SMS, email, or a combination) — undecided in source docs (File 07 §20).
7. **Whether Publisher login also uses the OTP-deferred demo variance** documented for Viewers, or targets OTP from day one (File 00 §3.6, File 04 PB-08).
8. **Minimum required photo count** — this documentation assumes 3; no source doc states a number (File 04 PB-03 Step 4).
9. **Hoarding-type-change-after-creation behavior** — assumed unsupported/immutable; not explicitly stated (File 07 §28).
10. **The "fits two types" taxonomy edge case's correct resolution** — assumed Publisher-choice-plus-Admin-review; not explicitly stated (File 07 §28).
11. **Exact API endpoints for Un-suspend and Re-list** — this documentation assumes they exist as reasonable counterparts; not confirmed in the reviewed `api-specification.md` sections (File 05 AD-02).
12. **Whether Publisher suspension should cascade to delist their other listings** — currently does not, per a literal reading of `ADMIN-002`/`ADMIN-004`, but `admin-platform.md` itself flags this as possibly unintended (File 06 §12.1).
13. **The single most consequential gap: Admin can Mark-Completed a Request but has no general capability to view, search, or list Requests directly** — a real dispute-resolution/support blind spot in a payment-free marketplace whose primary risk is disintermediation (File 06 §14.2/§14.3). Recommended for a pre-launch or fast-follow product decision, not left for a later roadmap review.
14. **Exact name of the 6th static hoarding type and the 2nd digital hoarding type** — not reconfirmed against `inventory.md`'s canonical taxonomy table during this documentation's drafting; verify before build (File 06 §10.1, also flagged in §32's audit).
15. **The full Site Intelligence field list** beyond the three fields (Traffic Volume, Visibility Rating, Nearby Landmarks) used consistently as this documentation's working set — `mvp-prd.md` may specify additional fields not re-verified here (File 06 §10.3).
16. **Whether editing Account Settings contact info retroactively affects already-created Requests' embedded summaries** (File 05 SH-01).
17. **Whether the pre-login landing experience (AUTH-01) should deliberately use the dark marketing-site identity while the authenticated app uses light** (a considered alternative to D1/D11 above), or whether one light system should extend end-to-end as this documentation specifies (File 02 §8).
18. **Exact minimum photo file-size/resolution/format constraints** (File 07 §26).
19. **Whether additional Discover filters** (illumination, exact size range) are needed beyond Type/Budget/Distance/Location-text (File 06 §9.1).
20. **Whether a minimal, read-only Admin Request-lookup/search capability should be added before launch** to close the gap in item 13 (File 06 §14.3) — named as a Future Consideration candidate, but flagged here because of its direct link to the business's own named top risk (disintermediation/disputes).
21. **Whether post-Confirmed contact exchange between Viewer and Publisher should eventually be allowed**, loosening the conservative "never expose contact info" default once a campaign is genuinely committed (File 00 §3.4).
22. **Whether the two-layer Pause/Delist model should expose a combined "why isn't this visible" explanation more prominently to Publishers** than the current secondary-annotation treatment (File 06 §12.1) — a minor open polish question, not a blocking one.
23. **Exact required verification documents/fields** for Publisher KYC (File 04 PB-08) — this documentation uses a generic "verification document" placeholder pending a legal/compliance-driven answer.

---

## 34. Future UX Considerations

Named explicitly so none of these is mistaken for MVP scope, and so a future phase has a ready-made, already-labeled backlog drawn directly from what this documentation deliberately did not build.

| Future Consideration | Why it's out of MVP scope | Where flagged |
|---|---|---|
| Agency, Technician, and Operator roles | `mvp-prd.md`/`mvp-brd.md` scope only Publisher/Viewer/Admin at MVP | File 00 §3 |
| Multi-city expansion beyond Bengaluru | MVP is explicitly single-city | File 00 §1 |
| Full digital-screen listing and booking (loop scheduling, proof-of-play, slot-based availability) | Digital types exist only as data-model entries at MVP; the operational complexity of real digital inventory isn't scoped | File 06 §10.2 |
| Online payment, escrow, invoicing | MVP is explicitly payment-free; all settlement is off-platform | File 00 §1 |
| In-app contracts, e-signature, campaign management tooling | Belongs to the full-scope framework document's long-term ambition, not MVP | File 00 §1 |
| A full Admin console: audit log, RBAC tiers, bulk actions, financial administration | `admin-platform.md` explicitly scopes Admin narrowly for MVP | File 06 §14.1 |
| AI-assisted or automated moderation | Not requested anywhere in MVP source docs; current moderation is fully manual (Admin review) | File 06 §14.1 |
| Personalized/AI-driven ranking and recommendations in Discovery | Full-scope framework's ambition; would also undermine the transparent, reasoning-friendly filter model this MVP relies on for trust | File 06 §9.5 |
| A Shortlist comparison table (side-by-side spec comparison) | `mvp-prd.md` scopes Shortlist as a simple save-list only | File 03 VW-06 |
| Geocoded "search this address, show a radius" search (vs. simple text matching) | A reasonable enhancement over MVP's text-match search, not a redesign | File 07 §27 |
| Custom Publisher-configurable watermark branding | Watermarking exists at MVP but is uniform, not Publisher-customizable | File 06 §10.4 |
| A minimal, read-only Admin Request-lookup/search capability | Would close the dispute-resolution gap named in §33.2 item 13 without expanding Admin's write authority — a strong fast-follow candidate given the business's own risk profile | File 06 §14.3 |
| Loosening the disintermediation contact-visibility boundary post-Confirmation | Currently a deliberately conservative "never expose" default; explicitly still open in source docs as a future policy question | File 00 §3.4 |
| An in-app record of `amount_agreed` (without processing payment) | Would materially help future dispute resolution; not designed at MVP since no source doc requests it and it isn't needed for the core Request mechanism to function | File 06 §11.4 |
| Marketplace / Campaigns / Reports / Insights tabs, and a standalone Viewer Dashboard tab | Seen in one reference screenshot set but not in `mvp-prd.md`'s MVP scope — these imply post-booking campaign analytics that don't exist yet (no live campaign management, no spend data) | File 01 §4.1 |
| Publisher-configurable minimum-stay/minimum-booking-length rules | Not requested in any source doc; noted here only because it's a common adjacent-marketplace feature worth explicitly *not* assuming | This file, §34 (newly named) |
| Two-theme system (dark pre-login marketing identity + light authenticated product) as a deliberate design, if the business decides against D1/D11's single-system approach | Currently resolved as a single light system throughout; the alternative is viable and named for completeness | File 02 §8 |

---

## Closing Note

This 9-file documentation set is implementation-ready as specified, with two verification steps flagged as prerequisites to starting Figma/dev work (the unconfirmed hoarding-type names in §32/§33.2 item 14, and the Site Intelligence field list in §33.2 item 15), and one operational risk flagged as worth a pre-launch product decision rather than a later roadmap conversation (the Admin Request-visibility gap, §33.2 item 13). Every other open item is a normal, expected byproduct of designing from real, sometimes-incomplete source documentation honestly rather than papering over gaps — which is precisely what Rule 8 of the original brief asked for.

**End of SEEABLE HOARDINGS UI/UX Design Documentation (Files 00–08).**
