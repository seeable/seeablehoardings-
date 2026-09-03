-- =============================================================================
-- Phase 1 · 06 — Request Engine functions
-- database-design.md §24, §41.6 · IMPLEMENTATION-PLAN.md §Phase 1 step 9
-- =============================================================================
-- Every state transition on `requests` is exactly one SECURITY DEFINER function
-- (the table has no client UPDATE grant). D7 SEEABLE_CODE on every raise.
-- =============================================================================

-- confirm_request — THE critical function (§24). Publisher-only.
-- Row lock serialises concurrent attempts on one hoarding; the exclusion
-- constraint (§31) is the structural backstop beneath the re-check.
create or replace function confirm_request(p_request_id uuid)
returns requests
language plpgsql security definer set search_path = public as $$
declare
  v_request requests;
begin
  select * into v_request from requests where id = p_request_id for update;

  if not found then
    raise exception 'Request not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=REQUEST_NOT_FOUND';
  end if;

  if v_request.publisher_id <> auth.uid() then
    raise exception 'Only the owning Publisher can confirm a request'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  if v_request.status <> 'REQUESTED' then
    raise exception 'Request is no longer awaiting a decision (current status: %)', v_request.status
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_STATE_CONFLICT';
  end if;

  -- REQUEST-004: re-validate visibility at accept time, not just at creation.
  if not exists (
    select 1 from hoardings
    where id = v_request.hoarding_id
      and approval_status = 'APPROVED' and not is_paused and not is_delisted
  ) then
    raise exception 'This listing is no longer available for confirmation'
      using errcode = '55000', detail = 'SEEABLE_CODE=HOARDING_NOT_VISIBLE';
  end if;

  -- REQUEST-004: re-validate no conflicting Confirmed/Live/Completed request.
  if exists (
    select 1 from requests r2
    where r2.hoarding_id = v_request.hoarding_id
      and r2.id <> v_request.id
      and r2.status in ('CONFIRMED', 'LIVE', 'COMPLETED')
      and r2.stay_range && v_request.stay_range
  ) then
    raise exception 'These dates are no longer available — a conflicting request was already confirmed'
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_DATE_CONFLICT';
  end if;

  begin
    update requests
    set status = 'CONFIRMED', confirmed_at = now()
    where id = v_request.id
    returning * into v_request;
  exception when exclusion_violation then
    raise exception 'These dates are no longer available — a conflicting request was already confirmed'
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_DATE_CONFLICT';
  end;

  insert into notifications (recipient_id, type, title, message, related_hoarding_id, related_request_id)
  values (v_request.viewer_id, 'REQUEST_ACCEPTED', 'Your request was accepted',
          'The Publisher has confirmed your requested dates.', v_request.hoarding_id, v_request.id);

  return v_request;
end;
$$;

-- reject_request — Publisher-only. Reason optional (unlike ADMIN-003).
create or replace function reject_request(p_request_id uuid, p_reason text default null)
returns requests
language plpgsql security definer set search_path = public as $$
declare
  v_request requests;
begin
  select * into v_request from requests where id = p_request_id for update;

  if not found then
    raise exception 'Request not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=REQUEST_NOT_FOUND';
  end if;

  if v_request.publisher_id <> auth.uid() then
    raise exception 'Only the owning Publisher can reject a request'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  if v_request.status <> 'REQUESTED' then
    raise exception 'Request is no longer awaiting a decision (current status: %)', v_request.status
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_STATE_CONFLICT';
  end if;

  update requests
  set status = 'REJECTED', rejected_at = now(), rejection_reason = p_reason
  where id = v_request.id
  returning * into v_request;

  insert into notifications (recipient_id, type, title, message, related_hoarding_id, related_request_id)
  values (v_request.viewer_id, 'REQUEST_REJECTED', 'Your request was declined',
          coalesce('The Publisher declined your request: ' || p_reason, 'The Publisher declined your request.'),
          v_request.hoarding_id, v_request.id);

  return v_request;
end;
$$;

-- mark_request_completed — Publisher OR Admin (request-engine.md §4's one named
-- exception to Admin's otherwise-narrow request authority). REQUEST-003
-- start-date floor only, evaluated in IST (D16).
create or replace function mark_request_completed(p_request_id uuid)
returns requests
language plpgsql security definer set search_path = public as $$
declare
  v_request requests;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select * into v_request from requests where id = p_request_id for update;

  if not found then
    raise exception 'Request not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=REQUEST_NOT_FOUND';
  end if;

  if v_request.publisher_id <> auth.uid() and not is_admin() then
    raise exception 'Only the owning Publisher or an Admin can mark a request completed'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  if v_request.status not in ('CONFIRMED', 'LIVE') then
    raise exception 'Only a Confirmed or Live request can be marked Completed (current status: %)', v_request.status
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_STATE_CONFLICT';
  end if;

  if v_request.start_date > v_today then
    raise exception 'Cannot mark a request Completed before its start date (REQUEST-003)'
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_COMPLETE_TOO_EARLY';
  end if;

  update requests
  set status = 'COMPLETED', completed_at = now(), completed_by = auth.uid()
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

-- =========================================================================
-- Scheduled-job functions — invoked by pg_cron ONLY (20260903121200).
-- No EXECUTE grant to authenticated/anon (20260903121000). They return a
-- count and raise nothing a client would see.
-- =========================================================================
create or replace function expire_stale_requests() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with expired as (
    update requests
    set status = 'EXPIRED', expired_at = now()
    where status = 'REQUESTED' and sla_deadline is not null and sla_deadline < now()
    returning id, viewer_id, hoarding_id
  )
  insert into notifications (recipient_id, type, title, message, related_hoarding_id, related_request_id)
  select viewer_id, 'REQUEST_EXPIRED', 'Your request expired',
         'The Publisher did not respond in time and your request has expired.', hoarding_id, id
  from expired;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Promote CONFIRMED -> LIVE when start_date is reached, in IST (D16).
-- Automatic, system-triggered, no notification (§25).
create or replace function promote_confirmed_to_live() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  update requests
  set status = 'LIVE', live_at = now()
  where status = 'CONFIRMED'
    and start_date <= (now() at time zone 'Asia/Kolkata')::date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- REQUEST_EXPIRING_SOON — notifies BOTH Viewer and Publisher (§25). Idempotent:
-- uses the notifications table itself to avoid re-notifying on every run.
create or replace function notify_expiring_soon_requests() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_req record;
  v_count integer := 0;
begin
  for v_req in
    select r.* from requests r
    where r.status = 'REQUESTED'
      and r.sla_deadline is not null
      and r.sla_deadline between now() and now() + default_expiring_soon_window()
      and not exists (
        select 1 from notifications n
        where n.related_request_id = r.id and n.type = 'REQUEST_EXPIRING_SOON'
      )
  loop
    insert into notifications (recipient_id, type, title, message, related_hoarding_id, related_request_id)
    values
      (v_req.viewer_id, 'REQUEST_EXPIRING_SOON', 'Your request is expiring soon',
       'Your request is still awaiting a response and will expire soon.', v_req.hoarding_id, v_req.id),
      (v_req.publisher_id, 'REQUEST_EXPIRING_SOON', 'A request needs your response',
       'A pending request on your listing will expire soon if you do not respond.',
       v_req.hoarding_id, v_req.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
