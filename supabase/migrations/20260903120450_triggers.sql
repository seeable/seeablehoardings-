-- =============================================================================
-- Phase 1 · 05 — Trigger functions + triggers (bookkeeping only, never
--                business-rule branching — database-design.md §3 principle 5)
-- database-design.md §36, §41.5 · IMPLEMENTATION-PLAN.md §Phase 1 step 8
-- =============================================================================
-- Decision D7: every RAISE that carries a business outcome attaches
--   DETAIL = 'SEEABLE_CODE=<CODE>'  so the /api/v1 facade maps it to a specific
--   api-specification.md §8.4 code instead of a generic 409 (see lib/db/errors.ts).
-- Decision D16: date-sensitive comparisons use IST explicitly.
-- =============================================================================

-- Generic updated_at maintenance --------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_publisher_profiles_updated_at before update on publisher_profiles
  for each row execute function set_updated_at();
create trigger trg_hoardings_updated_at before update on hoardings
  for each row execute function set_updated_at();
create trigger trg_requests_updated_at before update on requests
  for each row execute function set_updated_at();

-- auth.users -> profiles, standard Supabase pattern -------------------------
-- The ONLY thing that provisions a new user's app rows and the ONLY block on
-- role escalation, since auth is client-direct (IMPLEMENTATION-PLAN.md §5).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  -- Security-relevant: never trust client-supplied metadata for ADMIN.
  -- Admin accounts are provisioned out-of-band (database-design.md §15).
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'VIEWER');
  if v_role not in ('VIEWER', 'PUBLISHER') then
    v_role := 'VIEWER';
  end if;

  insert into profiles (id, role, full_name, phone, email, city)
  values (
    new.id, v_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'city', 'Bengaluru')
  );

  if v_role = 'PUBLISHER' then
    insert into publisher_profiles (id, business_name)
    values (new.id, new.raw_user_meta_data ->> 'business_name');
  end if;

  return new;
end;
$$;

create trigger trg_handle_new_user after insert on auth.users
  for each row execute function handle_new_user();

-- Request creation: visibility + past-date + conflict + denormalization (§24)
create or replace function validate_request_creation() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_publisher_id uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;  -- D16
begin
  select publisher_id into v_publisher_id
  from hoardings
  where id = new.hoarding_id
    and approval_status = 'APPROVED' and not is_paused and not is_delisted;

  if v_publisher_id is null then
    raise exception 'This listing is not currently available for requests'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_NOT_VISIBLE';
  end if;

  if new.end_date < v_today then
    raise exception 'The requested dates are in the past'
      using errcode = '55000', detail = 'SEEABLE_CODE=DATE_RANGE_IN_PAST';
  end if;

  if exists (
    select 1 from requests r
    where r.hoarding_id = new.hoarding_id
      and r.status in ('CONFIRMED', 'LIVE', 'COMPLETED')
      and r.stay_range && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'These dates are not available for this listing'
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_DATE_CONFLICT';
  end if;

  new.publisher_id := v_publisher_id;              -- denormalized, immutable (§22)
  new.sla_deadline := now() + default_response_sla();

  return new;
end;
$$;

create trigger trg_validate_request_creation before insert on requests
  for each row execute function validate_request_creation();

-- Status-change audit trail (§23) -----------------------------------------
create or replace function log_request_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into request_status_history (request_id, from_status, to_status, changed_by)
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    auth.uid()   -- NULL for pg_cron / scheduled-job transitions, by design (§28.8)
  );
  return new;
end;
$$;

create trigger trg_log_request_status_change
  after insert or update of status on requests
  for each row execute function log_request_status_change();

-- Creation-time notifications (§25) — two rows per creation ---------------
create or replace function notify_request_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  select title into v_title from hoardings where id = new.hoarding_id;

  insert into notifications (recipient_id, type, title, message, related_hoarding_id, related_request_id)
  values
    (new.publisher_id, 'REQUEST_CREATED', 'New request received',
     'You have a new date request on "' || v_title || '".', new.hoarding_id, new.id),
    (new.viewer_id, 'REQUEST_CREATED', 'Request submitted',
     'Your request for "' || v_title || '" has been sent to the Publisher.', new.hoarding_id, new.id);

  return new;
end;
$$;

create trigger trg_notify_request_created after insert on requests
  for each row execute function notify_request_created();

-- OWNER-003: freeze core fields while a REQUESTED request exists ----------
-- is_paused toggling is explicitly exempt (§36).
create or replace function enforce_hoarding_edit_freeze() returns trigger
language plpgsql as $$
begin
  if (new.title, new.type_code, new.attributes, new.price, new.latitude, new.longitude)
     is distinct from
     (old.title, old.type_code, old.attributes, old.price, old.latitude, old.longitude)
  then
    if exists (select 1 from requests where hoarding_id = old.id and status = 'REQUESTED') then
      raise exception 'Cannot edit core listing details while a request is pending (OWNER-003)'
        using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_EDIT_FROZEN';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_hoarding_edit_freeze before update on hoardings
  for each row execute function enforce_hoarding_edit_freeze();
