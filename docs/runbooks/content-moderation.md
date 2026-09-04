# Runbook — Content Moderation Criteria

`mvp-brd.md` §7.5 (Trust and Moderation) · §12 (no-recourse disputes) ·
IMPLEMENTATION-PLAN.md §Phase 11. This is the criteria an Admin applies when
reviewing a listing (`approve_listing` / `reject_listing`) or a Publisher
account (`suspend_publisher` / `verify_publisher`) — it doesn't add a new
mechanism, it documents how to use the ones that already exist
(`docs/admin-platform.md` AD-04, AD-02).

## Why this exists

There is no payment/escrow at MVP (`mvp-brd.md` §13.2), so Admin review before
a listing reaches Discover is the platform's only compensating control against
a Viewer being misled or a bad-faith Publisher — `ADMIN-001` in
`api-specification.md` is the rule; this is the judgment behind it.

## Listing review (`AD-04`) — reject if any of:

- **Photo doesn't show the claimed space.** Stock imagery, a screenshot, a
  photo of an unrelated site, or an image that's clearly not the physical
  hoarding/shelter/pole being listed.
- **Missing or implausible core facts.** No location info at all where the
  type requires it; coordinates that fall outside Bengaluru for a listing
  that doesn't say otherwise (`hoardings.city`/`locality` should match); a
  price with no plausible relationship to size/type (e.g. ₹50 for a month on
  a full unipole).
- **Duplicate of an existing live listing** — same Publisher, same space,
  already approved. Reject the duplicate, don't approve a second row for one
  physical asset.
- **Prohibited content in the image or description** — anything illegal to
  advertise space for, contact information embedded in the photo/description
  to route around the request flow (a disintermediation attempt, `mvp-brd.md`
  §12), or content unrelated to outdoor advertising space entirely.
- **Unwatermarked or tampered media** — `CONTENT-001`'s compensating control;
  `submit_hoarding_for_review()` already blocks submission until every media
  row is `WATERMARKED`, so seeing anything else at review time is itself a
  signal to reject and investigate, not just wait.

Approve when the above don't apply, even if some optional fields (site
intelligence, exact coordinates) are missing — `HOARDING_MISSING_CORE_FIELDS`
already gates what's mandatory before submission; a reviewer isn't the second
enforcement layer for optional fields.

## Publisher suspension (`AD-02`) — suspend if:

- Confirmed pattern of the listing-review issues above across multiple
  listings from the same Publisher (one rejected listing is a review outcome;
  a pattern is a trust problem).
- Confirmed report of a Publisher privately arranging different terms after
  accepting a request in-app, in a way that damaged a Viewer.
- Confirmed identity/business-verification fraud (`PB-08` — a submitted
  verification document that doesn't match the claimed business).

Suspension immediately drops a Publisher's listings from Discover
(`search_available_hoardings()` — `visible_hoardings` still requires
`not is_paused and not is_delisted`, and `AD-02`'s suspend flow sets the
listings side effect) without touching already-`CONFIRMED` requests — the
existing booking isn't retroactively voided.

## What this is not

There's no automated content scanner or an appeals workflow at MVP — every
decision here is a human Admin judgment call, logged to `admin_actions` with
a reason. If the reason doesn't fit cleanly into the categories above, err
toward writing out the specific concern in the action's `reason` field rather
than forcing it into one of these buckets.
