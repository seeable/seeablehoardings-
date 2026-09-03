-- =============================================================================
-- Phase 1 · 09 — Row Level Security: enable + policies
-- database-design.md §37, §41.10 · IMPLEMENTATION-PLAN.md §Phase 1 step 11
-- =============================================================================
-- RLS is THE enforcement layer (clients call Supabase directly). A command with
-- RLS enabled and no matching policy is denied. `requests` has NO admin SELECT
-- clause and NO client UPDATE/DELETE policy — every transition is a
-- SECURITY DEFINER function, which bypasses RLS by design (§37.7).
-- =============================================================================

alter table profiles enable row level security;
alter table publisher_profiles enable row level security;
alter table hoarding_types enable row level security;
alter table hoardings enable row level security;
alter table hoarding_media enable row level security;
alter table hoarding_availability_blocks enable row level security;
alter table requests enable row level security;
alter table request_status_history enable row level security;
alter table notifications enable row level security;
alter table admin_actions enable row level security;
alter table analytics_events enable row level security;

-- profiles ----------------------------------------------------------------
create policy profiles_select_own_or_admin on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update
  using (id = auth.uid());
create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

-- publisher_profiles ----------------------------------------------------------
create policy pp_select_own_or_admin on publisher_profiles for select
  using (id = auth.uid() or is_admin());
create policy pp_update_own on publisher_profiles for update
  using (id = auth.uid());

-- hoarding_types — public reference data ----------------------------------
create policy hoarding_types_select_all on hoarding_types for select
  using (true);

-- hoardings --------------------------------------------------------------
create policy hoardings_select_visible_or_own_or_admin on hoardings for select
  using (
    (approval_status = 'APPROVED' and not is_paused and not is_delisted)
    or publisher_id = auth.uid()
    or is_admin()
  );
create policy hoardings_insert_own on hoardings for insert
  with check (publisher_id = auth.uid());
create policy hoardings_update_own_or_admin on hoardings for update
  using (publisher_id = auth.uid() or is_admin());

-- hoarding_media ---------------------------------------------------------
create policy hm_select_visible_or_own_or_admin on hoarding_media for select
  using (
    exists (
      select 1 from hoardings h where h.id = hoarding_id
        and (
          (h.approval_status = 'APPROVED' and not h.is_paused and not h.is_delisted)
          or h.publisher_id = auth.uid()
          or is_admin()
        )
    )
  );
create policy hm_insert_own on hoarding_media for insert
  with check (owns_hoarding(hoarding_id));
create policy hm_update_own on hoarding_media for update
  using (owns_hoarding(hoarding_id));
create policy hm_delete_own on hoarding_media for delete
  using (owns_hoarding(hoarding_id));

-- hoarding_availability_blocks — not publicly readable -------------------
create policy hab_select_own_or_admin on hoarding_availability_blocks for select
  using (owns_hoarding(hoarding_id) or is_admin());
create policy hab_insert_own on hoarding_availability_blocks for insert
  with check (owns_hoarding(hoarding_id));
create policy hab_delete_own on hoarding_availability_blocks for delete
  using (owns_hoarding(hoarding_id));

-- requests — deliberately NO admin SELECT clause (request-engine.md §4/§12) --
create policy requests_select_own on requests for select
  using (viewer_id = auth.uid() or publisher_id = auth.uid());
create policy requests_insert_viewer on requests for insert
  with check (viewer_id = auth.uid() and status = 'REQUESTED');
-- No UPDATE / DELETE policy: every transition is a SECURITY DEFINER function.

-- request_status_history ------------------------------------------------
create policy rsh_select_via_request on request_status_history for select
  using (
    exists (
      select 1 from requests r where r.id = request_id
        and (r.viewer_id = auth.uid() or r.publisher_id = auth.uid())
    ) or is_admin()
  );

-- notifications --------------------------------------------------------
create policy notifications_select_own on notifications for select
  using (recipient_id = auth.uid());
create policy notifications_update_own on notifications for update
  using (recipient_id = auth.uid());

-- admin_actions -------------------------------------------------------
create policy admin_actions_select_admin_only on admin_actions for select
  using (is_admin());

-- analytics_events ---------------------------------------------------
create policy analytics_events_insert_any on analytics_events for insert
  with check (true);
create policy analytics_events_select_admin_only on analytics_events for select
  using (is_admin());
