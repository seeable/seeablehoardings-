-- =============================================================================
-- Fix: service_role is missing standard table/sequence/function privileges
-- (found while building the billboard-inventory import script)
-- =============================================================================
-- `service_role` bypasses RLS by role attribute, but RLS bypass is orthogonal
-- to plain Postgres GRANTs — PostgREST still enforces them. Querying with
-- `information_schema.role_table_grants` showed `service_role` holds only
-- TRUNCATE/TRIGGER/REFERENCES on every public table — never SELECT/INSERT/
-- UPDATE/DELETE. That means `lib/supabase/admin.ts`'s createAdminClient()
-- (its own doc-comment: "the media upload / watermark write handler" and
-- "migration / seed / provisioning tooling") could never actually read or
-- write a table directly — only `.rpc()` calls worked, because a
-- SECURITY DEFINER function runs as its owner, not its caller. This is a
-- pre-existing gap, not something this migration's own callers created; it
-- surfaced because the billboard-inventory import script is the first
-- tooling to actually exercise `admin.from(...)` against the live project.
--
-- Fix: grant service_role what every Supabase project's service_role is
-- meant to have — full DML on every table, usage/select on sequences,
-- execute on every function — and set default privileges so this holds for
-- objects created by future migrations too. RLS remains the enforcement
-- layer for anon/authenticated (unchanged); this migration touches only the
-- role that is documented, project-wide, to bypass it.
-- =============================================================================

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
