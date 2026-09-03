-- =============================================================================
-- Phase 8 · Publisher Platform — PB-08 verification submission + PB-01 support
-- 04-Screens-Publisher.md PB-01/PB-08 · api-specification.md §22 · IMPLEMENTATION-PLAN.md §Phase 8
-- =============================================================================
-- Phase 1 built the Admin side (verify_publisher / reject_publisher_verification,
-- the OWNER-004 gate inside submit_hoarding_for_review). This adds the
-- Publisher-initiated side:
--
--   1. verification_status gains 'PENDING' — PB-08's "under review" state.
--      Additive: computeGates / submit_hoarding_for_review / public_hoarding_listings
--      all key off `= 'VERIFIED'`, so PENDING behaves exactly like UNVERIFIED
--      for every gate.
--   2. business_type / verification_document_path / verification_submitted_at.
--   3. publisher-private bucket — the verification document, isolated the same
--      way as hoarding-private (no storage.objects policy at all).
--   4. submit_publisher_verification() — Publisher-initiated, PENDING transition.
--   5. get_verification_document_path() — self-or-Admin accessor (Phase 9 UI).
-- =============================================================================

alter table publisher_profiles
  drop constraint publisher_profiles_verification_status_check,
  add constraint publisher_profiles_verification_status_check
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'));

alter table publisher_profiles
  add column if not exists business_type text,
  add column if not exists verification_document_path text,
  add column if not exists verification_submitted_at timestamptz;

-- The verification document. Private bucket, NO row-level policy on
-- storage.objects — unreachable by anon/authenticated; only the service role
-- (BYPASSRLS) writes it, only the Admin reads it (via a signed URL minted
-- server-side in Phase 9). Mirrors hoarding-private exactly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publisher-private', 'publisher-private', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- submit_publisher_verification — Publisher-initiated. Operates on the caller's
-- own row (auth.uid()); from UNVERIFIED / REJECTED only (a resubmit re-enters
-- the queue). D7 SEEABLE_CODE tags.
create or replace function submit_publisher_verification(
  p_business_name text,
  p_business_type text,
  p_document_path text
)
returns publisher_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_pp publisher_profiles;
begin
  select * into v_pp from publisher_profiles where id = auth.uid() for update;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  if v_pp.suspended then
    raise exception 'Suspended Publishers cannot submit verification'
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_SUSPENDED';
  end if;

  if v_pp.verification_status not in ('UNVERIFIED', 'REJECTED') then
    raise exception 'Verification cannot be submitted from status %', v_pp.verification_status
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_VERIFICATION_STATE_CONFLICT';
  end if;

  if p_business_name is null or btrim(p_business_name) = '' then
    raise exception 'A business name is required'
      using errcode = '23514', detail = 'SEEABLE_CODE=VALIDATION_ERROR';
  end if;

  update publisher_profiles
  set business_name                 = btrim(p_business_name),
      business_type                 = nullif(btrim(coalesce(p_business_type, '')), ''),
      verification_document_path    = nullif(btrim(coalesce(p_document_path, '')), ''),
      verification_status           = 'PENDING',
      verification_submitted_at     = now(),
      verification_rejection_reason = null
  where id = auth.uid()
  returning * into v_pp;

  return v_pp;
end;
$$;

revoke execute on function public.submit_publisher_verification(text, text, text) from anon, public;
grant execute on function public.submit_publisher_verification(text, text, text) to authenticated;

-- get_verification_document_path — the owning Publisher or an Admin. The path
-- feeds a service-role signed-URL mint; it is never a public URL.
create or replace function get_verification_document_path(p_publisher_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_path text;
begin
  if p_publisher_id <> auth.uid() and not is_admin() then
    raise exception 'Not authorized to read this document'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  select verification_document_path into v_path
  from publisher_profiles where id = p_publisher_id;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  return v_path;
end;
$$;

revoke execute on function public.get_verification_document_path(uuid) from anon, public;
grant execute on function public.get_verification_document_path(uuid) to authenticated;
