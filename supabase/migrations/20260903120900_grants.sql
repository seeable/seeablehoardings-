-- =============================================================================
-- Phase 1 · 10 — Column-level grants & function EXECUTE privileges
-- database-design.md §38.1, §41.11 · IMPLEMENTATION-PLAN.md §Phase 1 step 12
-- =============================================================================
-- Supabase's default ACLs auto-grant anon+authenticated FULL DML on every new
-- public table and EXECUTE on every new function. This migration RESETS that
-- and re-grants exactly what §41.11 specifies. RLS (20260903120800) governs
-- *rows*; these grants govern *columns and callability*.
--
-- Deviation from §38.1, forced by Postgres semantics: a table-level SELECT
-- grant lets a role read EVERY column regardless of a later column-level
-- REVOKE. So `hoarding_media` is granted SELECT column-by-column, omitting
-- `original_storage_path` entirely — it is reachable only through
-- get_original_media_path() (§20, §38.1).
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

-- ---- Base tables ---------------------------------------------------------
grant select, insert on profiles to authenticated;
grant update (full_name, phone, email, city) on profiles to authenticated;

grant select on publisher_profiles to authenticated;
grant update (business_name) on publisher_profiles to authenticated;

grant select on hoarding_types to authenticated, anon;

grant select, insert, update on hoardings to authenticated;

grant select (id, hoarding_id, media_type, storage_path, is_primary,
              display_order, processing_status, watermarked_at, created_at)
  on hoarding_media to authenticated;
grant insert, delete on hoarding_media to authenticated;
grant update (is_primary, display_order) on hoarding_media to authenticated;

grant select, insert, delete on hoarding_availability_blocks to authenticated;

grant select, insert on requests to authenticated;
-- No UPDATE / DELETE grant — every transition is a function call.

grant select on request_status_history to authenticated;

grant select on notifications to authenticated;
grant update (is_read, read_at) on notifications to authenticated;

grant select on admin_actions to authenticated;

grant select, insert on analytics_events to authenticated, anon;

-- ---- Views --------------------------------------------------------------
grant select on visible_hoardings to authenticated;
grant select on publisher_inbox to authenticated;
grant select on viewer_request_list to authenticated;
grant select on public_hoarding_listings to authenticated;   -- D4: no anon
grant select on public_hoarding_detail to authenticated;

-- ---- Helper / predicate functions (needed by RLS + search) -------------
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_hoarding(uuid) to authenticated;
grant execute on function public.is_hoarding_available(uuid, date, date) to authenticated;
grant execute on function public.haversine_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.hoarding_has_required_attributes(uuid) to authenticated;
grant execute on function public.hoarding_missing_attribute_keys(uuid) to authenticated;
grant execute on function public.default_response_sla() to authenticated;
grant execute on function public.default_expiring_soon_window() to authenticated;

-- ---- Caller-facing state-transition / read functions ------------------
-- Admin-only functions are granted to `authenticated` too; enforcement is the
-- in-body is_admin() check, per §41.11's guarded-function pattern.
grant execute on function public.confirm_request(uuid) to authenticated;
grant execute on function public.reject_request(uuid, text) to authenticated;
grant execute on function public.mark_request_completed(uuid) to authenticated;
grant execute on function public.submit_hoarding_for_review(uuid) to authenticated;
grant execute on function public.delete_hoarding(uuid) to authenticated;
grant execute on function public.get_original_media_path(uuid) to authenticated;
grant execute on function public.search_available_hoardings(date, date, text, double precision, double precision, double precision, numeric) to authenticated;
grant execute on function public.approve_listing(uuid) to authenticated;
grant execute on function public.reject_listing(uuid, text) to authenticated;
grant execute on function public.delist_hoarding(uuid, text) to authenticated;
grant execute on function public.relist_hoarding(uuid) to authenticated;
grant execute on function public.verify_publisher(uuid) to authenticated;
grant execute on function public.reject_publisher_verification(uuid, text) to authenticated;
grant execute on function public.suspend_publisher(uuid, text) to authenticated;
grant execute on function public.unsuspend_publisher(uuid) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_listing_queue() to authenticated;

-- ---- Scheduled-job functions: NEVER client-callable (§41.11) ----------
revoke execute on function public.expire_stale_requests() from anon, authenticated, public;
revoke execute on function public.promote_confirmed_to_live() from anon, authenticated, public;
revoke execute on function public.notify_expiring_soon_requests() from anon, authenticated, public;

-- ---- Trigger functions: not directly callable; revoke for intent ------
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.validate_request_creation() from anon, authenticated, public;
revoke execute on function public.log_request_status_change() from anon, authenticated, public;
revoke execute on function public.notify_request_created() from anon, authenticated, public;
revoke execute on function public.enforce_hoarding_edit_freeze() from anon, authenticated, public;
