# Production Deployment Runbook

**Phase 13 — Launch Prep & Operations**

This runbook covers the full production deployment pipeline: environment setup → staging validation → production migration → launch verification.

## Pre-Launch Checklist

Before any production action:

- [ ] All Phase 12 E2E tests passing in CI
- [ ] Feature flags: `AUTH_OTP_ENABLED=false` confirmed
- [ ] Production bundle size verified under Worker ceiling (3 MiB)
- [ ] Database: staging migration dry-run successful
- [ ] Monitoring: uptime probe + staleness alert configured
- [ ] Backup: pre-deployment dump captured
- [ ] Launch inventory: 50+ approved listings seeded (manual/field entry, Phase 13 gate)
- [ ] First Admin: provisioned via `npm run provision:admin` (ADMIN_BOOTSTRAP_EMAIL env var)
- [ ] Rollback plan reviewed (this document, section "Rollback")

## Environment Setup (Staging & Production)

### 1. Cloudflare Pages/Workers (Production)

```bash
# Ensure CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in GitHub Actions Secrets
# (not in .env — this is IaC controlled)

# Deploy via CI on merge to main:
git push origin main
# GitHub Actions runs: npm run cf:deploy
# This builds via OpenNext and pushes to Cloudflare
```

### 2. Supabase Production Project

```bash
# Set up Supabase project (or bring existing to production state)
# Environment variables (GitHub Actions Secrets, Cloudflare Workers):
export NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="xxxxx"
export SUPABASE_SERVICE_ROLE_KEY="xxxxx" # GitHub Secrets only
```

### 3. Production Env Vars

**GitHub Actions Secrets** (for CI/deploy):
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF` (for `db:types:remote`)

**Cloudflare Workers Environment** (for runtime):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ENV=production`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (or `NEXT_PUBLIC_MAPTILER_KEY`)

**No deploy-time secrets in .env.** All via:
- GitHub Actions: Secrets (for CI scripts)
- Cloudflare Workers: Environment bindings (for app runtime)

## Staging Validation (Mandatory Before Production)

### 1. Migration Dry-Run

```bash
# Simulate migrations on a fresh Supabase project snapshot
supabase db push --dry-run  # Or locally: supabase db reset on a staging DB

# Verify:
# - All migrations apply cleanly
# - No constraint violations
# - search_path pinned on every SECURITY DEFINER function
# - RLS policies in place
```

### 2. Smoke Tests

```bash
# Deploy to Cloudflare staging (or a preview URL)
npm run cf:preview

# Run E2E against staging:
PLAYWRIGHT_TEST_BASE_URL="https://staging.seeable.in" npm run test:e2e

# Verify:
# - All critical flows pass
# - Performance: p95 < ~500ms for search/detail
# - Map renders 200 markers without jank
# - No CSP violations in console
```

### 3. Bundle Size Check

```bash
# Verify production build under 3 MiB Worker ceiling
npm run build
npm run check:bundle  # Should output "✓ clean"
du -sh .next  # Sanity check
```

## Production Migration Pipeline

### 1. Pre-Migration Backup

```bash
# Before ANY production migration:
pg_dump postgres://... > production_$(date +%Y%m%d_%H%M%S).sql

# Store securely (Backblaze B2, Wasabi, or similar backup service)
```

### 2. Staging Migration (on production-like snapshot)

```bash
# Create a production-shaped snapshot (or restore a recent backup)
# Run migrations against it
supabase db push --linked --password $SUPABASE_SERVICE_ROLE_KEY

# Verify success:
psql $STAGING_DB -c "SELECT version();"
psql $STAGING_DB -c "SELECT * FROM cron.job WHERE jobname='expire-requests';"
```

### 3. Production Migration

```bash
# On merge to main, CI runs:
# 1. Build + bundle size check
# 2. Staging migration dry-run
# 3. Production migration (automated via GitHub Actions)

# If manual trigger needed:
SUPABASE_PROJECT_ID=xxxxx supabase db push
```

### 4. Post-Migration Verification

```bash
# Connect to production database and verify:

# RLS is active
SELECT COUNT(*) FROM pg_policies;  -- Should be > 50

# search_path set on functions
SELECT proname, prosecdef, proconfig FROM pg_proc 
  WHERE prosecdef AND proowner != 10;

# pg_cron jobs registered
SELECT jobname, schedule, command FROM cron.job;

# Column grants in place
SELECT grantee, privilege_type FROM information_schema.table_privileges
  WHERE table_name='profiles' AND privilege_type='UPDATE';
```

## First Admin Provisioning

```bash
# Environment: set ADMIN_BOOTSTRAP_EMAIL
export ADMIN_BOOTSTRAP_EMAIL="ops@seeable.in"

# In Supabase dashboard or via CLI:
supabase auth admin create-user \
  --email $ADMIN_BOOTSTRAP_EMAIL \
  --password $RANDOM_PASSWORD

# Set user metadata:
INSERT INTO auth.users (email, raw_user_meta_data, role)
  VALUES ($ADMIN_BOOTSTRAP_EMAIL, '{"role": "ADMIN"}', 'ADMIN');

# Verify:
SELECT id, email, raw_user_meta_data FROM auth.users 
  WHERE email = $ADMIN_BOOTSTRAP_EMAIL;
```

## pg_cron in Production

### 1. Verify Jobs Exist

```bash
SELECT jobname, schedule, command, active FROM cron.job;

-- Expected jobs:
-- expire-requests: '*/5 * * * *' (every 5 minutes)
-- schedule-notifications: '*/2 * * * *' (every 2 minutes) [if Phase 10 enabled]
```

### 2. Monitor Staleness

**Alert: if `expire-requests` hasn't run in 15 minutes:**

