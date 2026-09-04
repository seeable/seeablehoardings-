# Runbook — Support & Dispute Handling (minimal, MVP stage)

`mvp-brd.md` §12 (no-recourse disputes) · §17 (Risks) · IMPLEMENTATION-PLAN.md
§Phase 11. There is no support ticketing system, in-app "report" button, or
payment-based enforcement in this product yet. This is what an operator
actually does today when a dispute reaches them — it does not describe a
feature to build first.

## The honest starting position

Settlement is offline by design (`mvp-brd.md` §13.1). If a Viewer doesn't pay
after a Publisher holds dates, or a Publisher doesn't deliver after being
paid, **SEEABLE has no mechanism to make either party whole** — this is a
disclosed MVP risk (`mvp-brd.md` §17), not an oversight. The runbook below is
about the moderation lever the platform *does* have (an account/listing on
the platform), not about resolving money already exchanged outside it.

## When a dispute reaches an operator

1. **Identify what's actually in dispute.** A request only carries dates and
   an optional message (`requests.message`) — there is no in-app record of a
   price, a delivery date, or anything agreed after the two parties made
   contact. Ask both sides for their side of what was agreed and when;
   SEEABLE's own data (`request_status_history`, `GET
   /api/v1/requests/{id}/history`) only shows the request's own lifecycle
   (REQUESTED → CONFIRMED/REJECTED/EXPIRED), not what happened after.
2. **Decide if this is a platform-policy question or a private commercial
   one.** "The Publisher never showed up / never paid" is a private dispute
   — SEEABLE can't adjudicate it and shouldn't imply it will. "The listing
   photo wasn't the real site" or "the Publisher asked to pay in cash outside
   the app to avoid us seeing it" is a policy question — apply
   `content-moderation.md`.
3. **If it's a policy question**, use the existing Admin actions
   (`reject_listing`, `delist_hoarding`, `suspend_publisher`) with a specific
   `reason` describing what was reported and what evidence was reviewed. Every
   action already writes to `admin_actions` — that row *is* the case record;
   there's no separate ticket system to also update.
4. **If it's a private commercial dispute**, say so plainly to whoever
   raised it: SEEABLE facilitated the introduction, isn't a party to what was
   agreed after, and can't recover money or compel delivery. Point them back
   to the terms they already agreed to (`/terms`).
5. **Log the pattern even when you can't act on one instance.** A single
   "they didn't pay" complaint isn't actionable; three against the same
   Viewer, or a Publisher with a pattern of no-shows after confirmation, is a
   `suspend`-worthy trust signal per `content-moderation.md`.

## What doesn't exist yet (don't imply it does)

- No in-app way for a Viewer or Publisher to report a problem — they reach
  an operator by whatever channel they already have (this MVP has no public
  support inbox — see `/privacy`).
- No refund/chargeback mechanism — there's no payment to refund.
- No formal appeals process for a rejected/suspended account — an operator
  re-reviewing the original `admin_actions` reason against new evidence *is*
  the appeals process at this stage.
