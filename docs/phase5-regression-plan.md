# Phase 5: Regression Test Plan

_This plan covers regression testing after Phase 2 apply + Phase 3 shadow write enablement._
_Execute before Phase 4 (Prisma as primary read path)._

---

## Scope

Verify that:
1. All existing Mongo-backed API endpoints continue to function correctly
2. Shadow writes are landing in PG correctly (row counts + key field sampling)
3. No `[pgShadow] ❌` errors appear in logs during normal usage
4. PG schema integrity (FK-like relationships, uniqueness constraints, enum values)

Out of scope for Phase 5:
- PG read path (Phase 4 concern)
- Frontend UI regression (separate test plan)

---

## Test Environment

- Backend: `volunteer-backend` container
- MongoDB: `volunteer-mongodb` container
- PostgreSQL: `volunteer-postgres` container
- Feature flags: `PG_SHADOW_WRITE=true`, `DATABASE_URL` set

---

## Section 1 — Auth API Regression

### 1.1 User Registration
- [ ] `POST /api/v1/auth/register` with valid email/password/name → 201, returns account data
- [ ] Same email again → 409
- [ ] Missing fields → 400
- [ ] Short password → 400
- [ ] **Shadow check**: `accounts` table in PG has the new row with correct email/role

### 1.2 Admin Creates Account
- [ ] `POST /api/v1/auth/admin/accounts` (admin role) → creates account with specified role
- [ ] **Shadow check**: PG `accounts` row exists with correct role

### 1.3 Login
- [ ] `POST /api/v1/auth/login` → 200, returns JWT token
- [ ] Wrong password → 401
- [ ] Inactive account → 401
- [ ] **Shadow check**: PG `accounts.lastLoginAt` updated within ~5 seconds

### 1.4 Current User
- [ ] `GET /api/v1/auth/me` with valid token → 200, returns account
- [ ] Expired/invalid token → 401

---

## Section 2 — Volunteer API Regression

### 2.1 Create Volunteer
- [ ] `POST /api/v1/volunteers` → 201, volunteer created in Mongo
- [ ] Duplicate ID → 400
- [ ] **Shadow check**: PG `volunteers` row exists with correct volunteerId/chineseName

### 2.2 Update Volunteer
- [ ] `PUT /api/v1/volunteers/:id` → 200, updated in Mongo
- [ ] **Shadow check**: PG `volunteers` row reflects updated values

### 2.3 Read Volunteers
- [ ] `GET /api/v1/volunteers` → 200, returns paginated list (Mongo-backed, no PG dependency)
- [ ] `GET /api/v1/volunteers/:id` → 200 or 404 as appropriate
- [ ] Filters (status, region, search) work correctly
- [ ] Stats endpoint returns aggregated data

---

## Section 3 — Application API Regression

### 3.1 Submit Application
- [ ] `POST /api/v1/applications` (create type) → 201, pending status
- [ ] Duplicate pending project → 409 with `PENDING_PROJECT_CONFLICT`
- [ ] **Shadow check**: PG `service_applications` row with `status=pending`

### 3.2 Withdraw Application
- [ ] `DELETE /api/v1/applications/:applicationId` (by submitter) → 200, status=withdrawn
- [ ] Different user → 403
- [ ] Non-pending application → 404
- [ ] **Shadow check**: PG row status updated to `withdrawn`

### 3.3 Get My Applications
- [ ] `GET /api/v1/applications/my?volunteerId=...` → returns volunteer's applications
- [ ] Inactive applications excluded by default
- [ ] `includeInactive=true` returns all records

### 3.4 Deactivate All My Applications
- [ ] `POST /api/v1/applications/my/deactivate-all` → all records soft-deleted
- [ ] **Note**: this is `updateMany` — no individual shadow writes; PG count may differ until next bulk sync

---

## Section 4 — Review API Regression

### 4.1 Create Review (approve a `create` application)
- [ ] Review `create` application → `approved` status, NonProjectService created in Mongo
- [ ] AuditLog created
- [ ] **Shadow check**: PG `non_project_services` row created, `service_applications` status=approved, `audit_logs` row created

