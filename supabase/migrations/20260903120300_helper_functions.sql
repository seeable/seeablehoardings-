-- =============================================================================
-- Phase 1 · 04 — Helper functions
-- database-design.md §33, §34, §37, §41.4 · IMPLEMENTATION-PLAN.md §Phase 1 step 7
-- =============================================================================
-- SECURITY DEFINER + SET search_path = public on every function that must read
-- across an RLS boundary (§37): is_admin / owns_hoarding are called from inside
-- RLS policies (a plain function would recurse into profiles' own policy);
-- is_hoarding_available is called by Viewers who have NO direct RLS grant on
-- hoarding_availability_blocks (§37.6) and must still get a correct answer.
-- =============================================================================

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN');
$$;

create or replace function owns_hoarding(p_hoarding_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from hoardings where id = p_hoarding_id and publisher_id = auth.uid()
  );
$$;

-- Decision D8: SLA duration is CONFIG, not a constant. Redefine with
-- CREATE OR REPLACE — never a schema migration. REQUEST_SLA_HOURS mirrors this
-- value in the app layer for display only.
create or replace function default_response_sla() returns interval
language sql immutable as $$
  select interval '48 hours';
$$;

-- Decision D8: the "expiring soon" lead time, same tunability contract.
-- Mirrors REQUEST_EXPIRING_SOON_HOURS.
create or replace function default_expiring_soon_window() returns interval
language sql immutable as $$
  select interval '6 hours';
$$;

-- Haversine great-circle distance (§33). LEAST/GREATEST clamp to [-1, 1] before
-- acos — float rounding on near-identical coords otherwise yields NULL and a
-- hoarding silently vanishes from distance-sorted results.
create or replace function haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

-- Computed availability (§34) — INVENTORY-003 + Publisher blocks + confirmed
-- requests, composed live. REQUEST-002's "release dates immediately" is a
-- structural consequence of input 3 reading live status, not a separate step.
create or replace function is_hoarding_available(
  p_hoarding_id uuid, p_start_date date, p_end_date date
) returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from hoardings h
      where h.id = p_hoarding_id
        and h.approval_status = 'APPROVED'
        and not h.is_paused
        and not h.is_delisted
    )
    and not exists (
      select 1 from hoarding_availability_blocks b
      where b.hoarding_id = p_hoarding_id
        and b.date_range && daterange(p_start_date, p_end_date, '[]')
    )
    and not exists (
      select 1 from requests r
      where r.hoarding_id = p_hoarding_id
        and r.status in ('CONFIRMED', 'LIVE', 'COMPLETED')
        and r.stay_range && daterange(p_start_date, p_end_date, '[]')
    );
$$;

-- INVENTORY-001 — does `attributes` contain every key this hoarding type
-- requires? `?&` is the jsonb "has all keys" operator. Called only from inside
-- submit_hoarding_for_review() (a SECURITY DEFINER fn) and, read-only, by an
-- owning Publisher on their own listing — both paths satisfy hoardings' RLS.
create or replace function hoarding_has_required_attributes(p_hoarding_id uuid) returns boolean
language sql stable as $$
  select (h.attributes ?& ht.required_attribute_keys)
  from hoardings h
  join hoarding_types ht on ht.code = h.type_code
  where h.id = p_hoarding_id;
$$;

-- INVENTORY-001 detail helper — which required keys are missing. Used by the
-- /api/v1 facade to fill error `details.missing_attribute_keys` (api-spec §8.1).
create or replace function hoarding_missing_attribute_keys(p_hoarding_id uuid) returns text[]
language sql stable as $$
  select coalesce(
    array_agg(k order by k) filter (where not (h.attributes ? k)),
    '{}'
  )
  from hoardings h
  join hoarding_types ht on ht.code = h.type_code
  cross join lateral unnest(ht.required_attribute_keys) as k
  where h.id = p_hoarding_id;
$$;
