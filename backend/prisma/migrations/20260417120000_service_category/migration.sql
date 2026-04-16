-- ─────────────────────────────────────────────────────────────────────────────
-- ServiceCategory — classify ServiceItems into the v3 三大板块 buckets
-- (项目管理 / 项目培训 / 项目支持) plus TRAINING_ATTENDANCE (受训考勤).
--
-- Placed at the ServiceItem level rather than Department because a few
-- departments span categories through their individual items (TECH has
-- 技术培训 which is PROJECT_TRAINING while the rest is PROJECT_SUPPORT;
-- CARE similarly). Department-level category would be too coarse.
--
-- The backfill uses (departmentId, name) as the deterministic source of
-- truth for existing rows. The seed script runs after migration and is
-- the authoritative source going forward, but we set sensible values
-- here so no row is ever observed with the default placeholder.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "ServiceCategory" AS ENUM (
  'PROJECT_MGMT',
  'PROJECT_TRAINING',
  'PROJECT_SUPPORT',
  'TRAINING_ATTENDANCE'
);

ALTER TABLE "service_items"
  ADD COLUMN "category" "ServiceCategory" NOT NULL DEFAULT 'PROJECT_SUPPORT';

-- Backfill existing rows based on (departmentId, name).
UPDATE "service_items" SET "category" = 'PROJECT_MGMT'
  WHERE "departmentId" IN ('BY_PROJECT', 'KY_PROJECT', 'XZT');

UPDATE "service_items" SET "category" = 'PROJECT_TRAINING'
  WHERE "departmentId" IN ('BY_TRAINING', 'KY_TRAINING');

UPDATE "service_items" SET "category" = 'PROJECT_TRAINING'
  WHERE "departmentId" = 'TECH' AND "name" IN ('技术培训', '培训');

UPDATE "service_items" SET "category" = 'PROJECT_TRAINING'
  WHERE "departmentId" = 'CARE' AND "name" = '人文培训';

CREATE INDEX "service_items_category_idx" ON "service_items"("category");
