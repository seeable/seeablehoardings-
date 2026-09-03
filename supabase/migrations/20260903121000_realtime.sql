-- =============================================================================
-- Phase 1 · 11 — Realtime publication (Decision D14)
-- IMPLEMENTATION-PLAN.md §Phase 1 step 13 · §5 (critical cross-phase dependency)
-- =============================================================================
-- The bell (notifications) and My Requests / Incoming Requests live status
-- (requests) subscribe via supabase.channel(...).on('postgres_changes', ...).
-- Subscriptions are RLS-filtered — the existing SELECT policies
-- (notifications_select_own, requests_select_own) scope them correctly.
--
-- REPLICA IDENTITY FULL so UPDATE payloads carry the full old+new row, which
-- Realtime needs to evaluate row-level filters on updates (e.g. a request
-- moving REQUESTED -> CONFIRMED).
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    execute 'alter publication supabase_realtime add table public.requests';
  end if;
end
$$;

alter table notifications replica identity full;
alter table requests replica identity full;
