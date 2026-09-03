-- =============================================================================
-- Phase 1 · 08 — Publisher verification, media access, dashboard & search
-- database-design.md §35, §41.8 · IMPLEMENTATION-PLAN.md §Phase 1 step 9
-- =============================================================================

-- Publisher verification workflow — Admin-only.
create or replace function verify_publisher(p_publisher_id uuid)
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

  update publisher_profiles
  set verification_status = 'VERIFIED', verified_at = now(), verification_rejection_reason = null
  where id = p_publisher_id
  returning * into v_pp;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id)
  values (auth.uid(), v_admin_label, 'PUBLISHER_VERIFIED', p_publisher_id);

  return v_pp;
end;
$$;

create or replace function reject_publisher_verification(p_publisher_id uuid, p_reason text default null)
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

  update publisher_profiles
  set verification_status = 'REJECTED', verification_rejection_reason = p_reason
  where id = p_publisher_id
  returning * into v_pp;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id, reason)
  values (auth.uid(), v_admin_label, 'PUBLISHER_VERIFICATION_REJECTED', p_publisher_id, p_reason);

  return v_pp;
end;
$$;

-- suspend_publisher deliberately never touches hoardings — ADMIN-004 (§26).
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

  update publisher_profiles
  set suspended = true, suspended_at = now(), suspended_by = auth.uid(), suspension_reason = p_reason
  where id = p_publisher_id
  returning * into v_pp;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id, reason)
  values (auth.uid(), v_admin_label, 'PUBLISHER_SUSPENDED', p_publisher_id, p_reason);

  return v_pp;
end;
$$;

-- Recommendation — Pending Confirmation (§17): no un-suspend is described in
-- the source material; included because leaving no reversal path is untenable.
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

  update publisher_profiles
  set suspended = false, suspended_at = null, suspended_by = null, suspension_reason = null
  where id = p_publisher_id
  returning * into v_pp;

  if not found then
    raise exception 'Publisher profile not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=PUBLISHER_NOT_FOUND';
  end if;

  select coalesce(full_name, email, id::text) into v_admin_label from profiles where id = auth.uid();
  insert into admin_actions (admin_id, admin_label, action_type, target_publisher_id)
  values (auth.uid(), v_admin_label, 'PUBLISHER_UNSUSPENDED', p_publisher_id);

  return v_pp;
end;
$$;

-- get_original_media_path — the ONLY path to the private original (§20, §38.1).
create or replace function get_original_media_path(p_media_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_path text;
  v_hoarding_id uuid;
begin
  select original_storage_path, hoarding_id into v_path, v_hoarding_id
  from hoarding_media where id = p_media_id;

  if not found then
    raise exception 'Media not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=MEDIA_NOT_FOUND';
  end if;

  if not owns_hoarding(v_hoarding_id) and not is_admin() then
    raise exception 'Not authorized to access the original media file'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  return v_path;
end;
$$;

-- admin_dashboard_summary — guarded aggregate read (§35). total_listings counts
-- ALL listings regardless of status ("platform health" reading, §26).
create or replace function admin_dashboard_summary()
returns table (
  total_publishers bigint, verified_publishers bigint,
  total_listings bigint, approved_listings bigint, pending_listings bigint,
  total_requests bigint, confirmed_requests bigint,
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
    (select count(*) from hoardings),
    (select count(*) from hoardings where approval_status = 'APPROVED'),
    (select count(*) from hoardings where approval_status = 'PENDING_REVIEW'),
    (select count(*) from requests),
    (select count(*) from requests where status in ('CONFIRMED', 'LIVE', 'COMPLETED')),
    (select round(
        count(*) filter (where status in ('CONFIRMED', 'LIVE', 'COMPLETED'))::numeric
        / nullif(count(*), 0) * 100, 1)
     from requests);
end;
$$;

create or replace function admin_listing_queue()
returns setof hoardings
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;
  return query select * from hoardings where approval_status = 'PENDING_REVIEW' order by created_at asc;
end;
$$;

-- search_available_hoardings — the Viewer discovery query (§33). Bounding-box
-- prefilter, then exact Haversine on survivors. Runs as the caller (invoker):
-- visible_hoardings' own RLS exposes the right rows.
create or replace function search_available_hoardings(
  p_start_date date default null,
  p_end_date date default null,
  p_type_code text default null,
  p_center_lat double precision default null,
  p_center_lng double precision default null,
  p_radius_km double precision default null,
  p_max_price numeric default null
)
returns table (
  id uuid, title text, type_code text, city text, locality text,
  price numeric, price_unit text, latitude double precision, longitude double precision,
  distance_km double precision
)
language plpgsql stable as $$
declare
  v_lat_delta double precision;
  v_lng_delta double precision;
begin
  if p_center_lat is not null and p_radius_km is not null then
    v_lat_delta := p_radius_km / 111.0;
    v_lng_delta := p_radius_km / (111.0 * cos(radians(p_center_lat)));
  end if;

  return query
  select h.id, h.title, h.type_code, h.city, h.locality, h.price, h.price_unit,
         h.latitude, h.longitude,
         case when p_center_lat is not null
              then haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude)
              else null end as distance_km
  from visible_hoardings h
  where (p_type_code is null or h.type_code = p_type_code)
    and (p_max_price is null or h.price <= p_max_price)
    and (p_center_lat is null or (
          h.latitude between p_center_lat - v_lat_delta and p_center_lat + v_lat_delta
          and h.longitude between p_center_lng - v_lng_delta and p_center_lng + v_lng_delta
          and haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude) <= p_radius_km
        ))
    and (p_start_date is null or p_end_date is null
         or is_hoarding_available(h.id, p_start_date, p_end_date))
  order by (case when p_center_lat is not null
                 then haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude)
                 else 0 end) asc,
           h.created_at desc;
end;
$$;
