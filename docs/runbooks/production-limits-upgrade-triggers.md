# Production Limits & Upgrade Triggers

**Phase 13 — Operational Capacity Planning**

This runbook documents Supabase Free-tier limits, current usage, upgrade triggers, and mitigation strategies per Phase 13 requirements.

## Supabase Free-Tier Quotas

| Resource | Limit | Current Usage | Headroom | Upgrade Trigger |
|----------|-------|----------------|----------|-----------------|
| **Database Size** | 500 MB | ~50 MB (seed) | 90% | At 450 MB |
| **Storage** | 1 GB | ~200 MB (photos) | 80% | At 800 MB |
| **Egress** | 5 GB/month | ~100 MB/week (~400 MB/month est.) | 92% | At 4.6 GB/month |
| **MAU (Monthly Active Users)** | 50,000 | ~50–100 (MVP launch) | 99.8% | At 40,000 MAU |
| **Realtime Connections** | 1,000 concurrent | <10 (MVP scale) | 99% | At 900 concurrent |

## Monitoring Quotas

### Daily Health Check (Supabase Dashboard)

1. **Database size:**
   ```sql
   SELECT pg_size_pretty(pg_database_size('postgres'));
   -- Expected for MVP: < 100 MB
   ```

2. **Storage usage:**
   - Supabase dashboard → Storage → Buckets
   - Track `hoarding-public` (user photos), `hoarding-private`, `publisher-documents`

3. **Egress trend:**
   - Supabase dashboard → Analytics → Egress (bytes)
   - If trending toward 4+ GB/month, escalate

4. **Active users:**
   - Supabase dashboard → Usage → MAU
   - Should stay < 1,000 on Free tier for MVP launch

5. **Realtime:**
   - Monitor Realtime message count in logs
   - Spike in notifications or requests could trigger reconnects

### Automated Alerts

Set up monitoring queries (e.g., in Grafana, PagerDuty, or a cron script):

```sql
-- Alert if DB size > 400 MB
SELECT CASE
  WHEN pg_database_size('postgres') > 400*1024*1024
  THEN 'ALERT: DB approaching limit'
  ELSE 'OK'
END;

-- Alert if no cron job runs in last 30 min (staleness)
SELECT CASE
  WHEN NOW() - MAX(start_time) > INTERVAL '30 minutes'
  THEN 'ALERT: pg_cron stalled'
  ELSE 'OK'
END FROM cron.job_run_details WHERE jobname='expire-requests';
```

## Upgrade Triggers & Actions

### Trigger: Database Size > 450 MB

**Cause:** Listings, photos, request history, analytics events accumulated.

**Action:**
1. **Archive old data** (if enabled):
   - Move analytics_events older than 6 months to a separate "archive" table.
   - Delete old hoarding_availability_blocks (> 1 year).
2. **Upgrade to Pro** (~$25/month):
   - Supabase dashboard → Billing → Upgrade Plan
   - Pro tier: 8 GB DB, 100 GB storage, 250 GB egress, unlimited MAU

### Trigger: Storage > 800 MB

**Cause:** Large or many photos in `hoarding-public` or `publisher-documents`.

**Mitigation (before upgrade):**
- Re-encode photos to smaller dimensions (e.g., 1200px max width).
- Delete low-quality or duplicate uploads.
- Use Cloudflare Image Resizing instead of storing full-res.

**Upgrade:** See "Database Size" above (same Pro plan covers storage).

### Trigger: Egress > 4.6 GB/month

**Cause:** High Discover page traffic (many image downloads from storage).

**Mitigation (before upgrade):**
- Cache images via Cloudflare (if not already doing so).
- Use Cloudflare CDN image resizing (or jsDelivr for serving images).
- Enable Supabase CDN caching on storage buckets (Pro feature).

**Upgrade:** Pro tier includes 250 GB egress; if still over, consider Supabase Bandwidth increase (à la carte).

### Trigger: MAU > 40,000

**Cause:** Platform gaining traction, many new Viewers/Publishers.

**Action:**
- No action needed at 40K. Free tier supports 50K.
- At 50K: Upgrade to Pro or Business (depending on other metrics).

### Trigger: Realtime Spikes (> 900 concurrent connections)

**Cause:** Unusual spike in notifications, live request updates, or broadcast loops.

