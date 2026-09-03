-- =============================================================================
-- Phase 1 pgTAP · schema shape, RLS, grants, functions, Decision D7
-- Run:  supabase test db          (local Docker)
--   or: psql "$SUPABASE_DB_URL" -f supabase/tests/01_schema_and_security.test.sql
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---- Tables & views -------------------------------------------------------
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'publisher_profiles', 'publisher_profiles exists');
select has_table('public', 'hoardings', 'hoardings exists');
select has_table('public', 'hoarding_media', 'hoarding_media exists');
select has_table('public', 'hoarding_availability_blocks', 'availability blocks exists');
select has_table('public', 'requests', 'requests exists');
select has_table('public', 'request_status_history', 'request_status_history exists');
select has_table('public', 'notifications', 'notifications exists');
select has_table('public', 'admin_actions', 'admin_actions exists');
select has_table('public', 'analytics_events', 'analytics_events exists');
select has_table('public', 'hoarding_types', 'hoarding_types exists');
select has_view('public', 'public_hoarding_listings', 'viewer-safe listings view exists');
select has_view('public', 'public_hoarding_detail', 'viewer-safe detail view exists');

-- ---- The exclusion constraint -------------------------------------------
select is(
  pg_get_constraintdef((select oid from pg_constraint where conname = 'requests_no_overlapping_confirmed')),
  'EXCLUDE USING gist (hoarding_id WITH =, stay_range WITH &&) WHERE ((status = ANY (ARRAY[''CONFIRMED''::text, ''LIVE''::text, ''COMPLETED''::text])))',
  'exclusion constraint definition is exactly REQUEST-004'
);

-- ---- VIEWER-002 ---------------------------------------------------------
select ok(
  (select indexdef from pg_indexes where indexname = 'requests_one_pending_per_viewer_hoarding')
    ilike '%WHERE (status = ''REQUESTED''::text)%',
  'VIEWER-002 partial unique index is scoped to REQUESTED'
);

-- ---- RLS on every base table -----------------------------------------
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity),
  0,
  'RLS is enabled on every public base table'
);

-- ---- requests has no client UPDATE/DELETE policy --------------------
select is(
  (select count(*)::int from pg_policies
   where tablename = 'requests' and cmd in ('UPDATE', 'DELETE')),
  0,
  'requests has NO client UPDATE/DELETE policy (transitions are functions only)'
);
-- ---- requests SELECT policy has no is_admin() clause --------------
select ok(
  (select qual from pg_policies where tablename = 'requests' and policyname = 'requests_select_own')
    not ilike '%is_admin%',
  'Admin has NO blanket SELECT on requests (request-engine.md §4/§12)'
);

-- ---- SECURITY DEFINER + search_path on the transition functions ---
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('confirm_request','reject_request','mark_request_completed',
                     'submit_hoarding_for_review','approve_listing','reject_listing',
                     'verify_publisher','suspend_publisher','is_hoarding_available','is_admin')
     and prosecdef
     and array_to_string(proconfig, ',') like '%search_path=public%'),
  10,
  'every cross-RLS function is SECURITY DEFINER with search_path pinned'
);

-- ---- D7: SEEABLE_CODE in function bodies ---------------------------
select cmp_ok(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace and prosrc like '%SEEABLE_CODE=%'),
  '>=', 12,
  'D7: at least 12 functions attach SEEABLE_CODE in DETAIL'
);
select ok(
  (select prosrc from pg_proc where proname = 'confirm_request') like '%SEEABLE_CODE=REQUEST_DATE_CONFLICT%',
  'confirm_request tags the date-conflict path with SEEABLE_CODE'
);

-- ---- Grants: disintermediation + least privilege ----------------
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public' and table_name = 'hoardings'),
  0,
  'D4: anon has zero privileges on hoardings'
);
select is(
  (select count(*)::int from information_schema.column_privileges
   where grantee in ('anon','authenticated') and table_name = 'hoarding_media'
     and column_name = 'original_storage_path' and privilege_type = 'SELECT'),
  0,
  'CONTENT-001: original_storage_path is not SELECT-able by any client role'
);
select is(
  (select count(*)::int from information_schema.role_routine_grants
   where grantee in ('anon','authenticated')
     and routine_name in ('expire_stale_requests','promote_confirmed_to_live','notify_expiring_soon_requests')),
  0,
  'scheduled-job functions are never client-callable'
);
select ok(
  not exists (
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'public_hoarding_listings'
      and column_name ~* 'phone|email|full_name'
  ),
  'public_hoarding_listings exposes no Publisher contact column'
);

-- ---- hoarding_types seed --------------------------------------
select is((select count(*)::int from hoarding_types), 8, 'hoarding_types seeded with 8 rows');
select is((select count(*)::int from hoarding_types where is_digital), 2, '2 digital types (taxonomy only)');

-- ---- Realtime ------------------------------------------------
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications')
  and exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'),
  'Realtime publication includes notifications + requests'
);

select * from finish();
rollback;
