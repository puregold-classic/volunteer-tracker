# Codex Handoff (Next Chat Inherit)

This file summarizes the current project state after the latest backend data-model and frontend filter/map upgrades.

## Current Status

- Auth/account system is active:
  - `Account` + JWT middleware in use
  - `/api/v1/auth/register|login|me|logout|accounts`
- Review center works in frontend:
  - Header tabs: `首页 / 个人中心 / 审核中心`
  - `审核中心` loads pending + processed via `reviewService`
- Home page map/list flow is active:
  - Left: `react-leaflet` map + quick focus
  - Right: summary/search/compact volunteer list
  - Volunteer card click opens detail modal (DB-backed)

## Important New Rules (Implemented)

### 1) Volunteer-account policy

- Every volunteer should have an account.
- Accounts may exist without volunteer binding (system/reviewer/admin accounts).
- `Account.volunteerId` uses unique partial index for 1:1 binding behavior.

### 2) Reserved reviewer/admin IDs

- `admin` uses reserved ID: `PG-0000`
- `a_admin` uses reserved IDs from high range (e.g. `PG-9999` downward)
- Migration script added to enforce/repair this.

### 3) Audit for seeded NPS data

- Seed now writes `AuditLog` records for imported NPS entries (`action=seed_import`)
- `AuditLog` model expanded to support these non-review actions

### 4) NPS duplicate prevention

- `NonProjectService` has unique partial index for active duplicate event signature
- Dedupe migration script added for existing data

## Frontend Filter/Map Behavior (Latest)

- Region/province filtering now supports multi-select.
- Quick focus buttons toggle multiple regions.
- Map clicks toggle multiple provinces.
- Region + province are merged into one display block: `地区/省份`.
- Taiwan handling fixed:
  - map click on `台湾省` -> region `中国台湾`, province `台湾省`
  - no more `未知省份` labels for unnamed shapes

## New Backend Scripts

- `backend/scripts/seed-quality-dataset.js`
  - high-quality seed dataset (12 volunteers + linked accounts + services + audit logs)
- `backend/scripts/backfill-volunteer-accounts.js`
  - creates missing volunteer-linked accounts
- `backend/scripts/migrate-account-volunteer-unique.js`
  - enforces unique partial index + resolves duplicates
- `backend/scripts/migrate-dedupe-service-records.js`
  - deactivates duplicate active NPS records + enforces dedupe index
- `backend/scripts/migrate-reviewer-reserved-ids.js`
  - ensures reserved PG IDs for admin/a_admin

## Make/NPM Commands

### Stable dev startup

```bash
make dev
```

### Data operations

```bash
make seed-quality
make migrate-data
make backfill-accounts
make migrate-reviewer-ids
```

### Recovery command

```bash
make recover
```

## Current Seed Credentials

- Volunteer accounts default password: `Volunteer@123`
- `admin@example.com` / `Admin@12345` (admin, `PG-0000`)
- `reviewer@example.com` / `Reviewer@123` (a_admin, `PG-9999`)

## Last Verified Counts

From latest `seed-quality` run:

- volunteers: 12
- accounts: 14
- linkedAccounts: 14
- services: 22
- audit logs for seed import present

## Known Caveats

- If Docker environment drifts, recreate backend:
  - `docker-compose up -d --force-recreate backend`
- If Docker permissions block commands in tool execution contexts, rerun with elevated permissions.
- `Account` model previously showed duplicate email-index warning; email index declaration was simplified in model.

## Next Suggested Work

1. Add chip UI to remove single selected region/province with `x`.
2. Optionally add route-based volunteer detail page (`/volunteers/:id`) in addition to modal.
3. Add explicit audit writes for any non-review direct service CRUD path (if introduced later).
