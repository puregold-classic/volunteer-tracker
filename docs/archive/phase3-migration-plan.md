# Phase 3: Parallel Adapter Migration Plan
## MongoDB → PostgreSQL — Backend Data Access Layer

_Living document. Update as each step completes._

---

## Approach: Parallel Adapter with Shadow Writes

Mongoose stays as **source of truth** throughout Phase 3. The Prisma layer is shadow-only:

```
HTTP Request
    │
    ▼
Controller
    │
    ▼
Service (e.g. ReviewService)
    ├── Mongoose write  ← source of truth, synchronous
    │       │
    │       ▼ success
    └── pgShadow.write()  ← fire-and-forget, never throws
            │
            ▼ (if PG_SHADOW_WRITE=true AND DATABASE_URL set)
        Prisma → PostgreSQL
```

Any PG failure is logged as `[pgShadow] ❌ ...` and silently dropped. The HTTP response is never affected.

---

## Feature Flags

| Env Var | Default | Effect |
|---------|---------|--------|
| `PG_SHADOW_WRITE` | `false` | Mirror Mongo writes to PG after commit |
| `PG_SHADOW_READ` | `false` | (Future) Compare Mongo reads with PG reads |
| `DATABASE_URL` | unset | Prisma won't initialise until this is set |

To enable shadow writes for testing after demo:
```bash
# docker-compose.override.yml (do not commit with real values)
environment:
  - PG_SHADOW_WRITE=true
  - DATABASE_URL=postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker
```

---

## Step-by-Step Adapter Rollout

### Step 0 ✅ (done) — Infrastructure
- Prisma client singleton (`src/utils/prismaClient.js`) — lazy, no-op if DATABASE_URL missing
- Feature flags (`src/utils/featureFlags.js`)
- Mapper functions for all 5 models (`src/utils/pgMapper.js`)
- Shadow adapter (`src/utils/pgShadow.js`) — upsert-based, idempotent, never throws

### Step 1 ✅ (done) — Hook: Review approval path
File: `src/services/ReviewService.js` (no-transaction variant, dev environment)

Shadow writes added after each Mongoose save:
| Mongoose operation | Shadow call | Line approx |
|-------------------|-------------|-------------|
| `serviceRecord.save()` | `pgShadow.nonProjectService(serviceRecord)` | ~168 |
| `application.save()` | `pgShadow.serviceApplication(application)` | ~181 |
| `auditLog.save()` (in `createAuditLogWithoutTransaction`) | `pgShadow.auditLog(auditLog)` | ~322 |

### Step 2 — Hook: Remaining write paths in ReviewService (transaction variants)
Files: `ReviewService.executeReviewCreateWithTransaction`, `reviewUpdateApplication*`, `reviewDeleteApplication*`

Pattern is identical: add shadow call after each `save({ session })`.
Note: PG shadow writes run after the Mongo transaction commits — they are NOT inside the Mongo session.

### Step 3 — Hook: ServiceApplication submission
File: `src/controllers/applicationController.js` (or the service it calls)

Shadow writes needed for:
- Application create (`POST /api/v1/applications`)
- Application withdraw/deactivate

### Step 4 — Hook: Volunteer reads/writes (admin paths)
File: `src/controllers/volunteerController.js`

Volunteer records change less frequently; shadow write on create/update.

### Step 5 — Hook: Account creation / login update
File: `src/services/` or `src/controllers/authController.js`

Shadow write on account creation and `lastLoginAt` update.

---

## Verification Protocol (per step)

After enabling `PG_SHADOW_WRITE=true` and `DATABASE_URL`:

1. Trigger the Mongoose write through the API (e.g. review an application)
2. Check logs for `[pgShadow] ✅ <Model> shadow-written: <domainId>`
3. Query PG directly:
   ```bash
   docker exec volunteer-postgres psql -U volunteer_user -d volunteer_tracker \
     -c "SELECT service_id, volunteer_id, is_active FROM non_project_services ORDER BY created_at DESC LIMIT 5;"
   ```
4. Run `verify-pg-schema.js` to check row counts match MongoDB

---

## Rollback Plan

At any point in Phase 3:
- Set `PG_SHADOW_WRITE=false` (or remove the env var) → shadow writes stop immediately, zero impact
- PG data may be behind Mongo — that's expected during the shadow phase
- Mongo remains source of truth; the API response is unaffected

Full rollback to pre-Phase-3 state:
```bash
git checkout 734ba97 -- backend/src/services/ReviewService.js
# (removes the 3 shadow write lines and the pgShadow import)
```
The 4 new utility files (`featureFlags.js`, `prismaClient.js`, `pgMapper.js`, `pgShadow.js`) are purely additive and have no effect when the flag is off.

---

## Phase 3 → Phase 4 Transition Gate

**Do NOT cut over to Prisma as primary until all of these pass:**

- [ ] All write paths are hooked and shadow-writing successfully
- [ ] Row counts: PG == Mongo across all 5 tables (after a burn-in period of ≥1 day)
- [ ] No `[pgShadow] ❌` errors in logs during normal usage
- [ ] `verify-pg-schema.js` passes 29/29
- [ ] `migrate-mongo-to-pg.js --apply` completes 0 errors (bulk backfill of historical data)
- [ ] OC sign-off on cutover window

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `backend/src/utils/featureFlags.js` | Env-based flag reader |
| `backend/src/utils/prismaClient.js` | Lazy Prisma singleton |
| `backend/src/utils/pgMapper.js` | 5 mapper functions (Mongoose doc → PG row) |
| `backend/src/utils/pgShadow.js` | Shadow adapter — never throws |
| `backend/scripts/migrate-mongo-to-pg.js` | Bulk dry-run / apply migration |
| `backend/scripts/verify-pg-schema.js` | 29-point PG schema verification |
| `backend/prisma/schema.prisma` | PG schema (5 models, 10 enums) |
| `backend/prisma/migrations/` | Applied migration SQL |
