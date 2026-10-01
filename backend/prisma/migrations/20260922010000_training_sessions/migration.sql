-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'TrainingSession';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'training_create';
ALTER TYPE "AuditAction" ADD VALUE 'training_update';
ALTER TYPE "AuditAction" ADD VALUE 'training_add';
ALTER TYPE "AuditAction" ADD VALUE 'training_remove';
ALTER TYPE "AuditAction" ADD VALUE 'training_restore';
ALTER TYPE "AuditAction" ADD VALUE 'training_migrate';

-- DropForeignKey
ALTER TABLE "project_supports" DROP CONSTRAINT "project_supports_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "tag_attachments" DROP CONSTRAINT "tag_attachments_attachedById_fkey";

-- AlterTable
ALTER TABLE "project_supports" ADD COLUMN     "submittedByAccountId" TEXT,
ADD COLUMN     "trainingSessionId" TEXT,
ALTER COLUMN "submittedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tag_groups" ADD COLUMN     "applicability" TEXT NOT NULL DEFAULT 'specified',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tag_attachments" ADD COLUMN     "attachedByAccountId" TEXT,
ALTER COLUMN "attachedById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByAccountId" TEXT,
    "updatedByAccountId" TEXT,
    "legacyTagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attendances" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "supportId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_sessions_legacyTagId_key" ON "training_sessions"("legacyTagId");

-- CreateIndex
CREATE INDEX "training_sessions_serviceDate_name_idx" ON "training_sessions"("serviceDate", "name");

-- CreateIndex
CREATE UNIQUE INDEX "training_attendances_supportId_key" ON "training_attendances"("supportId");

-- CreateIndex
CREATE UNIQUE INDEX "training_attendances_sessionId_volunteerId_key" ON "training_attendances"("sessionId", "volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "project_supports_trainingSessionId_volunteerId_key" ON "project_supports"("trainingSessionId", "volunteerId");

-- AddForeignKey
ALTER TABLE "project_supports" ADD CONSTRAINT "project_supports_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_supports" ADD CONSTRAINT "project_supports_submittedByAccountId_fkey" FOREIGN KEY ("submittedByAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_supports" ADD CONSTRAINT "project_supports_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_attachments" ADD CONSTRAINT "tag_attachments_attachedById_fkey" FOREIGN KEY ("attachedById") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_attachments" ADD CONSTRAINT "tag_attachments_attachedByAccountId_fkey" FOREIGN KEY ("attachedByAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "service_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_legacyTagId_fkey" FOREIGN KEY ("legacyTagId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendances_supportId_fkey" FOREIGN KEY ("supportId") REFERENCES "project_supports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the old empty-scope meaning: hidden from submission forms.
UPDATE "tag_groups" SET "applicability" = 'legacy' WHERE cardinality("boundServiceItemIds") = 0;
ALTER TABLE "tag_groups" ADD CONSTRAINT "tag_groups_applicability_check"
  CHECK ("applicability" IN ('legacy', 'all', 'specified'));
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_duration_check"
  CHECK ("duration" > 0 AND "duration" * 2 = trunc("duration" * 2));

-- Keep ordinary-record dedup; different sessions may have identical snapshots.
DROP INDEX "project_supports_active_dedup";
CREATE UNIQUE INDEX "project_supports_active_dedup"
  ON "project_supports"("volunteerId", "serviceDate", "serviceItemId", "duration", "description")
  WHERE "status" = 'ACTIVE' AND "trainingSessionId" IS NULL;

-- Attendance cannot point at another person's/session's ledger record.
CREATE UNIQUE INDEX "project_supports_attendance_identity"
  ON "project_supports"("id", "trainingSessionId", "volunteerId");
ALTER TABLE "training_attendances" ADD CONSTRAINT "training_attendance_identity_fkey"
  FOREIGN KEY ("supportId", "sessionId", "volunteerId")
  REFERENCES "project_supports"("id", "trainingSessionId", "volunteerId") ON DELETE RESTRICT;
