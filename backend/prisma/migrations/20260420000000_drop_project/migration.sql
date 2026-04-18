-- v3.3 Phase A: drop Project schema (replaced entirely by Tag/TagGroup).
--
-- 20260419 migration had already back-filled projectId rows into Tag rows
-- under the "会话" group, so dropping projectId + projects now is safe —
-- no data is lost that isn't already mirrored on the tag side.
--
-- AuditTargetType 'Project' enum value is intentionally kept; historical
-- audit_log rows referencing it remain queryable.

ALTER TABLE "project_supports" DROP CONSTRAINT IF EXISTS "project_supports_projectId_fkey";
DROP INDEX IF EXISTS "project_supports_projectId_idx";
ALTER TABLE "project_supports" DROP COLUMN IF EXISTS "projectId";

DROP TABLE IF EXISTS "projects";
