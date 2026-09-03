-- =============================================================================
-- Phase 1 · 02 — Core tables, generated columns, check constraints,
--                the exclusion constraint, the VIEWER-002 unique index
-- database-design.md §40 steps 2-13, §41.2 · IMPLEMENTATION-PLAN.md §Phase 1 steps 2-6
-- =============================================================================
-- Verbatim from database-design.md §41.2. The one load-bearing object here is
-- `requests_no_overlapping_confirmed` (§31): no two CONFIRMED/LIVE/COMPLETED
-- requests on one hoarding may hold overlapping date ranges — enforced by
-- Postgres itself, underneath confirm_request() (§24).
-- =============================================================================

-- 1. profiles — 1:1 extension of auth.users -----------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('VIEWER', 'PUBLISHER', 'ADMIN')),
  full_name   text,
  phone       text,
  email       text,
  city        text default 'Bengaluru',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. publisher_profiles — verification / suspension workflow, 1:1 with profiles
create table publisher_profiles (
  id                            uuid primary key references profiles (id) on delete cascade,
  business_name                 text,
  verification_status           text not null default 'UNVERIFIED'
                                  check (verification_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')),
  verified_at                   timestamptz,
  verification_rejection_reason  text,
  suspended                     boolean not null default false,
  suspended_at                  timestamptz,
  suspended_by                  uuid references profiles (id) on delete set null,
  suspension_reason             text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- 3. hoarding_types — seeded reference/lookup table (§18, seeded in 20260903121300)
create table hoarding_types (
  code                     text primary key,
  display_name             text not null,
  is_digital               boolean not null default false,
  required_attribute_keys  text[] not null default '{}',
  description              text,
  created_at               timestamptz not null default now()
);

-- 4. hoardings — the central entity -----------------------------------------
create table hoardings (
  id                          uuid primary key default gen_random_uuid(),
  publisher_id                uuid not null references profiles (id) on delete restrict,
  type_code                   text not null references hoarding_types (code) on delete restrict,
  title                       text not null,
  description                 text,
  size                        text,
  price                       numeric(12, 2),
  price_unit                  text not null default 'MONTH'
                               check (price_unit in ('DAY', 'WEEK', 'MONTH')),
  latitude                    double precision,
  longitude                   double precision,
  locality                    text,
  city                        text not null default 'Bengaluru',
  address_text                text,
  approval_status             text not null default 'DRAFT'
                               check (approval_status in ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  rejection_reason            text,
  approved_at                 timestamptz,
  approved_by                 uuid references profiles (id) on delete set null,
  is_paused                   boolean not null default false,
  paused_at                   timestamptz,
  is_delisted                 boolean not null default false,
  delisted_at                 timestamptz,
  delisted_by                 uuid references profiles (id) on delete set null,
  delist_reason               text,
  site_intelligence_complete  boolean not null default false,
  site_intelligence           jsonb not null default '{}'::jsonb,
  attributes                  jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint hoardings_price_positive_check check (price is null or price > 0),
  constraint hoardings_rejection_reason_required_check
    check (approval_status <> 'REJECTED' or rejection_reason is not null),
  constraint hoardings_lat_range_check check (latitude is null or latitude between -90 and 90),
  constraint hoardings_lng_range_check check (longitude is null or longitude between -180 and 180)
);

-- 5. hoarding_media — public/private storage references (CONTENT-001) --------
create table hoarding_media (
  id                     uuid primary key default gen_random_uuid(),
  hoarding_id            uuid not null references hoardings (id) on delete cascade,
  media_type             text not null default 'IMAGE' check (media_type in ('IMAGE', 'VIDEO')),
  storage_path           text not null,
  original_storage_path  text,
  is_primary             boolean not null default false,
  display_order          int not null default 0,
  processing_status      text not null default 'UPLOADED'
                          check (processing_status in ('UPLOADED', 'PROCESSING', 'WATERMARKED', 'FAILED')),
  watermarked_at         timestamptz,
  created_at             timestamptz not null default now()
);

-- 6. hoarding_availability_blocks — Publisher-declared unavailable ranges ----
create table hoarding_availability_blocks (
  id           uuid primary key default gen_random_uuid(),
  hoarding_id  uuid not null references hoardings (id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  date_range   daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  reason       text,
  created_at   timestamptz not null default now(),
  constraint hab_date_order_check check (end_date >= start_date)
);

-- 7. requests — the Request Engine's core table ----------------------------
create table requests (
  id                uuid primary key default gen_random_uuid(),
  hoarding_id       uuid not null references hoardings (id) on delete restrict,
  viewer_id         uuid not null references profiles (id) on delete restrict,
  publisher_id      uuid not null references profiles (id) on delete restrict,
  start_date        date not null,
  end_date          date not null,
  stay_range        daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  status            text not null default 'REQUESTED'
                     check (status in ('REQUESTED', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'LIVE', 'COMPLETED')),
  message           text,
  rejection_reason  text,
  amount_agreed     numeric(12, 2),
  sla_deadline      timestamptz,
  confirmed_at      timestamptz,
  rejected_at       timestamptz,
  expired_at        timestamptz,
  live_at           timestamptz,
  completed_at      timestamptz,
  completed_by      uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint requests_date_order_check check (end_date >= start_date),
  constraint requests_amount_positive_check check (amount_agreed is null or amount_agreed > 0)
);

-- THE central invariant — REQUEST-001 / REQUEST-004 (database-design.md §31).
alter table requests
  add constraint requests_no_overlapping_confirmed
  exclude using gist (
    hoarding_id with =,
    stay_range with &&
  )
  where (status in ('CONFIRMED', 'LIVE', 'COMPLETED'));

-- VIEWER-002 — one pending request per Viewer per hoarding, enforced structurally.
create unique index requests_one_pending_per_viewer_hoarding
  on requests (hoarding_id, viewer_id)
  where status = 'REQUESTED';

-- 8. request_status_history — append-only audit trail (§23) ------------------
create table request_status_history (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references requests (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references profiles (id) on delete set null,
  changed_at   timestamptz not null default now(),
  note         text
);

-- 9. notifications — flat, one row per (event, recipient) -------------------
create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  recipient_id        uuid not null references profiles (id) on delete cascade,
  type                text not null check (type in (
                        'REQUEST_CREATED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED',
                        'REQUEST_EXPIRED', 'REQUEST_EXPIRING_SOON',
                        'LISTING_APPROVED', 'LISTING_REJECTED'
                      )),
  title               text not null,
  message             text not null,
  related_hoarding_id uuid references hoardings (id) on delete set null,
  related_request_id  uuid references requests (id) on delete set null,
  is_read             boolean not null default false,
  read_at             timestamptz,
  created_at          timestamptz not null default now()
);

-- 10. admin_actions — lightweight moderation audit trail (§26) --------------
create table admin_actions (
  id                   uuid primary key default gen_random_uuid(),
  admin_id             uuid references profiles (id) on delete set null,
  admin_label          text not null,
  action_type          text not null check (action_type in (
                         'LISTING_APPROVED', 'LISTING_REJECTED',
                         'PUBLISHER_VERIFIED', 'PUBLISHER_VERIFICATION_REJECTED',
                         'PUBLISHER_SUSPENDED', 'PUBLISHER_UNSUSPENDED',
                         'HOARDING_DELISTED', 'HOARDING_RELISTED'
                       )),
  target_hoarding_id   uuid references hoardings (id) on delete set null,
  target_publisher_id  uuid references profiles (id) on delete set null,
  reason               text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

-- 11. analytics_events — decoupled operational event log (§27, §39) --------
create table analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles (id) on delete set null,
  event_name  text not null,
  properties  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
