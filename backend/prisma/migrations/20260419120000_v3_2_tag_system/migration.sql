-- ─────────────────────────────────────────────────────────────────────────────
-- v3.2: Tag system + dept/item adjustments
--
-- This migration:
-- 1. Adds new enum values for AuditTargetType / AuditAction
-- 2. Creates new enums TagSelectionMode / TagOpMode / TagOpenness
-- 3. Creates tag_groups / tags / tag_attachments tables
-- 4. Backfills existing projects → tags under a default "会话" TagGroup
-- 5. Migrates project_supports.projectId → tag_attachments rows
-- 6. Schema-only: projects table + project_supports.projectId column are NOT
--    dropped here — that happens in a follow-up sweep after we verify no
--    consumer still reads them. This migration is read-safe: both project.*
--    and tag.* work in parallel until service layer switches over.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enum additions ──

ALTER TYPE "AuditTargetType" ADD VALUE 'TagGroup';
ALTER TYPE "AuditTargetType" ADD VALUE 'Tag';

ALTER TYPE "AuditAction" ADD VALUE 'tag_group_create';
ALTER TYPE "AuditAction" ADD VALUE 'tag_group_update';
ALTER TYPE "AuditAction" ADD VALUE 'tag_group_delete';
ALTER TYPE "AuditAction" ADD VALUE 'tag_create';
ALTER TYPE "AuditAction" ADD VALUE 'tag_update';
ALTER TYPE "AuditAction" ADD VALUE 'tag_delete';
ALTER TYPE "AuditAction" ADD VALUE 'tag_attach';
ALTER TYPE "AuditAction" ADD VALUE 'tag_detach';
ALTER TYPE "AuditAction" ADD VALUE 'support_batch_create';
ALTER TYPE "AuditAction" ADD VALUE 'support_batch_update';
ALTER TYPE "AuditAction" ADD VALUE 'support_batch_delete';
ALTER TYPE "AuditAction" ADD VALUE 'support_batch_attach';
ALTER TYPE "AuditAction" ADD VALUE 'support_batch_detach';
ALTER TYPE "AuditAction" ADD VALUE 'account_password_change';
ALTER TYPE "AuditAction" ADD VALUE 'account_password_reset';
ALTER TYPE "AuditAction" ADD VALUE 'account_avatar_update';

-- ─── New enums ──

CREATE TYPE "TagSelectionMode" AS ENUM ('single', 'multi');
CREATE TYPE "TagOpMode"        AS ENUM ('managed', 'tag_only');
CREATE TYPE "TagOpenness"      AS ENUM ('closed', 'open');

-- ─── tag_groups ──

CREATE TABLE "tag_groups" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "description"         TEXT,
  "boundServiceItemIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectionMode"       "TagSelectionMode" NOT NULL DEFAULT 'single',
  "opMode"              "TagOpMode" NOT NULL DEFAULT 'tag_only',
  "openness"            "TagOpenness" NOT NULL DEFAULT 'closed',
  "required"            BOOLEAN NOT NULL DEFAULT false,
  "createdById"         TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tag_groups_name_key" ON "tag_groups"("name");
CREATE INDEX "tag_groups_createdById_idx" ON "tag_groups"("createdById");
ALTER TABLE "tag_groups"
  ADD CONSTRAINT "tag_groups_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── tags ──

CREATE TABLE "tags" (
  "id"          TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tags_groupId_name_key" ON "tags"("groupId", "name");
CREATE INDEX "tags_groupId_idx" ON "tags"("groupId");
ALTER TABLE "tags"
  ADD CONSTRAINT "tags_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "tag_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags"
  ADD CONSTRAINT "tags_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── tag_attachments ──

CREATE TABLE "tag_attachments" (
  "id"           TEXT NOT NULL,
  "tagId"        TEXT NOT NULL,
  "supportId"    TEXT NOT NULL,
  "attachedById" TEXT NOT NULL,
  "attachedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tag_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tag_attachments_tagId_supportId_key"
  ON "tag_attachments"("tagId", "supportId");
CREATE INDEX "tag_attachments_supportId_idx" ON "tag_attachments"("supportId");
CREATE INDEX "tag_attachments_tagId_idx"     ON "tag_attachments"("tagId");
ALTER TABLE "tag_attachments"
  ADD CONSTRAINT "tag_attachments_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_attachments"
  ADD CONSTRAINT "tag_attachments_supportId_fkey"
  FOREIGN KEY ("supportId") REFERENCES "project_supports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tag_attachments"
  ADD CONSTRAINT "tag_attachments_attachedById_fkey"
  FOREIGN KEY ("attachedById") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Backfill: existing projects → tags under default "会话" group ──
--
-- The default group is created idempotently; seeder later on first run may
-- upsert it too but the unique constraint on name makes this safe.

DO $$
DECLARE
  first_volunteer_id TEXT;
  session_group_id TEXT;
  proj RECORD;
  new_tag_id TEXT;
BEGIN
  -- Pick any volunteer to own the backfill-created rows. Seed always creates
  -- at least one sample volunteer; if the DB is truly empty we skip backfill.
  SELECT id INTO first_volunteer_id FROM volunteers LIMIT 1;
  IF first_volunteer_id IS NULL THEN
    RETURN;
  END IF;

  -- Create default session group (idempotent via name unique)
  INSERT INTO "tag_groups" (id, name, description, "boundServiceItemIds",
                            "selectionMode", "opMode", openness, required,
                            "createdById", "updatedAt")
  VALUES (
    'tg_session_default_cbf0000000000000',
    '会话',
    'Session-style 自由标签组。一次培训 / 一个批次就是一个 tag。由 v3 → v3.2 migration 自动创建，承接原 Project 数据。',
    ARRAY[]::TEXT[], 'multi', 'managed', 'open', false,
    first_volunteer_id, CURRENT_TIMESTAMP
  )
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO session_group_id FROM "tag_groups" WHERE name = '会话';

  -- For each existing project, create a tag with the same name under the session group
  FOR proj IN SELECT * FROM projects LOOP
    -- Skip if tag with this name already exists in the group
    IF NOT EXISTS (
      SELECT 1 FROM tags WHERE "groupId" = session_group_id AND name = proj.name
    ) THEN
      new_tag_id := 'tag_from_proj_' || proj.id;
      INSERT INTO "tags" (id, "groupId", name, "createdById", "updatedAt")
      VALUES (new_tag_id, session_group_id, proj.name, proj."createdById", CURRENT_TIMESTAMP);
    ELSE
      SELECT id INTO new_tag_id FROM tags
        WHERE "groupId" = session_group_id AND name = proj.name;
    END IF;

    -- Insert tag_attachments for every project_support with this projectId
    INSERT INTO "tag_attachments" (id, "tagId", "supportId", "attachedById", "attachedAt")
    SELECT
      'ta_from_proj_' || ps.id,
      new_tag_id,
      ps.id,
      ps."submittedById",
      CURRENT_TIMESTAMP
    FROM project_supports ps
    WHERE ps."projectId" = proj.id
    ON CONFLICT ("tagId", "supportId") DO NOTHING;
  END LOOP;
END
$$;