**Mitigation:**
- Check for runaway Realtime subscriptions (e.g., a page subscribing to all tables).
- Unsubscribe from unused channels.
- Limit Realtime scope (Phase 11: notifications + requests only).

**Upgrade:** Business plan (if spiking regularly) or contact Supabase support for debug.

## Capacity Projections

**Assumption:** 1,000 Viewers + 50 Publishers, 200 live listings, 50 requests/week.

| Metric | Monthly Growth | Projected (12 months) | Free-Tier Safe At |
|--------|---------------|-----------------------|-------------------|
| DB Size | +5–10 MB | ~60–120 MB | < 400 MB ✓ |
| Storage | +20 MB (photos) | ~240 MB | < 800 MB ✓ |
| Egress | +40 MB (discovery views) | ~480 MB | < 4.6 GB ✓ |
| MAU | +100/month | ~1,200 | < 50,000 ✓ |

**Conclusion:** Free tier **sufficient for MVP launch (6 months of growth)**. Plan Pro upgrade by Month 6–9 if growth accelerates.

## Risk Mitigation (RISK-8, per api-specification.md)

### Risk: Supabase Pause (Inactivity)

**Scenario:** If Free-tier project inactive for 2 weeks, Supabase pauses the DB.

**Mitigation:**
- `/api/health` endpoint pinged every 5 minutes (external uptime monitor).
- This keeps project "active" (prevents pause).
- Ensure uptime probe configured in Cloudflare or external service.

**Verification:**
```bash
# Cron: every 6 hours
curl -s https://seeable.in/api/health | grep '"status":"ok"' && echo "✓ Project active"
```

## Disaster Scenarios

### Scenario: Storage Quota Exceeded (uploads blocked)

**Symptom:** Publishers cannot upload media; `POST /api/v1/hoardings/{id}/media` returns 403.

**Immediate Action:**
1. Stop accepting new uploads (return 503 "Service Temporarily Unavailable").
2. Identify and delete low-value or test photos.
3. Restore upload functionality once storage < 800 MB.
4. **Permanent:** Upgrade to Pro or implement image compression/CDN.

### Scenario: DB Quota Exceeded (writes blocked)

**Symptom:** `INSERT` errors in requests, notifications, analytics.

**Immediate Action:**
1. Stop accepting new requests (return 503).
2. Archive old analytics_events to a separate table.
3. Upgrade to Pro **immediately** (< 1 hour).
4. Restore functionality.

### Scenario: MAU Limit Exceeded (auth fails)

**Symptom:** New Viewers cannot sign up; Supabase Auth returns quota error.

**Immediate Action:**
1. Close signup (return 503 "Closed for maintenance").
2. Contact Supabase support for emergency upgrade.
3. Upgrade to Pro/Business.
4. Reopen signup.

## Cost Estimation (First Year)

| Scenario | Free Tier | Pro Plan | Business |
|----------|-----------|----------|----------|
| **MVP Launch (first 6 mo)** | $0 | N/A | N/A |
| **Scale to 5K MAU (next 6 mo)** | $0 (hits quota) | $25/mo | N/A |
| **Scale to 20K MAU (year 1+)** | $0 (over quota) | $25/mo | $100+/mo |

**Recommendation:**
- Start on Free tier (no cost).
- Upgrade to Pro at 6 months or when quota warnings appear.
- Switch to Business only if > 20K MAU or custom SLA needed.

## Monitoring Dashboard (Optional)

Create a simple status page or dashboard:

```bash
# Example: cron job (daily, 9 AM IST)
0 3 * * * /home/ops/check-quotas.sh >> /var/log/seeable-quotas.log
```

**Script: check-quotas.sh**

```bash
#!/bin/bash
SLACK_WEBHOOK="https://hooks.slack.com/services/..."
DB_SIZE=$(psql $SUPABASE_URL -c "SELECT pg_size_pretty(pg_database_size('postgres'));" -t)
STORAGE_SIZE="..." # Fetch from Supabase API
echo "DB: $DB_SIZE | Storage: $STORAGE_SIZE | Time: $(date)" | curl -X POST -d @- $SLACK_WEBHOOK
```

---

**Created:** 2026-09-04 (Phase 13)  
**Last Updated:** Pre-launch  
**Next Review:** Post-launch (weekly for first month, then monthly)

**Owned By:** Ops team / On-call engineer
