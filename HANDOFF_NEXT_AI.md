# Codex Handoff (Next Chat Inherit)

This file is for the next AI session to continue work without losing context.

## Current Status

- Backend auth MVP is implemented and working:
  - `Account` model + JWT auth middleware
  - `/api/v1/auth/register|login|me|logout`
  - Admin account seed script
- Role merge completed:
  - `c_admin` merged to `b_admin`
  - DB migration script exists and has been run on local Docker DB
- Frontend auth flow exists:
  - `/login`, `/register`, `/me`, `/review`
  - Header has dynamic nav (`首页 / 我的账号 / 审核台`)
- Review center:
  - Pending + processed tabs
  - approve/reject/reopen/withdraw actions wired
- Home page:
  - Docs-style shell implemented (left map area + right panel)
  - Filters wired (`status/services/region/province`)
  - Quick focus buttons + shared filter state
- Map:
  - Switched to real `react-leaflet` map + China province GeoJSON click
  - Province click sets `province` filter and region=`中国大陆`

## Important Files

- Frontend main flow:
  - `frontend/src/App.tsx`
  - `frontend/src/App.scss`
  - `frontend/src/context/AuthContext.tsx`
- Map:
  - `frontend/src/components/HomeMap/HomeMap.tsx`
  - `frontend/src/components/HomeMap/HomeMap.scss`
- Review APIs:
  - `frontend/src/services/reviewService.ts`
- Volunteer filtering:
  - `frontend/src/services/volunteerService.ts`
  - `frontend/src/services/api.ts`
  - `backend/src/controllers/volunteerController.js`
- Auth backend:
  - `backend/src/models/Account.js`
  - `backend/src/middleware/authenticate.js`
  - `backend/src/controllers/authController.js`
  - `backend/src/routes/authRoutes.js`
  - `backend/src/server.js`

## Local Run Commands

From repo root:

```bash
docker-compose up -d mongodb backend
npm --prefix frontend run dev
```

Backend local scripts:

```bash
npm --prefix backend run seed:admin
npm --prefix backend run migrate:roles:check
npm --prefix backend run migrate:roles
```

## Known Caveats

- Docker env changes may require **recreate**, not just restart:
  - `docker-compose up -d --force-recreate backend`
- Login fails with `JWT_SECRET is not configured` if backend container started from old env.
- `react-leaflet/leaflet` deps were added in `frontend/package.json`; if missing locally:
  - `cd frontend && npm install`

## Recommended Next Steps

1. Improve map UX:
   - Province hover tooltip polish
   - Region overlays (outside China) or separate global layer toggle
2. Replace placeholder stats in home right panel with live metrics.
3. Add volunteer detail route (`/volunteers/:id`) and open from card click.
4. Add auth/session UX:
   - global 401 redirect
   - post-login redirect back to intended path

## Quick Validation Checklist

1. Login with seeded admin and verify `/me` loads.
2. Open `/review`, approve/reject one pending item.
3. Switch to processed tab, test reopen/withdraw.
4. On home page, click one province in map and verify right list filters.
5. Click quick-focus buttons and verify map pans/zooms and list updates.
