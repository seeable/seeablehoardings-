-- =============================================================================
-- Phase 10 · 1 — admin_kpis() (mvp-brd.md §14, database-design.md §44)
-- IMPLEMENTATION-PLAN.md §Phase 10 · "KPI query set"
-- =============================================================================
-- The seven MVP-stage KPIs, since there is no payment activity to measure
-- revenue against. Three are already exposed by admin_dashboard_summary()
-- (publishers verified, live approved listings, request-to-confirmation
-- rate) — this function is a separate, admin-only reporting surface rather
-- than folding these into the AD-01 dashboard aggregate, so a change to one
-- doesn't risk the other's shape.
--
-- Median Publisher response time reads straight off `requests.confirmed_at` /
-- `.rejected_at` — both are already set by confirm_request() / reject_request()
-- in the same transaction as the status change (Phase 7), so no join to
-- request_status_history is needed. "Repeat usage" is read literally: an
-- actor with more than one row of their own kind (a Viewer's requests, a
-- Publisher's listings) — not yet a "second time" defined against tenure.
-- =============================================================================

create or replace function admin_kpis()
returns table (
  publishers_onboarded             bigint,
  publishers_verified              bigint,
  live_approved_listings           bigint,
  viewer_accounts                  bigint,
  requests_submitted               bigint,
  request_to_confirmation_rate     numeric,
  median_publisher_response_hours  numeric,
  repeat_viewers                   bigint,
  repeat_publishers                bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admin access required'
      using errcode = '42501', detail = 'SEEABLE_CODE=ADMIN_ONLY';
  end if;
  return query select
    (select count(*) from publisher_profiles),
    (select count(*) from publisher_profiles where verification_status = 'VERIFIED'),
    (select count(*) from hoardings
       where approval_status = 'APPROVED' and not is_paused and not is_delisted),
    (select count(*) from profiles where role = 'VIEWER'),
    (select count(*) from requests),
    (select round(
        count(*) filter (where status in ('CONFIRMED', 'LIVE', 'COMPLETED'))::numeric
        / nullif(count(*), 0) * 100, 1)
     from requests),
    (select round((percentile_cont(0.5) within group (
        order by extract(epoch from (coalesce(confirmed_at, rejected_at) - created_at)) / 3600.0
      ))::numeric, 1)
     from requests where confirmed_at is not null or rejected_at is not null),
    (select count(*) from (
        select viewer_id from requests group by viewer_id having count(*) > 1
      ) t),
    (select count(*) from (
        select publisher_id from hoardings group by publisher_id having count(*) > 1
      ) t);
end;
$$;

-- No explicit grant needed — Postgres defaults new functions to PUBLIC
-- EXECUTE, and the is_admin() check above is the enforcement layer, matching
-- admin_dashboard_summary() / admin_listing_queue() (Phase 7/9 convention).
