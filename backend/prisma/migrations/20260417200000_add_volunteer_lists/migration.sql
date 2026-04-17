-- ─────────────────────────────────────────────────────────────────────────────
-- Volunteer lists (v3 wave 3)
--
-- Private per-owner tracking lists. MVP usage: a single auto-created
-- "我的关注" list per owner (lazy on first add). Schema is ready for
-- multi-list without further migration.
-- -────────────────────────────────────────────────────────────────────────────

-- Extend audit enum first so the service layer can write audit rows.
ALTER TYPE "AuditAction" ADD VALUE 'list_create';
ALTER TYPE "AuditAction" ADD VALUE 'list_update';
ALTER TYPE "AuditAction" ADD VALUE 'list_delete';
ALTER TYPE "AuditAction" ADD VALUE 'list_member_add';
ALTER TYPE "AuditAction" ADD VALUE 'list_member_remove';

-- volunteer_lists
CREATE TABLE "volunteer_lists" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "volunteer_lists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "volunteer_lists_ownerId_name_key"
  ON "volunteer_lists"("ownerId", "name");
CREATE INDEX "volunteer_lists_ownerId_idx"
  ON "volunteer_lists"("ownerId");
ALTER TABLE "volunteer_lists"
  ADD CONSTRAINT "volunteer_lists_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- volunteer_list_members
CREATE TABLE "volunteer_list_members" (
  "id"          TEXT NOT NULL,
  "listId"      TEXT NOT NULL,
  "volunteerId" TEXT NOT NULL,
  "note"        TEXT,
  "addedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "volunteer_list_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "volunteer_list_members_listId_volunteerId_key"
  ON "volunteer_list_members"("listId", "volunteerId");
CREATE INDEX "volunteer_list_members_volunteerId_idx"
  ON "volunteer_list_members"("volunteerId");
ALTER TABLE "volunteer_list_members"
  ADD CONSTRAINT "volunteer_list_members_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "volunteer_lists"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "volunteer_list_members"
  ADD CONSTRAINT "volunteer_list_members_volunteerId_fkey"
  FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