### 4.2 Update Review (approve an `update` application)
- [ ] Review `update` application → target NPS record updated in Mongo
- [ ] **Shadow check**: PG `non_project_services` row updated

### 4.3 Delete Review (approve a `delete` application)
- [ ] Review `delete` application → NPS record soft-deleted in Mongo
- [ ] **Shadow check**: PG `non_project_services.isActive = false`

### 4.4 Reject Application
- [ ] Reject any application type → status=rejected, reviewNotes populated
- [ ] **Shadow check**: PG `service_applications` status=rejected

### 4.5 Reopen Review
- [ ] Reopen a rejected application → status back to pending
- [ ] AuditLog created for reopen action
- [ ] **Shadow check**: PG row updated, new audit_logs row created

### 4.6 Withdraw Review
- [ ] Withdraw an approved review → NPS soft-deleted, application=withdrawn
- [ ] **Shadow check**: PG rows reflect final state

---

## Section 5 — PG Data Integrity Checks

Run after completing Sections 1–4:

### 5.1 Row count parity
```bash
docker exec \
  -e MONGODB_URI="mongodb://mongodb:27017/volunteer_tracker" \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/verify-migration-complete.js
```
Expected: all collections show PG_count >= Mongo_count (PG may be higher due to shadow write timing; counts should not be lower).

### 5.2 Schema verification
```bash
docker exec \
  -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" \
  volunteer-backend \
  node scripts/verify-pg-schema.js
```
Expected: 29/29 checks passed.

### 5.3 Uniqueness constraint check
```bash
docker exec volunteer-postgres psql -U volunteer_user -d volunteer_tracker -c "
  SELECT COUNT(*) as total, COUNT(DISTINCT email) as unique_emails FROM accounts;
  SELECT COUNT(*) as total, COUNT(DISTINCT \"volunteerId\") as unique_vids FROM volunteers;
  SELECT COUNT(*) as total, COUNT(DISTINCT \"applicationId\") as unique_app_ids FROM service_applications;
  SELECT COUNT(*) as total, COUNT(DISTINCT \"serviceId\") as unique_svc_ids FROM non_project_services;
  SELECT COUNT(*) as total, COUNT(DISTINCT \"auditId\") as unique_audit_ids FROM audit_logs;
"
```
Expected: total = unique for each table (no duplicates).

### 5.4 Log check — no shadow errors
```bash
docker logs volunteer-backend 2>&1 | grep '\[pgShadow\]' | grep '❌' | wc -l
```
Expected: 0.

---

## Section 6 — Edge Cases

- [ ] Shadow write with `PG_SHADOW_WRITE=false` → no PG writes, no errors, API response unaffected
- [ ] Shadow write with `DATABASE_URL` missing → no PG writes, no errors (lazy init)
- [ ] PG container down during shadow write → `[pgShadow] ❌` logged, API response still 200
- [ ] Re-run `migrate-mongo-to-pg.js --apply` after shadow writes → idempotent, no duplicates

---

## Phase 3 → Phase 4 Transition Gate

All of the following must pass before proceeding to Phase 4 (Prisma as primary):

- [ ] Sections 1–4 pass with 0 regressions
- [ ] Section 5 row counts: PG == Mongo (after ≥1 day burn-in with shadow writes on)
- [ ] Section 5 uniqueness constraints all pass
- [ ] Section 5 log check: 0 `[pgShadow] ❌` during normal usage
- [ ] verify-pg-schema.js: 29/29 passed
- [ ] migrate-mongo-to-pg.js --apply completed with 0 errors
- [ ] OC sign-off on cutover window

---

## Execution Order

1. Run `--apply` (see `docs/apply-runbook.md`)
2. Enable `PG_SHADOW_WRITE=true` and restart backend
3. Execute Sections 1–4 (manual API testing)
4. Execute Section 5 (automated checks)
5. Execute Section 6 (edge cases)
6. Review logs for a burn-in period (≥1 day)
7. Re-run Section 5 after burn-in
8. File OC sign-off request in QUESTIONS.md before Phase 4 cutover
