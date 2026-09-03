-- =============================================================================
-- Phase 1 · 12 — pg_cron schedules (Decision D13)
-- IMPLEMENTATION-PLAN.md §Phase 1 step 14 · §1 (jobs inside Postgres)
-- =============================================================================
-- cron.schedule() upserts by job name, so this migration is idempotent across
-- `db reset`. Wrapped in a guard: if pg_cron is not installed (20260903120000
-- warned rather than failed), the schema still applies and jobs can be added
-- later with one statement each.
--
-- Cron runs in UTC. promote_confirmed_to_live() compares against IST internally
-- (D16), so "5 0 * * *" UTC = 05:35 IST is an arbitrary safe daily slot after
-- the IST date has rolled over.
--
-- Monitor:  select * from cron.job_run_details order by start_time desc;
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron not installed — no schedules created. Add them manually once enabled.';
    return;
  end if;

  perform cron.schedule('seeable-expire-requests', '*/15 * * * *',
    $job$ select public.expire_stale_requests(); $job$);

  perform cron.schedule('seeable-expiring-soon', '*/15 * * * *',
    $job$ select public.notify_expiring_soon_requests(); $job$);

  perform cron.schedule('seeable-transition-live', '5 0 * * *',
    $job$ select public.promote_confirmed_to_live(); $job$);
end
$$;
