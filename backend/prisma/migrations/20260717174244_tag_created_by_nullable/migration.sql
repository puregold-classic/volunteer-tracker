-- DropForeignKey
ALTER TABLE "tag_groups" DROP CONSTRAINT "tag_groups_createdById_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_createdById_fkey";

-- AlterTable
ALTER TABLE "tag_groups" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tags" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tag_groups" ADD CONSTRAINT "tag_groups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
