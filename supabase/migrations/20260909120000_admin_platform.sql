-- =============================================================================
-- Phase 9 · Admin Platform — dashboard metrics + suspension state guards
-- 05-Screens-Admin-and-Shared.md AD-01..05 · api-specification.md §24-§26
-- admin-platform.md · IMPLEMENTATION-PLAN.md §Phase 9
-- =============================================================================
-- Phase 1 already built every Admin state-transition function (verify_publisher,
-- reject_publisher_verification, suspend/unsuspend_publisher, approve/reject_
-- listing, delist/relist_hoarding) and the admin_actions audit trail. This
-- migration adds only what the Admin screens need on top:
--
--   1. admin_dashboard_summary() gains the AD-01 metrics — pending_verifications,
--      live_campaigns, active_publishers, live_in_search_listings. `requests`
--      has NO Admin SELECT policy (request-engine.md §4), so the LIVE-campaign
--      count can ONLY come from this SECURITY DEFINER aggregate.
--   2. suspend_publisher / unsuspend_publisher gain a state guard so a repeat
--      call returns 409 PUBLISHER_VERIFICATION_STATE_CONFLICT (api-spec §26.5)
--      instead of a silent no-op UPDATE. Happy path unchanged.
-- =============================================================================

-- 1. admin_dashboard_summary — recreate with the richer metric set ------------
-- Return signature changes, so DROP first. api-spec §24.4's JSON shape is
-- assembled in the route from these columns; the four AD-01 cards read
-- pending_verifications / pending_listings / active_publishers / live_campaigns.
drop function if exists admin_dashboard_summary();

create function admin_dashboard_summary()
returns table (
  total_publishers          bigint,
  verified_publishers       bigint,
  active_publishers         bigint,
  pending_verifications     bigint,
  total_listings            bigint,
  approved_listings         bigint,
  live_in_search_listings   bigint,
  pending_listings          bigint,
  total_requests            bigint,
  confirmed_requests        bigint,
  live_campaigns            bigint,
  request_to_confirmation_rate numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;
  return query select
    (select count(*) from publisher_profiles),
    (select count(*) from publisher_profiles where verification_status = 'VERIFIED'),
    (select count(*) from publisher_profiles where verification_status = 'VERIFIED' and not suspended),
    (select count(*) from publisher_profiles where verification_status = 'PENDING'),
    (select count(*) from hoardings),
    (select count(*) from hoardings where approval_status = 'APPROVED'),
    (select count(*) from hoardings
       where approval_status = 'APPROVED' and not is_paused and not is_delisted),
    (select count(*) from hoardings where approval_status = 'PENDING_REVIEW'),
    (select count(*) from requests),
    (select count(*) from requests where status in ('CONFIRMED', 'LIVE', 'COMPLETED')),
    (select count(*) from requests where status = 'LIVE'),
    (select round(
        count(*) filter (where status in ('CONFIRMED', 'LIVE', 'COMPLETED'))::numeric
        / nullif(count(*), 0) * 100, 1)
     from requests);
end;
$$;

-- 2. suspend / unsuspend — add the "already in that state" guard --------------
create or replace function suspend_publisher(p_publisher_id uuid, p_reason text default null)
returns publisher_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_pp publisher_profiles;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  select * into v_pp from publisher_profiles where id = p_publisher_id for update;
  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;
  if v_pp.suspended then
    raise exception 'Publisher is already suspended'
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_VERIFICATION_STATE_CONFLICT';
  end if;

  update publisher_profiles
  set suspended = true, suspended_at = now(), suspended_by = auth.uid(), suspension_reason = p_reason
  where id = p_publisher_id
  returning * into v_pp;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id, reason)
  values (auth.uid(), v_admin_label, 'PUBLISHER_SUSPENDED', p_publisher_id, p_reason);

  return v_pp;
end;
$$;

create or replace function unsuspend_publisher(p_publisher_id uuid)
returns publisher_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_pp publisher_profiles;
  v_admin_label text;
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;

  select * into v_pp from publisher_profiles where id = p_publisher_id for update;
  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;
  if not v_pp.suspended then
    raise exception 'Publisher is not suspended'
      using errcode = '55000', detail = 'SEEABLE_CODE=PUBLISHER_VERIFICATION_STATE_CONFLICT';
  end if;

  update publisher_profiles
  set suspended = false, suspended_at = null, suspended_by = null, suspension_reason = null
  where id = p_publisher_id
  returning * into v_pp;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id)
  values (auth.uid(), v_admin_label, 'PUBLISHER_UNSUSPENDED', p_publisher_id);

  return v_pp;
end;
$$;
