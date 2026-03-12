# Phase 2 Apply Runbook: MongoDB → PostgreSQL Bulk Backfill

_Run this AFTER demo ends and backend is restarted with `DATABASE_URL` injected._

---

## Prerequisites

Before running `--apply`, verify all of these:

- [ ] Demo is fully finished — no active reviewers in the system
- [ ] `DATABASE_URL` is set in the running backend container (or passed via `-e`)
- [ ] `MONGODB_URI` is accessible (MongoDB container is healthy)
- [ ] PG tables are empty or contain only shadow-write data from the shadow phase
- [ ] You have a restore point: commit `734ba97` is tagged and `git log` confirms it

---

## Step 0 — Verify PG schema is clean

```bash
docker exec volunteer-postgres psql -U volunteer_user -d volunteer_tracker \
  -c "SELECT schemaname, tablename, n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY tablename;"
```

Expected: all tables exist, row counts are 0 (or small if shadow writes ran).

---

## Step 1 — Dry-run one more time (confirm 0 errors)

```bash
docker exec \
  -e MONGODB_URI="mongodb://mongodb:27017/volunteer_tracker" \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/migrate-mongo-to-pg.js
```

Expected output:
```
✅ All collections mapped successfully — 0 errors
```

If there are errors, STOP. Investigate mapping failures before proceeding.

---

## Step 2 — Apply (writes to PG)

```bash
docker exec \
  -e MONGODB_URI="mongodb://mongodb:27017/volunteer_tracker" \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/migrate-mongo-to-pg.js --apply
```

Expected output:
```
[apply] Account: upserted N rows
[apply] Volunteer: upserted N rows
[apply] ServiceApplication: upserted N rows
[apply] NonProjectService: upserted N rows
[apply] AuditLog: upserted N rows
✅ Apply complete — N total rows written
```

If any collection fails mid-way: the script uses per-collection transactions in PG. Failed collection is rolled back. Other collections that already completed remain. Re-run after fixing the issue (upsert is idempotent — safe to re-run).

---

## Step 3 — Row count verification

```bash
docker exec volunteer-postgres psql -U volunteer_user -d volunteer_tracker \
  -c "SELECT 'accounts' AS tbl, COUNT(*) FROM accounts
  UNION ALL SELECT 'volunteers', COUNT(*) FROM volunteers
  UNION ALL SELECT 'service_applications', COUNT(*) FROM service_applications
  UNION ALL SELECT 'non_project_services', COUNT(*) FROM non_project_services
  UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
  ORDER BY tbl;"
```

Cross-check against MongoDB:
```bash
docker exec volunteer-mongodb mongosh volunteer_tracker --quiet \
  --eval "print(JSON.stringify({
    Account: db.accounts.countDocuments(),
    Volunteer: db.volunteers.countDocuments(),
    ServiceApplication: db.serviceapplications.countDocuments(),
    NonProjectService: db.nonprojectservices.countDocuments(),
    AuditLog: db.auditlogs.countDocuments()
  }))"
```

Counts must match across both databases.

---

## Step 4 — Run schema verification script

```bash
docker exec \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/verify-pg-schema.js
```

Expected: `29/29 checks passed`

---

## Step 5 — Run full one-click migration verification

```bash
docker exec \
  -e MONGODB_URI="mongodb://mongodb:27017/volunteer_tracker" \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/verify-migration-complete.js
```

Expected: all counts match + key field samples pass.

---

## Step 6 — Enable shadow writes

Add to `docker-compose.override.yml` (create if missing):
```yaml
services:
  backend:
    environment:
      - PG_SHADOW_WRITE=true
      - DATABASE_URL=postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker
```

Restart backend:
```bash
docker-compose up -d backend
```

Verify shadow writes active:
```bash
docker logs volunteer-backend --tail 20
# should show: [PrismaClient] DATABASE_URL detected — PG shadow layer initialised.
```

Trigger a test write (e.g. login) and check logs:
```bash
docker logs volunteer-backend --tail 10
# should show: [pgShadow] ✅ Account shadow-written: <email>
```

---

## Rollback Procedure

### Option A — Disable shadow writes (no data loss, instant)
Remove `PG_SHADOW_WRITE=true` from environment and restart backend.
MongoDB remains source of truth. PG data may lag — expected.

### Option B — Full rollback to pre-Phase-3 state
```bash
# Restore backend source files to pre-Phase-3 state
git checkout 734ba97 -- backend/src/services/ReviewService.js
git checkout 734ba97 -- backend/src/controllers/applicationController.js
git checkout 734ba97 -- backend/src/controllers/authController.js
git checkout 734ba97 -- backend/src/controllers/volunteerController.js

# Remove DATABASE_URL from env and restart
docker-compose up -d backend
```

The 4 utility files (featureFlags.js, prismaClient.js, pgMapper.js, pgShadow.js) are purely additive and have no effect when DATABASE_URL is unset.

### Option C — Truncate PG and re-apply
```bash
docker exec volunteer-postgres psql -U volunteer_user -d volunteer_tracker -c "
  TRUNCATE TABLE audit_logs, non_project_services, service_applications, volunteers, accounts CASCADE;
"
# Then re-run Step 2 above
```

---

## Notes

- Apply is idempotent (upsert-based). Safe to re-run if interrupted.
- MongoDB is NEVER modified by the migration script.
- PG row counts may be slightly higher than Mongo after shadow writes have been running (shadow writes happen in real-time as new Mongo writes occur; bulk apply backfills history).
