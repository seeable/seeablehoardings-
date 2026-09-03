-- =============================================================================
-- Phase 7 · Request / Booking Engine — the two gaps Phase 1 left, + view fields
-- request-engine.md · api-specification.md §16–§23 · IMPLEMENTATION-PLAN.md §Phase 7
-- =============================================================================
-- The engine itself (confirm_request / reject_request / mark_request_completed,
-- the BEFORE INSERT trigger, the EXCLUDE constraint, the VIEWER-002 partial
-- unique index, expire/live pg_cron) was built in Phase 1 (20260903120500,
-- 20260903120450, 20260903120100, 20260903121100) and is only *verified* here
-- (scripts/verify-requests.mjs). This migration adds:
--
--   1. set_request_amount_agreed()  — the one transition Phase 1 did not build
--                                     (api-spec §20.4; RECOMMENDED action).
--   2. get_request_history()        — SECURITY DEFINER so a Viewer can resolve
--                                     the Publisher-side actor's role, which
--                                     `profiles` RLS (id = auth.uid()) forbids.
--   3. viewer_request_list /        — carry the embedded `hoarding` summary +
--      publisher_inbox                publisher business_name so the summary
--                                     survives a since-paused listing (§23.3).
--   4. api_idempotency_keys         — replay-safety for POST /api/v1/requests
--                                     (§17.1 / §31; DoD "Idempotency").
-- =============================================================================

-- 1. amount_agreed — settable only by the owning Publisher, only post-REQUESTED
--    (database-design.md §22 assumption, api-spec §20.4). D7 SEEABLE_CODE tags.
create or replace function set_request_amount_agreed(p_request_id uuid, p_amount numeric)
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
    raise exception 'Only the owning Publisher can set the agreed amount'
      using errcode = '42501', detail = 'SEEABLE_CODE=FORBIDDEN_NOT_OWNER';
  end if;

  if v_request.status = 'REQUESTED' then
    raise exception 'The agreed amount can only be recorded once the request is confirmed'
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_AMOUNT_NOT_SETTABLE';
  end if;

  if v_request.status in ('REJECTED', 'EXPIRED') then
    raise exception 'This request is no longer active (current status: %)', v_request.status
      using errcode = '55000', detail = 'SEEABLE_CODE=REQUEST_STATE_CONFLICT';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'The agreed amount must be greater than zero'
      using errcode = '23514', detail = 'SEEABLE_CODE=VALIDATION_ERROR';
  end if;

  update requests set amount_agreed = p_amount
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

revoke execute on function public.set_request_amount_agreed(uuid, numeric) from anon, public;
grant execute on function public.set_request_amount_agreed(uuid, numeric) to authenticated;

-- 2. Request history for the timeline (api-spec §21.3). Party-or-Admin gate
--    mirrors rsh_select_via_request RLS; runs as owner so it can read the
--    counterparty's `profiles.role` (a plain query cannot — §22.4).
create or replace function get_request_history(p_request_id uuid)
returns table (
  from_status text,
  to_status   text,
  changed_at  timestamptz,
  note        text,
  actor_id    uuid,
  actor_role  text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
        select 1 from requests r
        where r.id = p_request_id
          and (r.viewer_id = auth.uid() or r.publisher_id = auth.uid())
      )
     and not is_admin()
  then
    raise exception 'Request not found'
      using errcode = 'P0002', detail = 'SEEABLE_CODE=REQUEST_NOT_FOUND';
  end if;

  return query
  select h.from_status,
         h.to_status,
         h.changed_at,
         h.note,
         h.changed_by,
         (select p.role from profiles p where p.id = h.changed_by)
  from request_status_history h
  where h.request_id = p_request_id
  order by h.changed_at asc, h.id asc;
end;
$$;

revoke execute on function public.get_request_history(uuid) from anon, public;
grant execute on function public.get_request_history(uuid) to authenticated;

-- 3. Views — add the embedded-summary fields the Request resource (§16.3) needs.
--    Both stay security_invoker = false: the column projection is the
--    disintermediation boundary, and the definer context is what lets the view
--    return a row whose listing is now paused (the Viewer's own record, §23.3)
--    and resolve the counterparty name across `profiles` RLS.
--    Nothing depends on these two views; recreate in place.
drop view if exists viewer_request_list;
create view viewer_request_list with (security_invoker = false) as
  select
    r.*,
    h.title        as hoarding_title,
    h.type_code    as hoarding_type_code,
    h.city         as hoarding_city,
    h.locality     as hoarding_locality,
    h.price        as hoarding_price,
    h.price_unit   as hoarding_price_unit,
    (h.approval_status = 'APPROVED' and not h.is_paused and not h.is_delisted)
                   as hoarding_is_listed,
    pp.business_name as publisher_business_name,
    (select m.storage_path
       from hoarding_media m
      where m.hoarding_id = h.id
        and m.processing_status = 'WATERMARKED'
      order by m.is_primary desc, m.display_order asc, m.created_at asc
      limit 1)     as hoarding_primary_media_path
  from requests r
  join hoardings h on h.id = r.hoarding_id
  join publisher_profiles pp on pp.id = r.publisher_id
  where r.viewer_id = auth.uid();

drop view if exists publisher_inbox;
create view publisher_inbox with (security_invoker = false) as
  select
    r.*,
    h.title        as hoarding_title,
    h.type_code    as hoarding_type_code,
    h.city         as hoarding_city,
    h.locality     as hoarding_locality,
    h.price        as hoarding_price,
    h.price_unit   as hoarding_price_unit,
    (h.approval_status = 'APPROVED' and not h.is_paused and not h.is_delisted)
                   as hoarding_is_listed,
    p.full_name    as viewer_name,
    (select m.storage_path
       from hoarding_media m
      where m.hoarding_id = h.id
        and m.processing_status = 'WATERMARKED'
      order by m.is_primary desc, m.display_order asc, m.created_at asc
      limit 1)     as hoarding_primary_media_path
  from requests r
  join hoardings h on h.id = r.hoarding_id
  join profiles p on p.id = r.viewer_id
  where r.publisher_id = auth.uid();

grant select on viewer_request_list to authenticated;
grant select on publisher_inbox to authenticated;

-- 4. Idempotency store for POST /api/v1/requests (§17.1 — "REQUIRED in practice").
--    Only successful creations are cached; a 4xx means nothing was written and a
--    retry is safe. VIEWER-002's partial unique index still absorbs a concurrent
--    double-submit even without a key.
create table if not exists api_idempotency_keys (
  key           text        not null,
  user_id       uuid        not null references profiles (id) on delete cascade,
  endpoint      text        not null,
  request_id    uuid        references requests (id) on delete set null,
  status_code   int         not null,
  response_json jsonb       not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, endpoint, key)
);

alter table api_idempotency_keys enable row level security;

create policy idem_select_own on api_idempotency_keys for select
  using (user_id = auth.uid());
create policy idem_insert_own on api_idempotency_keys for insert
  with check (user_id = auth.uid());

revoke all on api_idempotency_keys from anon, authenticated;
grant select, insert on api_idempotency_keys to authenticated;
