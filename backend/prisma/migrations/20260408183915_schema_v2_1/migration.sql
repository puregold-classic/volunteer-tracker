-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v2.1 — destructive rewrite
--
-- This migration drops all v1 tables and types and rebuilds the schema from
-- scratch. It is intentionally destructive: dev data is being thrown away by
-- decision (no production data exists). Do NOT run on a database with data
-- you care about without taking a pg_dump first.
--
-- Highlights:
-- - Adds Department + ServiceItem (replaces ServiceType enum)
-- - NonProjectService → ProjectSupport (rename + status state machine + proxy)
-- - Real foreign keys everywhere
-- - Account ↔ Volunteer 1:1 enforced via FK + CHECK constraint
-- - ServiceApplication and the entire review pipeline removed
-- - Partial unique index for ProjectSupport dedup (replaces v1's never-applied one)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── DROP v1 ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS "audit_logs"            CASCADE;
DROP TABLE IF EXISTS "non_project_services"  CASCADE;
DROP TABLE IF EXISTS "service_applications"  CASCADE;
DROP TABLE IF EXISTS "volunteers"            CASCADE;
DROP TABLE IF EXISTS "accounts"              CASCADE;

DROP TYPE IF EXISTS "ReviewResult";
DROP TYPE IF EXISTS "AuditAction";
DROP TYPE IF EXISTS "AuditTargetType";
DROP TYPE IF EXISTS "ApplicationStatus";
DROP TYPE IF EXISTS "ApplicationType";
DROP TYPE IF EXISTS "ServiceType";
DROP TYPE IF EXISTS "ActivityLevel";
DROP TYPE IF EXISTS "Region";
DROP TYPE IF EXISTS "VolunteerStatus";
DROP TYPE IF EXISTS "Role";

-- ─── CREATE v2.1 enums ────────────────────────────────────────────────────────

CREATE TYPE "Role" AS ENUM ('user', 'b_admin', 'a_admin', 'admin');

CREATE TYPE "VolunteerStatus" AS ENUM ('在职', '不在职');

CREATE TYPE "Region" AS ENUM ('中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他');

CREATE TYPE "ActivityLevel" AS ENUM ('高', '中', '低');

CREATE TYPE "ProjectSupportStatus" AS ENUM (
  'ACTIVE',
  'PENDING_CONFIRMATION',
  'REJECTED_BY_OWNER',
  'DELETED'
);

CREATE TYPE "AuditTargetType" AS ENUM (
  'ProjectSupport',
  'Volunteer',
  'Account',
  'SystemSettings'
);

CREATE TYPE "AuditAction" AS ENUM (
  'support_create',
  'support_update',
  'support_delete',
  'support_confirm',
  'support_reject',
  'volunteer_create',
  'volunteer_update',
  'volunteer_deactivate',
  'account_create',
  'account_update',
  'month_lock',
  'system_cleanup',
  'seed_import'
);

-- ─── CREATE v2.1 tables ───────────────────────────────────────────────────────

-- departments (10 rows seeded separately)
CREATE TABLE "departments" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_name_key"         ON "departments"("name");
CREATE UNIQUE INDEX "departments_displayOrder_key" ON "departments"("displayOrder");

-- service_items (~40 rows seeded separately, FK to departments)
CREATE TABLE "service_items" (
  "id"           TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_items_departmentId_name_key"
  ON "service_items"("departmentId", "name");
CREATE INDEX "service_items_departmentId_displayOrder_idx"
  ON "service_items"("departmentId", "displayOrder");
ALTER TABLE "service_items"
  ADD CONSTRAINT "service_items_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- volunteers (FK to departments)
CREATE TABLE "volunteers" (
  "id"            TEXT NOT NULL,
  "volunteerCode" TEXT NOT NULL,
  "chineseName"   TEXT NOT NULL,
  "englishName"   TEXT NOT NULL,
  "avatar"        TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Unknown&background=random',
  "status"        "VolunteerStatus" NOT NULL DEFAULT '在职',
  "region"        "Region" NOT NULL,
  "province"      TEXT,
  "subRegion"     TEXT,
  "departmentId"  TEXT NOT NULL,
  "activityLevel" "ActivityLevel" NOT NULL DEFAULT '中',
  "email"         TEXT,
  "phone"         TEXT,
  "joinDate"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "volunteers_volunteerCode_key" ON "volunteers"("volunteerCode");
CREATE INDEX "volunteers_status_idx"        ON "volunteers"("status");
CREATE INDEX "volunteers_region_idx"        ON "volunteers"("region");
CREATE INDEX "volunteers_activityLevel_idx" ON "volunteers"("activityLevel");
CREATE INDEX "volunteers_departmentId_idx"  ON "volunteers"("departmentId");
ALTER TABLE "volunteers"
  ADD CONSTRAINT "volunteers_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- accounts (FK to volunteers; CHECK enforces non-admin must bind)
CREATE TABLE "accounts" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "role"         "Role" NOT NULL DEFAULT 'user',
  "volunteerId"  TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_email_key"       ON "accounts"("email");
CREATE UNIQUE INDEX "accounts_volunteerId_key" ON "accounts"("volunteerId");
CREATE INDEX "accounts_role_isActive_idx"      ON "accounts"("role", "isActive");
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_volunteerId_fkey"
  FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual CHECK: non-admin accounts must bind to a volunteer.
-- Prisma DSL cannot express this; managed by hand here.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_role_volunteer_check"
  CHECK ("role" = 'admin' OR "volunteerId" IS NOT NULL);

-- project_supports (FKs to volunteers ×2 and service_items)
CREATE TABLE "project_supports" (
  "id"            TEXT NOT NULL,
  "supportId"     TEXT NOT NULL,
  "volunteerId"   TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "serviceItemId" TEXT NOT NULL,
  "serviceDate"   TIMESTAMP(3) NOT NULL,
  "duration"      DOUBLE PRECISION NOT NULL,
  "description"   TEXT NOT NULL,
  "status"        "ProjectSupportStatus" NOT NULL DEFAULT 'ACTIVE',
  "confirmedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_supports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_supports_supportId_key" ON "project_supports"("supportId");
CREATE INDEX "project_supports_volunteerId_serviceDate_idx"
  ON "project_supports"("volunteerId", "serviceDate" DESC);
CREATE INDEX "project_supports_submittedById_status_idx"
  ON "project_supports"("submittedById", "status");
CREATE INDEX "project_supports_serviceItemId_idx" ON "project_supports"("serviceItemId");
CREATE INDEX "project_supports_status_idx"        ON "project_supports"("status");
ALTER TABLE "project_supports"
  ADD CONSTRAINT "project_supports_volunteerId_fkey"
  FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_supports"
  ADD CONSTRAINT "project_supports_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_supports"
  ADD CONSTRAINT "project_supports_serviceItemId_fkey"
  FOREIGN KEY ("serviceItemId") REFERENCES "service_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Manual partial unique index: dedup enforcement.
-- Two ACTIVE records with the same (volunteer, date, item, duration, description)
-- are rejected by the database. DELETED / PENDING / REJECTED rows are exempt.
CREATE UNIQUE INDEX "project_supports_active_dedup"
  ON "project_supports"("volunteerId", "serviceDate", "serviceItemId", "duration", "description")
  WHERE "status" = 'ACTIVE';

-- system_settings (singleton table; row id=1 created on first write by service)
CREATE TABLE "system_settings" (
  "id"           INTEGER NOT NULL DEFAULT 1,
  "lockedBefore" TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "updatedById"  TEXT,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- audit_logs (no FKs — operator/submitter snapshots may reference deleted accounts)
CREATE TABLE "audit_logs" (
  "id"            TEXT NOT NULL,
  "auditId"       TEXT NOT NULL,
  "targetType"    "AuditTargetType" NOT NULL,
  "targetId"      TEXT NOT NULL,
  "action"        "AuditAction" NOT NULL,
  "actionDetails" JSONB NOT NULL,
  "modifiedId"    TEXT,
  "changes"       JSONB NOT NULL DEFAULT '[]',
  "operator"      JSONB NOT NULL,
  "submitter"     JSONB NOT NULL,
  "timestamp"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_logs_auditId_key"  ON "audit_logs"("auditId");
CREATE INDEX "audit_logs_timestamp_idx"       ON "audit_logs"("timestamp" DESC);
CREATE INDEX "audit_logs_targetId_idx"        ON "audit_logs"("targetId");
CREATE INDEX "audit_logs_modifiedId_idx"      ON "audit_logs"("modifiedId");

-- ─── Initial data ─────────────────────────────────────────────────────────────

-- SystemSettings singleton row. Schema model has @updatedAt but the column is
-- NOT NULL with no DB default, so the row must be initialized here. Subsequent
-- writes go through Prisma which handles updatedAt automatically.
INSERT INTO "system_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);

-- Reference data (10 departments + ~50 service items) is loaded by seed.js,
-- not here. Migration files are schema-only by convention.
