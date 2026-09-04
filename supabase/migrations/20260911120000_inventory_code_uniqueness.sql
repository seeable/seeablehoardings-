-- =============================================================================
-- Billboard inventory import — stable inventory-code identity
-- (an out-of-sequence addition; unrelated to the roadmap's own Phase 11)
-- =============================================================================
-- The 68-photo bulk import (billboards/, codes SH-BB-001.. / SH-DB-001.. /
-- SH-BS-001) needs a durable, DB-enforced way to say "this business inventory
-- code has already been imported" so the import script is safe to re-run.
-- `hoardings` has no existing business-key column; the code is stored at
-- `attributes->>'inventory_code'` (jsonb already holds type-specific,
-- non-relational facts — this is one more, not a new column for a one-off).
-- A partial unique index on that expression is the actual enforcement layer
-- (matches this project's "the DB is the enforcement layer" convention) —
-- the import script's own pre-check is a courtesy, not the only guard.
-- =============================================================================

create unique index if not exists hoardings_inventory_code_uidx
  on hoardings (((attributes ->> 'inventory_code')))
  where attributes ->> 'inventory_code' is not null;
