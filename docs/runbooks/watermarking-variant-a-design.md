# Design note — restoring server-side watermarking (Variant A)

`api-specification.md` §14.2, §46 Q10 · `mvp-prd.md` §7.7 · IMPLEMENTATION-PLAN.md
§Phase 11 ("(Post-MVP hook) server-side watermarking design recorded for when
real inventory goes live"). Recorded per that instruction — **not
implemented**; the live `POST /api/v1/hoardings/{id}/media` route still runs
Variant B (`lib/inventory/watermark.ts`, browser Canvas) today.

## Why this is worth recording now, not later

`api-specification.md` §46 Q10 already says to "restore Variant A before real
Publisher inventory goes live... because a watermark the Publisher can switch
off is not a trust control." The billboard-inventory import (out-of-sequence,
ahead of this phase) put 62 real, public listings live — so that condition
has technically already occurred, just through an Admin-run import script
rather than the ordinary self-serve upload route. That route is the actual
gap; this note is what closing it would look like.

## The reference implementation already exists — just not in the right runtime

`scripts/import-billboards.mjs`'s `watermarkImage()` is a working Variant A:
`sharp(filePath).rotate()` → resize to `MEDIA_MAX_LONG_EDGE` → `.composite()`
a generated tiled SVG mark → re-encode as JPEG. It runs correctly because the
import script executes under plain **Node.js** on a developer machine
(`node scripts/import-billboards.mjs`).

`POST /api/v1/hoardings/{id}/media`, by contrast, is a Next.js Route Handler
that ships to **Cloudflare Workers** via OpenNext. `sharp` is a native
addon (libvips bindings) — it cannot load in the Workers V8 isolate.
`seeable_free_first_techstack.md` §18 already flagged this as the reason
Variant B was chosen for the ₹0 stack; nothing about that constraint has
changed.

## What would actually have to change

Restoring Variant A for the live route means moving the watermark step
somewhere `sharp` (or an equivalent) can run — not just calling the existing
function from the Worker. Three real options, roughly in order of fit for
this project's ₹0/Supabase-first stack:

1. **A Supabase Edge Function** (Deno runtime, not Workers) does the
   watermarking. `POST /api/v1/hoardings/{id}/media` uploads the original to
   `hoarding-private` (already provisioned, already unreachable by
   anon/authenticated) and enqueues a job; the Edge Function watermarks and
   writes the derivative to `hoarding-public`, then updates
   `hoarding_media.processing_status` to `WATERMARKED`. This is the path
   `api-specification.md` already designed for under "Variant A" — `202
   Accepted`, `processing_status: "UPLOADED"` until the derivative exists,
   `POST /api/jobs/process-media` polled by `pg_cron` (§14.2, §28.7 — those
   sections already assume this shape). Deno doesn't run `sharp` either, but
   a WASM image library (e.g. `@jsquash/*` or `photon` compiled to WASM) does
   the same resize+composite operation Deno-side.
2. **A tiny external Node service** (Cloudflare Workers can call out to it)
   does the same job as the import script, over an authenticated HTTP call.
   More infrastructure to run and pay for than option 1; only worth it if the
   Edge Function's WASM image tooling turns out to be a poor fit.
3. **Cloudflare Images** (transform + a Worker-side overlay) — avoids Node
   entirely, but is a paid product beyond the Free plan the rest of this
   stack depends on (`seeable_free_first_techstack.md`), so it's listed for
   completeness, not recommended at MVP budget.

Whichever path: the wire contract in `api-specification.md` §14 already
describes both variants (`202`/`UPLOADED` vs `201`/`WATERMARKED`), and
`submit_hoarding_for_review()`'s "every media row must be `WATERMARKED`"
gate doesn't change — only which process flips that flag does.

## What this note does not do

It doesn't migrate the live route, add the Edge Function, or change any
schema — `hoarding_media.processing_status` and the two storage buckets are
already shaped for either variant. This is the design to execute against
when that migration is actually scheduled.
