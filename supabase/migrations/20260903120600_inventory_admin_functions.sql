-- =============================================================================
-- Phase 1 · 07 — Inventory & Admin-moderation functions
-- database-design.md §26, §41.7 · IMPLEMENTATION-PLAN.md §Phase 1 step 9
-- =============================================================================
-- D7 SEEABLE_CODE on every raise. Deviations from database-design.md §41.7,
-- all additive (finer-grained codes, never new behaviour):
--   * submit_hoarding_for_review splits "Verified AND not Suspended" into two
--     checks so the facade can return PUBLISHER_NOT_VERIFIED vs PUBLISHER_SUSPENDED.
--   * delist/relist check existence separately from state (HOARDING_NOT_FOUND
--     vs HOARDING_ALREADY_DELISTED / HOARDING_NOT_DELISTED).
-- =============================================================================

-- submit_hoarding_for_review — the full submission gate, all in one place.
create or replace function submit_hoarding_for_review(p_hoarding_id uuid)
returns hoardings
language plpgsql security definer set search_path = public as $$
declare
  v_hoarding hoardings;
  v_pp publisher_profiles;
  v_media_count integer;
  v_unwatermarked_count integer;
begin
  select * into v_hoarding from hoardings where id = p_hoarding_id for update;

  if not found then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;

  if v_hoarding.publisher_id <> auth.uid() then
    raise exception 'Not authorized to submit this listing'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  -- Resubmission after rejection re-enters the same pipeline directly (§17).
  if v_hoarding.approval_status not in ('DRAFT', 'REJECTED') then
    raise exception 'Only a Draft or Rejected listing can be submitted for review (current status: %)', v_hoarding.approval_status
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_INVALID_STATE';
  end if;

  select * into v_pp from publisher_profiles where id = v_hoarding.publisher_id;
  if v_pp is null or v_pp.verification_status <> 'VERIFIED' then
    raise exception 'Publisher must be Verified before submitting a listing (OWNER-004)'
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_NOT_VERIFIED';
  end if;
  if v_pp.suspended then
    raise exception 'Suspended Publishers cannot submit listings (ADMIN-002)'
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_SUSPENDED';
  end if;

  if v_hoarding.price is null or v_hoarding.latitude is null or v_hoarding.longitude is null then
    raise exception 'Price and location are required before submission'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_MISSING_CORE_FIELDS';
  end if;

  if not hoarding_has_required_attributes(p_hoarding_id) then
    raise exception 'Missing required attributes for this hoarding type (INVENTORY-001)'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_INCOMPLETE_ATTRIBUTES';
  end if;

  select count(*) into v_media_count from hoarding_media where hoarding_id = p_hoarding_id;
  if v_media_count < 1 then
    raise exception 'At least one media asset is required before submission'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_MISSING_MEDIA';
  end if;

  select count(*) into v_unwatermarked_count
  from hoarding_media where hoarding_id = p_hoarding_id and processing_status <> 'WATERMARKED';
  if v_unwatermarked_count > 0 then
    raise exception 'All media must finish watermarking before submission (CONTENT-001)'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_MEDIA_NOT_WATERMARKED';
  end if;

  update hoardings
  set approval_status = 'PENDING_REVIEW', rejection_reason = null
  where id = p_hoarding_id
  returning * into v_hoarding;

  return v_hoarding;
end;
$$;

-- approve_listing / reject_listing — Admin-only. FOR UPDATE row locking resolves
-- "two Admins, same queue item" structurally (§26).
create or replace function approve_listing(p_hoarding_id uuid)
returns hoardings
language plpgsql security definer set search_path = public as $$
declare
  v_hoarding hoardings;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  select * into v_hoarding from hoardings where id = p_hoarding_id for update;
  if not found then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;

  if v_hoarding.approval_status <> 'PENDING_REVIEW' then
    raise exception 'Listing is not awaiting review (current status: %)', v_hoarding.approval_status
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_INVALID_STATE';
  end if;

  update hoardings
  set approval_status = 'APPROVED', approved_at = now(), approved_by = auth.uid(), rejection_reason = null
  where id = p_hoarding_id
  returning * into v_hoarding;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();

  insert into admin_actions (admin_id, admin_label, action_type, target_hoarding_id, target_publisher_id)
  values (auth.uid(), v_admin_label, 'LISTING_APPROVED', p_hoarding_id, v_hoarding.publisher_id);

  insert into notifications (recipient_id, type, title, message, related_hoarding_id)
  values (v_hoarding.publisher_id, 'LISTING_APPROVED', 'Your listing was approved',
          'Your listing "' || v_hoarding.title || '" is now live in search.', p_hoarding_id);

  return v_hoarding;
