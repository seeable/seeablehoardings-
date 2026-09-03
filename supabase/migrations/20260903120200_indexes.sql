-- =============================================================================
-- Phase 1 · 03 — Indexes
-- database-design.md §32, §41.3 · IMPLEMENTATION-PLAN.md §Phase 1 step 6
-- =============================================================================
-- Beyond the automatic PK indexes and the btree_gist exclusion index (§31).
-- Partial indexes keep the HOT subset of each table (pending queue, active
-- requests, unread notifications) small regardless of history growth (§45).
-- =============================================================================

create index idx_hoardings_publisher_id on hoardings (publisher_id);
create index idx_hoardings_type_code on hoardings (type_code);
create index idx_hoardings_approval_status on hoardings (approval_status)
  where approval_status = 'PENDING_REVIEW';
create index idx_hoardings_visible on hoardings (city, type_code)
  where approval_status = 'APPROVED' and not is_paused and not is_delisted;
create index idx_hoardings_city_locality on hoardings (city, locality);

create index idx_hoarding_media_hoarding_id on hoarding_media (hoarding_id);

create index idx_hab_hoarding_id on hoarding_availability_blocks (hoarding_id);
create index idx_hab_date_range on hoarding_availability_blocks using gist (date_range);

create index idx_requests_hoarding_id on requests (hoarding_id);
create index idx_requests_viewer_id on requests (viewer_id);
create index idx_requests_publisher_id on requests (publisher_id);
create index idx_requests_status on requests (status) where status = 'REQUESTED';
create index idx_requests_sla_deadline on requests (sla_deadline) where status = 'REQUESTED';

create index idx_rsh_request_id on request_status_history (request_id);

create index idx_notifications_recipient_unread on notifications (recipient_id, created_at desc)
  where not is_read;

create index idx_admin_actions_target_hoarding on admin_actions (target_hoarding_id);
create index idx_admin_actions_target_publisher on admin_actions (target_publisher_id);

create index idx_analytics_events_name_created on analytics_events (event_name, created_at desc);