```sql
-- Saved query: Production CronStaleness Alert
SELECT jobname, MAX(start_time) as last_run, NOW() - MAX(start_time) as staleness
FROM cron.job_run_details
WHERE jobname = 'expire-requests'
GROUP BY jobname
HAVING NOW() - MAX(start_time) > INTERVAL '15 minutes';
```

**Action:** Check Supabase DB status; restart `pg_cron` extension; escalate if not recovering.

### 3. Logs

```bash
# Supabase dashboard → Logs → Postgres
# Filter: jobname='expire-requests'
# Verify every ~5 min there's a "Job started" + "Job completed"
```

## Monitoring & Alerting

### Uptime Probe (External)

**Tool:** Healthchecks.io, UptimeRobot, or similar (free tier OK).

**Target:** `GET /api/health`

**Interval:** every 5 minutes

**Alert:** on 2 consecutive failures (10-min downtime)

```bash
# Test locally:
curl http://localhost:3000/api/health
# Expected: { "status": "ok" }
```

### Performance Monitoring

**Dashboard:** Cloudflare Analytics Engine or Supabase logs.

Track:
- `GET /api/v1/hoardings/search` p95 latency (target: < 500ms at 200 listings)
- Map render time (no jank at 200 markers)
- Request success rate (target: > 99.5%)
- SLA expiry job staleness (alert if > 15 min)

### Error Logging

**Cloudflare Workers:** Runtime errors visible in Cloudflare dashboard.

**Supabase:** Postgres logs and Edge Function logs.

**Procedure: Correlating a User-Reported Issue**

1. User provides their `request_id` (shown in error toasts).
2. Search Supabase logs: `request_id = 'user-provided-id'`.
3. Correlate with Cloudflare request logs by timestamp + user IP.
4. Check analytics_events table for sequence of user actions leading to error.

## Backup & Restore

### Weekly Export

```bash
# Scheduled (e.g., cron on a VM or CI runner):
pg_dump postgres://prod-url > backup_$(date +%Y%m%d).sql
gzip backup_$(date +%Y%m%d).sql
# Upload to Backblaze B2, Wasabi, or similar
```

### Restore Test

```bash
# Monthly: restore a backup into a scratch Supabase project
supabase db reset  # wipe local
pg_restore -d local backup_20250915.sql  # restore

# Verify integrity:
SELECT COUNT(*) FROM public.hoardings;  -- Should be 50+
SELECT COUNT(*) FROM public.requests;
SELECT COUNT(*) FROM cron.job_run_details;  -- Should have history
```

**Note:** Restores take ~5 min for a 50M-row DB. Plan maintenance window.

## Degradation Scenarios

### Supabase Unreachable

**Expected behavior** (per `system-architecture.md` §24):
- Cached list data (from previous fetch) still renders.
- Media images show placeholder.
- Map degrades gracefully (no tiles).
- Forms show "Service temporarily unavailable" (no submit allowed).

**Recovery:** Wait for Supabase restore, or failover to standby if available.

### pg_cron Jobs Stalled

**Symptom:** Requests past deadline still PENDING (not EXPIRED).

**Action:**
1. Verify DB connection: `SELECT 1;`
2. Restart `pg_cron` extension:
   ```sql
   DROP EXTENSION cron;
   CREATE EXTENSION cron;
   ```
3. Re-register jobs (migrations should re-apply).
4. Monitor `cron.job_run_details` for next run.

## Rollback

**Goal:** Return to last known-good state if deployment breaks production.

### Pre-Rollback

- Identify the last-good commit (or previous stable version tag).
- Verify a database backup exists from before the rollback commit.

### Rollback Steps

```bash
# 1. Revert application code to last-good commit
git revert HEAD  # Or git reset --hard <last-good-commit>
git push origin main

# 2. GitHub Actions automatically redeploys to Cloudflare

# 3. If database rollback needed (rare for forward-only migrations):
#    Restore the pre-deployment backup into production
#    (This is last resort; coordinate with ops)

pg_restore -d prod < production_20250915_145000.sql
```

### Post-Rollback

- Verify `/api/health` responds.
- Run E2E smoke tests.
- Notify stakeholders.
- Root-cause the broken deploy before attempting again.

## Launch Day Checklist

**T-60 min:**
- Verify all systems green (monitoring, backups, pg_cron).
- Confirm launch inventory (50+ listings) seeded.
- Brief ops team on escalation contacts.

**T-0:**
- Deploy to production (merge to main).
- Monitor uptime probe + error logs.
- Run smoke tests (critical flows end-to-end).

**T+30 min:**
- Confirm pg_cron jobs running (staleness alert armed).
- Check analytics: search/detail p95 < 500ms.
- Monitor request success rate.

**T+2 hours:**
- Canary test with 10% real traffic (if possible via Cloudflare rules).
- Scale to 100% once confident.

**Ongoing (24/7 for first week):**
- Uptime probe + staleness alerts active.
- On-call rotation armed.
- Daily review of error rates + performance.

## On-Call Runbook

If paged during outage:

1. **Is `/api/health` responding?**
   - No → Cloudflare or app crashed. Redeploy or restart Workers.
   - Yes → Partial outage (some endpoint down). Check logs.

2. **Is Supabase reachable?** `psql $PROD_DB -c "SELECT 1;"`
   - No → Supabase down. Wait or failover. App degrades gracefully.
   - Yes → App issue. Check Cloudflare + Supabase logs.

3. **Are pg_cron jobs running?**
   - No → Restart extension. See "Degradation Scenarios" above.
   - Yes → Logic bug in a job. Check recent migrations/deploys.

4. **Still stuck?** → Rollback to last-good commit (see "Rollback" above).

---

**Last Updated:** 2026-09-04 (Phase 13)  
**Next Review:** Post-launch (weekly for first month, then monthly)
