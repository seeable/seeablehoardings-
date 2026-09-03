-- =============================================================================
-- Phase 6 · Viewer discovery — search_available_hoardings, finalised
-- api-specification.md §10–§11 · IMPLEMENTATION-PLAN.md §Phase 6
-- =============================================================================
-- Rewrites the Phase 1 stub (`database-design.md` §41.8) into the one query
-- surface the whole Viewer experience runs on — list AND map, one filtered
-- result set (viewer-platform.md §10). Changes:
--   * SECURITY DEFINER SET search_path = public — api-spec §11.2 "REQUIRED fix".
--     visible_hoardings' WHERE clause is the INVENTORY-003 boundary; running as
--     the owner lets it see every APPROVED row to filter, and leaks nothing
--     (it returns only public_hoarding_listings columns + a distance + a date).
--   * Returns the full public_hoarding_listings projection + distance_km +
--     next_available_date + total_count (window count, for meta.pagination).
--   * Bengaluru-normalised price ceiling (DAY/WEEK -> monthly equivalent) —
--     filter/sort only; the card shows the entered rate + period.
--   * Pagination (p_limit / p_offset) and sort (newest | price_asc | price_desc;
--     distance is automatic whenever a centre point is supplied — api-spec §10.5).
-- =============================================================================

-- ---- Views: add `description` to the Viewer projection (VW-03 needs it) ----
-- Drop + recreate in dependency order; nothing else depends on these two, and
-- search_available_hoardings reads visible_hoardings, not the public views.
drop view if exists public_hoarding_detail;
drop view if exists public_hoarding_listings;

create view public_hoarding_listings with (security_invoker = false) as
  select
    h.id, h.title, h.type_code, h.description, h.locality, h.city, h.address_text,
    h.size, h.price, h.price_unit, h.latitude, h.longitude,
    h.attributes, h.site_intelligence, h.site_intelligence_complete,
    h.created_at,
    pp.business_name                          as publisher_business_name,
    (pp.verification_status = 'VERIFIED')     as publisher_is_verified
  from visible_hoardings h
  join publisher_profiles pp on pp.id = h.publisher_id;

create view public_hoarding_detail with (security_invoker = false) as
  select
    l.*,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', m.id, 'media_type', m.media_type, 'storage_path', m.storage_path,
                'is_primary', m.is_primary, 'display_order', m.display_order
              ) order by m.display_order, m.created_at)
       from hoarding_media m
       where m.hoarding_id = l.id and m.processing_status = 'WATERMARKED'),
      '[]'::jsonb
    ) as media,
    coalesce(
      (select jsonb_agg(jsonb_build_object('start_date', r.start_date, 'end_date', r.end_date)
                order by r.start_date)
       from requests r
       where r.hoarding_id = l.id and r.status in ('CONFIRMED', 'LIVE', 'COMPLETED')),
      '[]'::jsonb
    ) as booked_ranges,
    coalesce(
      (select jsonb_agg(jsonb_build_object('start_date', b.start_date, 'end_date', b.end_date)
                order by b.start_date)
       from hoarding_availability_blocks b
       where b.hoarding_id = l.id),
      '[]'::jsonb
    ) as blocked_ranges
  from public_hoarding_listings l;

grant select on public_hoarding_listings to authenticated;
grant select on public_hoarding_detail to authenticated;

drop function if exists search_available_hoardings(date, date, text, double precision, double precision, double precision, numeric);

create or replace function search_available_hoardings(
  p_type_code        text default null,
  p_city             text default null,
  p_center_lat       double precision default null,
  p_center_lng       double precision default null,
  p_radius_km        double precision default null,
  p_max_price_monthly numeric default null,
  p_sort             text default null,
  p_limit            integer default 20,
  p_offset           integer default 0
)
returns table (
  id uuid,
  title text,
  type_code text,
  locality text,
  city text,
  address_text text,
  size text,
  price numeric,
  price_unit text,
  latitude double precision,
  longitude double precision,
  attributes jsonb,
  site_intelligence jsonb,
  site_intelligence_complete boolean,
  created_at timestamptz,
  publisher_business_name text,
  publisher_is_verified boolean,
  distance_km double precision,
  next_available_date date,
  total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_lat_delta double precision;
  v_lng_delta double precision;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if p_center_lat is not null and p_radius_km is not null then
    v_lat_delta := p_radius_km / 111.0;
    v_lng_delta := p_radius_km / (111.0 * cos(radians(p_center_lat)));
  end if;

  return query
  select
    h.id, h.title, h.type_code, h.locality, h.city, h.address_text, h.size,
    h.price, h.price_unit, h.latitude, h.longitude, h.attributes,
    h.site_intelligence, h.site_intelligence_complete, h.created_at,
    pp.business_name,
    (pp.verification_status = 'VERIFIED'),
    case when p_center_lat is not null
         then haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude)
         else null end,
    (select gs::date
     from generate_series(v_today::timestamp, (v_today + 180)::timestamp, interval '1 day') gs
     where not exists (
             select 1 from hoarding_availability_blocks b
             where b.hoarding_id = h.id
               and b.start_date <= gs::date and b.end_date >= gs::date)
       and not exists (
             select 1 from requests r
             where r.hoarding_id = h.id
               and r.status in ('CONFIRMED', 'LIVE', 'COMPLETED')
               and r.start_date <= gs::date and r.end_date >= gs::date)
     order by gs
     limit 1),
    count(*) over()
  from visible_hoardings h
  join publisher_profiles pp on pp.id = h.publisher_id
  join hoarding_types ht on ht.code = h.type_code
  where not ht.is_digital  -- digital types are taxonomy-only at MVP (mvp-brd.md §5.1)
    and (p_type_code is null or h.type_code = p_type_code)
    and (p_city is null or h.city = p_city)
    and (p_max_price_monthly is null or h.price is null or
         (case h.price_unit
            when 'DAY' then h.price * 30
            when 'WEEK' then h.price * 4.345
            else h.price
          end) <= p_max_price_monthly)
    and (p_center_lat is null or (
          h.latitude between p_center_lat - v_lat_delta and p_center_lat + v_lat_delta
          and h.longitude between p_center_lng - v_lng_delta and p_center_lng + v_lng_delta
          and haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude) <= p_radius_km))
  order by
    (case when p_center_lat is not null
          then haversine_km(p_center_lat, p_center_lng, h.latitude, h.longitude)
     end) asc nulls last,
    (case when p_sort = 'price_asc' then h.price end) asc nulls last,
    (case when p_sort = 'price_desc' then h.price end) desc nulls last,
    h.created_at desc,
    h.id asc
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.search_available_hoardings(
  text, text, double precision, double precision, double precision, numeric, text, integer, integer
) to authenticated;
