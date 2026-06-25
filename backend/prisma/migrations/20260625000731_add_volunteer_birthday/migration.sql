-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_volunteerId_fkey";

-- AlterTable
ALTER TABLE "tag_groups" ALTER COLUMN "boundServiceItemIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "volunteers" ADD COLUMN     "birthday" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
