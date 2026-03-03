# Codex Handoff (Next Chat Inherit)

This file summarizes the project state after the latest frontend redesign and NPS application flow updates.

## Current Status

- Auth/account system active:
  - `Account` + JWT middleware
  - `/api/v1/auth/register|login|me|logout|accounts`
- Review center active:
  - Tabs: `首页 / 个人中心 / 审核中心`
  - `审核中心` loads pending + processed
- Home page active:
  - Left: larger `react-leaflet` map + top-left custom controls
  - Right: summary/search + compact volunteer cards
  - Volunteer cards render **2 per row** on desktop

## Major Frontend Changes (Completed)

### 1) Home Filter + Map UX

- Removed deprecated direction options from UI:
  - removed `项目培训 / 非项目培训 / 受训 / 社区服务`
  - keeps `翻译 / 校对 / 管理 / 技术`
- Added `热门省份` filter between `方向` and `地区/省份`:
  - `全部 / 北京 / 上海 / 深圳`
  - mapped to province query:
    - 北京 -> 北京市
    - 上海 -> 上海市
    - 深圳 -> 广东省
- `地区/省份` now supports mode switch:
  - `单选 / 多选`
- Map quick focus is now packed behind icon control:
  - Controls at **top-left**, horizontal: `+ / - / ◎ / ↻`
  - `◎` toggles quick-focus region panel
  - `↻` resets map view + clears region/province filters
- Removed filter-bar selection text for `地区/省份` (`未选择` no longer shown there).

### 2) Layout Width + Cards

- Reduced side margins and expanded container width.
- Rebalanced home split to give right panel more room.
- Compact volunteer cards tightened and now 2-column layout on desktop.

### 3) Personal Center Model

- `我的个人中心` now combines:
  - Account info
  - Volunteer profile
  - NPS records
- Other-person center (opened by clicking volunteer card) shows:
  - Volunteer profile
  - NPS records
  - no account data
- NPS list supports pagination via “查看更多记录” in both places.

### 4) NPS Application Submit in Personal Panels

- Added NPS application submit entry in both personal panels.
- UX now packed as a single toggle button:
  - default: single button + minimal hint text
  - expand to form only after click
- Form submits `create` application to `/api/v1/applications`.

## Critical Backend/Validation Rules (Important)

- Service types now constrained to: `翻译 / 校对 / 管理 / 技术` in:
  - `Volunteer.services`
  - `NonProjectService.serviceType`
  - validation utils and export template hints
- New migration script:
  - `backend/scripts/migrate-remove-deprecated-service-types.js`
  - npm script: `migrate:services:remove-deprecated`
  - make target: `make migrate-remove-deprecated-services`
- This migration was executed and deactivated active NPS records with deprecated types.
  - Effect example:
    - `PG-0002` had 2 records; now only 1 active (`项目培训` deactivated)
    - `PG-0004` records all inactive (both deprecated types)

## Very Important Fix (Latest)

- NPS application submit originally failed with 400/500 due to submitter ID format.
- Root cause:
  - backend `IDGenerator.generateApplicationId(submittedBy.id)` requires `PG-xxxx`
  - frontend initially sent account Mongo `_id` (24-hex), invalid
- Fixed in frontend:
  - now sends `submittedBy.id = account.volunteerId` (fallback `PG-0000` for admin)
  - if no volunteerId and non-admin -> blocks submit with clear message
- Improved API error mapping:
  - frontend now surfaces backend `error` field (not only `message`)

## New/Updated Frontend Service Files

- Added:
  - `frontend/src/services/serviceRecordService.ts`
  - `frontend/src/services/applicationService.ts`
- Updated:
  - `frontend/src/services/api.ts` (better error message mapping)

## Recent Commits

- `6479029` `feat: revamp home filtering/map controls and clean deprecated service types`
- `d71ad71` `chore: remove obsolete mock docs`

## Make/NPM Commands

```bash
make dev
make seed-quality
make migrate-data
make migrate-remove-deprecated-services
make backfill-accounts
make migrate-reviewer-ids
make recover
```

## Current Seed Credentials

- Volunteer accounts default password: `Volunteer@123`
- `admin@example.com` / `Admin@12345` (`admin`, `PG-0000`)
- `reviewer@example.com` / `Reviewer@123` (`a_admin`, `PG-9999`)

## Known Caveats

- If user reports “missing NPS records”, check `isActive`:
  - deprecated-type migration may have deactivated older records
- Backend application ID logic still assumes submitter ID is volunteer-style (`PG-xxxx`).
- Docker drift recovery:
  - `docker-compose up -d --force-recreate backend`

## Suggested Next Work

1. Add “我的申请记录” section in personal center (pending/approved/rejected/withdrawn).
2. Decide whether to keep deprecated NPS rows inactive or remap/reactivate them (`项目培训/非项目培训/社区服务 -> 管理`, `受训 -> 技术`).
3. Optional: route-based personal pages (`/volunteers/:id`) instead of modal-only flow.
