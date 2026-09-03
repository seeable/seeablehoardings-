-- =============================================================================
-- Phase 1 · 01 — Extensions
-- IMPLEMENTATION-PLAN.md §Phase 1 step 1 · database-design.md §40 step 1, §41.1
-- =============================================================================
-- btree_gist  : GiST equality on uuid — required by the requests exclusion
--               constraint (database-design.md §31).
-- pgcrypto    : gen_random_uuid() (already installed on Supabase; kept for
--               portability to a bare Postgres / local image).
-- pg_cron     : in-database scheduled jobs (Decision D13). Jobs run only in the
--               `postgres` database on Supabase — which is where this runs.
-- pg_net      : outbound HTTP for the optional Resend email dispatch (Phase 10).
--               Created now so no later migration needs elevated privilege.
-- Supabase convention: helper extensions live in the `extensions` schema, which
-- is already on the search_path for every Data API role.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- pg_cron manages its own `cron` schema and a background worker; no schema arg.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise warning 'pg_cron not installed (%). Cron schedules in 20260903121200 will be skipped.', sqlerrm;
end
$$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise warning 'pg_net not installed (%). Optional email dispatch stays disabled.', sqlerrm;
end
$$;
