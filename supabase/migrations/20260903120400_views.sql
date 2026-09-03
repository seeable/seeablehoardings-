-- =============================================================================
-- Phase 1 · 05a — Views
-- database-design.md §35, §41.9 · IMPLEMENTATION-PLAN.md §Phase 1 step 10
-- =============================================================================
-- Created before the request/inventory functions so search_available_hoardings
-- (20260903120700) can build on visible_hoardings.
--
-- security_invoker choice, per view:
--   visible_hoardings          — invoker=true. Reads only `hoardings`; the
--                                table's own RLS SELECT policy already exposes
--                                exactly the APPROVED-visible rows to every role.
--   publisher_inbox            — invoker=FALSE (deviation from §41.9). With
--   viewer_request_list          invoker=true the JOIN to `profiles`/`hoardings`
--                                is re-filtered by THOSE tables' RLS and the
--                                view returns zero rows for its intended user
--                                (a Publisher cannot SELECT the Viewer's
--                                `profiles` row, §37.1). The explicit
--                                `= auth.uid()` predicate is the boundary;
--                                auth.uid() reads the JWT and is unaffected by
--                                definer context. Documented in CHANGELOG.
--   public_hoarding_listings   — invoker=FALSE (NEW, IMPLEMENTATION-PLAN.md §5).
--   public_hoarding_detail       RLS filters rows, not columns; the column
--                                projection IS the disintermediation boundary
--                                (mvp-brd.md §12). No `profiles` join, no
--                                contact fields — a Viewer sees business_name
--                                and a verified flag, nothing else.
-- =============================================================================

-- Ergonomic, self-filtering ------------------------------------------------
create view visible_hoardings with (security_invoker = true) as
  select * from hoardings
  where approval_status = 'APPROVED' and not is_paused and not is_delisted;

create view publisher_inbox with (security_invoker = false) as
  select r.*, h.title as hoarding_title, p.full_name as viewer_name
  from requests r
  join hoardings h on h.id = r.hoarding_id
  join profiles p on p.id = r.viewer_id
  where r.publisher_id = auth.uid();

create view viewer_request_list with (security_invoker = false) as
  select r.*, h.title as hoarding_title, h.city, h.locality
  from requests r
  join hoardings h on h.id = r.hoarding_id
  where r.viewer_id = auth.uid();

-- Disintermediation boundary — Viewer-facing projections -------------------
create view public_hoarding_listings with (security_invoker = false) as
  select
    h.id, h.title, h.type_code, h.locality, h.city, h.address_text,
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
                'id', m.id,
                'media_type', m.media_type,
                'storage_path', m.storage_path,
                'is_primary', m.is_primary,
                'display_order', m.display_order
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