end;
$$;

create or replace function reject_listing(p_hoarding_id uuid, p_reason text)
returns hoardings
language plpgsql security definer set search_path = public as $$
declare
  v_hoarding hoardings;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to reject a listing (ADMIN-003)'
      using errcode = '55000', detail = 'SEEABLE_CODE=VALIDATION_ERROR';
  end if;

  select * into v_hoarding from hoardings where id = p_hoarding_id for update;
  if not found then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;

  if v_hoarding.approval_status <> 'PENDING_REVIEW' then
    raise exception 'Listing is not awaiting review (current status: %)', v_hoarding.approval_status
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_INVALID_STATE';
  end if;

  update hoardings
  set approval_status = 'REJECTED', rejection_reason = p_reason
  where id = p_hoarding_id
  returning * into v_hoarding;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();

  insert into admin_actions (admin_id, admin_label, action_type, target_hoarding_id, target_publisher_id, reason)
  values (auth.uid(), v_admin_label, 'LISTING_REJECTED', p_hoarding_id, v_hoarding.publisher_id, p_reason);

  insert into notifications (recipient_id, type, title, message, related_hoarding_id)
  values (v_hoarding.publisher_id, 'LISTING_REJECTED', 'Your listing was rejected',
          'Your listing "' || v_hoarding.title || '" was rejected: ' || p_reason, p_hoarding_id);

  return v_hoarding;
end;
$$;

-- delist_hoarding / relist_hoarding — Admin-only, independent of
-- suspend_publisher (ADMIN-004, §26).
create or replace function delist_hoarding(p_hoarding_id uuid, p_reason text default null)
returns hoardings
language plpgsql security definer set search_path = public as $$
declare
  v_hoarding hoardings;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  select * into v_hoarding from hoardings where id = p_hoarding_id for update;
  if not found then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;
  if v_hoarding.is_delisted then
    raise exception 'Listing is already delisted'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_ALREADY_DELISTED';
  end if;

  update hoardings
  set is_delisted = true, delisted_at = now(), delisted_by = auth.uid(), delist_reason = p_reason
  where id = p_hoarding_id
  returning * into v_hoarding;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();

  insert into admin_actions (admin_id, admin_label, action_type, target_hoarding_id, target_publisher_id, reason)
  values (auth.uid(), v_admin_label, 'HOARDING_DELISTED', p_hoarding_id, v_hoarding.publisher_id, p_reason);

  return v_hoarding;
end;
$$;

create or replace function relist_hoarding(p_hoarding_id uuid)
returns hoardings
language plpgsql security definer set search_path = public as $$
declare
  v_hoarding hoardings;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  select * into v_hoarding from hoardings where id = p_hoarding_id for update;
  if not found then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;
  if not v_hoarding.is_delisted then
    raise exception 'Listing is not currently delisted'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_NOT_DELISTED';
  end if;

  update hoardings
  set is_delisted = false, delisted_at = null, delisted_by = null, delist_reason = null
  where id = p_hoarding_id
  returning * into v_hoarding;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();

  insert into admin_actions (admin_id, admin_label, action_type, target_hoarding_id, target_publisher_id)
  values (auth.uid(), v_admin_label, 'HOARDING_RELISTED', p_hoarding_id, v_hoarding.publisher_id);

  return v_hoarding;
end;
$$;

-- delete_hoarding — Publisher (own) or Admin. Hard delete only succeeds when
-- the RESTRICT FK from requests allows it (§38.2).
create or replace function delete_hoarding(p_hoarding_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from hoardings where id = p_hoarding_id) then
    raise exception 'Hoarding not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=HOARDING_NOT_FOUND';
  end if;

  if not owns_hoarding(p_hoarding_id) and not is_admin() then
    raise exception 'Not authorized to delete this listing'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  begin
    delete from hoardings where id = p_hoarding_id;
  exception when foreign_key_violation then
    raise exception 'This listing has request history and cannot be deleted — delist it instead'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_HAS_REQUEST_HISTORY';
  end;
end;
$$;
