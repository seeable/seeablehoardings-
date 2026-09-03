-- =============================================================================
-- Phase 1 · 13 — hoarding_types reference data (Decision D15)
-- database-design.md §18, §42.1 · IMPLEMENTATION-PLAN.md §Phase 1 step 15
-- =============================================================================
-- This is REFERENCE data, not sample data — it lives in a migration, not
-- seed.sql (§37.3: hoarding_types has no client write policy, maintained only
-- via migration). 6 static types + 2 digital (taxonomy only, not listable at
-- MVP — enforced in the creation UI, mvp-brd.md §5.1). Size unit = feet,
-- min photos to submit = 3 (D15).
--
-- Recommendation — Pending Confirmation (§42.1): `required_attribute_keys` is a
-- reasonable reconstruction of mvp-prd.md §8's per-type field tables, not a
-- verified character-for-character copy. hoarding_has_required_attributes()
-- depends on these being exactly right — reconcile against mvp-prd.md §8 and
-- api-specification.md §39.4 before onboarding real Publishers. Correcting a
-- key here is `update hoarding_types`, not a schema migration.
-- =============================================================================

insert into hoarding_types (code, display_name, is_digital, required_attribute_keys, description) values
  ('UNIPOLE_BILLBOARD', 'Unipole / Billboard', false,
    array['height_ft', 'width_ft', 'illumination', 'facing_direction'],
    'Single-pole outdoor billboard structure'),
  ('GANTRY', 'Gantry', false,
    array['height_ft', 'width_ft', 'illumination', 'road_name'],
    'Overhead structure spanning a road'),
  ('METRO_PILLAR', 'Metro Pillar', false,
    array['pillar_number', 'height_ft', 'width_ft', 'metro_line'],
    'Advertising wrap on a metro rail pillar'),
  ('WALL_WRAP', 'Wall Wrap', false,
    array['height_ft', 'width_ft', 'building_name', 'wrap_type'],
    'Large-format wrap on a building wall'),
  ('TRANSIT_MEDIA', 'Transit Media', false,
    array['vehicle_type', 'route_number', 'media_position'],
    'Advertising on buses / transit vehicles'),
  ('BUS_QUEUE_SHELTER', 'Bus Queue Shelter', false,
    array['shelter_id', 'height_ft', 'width_ft', 'illumination'],
    'Advertising panel at a bus shelter'),
  ('DIGITAL_BILLBOARD', 'Digital Billboard', true,
    array['screen_resolution', 'loop_duration_seconds', 'slot_count'],
    'Digital display billboard — taxonomy only, not listable at MVP (mvp-brd.md §5.1)'),
  ('DIGITAL_SCREEN', 'Digital Screen', true,
    array['screen_resolution', 'orientation', 'network_connectivity'],
    'Digital display screen — taxonomy only, not listable at MVP (mvp-brd.md §5.1)')
on conflict (code) do update set
  display_name            = excluded.display_name,
  is_digital              = excluded.is_digital,
  required_attribute_keys = excluded.required_attribute_keys,
  description             = excluded.description;
