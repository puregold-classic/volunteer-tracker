-- ─────────────────────────────────────────────────────────────────────────────
-- Project (v3 wave 2) — first-class session/instance entity.
--
-- Groups ProjectSupport records that belong to the same real-world event
-- ("2026-04 笔译培训 第 12 期"). At MVP only TRAINING_ATTENDANCE category
-- projects are produced by the API, enforced at the service layer.
--
-- The `attributes` JSONB column holds flexible tags (language / level /
-- noteType) without requiring a schema migration every time v3-plan.md
-- adds a new dimension.
--
-- ProjectSupport gets an optional FK to Project:
-- - Populated automatically by batch-attendance entry.
-- - Can be set later by admin / self to tag an existing support to a session.
-- -────────────────────────────────────────────────────────────────────────────

-- ─── Extend existing enums ──

ALTER TYPE "AuditTargetType" ADD VALUE 'Project';

ALTER TYPE "AuditAction" ADD VALUE 'project_create';
ALTER TYPE "AuditAction" ADD VALUE 'project_update';
ALTER TYPE "AuditAction" ADD VALUE 'project_delete';
ALTER TYPE "AuditAction" ADD VALUE 'project_attendance_batch';
ALTER TYPE "AuditAction" ADD VALUE 'project_link_support';

-- ─── projects table ──

CREATE TABLE "projects" (
  "id"              TEXT NOT NULL,
  "projectCode"     TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "category"        "ServiceCategory" NOT NULL,
  "departmentId"    TEXT NOT NULL,
  "sessionDate"     TIMESTAMP(3) NOT NULL,
  "sessionDuration" DOUBLE PRECISION,
  "attributes"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_projectCode_key" ON "projects"("projectCode");
CREATE INDEX "projects_category_idx"       ON "projects"("category");
CREATE INDEX "projects_departmentId_idx"   ON "projects"("departmentId");
CREATE INDEX "projects_sessionDate_idx"    ON "projects"("sessionDate" DESC);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── project_supports.projectId ──

ALTER TABLE "project_supports"
  ADD COLUMN "projectId" TEXT;

CREATE INDEX "project_supports_projectId_idx"
  ON "project_supports"("projectId");

ALTER TABLE "project_supports"
  ADD CONSTRAINT "project_supports_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
