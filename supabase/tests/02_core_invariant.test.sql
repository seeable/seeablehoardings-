-- =============================================================================
-- Phase 1 pgTAP · the core invariant, VIEWER-002, computed availability
-- database-design.md §44 scenarios 1-5, 8, haversine edge case
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Seed: one auth user (FK target), one verified publisher, one approved hoarding.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pub@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'v1@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'v2@test.local');
-- handle_new_user fired on those inserts; make the publisher usable.
update profiles set role = 'PUBLISHER' where id = '00000000-0000-0000-0000-0000000000a1';
insert into publisher_profiles (id, verification_status, verified_at)
  values ('00000000-0000-0000-0000-0000000000a1', 'VERIFIED', now())
  on conflict (id) do update set verification_status = 'VERIFIED';

insert into hoardings (id, publisher_id, type_code, title, price, latitude, longitude, approval_status)
values ('00000000-0000-0000-0000-000000000f01',
        '00000000-0000-0000-0000-0000000000a1', 'UNIPOLE_BILLBOARD', 'Test Unipole',
        50000, 12.97, 77.59, 'APPROVED');

-- Bypass the BEFORE INSERT trigger so we test the CONSTRAINT, not the trigger.
set local session_replication_role = replica;

-- Scenario 2 — two overlapping REQUESTED both allowed (predicate excludes them).
select lives_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status) values
   ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','2030-09-01','2030-09-15','REQUESTED'),
   ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a1','2030-09-10','2030-09-20','REQUESTED')
$$, 'two overlapping REQUESTED rows on one hoarding both insert (mvp-prd.md §12)');

-- Scenario 3 — VIEWER-002: a second REQUESTED by the same viewer is rejected.
select throws_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','2031-01-01','2031-01-10','REQUESTED')
$$, '23505', null, 'VIEWER-002: same viewer cannot hold two REQUESTED on one hoarding');

-- Scenario 1 — first CONFIRMED succeeds.
select lives_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','2030-09-01','2030-09-15','CONFIRMED')
$$, 'first CONFIRMED request inserts');

-- Scenario 1 — an overlapping CONFIRMED is rejected by Postgres itself.
select throws_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a1','2030-09-10','2030-09-20','CONFIRMED')
$$, '23P01', null, 'REQUEST-004: overlapping CONFIRMED rejected with exclusion_violation');

-- Scenario 4 — an adjacent, non-overlapping CONFIRMED succeeds.
select lives_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f01','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a1','2030-09-16','2030-09-25','CONFIRMED')
$$, 'adjacent range 09-16..09-25 after 09-01..09-15 succeeds (inclusive-range semantics)');

-- Same range, different hoarding — allowed (per-hoarding scope).
insert into hoardings (id, publisher_id, type_code, title, price, latitude, longitude, approval_status)
values ('00000000-0000-0000-0000-000000000f02','00000000-0000-0000-0000-0000000000a1','GANTRY','H2',1,12.9,77.6,'APPROVED');
select lives_ok($$
  insert into requests (hoarding_id, viewer_id, publisher_id, start_date, end_date, status)
  values ('00000000-0000-0000-0000-000000000f02','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','2030-09-01','2030-09-15','CONFIRMED')
$$, 'identical overlapping range on a DIFFERENT hoarding is allowed');

set local session_replication_role = origin;

-- Computed availability (§34) composes the three inputs live.
select is(
  is_hoarding_available('00000000-0000-0000-0000-000000000f01', '2030-09-05', '2030-09-08'),
  false, 'is_hoarding_available: dates inside a CONFIRMED range are unavailable');
select is(
  is_hoarding_available('00000000-0000-0000-0000-000000000f01', '2035-01-01', '2035-01-10'),
  true, 'is_hoarding_available: far-future free dates are available');

-- REQUEST-002 — rejecting a CONFIRMED releases the dates with no explicit step.
update requests set status = 'REJECTED', rejected_at = now()
  where hoarding_id = '00000000-0000-0000-0000-000000000f01' and start_date = '2030-09-01';
select is(
  is_hoarding_available('00000000-0000-0000-0000-000000000f01', '2030-09-05', '2030-09-08'),
  true, 'REQUEST-002: those dates read available immediately after the request leaves CONFIRMED');

-- haversine: identical coordinates must not yield NULL (the acos clamp).
select is(haversine_km(12.9716, 77.5946, 12.9716, 77.5946), 0::double precision,
          'haversine_km returns 0, not NULL, for identical coordinates');

select * from finish();
rollback;
