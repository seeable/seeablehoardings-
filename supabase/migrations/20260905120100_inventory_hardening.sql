-- =============================================================================
-- Phase 5 · Inventory write-surface hardening
-- api-specification.md §12.3 / §13.2 / §14.5 · IMPLEMENTATION-PLAN.md §Phase 5
-- =============================================================================
-- Phase 1's grants migration granted table-level INSERT/UPDATE on `hoardings`
-- and INSERT on `hoarding_media` to `authenticated`. That is wider than the API
-- contract: a Publisher could PATCH `approval_status = 'APPROVED'` and bypass
-- ADMIN-001, or INSERT a `hoarding_media` row with `processing_status =
-- 'WATERMARKED'` and slip past the CONTENT-001 gate. RLS governs *rows*; column
-- grants govern *which columns*. This migration narrows both to exactly the
-- client-writable set. Server-owned columns move only via the SECURITY DEFINER
-- lifecycle functions (which run as the function owner) and the service-role
-- media handler (which BYPASSRLS).
-- =============================================================================

-- ---- hoardings: column-restricted INSERT + UPDATE ------------------------
revoke insert, update on hoardings from authenticated;

-- api-specification.md §12.3 "Required/validated at creation" + the optional set
grant insert (
  publisher_id, type_code, title, description, size, price, price_unit,
  latitude, longitude, locality, city, address_text, attributes, site_intelligence
) on hoardings to authenticated;

-- api-specification.md §13.2 "Freely editable by the owning Publisher"
grant update (
  title, description, size, price, price_unit,
  latitude, longitude, locality, city, address_text,
  attributes, site_intelligence, is_paused
) on hoardings to authenticated;

-- ---- hoarding_media: no client INSERT ----------------------------------
-- Rows are created only by POST /api/v1/hoardings/{id}/media (service role,
-- api-specification.md §14.2). The client keeps UPDATE (is_primary,
-- display_order) and DELETE, both already column-/row-scoped.
revoke insert on hoarding_media from authenticated;

-- ---- site_intelligence_complete — server-derived (INVENTORY-002) --------
-- api-specification.md §12.3: the server owns this flag. It is deliberately not
-- in the INSERT/UPDATE grant above, so it can only be set here. "Complete" =
-- the three fields the listing form (docs/04 PB-03 Step 3) collects are all
-- present and non-blank.
create or replace function maintain_site_intelligence_complete()
returns trigger language plpgsql as $$
begin
  new.site_intelligence_complete := (
    nullif(btrim(coalesce(new.site_intelligence ->> 'traffic_volume', '')), '') is not null
    and nullif(btrim(coalesce(new.site_intelligence ->> 'visibility_rating', '')), '') is not null
    and nullif(btrim(coalesce(new.site_intelligence ->> 'nearby_landmarks', '')), '') is not null
  );
  return new;
end;
$$;

drop trigger if exists trg_maintain_site_intelligence_complete on hoardings;
create trigger trg_maintain_site_intelligence_complete
  before insert or update of site_intelligence on hoardings
  for each row execute function maintain_site_intelligence_complete();

revoke execute on function maintain_site_intelligence_complete()
  from anon, authenticated, public;
