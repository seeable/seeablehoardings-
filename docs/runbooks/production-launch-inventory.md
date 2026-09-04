# Production Launch Inventory Seeding

**Phase 13 — Launch Gate: 50+ Real Approved Listings**

This document covers the manual/field-entry process for seeding real inventory before go-live. This is a **launch gate** per Phase 13 requirements — no go-live without ≥50 verified, live listings.

## Overview

The MVP ships with real Bengaluru billboard inventory (imported from field surveys, Phase billboard import). Launch requires:

- **50+ listings** in `APPROVED` status
- **All 6 hoarding types** represented (Bus Queue Shelter, Gantry, Unipole/Billboard, Cantilever, Metro Pillar, Wall Wrap)
- **Geographic spread** across Bengaluru zones (N, S, E, W, central)
- **At least 2 verified Publishers** (so Viewers see multiple sources, builds trust)
- **No duplicate/invalid data** (addresses valid, coordinates in Bengaluru bounds, photos clear)

## Inventory Entry Workflow

### 1. Audit Existing Seeded Data

Phase 12's `supabase seed.sql` includes ~60 test listings. In production:

```sql
-- Count by status:
SELECT status, hoarding_type_id, COUNT(*) FROM hoardings GROUP BY status, hoarding_type_id;

-- Count by publisher:
SELECT publisher_id, COUNT(*) FROM hoardings GROUP BY publisher_id;

-- Verify at least 50 APPROVED:
SELECT COUNT(*) FROM hoardings WHERE status = 'APPROVED';  -- Should be ≥ 50
```

### 2. Manual Field Entry (if short of 50)

**Process:**
- Ops team visits locations or uses existing site-survey data (GPS, photos).
- For each hoarding: capture GPS coordinates, photo, hoarding type, business name (Publisher).
- Entry via `POST /api/v1/hoardings` (as Publisher) or direct SQL insert (as Admin).

**Example: Bulk Insert via Admin SQL**

```sql
-- If doing direct SQL (Admin context, Service Role bypass):
INSERT INTO public.hoardings (
  publisher_id, hoarding_type_id, title, description,
  latitude, longitude, address, status, created_at
) VALUES
  ('pub-verified-1', 3, 'Silk Board Unipole - SH-BB-064',
   'Facing ORR towards whitefield', 12.9412, 77.6245,
   'Silk Board, Bengaluru', 'APPROVED', NOW()),
  ('pub-verified-2', 2, 'Outer Ring Road Gantry - SH-BB-065',
   'High speed traffic corridor', 12.9625, 77.7125,
   'Outer Ring Road, Bengaluru', 'APPROVED', NOW());
-- ... repeat for all 50+
```

**Validation:**
- Latitude/Longitude: Bengaluru bounds (12.8–13.2°N, 77.4–77.8°E)
- Status must be `APPROVED` (not `SUBMITTED` — publish immediately for launch)
- At least 8 listings per type (6 types × ~8 = 48)
- Geographic spread: at least 3 listings per major zone

### 3. Photo Upload (if applicable)

If using the UI to add listings:
1. Publisher logs in to their dashboard.
2. Add Hoarding → wizard step "Media".
3. Upload a watermarked photo (server-side or Variant B Canvas).
4. Verify in `hoarding_media` table:

```sql
SELECT hoarding_id, COUNT(*) FROM public.hoarding_media GROUP BY hoarding_id;
```

### 4. Verification Checklist

Before marking go-ahead:

```sql
-- 1. Count by type (should be ≥ 8 each):
SELECT hoarding_type_id, COUNT(*) as cnt
FROM public.hoardings WHERE status = 'APPROVED'
GROUP BY hoarding_type_id;

-- 2. Geographic spread (should cover zones):
SELECT 
  CASE 
    WHEN latitude >= 13.05 THEN 'North'
    WHEN latitude < 13.05 AND latitude >= 13.0 THEN 'Central'
    WHEN latitude < 13.0 AND latitude >= 12.95 THEN 'South'
    ELSE 'Far South'
  END as zone,
  COUNT(*) as cnt
FROM public.hoardings WHERE status = 'APPROVED'
GROUP BY zone;

-- 3. Media coverage (at least 80% have photos):
SELECT 
  COUNT(DISTINCT h.id) as total_approved,
  COUNT(DISTINCT m.hoarding_id) as with_media
FROM public.hoardings h
LEFT JOIN public.hoarding_media m ON h.id = m.hoarding_id
WHERE h.status = 'APPROVED';

-- 4. Publisher spread (at least 2):
SELECT publisher_id, COUNT(*) FROM public.hoardings 
WHERE status = 'APPROVED' GROUP BY publisher_id;

-- 5. Coordinates valid:
SELECT COUNT(*) as invalid_coords
FROM public.hoardings
WHERE status = 'APPROVED'
  AND (latitude NOT BETWEEN 12.8 AND 13.2
    OR longitude NOT BETWEEN 77.4 AND 77.8);  -- Should be 0
```

## Testing Launch Inventory

### Viewer Discovery Smoke Test

1. Log in as a Viewer (or run Playwright E2E).
2. Visit `/discover`.
3. Verify:
   - ≥ 50 listings visible.
   - Type filter shows all 6 types.
   - Map displays markers across Bengaluru.
   - Click a listing → detail loads, photo visible, "Available now" shown.

### Admin Inventory Check

1. Log in as Admin.
2. Navigate to "Inventory" or "Publishers" section.
3. Verify:
   - All ≥ 50 listings status = "APPROVED".
   - "Total Listings" KPI in overview ≥ 50.
   - No SUBMITTED or REJECTED listings visible (these shouldn't go live).

### Analytics Seed

If Phase 10 analytics enabled:

```sql
-- Verify no fake events in production (e.g., from test runs):
SELECT event_type, COUNT(*) FROM public.analytics_events
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY event_type;  -- Should show real Viewer activity post-launch
```

## Rollback (Inventory Wipe)

If launch must be halted:

```sql
-- Delete all seed listings (careful — production data!):
DELETE FROM public.hoarding_availability_blocks
WHERE hoarding_id IN (SELECT id FROM public.hoardings WHERE publisher_id = 'pub-verified-1' OR 'pub-verified-2');

DELETE FROM public.hoarding_media
WHERE hoarding_id IN (SELECT id FROM public.hoardings WHERE publisher_id = 'pub-verified-1' OR 'pub-verified-2');

DELETE FROM public.hoardings
WHERE publisher_id IN ('pub-verified-1', 'pub-verified-2');

-- Verify:
SELECT COUNT(*) FROM public.hoardings WHERE status = 'APPROVED';  -- Should be 0 now
```

## Go/No-Go Criteria

**GO:**
- ✓ ≥ 50 listings in APPROVED status
- ✓ All 6 hoarding types represented
- ✓ Geographic spread (N, S, E, W, central)
- ✓ ≥ 2 Publishers
- ✓ ≥ 80% have media (photos)
- ✓ Viewer discovery smoke test passes
- ✓ Admin inventory KPI ≥ 50

**NO-GO:**
- ✗ < 50 listings
- ✗ Missing type (only 5 of 6 types present)
- ✗ All listings in one zone
- ✗ 1 Publisher only (no diversity signal)
- ✗ > 20% missing media
- ✗ Coordinates invalid or outside Bengaluru
- ✗ Smoke test failures

---

**Created:** 2026-09-04  
**Last Reviewed:** Phase 13 Launch  
**Next Update:** Post-launch inventory management (add/retire listings)
