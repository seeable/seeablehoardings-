# Runbook — Provisioning an ADMIN account

`api-specification.md` §6.1 · `database-design.md` §15 · Decision (Phase 2): no
public path to ADMIN.

## Why there is no self-service

- The sign-up form only offers **Advertiser** / **Publisher**.
- `handle_new_user` (migration `20260903120450` / `20260904090000`) reads
  `raw_user_meta_data.role` and **downgrades anything that isn't
  `VIEWER`/`PUBLISHER` to `VIEWER`** — a forged `role: "ADMIN"` in a signup
  payload becomes a Viewer.
- `profiles.role` is **not** in the column `GRANT UPDATE (...)` for
  `authenticated`, so no signed-in user can escalate their own row
  (`database-design.md` §38.1, verified by the Phase 1 test suite).

So an ADMIN is made by an operator, against an account that has **already
registered normally**.

## Steps

1. The person signs up at `/signup` as an Advertiser (any role — it will be
   replaced). They now have an `auth.users` row and a `profiles` row.

2. An operator with the service-role key runs:

   ```bash
   # email defaults to ADMIN_BOOTSTRAP_EMAIL
   node scripts/provision-admin.mjs ops@seeable.example
   ```

   The script finds the registered user by email and sets
   `profiles.role = 'ADMIN'` via PostgREST using the **service-role key**
   (which bypasses RLS and the column grant). It prints the user id on success.

   Equivalent manual SQL (Supabase dashboard → SQL editor):

   ```sql
   update public.profiles
   set role = 'ADMIN'
   where id = (select id from auth.users where email = 'ops@seeable.example');
   ```

3. The person signs out and back in. `GET /api/v1/auth/me` now returns
   `role: "ADMIN"`; `/admin/overview` is reachable; `is_admin()` is true inside
   every `SECURITY DEFINER` function.

## Notes

- If the account was a Publisher, its `publisher_profiles` row stays. It is
  inert for an ADMIN (no code path reads it for that role). Delete it only if
  you want a clean record.
- **ADMIN is not a superset of PUBLISHER** (`api-specification.md` §6.1). An
  ADMIN cannot accept/reject requests and cannot browse individual requests —
  `requests_select_own` has no `is_admin()` clause by design.
- To revoke: set the role back to `VIEWER` with the same SQL.
- `ADMIN_BOOTSTRAP_EMAIL` in the environment is only a convenience default for
  the script — it grants nothing on its own.
