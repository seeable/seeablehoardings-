-- =============================================================================
-- Phase 2 · handle_new_user — tolerate OAuth (Google) signups
-- IMPLEMENTATION-PLAN.md §Phase 2 · Decision: Google = Viewer-only
-- =============================================================================
-- A Google sign-in has no `role` in raw_user_meta_data, so it defaults to
-- VIEWER (unchanged — the security-relevant part). What changes:
--   * name comes from Google's `name` / `full_name` claim, not our form field
--   * `on conflict (id) do nothing` — an identity linked to an existing user
--     (same email, password + Google) does not re-run this cleanly otherwise
-- Publishers still sign up with email + password and the explicit role field.
-- =============================================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  -- Security-relevant: never trust client-supplied metadata for ADMIN.
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'VIEWER');
  if v_role not in ('VIEWER', 'PUBLISHER') then
    v_role := 'VIEWER';
  end if;

  insert into profiles (id, role, full_name, phone, email, city)
  values (
    new.id,
    v_role,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'phone',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'city', 'Bengaluru')
  )
  on conflict (id) do nothing;

  if v_role = 'PUBLISHER' then
    insert into publisher_profiles (id, business_name)
    values (new.id, new.raw_user_meta_data ->> 'business_name')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
