-- =============================================================================
-- Phase 5 · Storage buckets — Content Protection (mvp-prd.md §7.7, api-spec §14)
-- =============================================================================
--   hoarding-public   watermarked derivatives only. Public bucket: the `url`
--                     in a media response resolves here directly. Content is
--                     already watermarked, so a public bucket is acceptable
--                     (api-specification.md §14.7 — "either is acceptable").
--   hoarding-private  pre-watermark originals. No public flag, and — critically
--                     — NO row-level policy on storage.objects, so it is
--                     unreachable by anon/authenticated. Only the service role
--                     (BYPASSRLS) can touch it. At MVP (Variant B watermarking)
--                     no original is retained, so this bucket stays empty; it
--                     exists so the isolation is structural, not conventional.
--
-- Writes to hoarding-public are performed by the API media handler using the
-- service role (api-specification.md §14.2) — never by the browser. No client
-- INSERT policy on storage.objects is created for that reason.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('hoarding-public', 'hoarding-public', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('hoarding-private', 'hoarding-private', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
