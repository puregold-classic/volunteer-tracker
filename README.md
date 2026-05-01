# Volunteer Tracker

A visualization and management platform for the **Pure Gold Classic Translation (PG)** volunteer team. See where teammates are around the world, log everyone's contributions across translation, interpretation, training and support work, and run the team without spreadsheets.

This is an **internal tool** — there is no public sign-up, accounts are issued by an admin.

> **Live (sandbox):** https://dev.puregoldclassictranslation.com
>
> Sample login: `PG-0001` / `Sample@123`  ·  Admin access: contact a maintainer.

**Walkthrough video:** [Watch on YouTube](https://youtu.be/csTTi6n-Hmk)

[![Walkthrough video](https://img.youtube.com/vi/csTTi6n-Hmk/maxresdefault.jpg)](https://youtu.be/csTTi6n-Hmk)

---

## Features

### 1. Browsing volunteers

The home page is a Leaflet world map with one pin per active volunteer, color-coded by department, alongside a filterable card list of the whole team.

- **Filters:** department, region, active / inactive status, free-text search
- **Map ↔ list:** click a pin or a card to open that person's profile
- **Profile pages** — same layout for your own (`/me`) and anyone else's (`/volunteers/:id`):
  - Hero avatar, department badge, region
  - Three stat tiles: this-month / this-year / all-time hours
  - 90-day activity heatmap (GitHub-style contribution graph)
  - Service records grouped by month with sticky month headers
  - Status chips to filter active / pending-confirmation / rejected entries

### 2. Logging service work

Every volunteer can log what they did. Records belong to one of **four categories**:

| Category | What it covers |
|---|---|
| Project Management | Coordination, planning |
| Project Training | Running training sessions |
| Project Support | Design, tech, ops, care, etc. |
| Training Attendance | Sitting in on training (batch entry only — see Tags below) |

Each record carries a date, duration, the specific service item, optional tags, and a short description.

- **Self-submit** — your own record goes live immediately
- **Proxy submission** — coordinators can log work *on behalf of* another volunteer; the owner gets a "pending confirmation" card on their profile and either **confirms** (record goes live) or **rejects** (archived with a reason)
- **Direct entry mode** — A-level / B-level admins acting as data-entry operators bypass the confirmation step, so historical bulk entry doesn't pile up notifications
- **Built-in deduplication** — the same person can't accidentally submit the same entry twice
- **Soft delete** — deleted records are hidden from stats but never actually removed
- **Month-end lock** — admins can freeze records before a given date so historical numbers can't drift

### 3. Tags & batch entry

Service items can be augmented with **tag groups** — sponsor, translation role, interpreter post, specific training session, and so on. Each tag group is configured along three axes:

- **Selection mode:** single-pick or multi-pick
- **Op mode:** *managed* (admins curate, supports batch operations) or *tag-only* (free attach)
- **Openness:** *closed* (fixed list) or *open* (anyone can add a new tag)

When you submit a record, any tag group bound to the chosen service item pops up an inline picker — no extra dialogs.

For organizers, the `/tags` page provides **batch tools**:

- **Paste-roster batch entry** — drop in a list of names, preview the impact (how many records, original duration distribution), then apply. This is the only way to log **Training Attendance** records.
- **Manual attach / detach** — typeahead search against existing records
- **Tag-level edits** — rename, merge, delete tags with full audit trail

### 4. Watch lists

Build private lists of volunteers you want to keep track of — your team, mentees, an event squad. Volunteers can sit in any number of lists; lists can be renamed and reordered.

The **proxy-submission workbench** (v3.4.1) takes a list and lets you log a service record for everyone on it in one go — handy for batch attendance after a training session or an event without falling back to the tag-batch flow.

### 5. The ledger

`/review` is a read-only browse of the whole team's records, with **three-level drill-down**:

`category` → `department` → `volunteer` → `individual record`

Each level shows summary charts (bar / distribution) and supports filtering by date range, status, and category. Useful for monthly reporting or spot-checking activity.

- **Export** — one-click CSV / Excel of any filtered view
- **Audit trail** — every state-changing action across the system (account creation, password reset, record submit / edit / delete, tag attach / detach, list mutation) is logged with operator, timestamp, and a before / after snapshot. Nothing important is unattributable.

### 6. Accounts & access

Accounts are admin-issued — no public registration. Once you have an account, you sign in with one of three identifiers in a single field, auto-detected from what you type:

- Email (contains `@`)
- Phone number (digits only)
- Volunteer code (`PG-0001` style)

**Self-service** for any logged-in user:

- Change your own password (auto-logs you out of all sessions on success)
- Upload an avatar (resized client-side to a sensible JPEG)

**Admin center** (inline panel on `/me` for maintainers):

- Account creation: single-form or bulk CSV import
- Role assignment: `user` / `b_admin` (review-only) / `a_admin` (locking + onboarding) / `admin` (full)
- Reset anyone's password and force-logout their sessions
- Toggle the system-wide month-end lock

---

## For developers

This README is a tour for end users. If you want to run the project locally, contribute, or understand the data model:

- [`docs/architecture.md`](./docs/architecture.md) — tech stack, module layout, data model
- [`docs/development.md`](./docs/development.md) — local setup, testing, git workflow
- [`docs/api-overview.md`](./docs/api-overview.md) — backend endpoint reference
- [`docs/v3-changelog.md`](./docs/v3-changelog.md) — recent feature releases (v3.x)
- [`docs/deploy/`](./docs/deploy/) — deployment & backup guides

**Stack at a glance:** React 18 · TypeScript · Vite · Tailwind CSS · Node.js · Express · Prisma · PostgreSQL · Docker

---

## Feedback

Bug reports and feature requests welcome — open a GitHub issue on `puregold-classic/volunteer-tracker`, or reach out to a team coordinator.
