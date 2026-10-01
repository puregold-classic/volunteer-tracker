CREATE TYPE "CircleAssetKind" AS ENUM ('COVER', 'FILE');
CREATE TABLE "circle_assets" (
  "id" TEXT NOT NULL,
  "circleId" TEXT NOT NULL,
  "uploaderId" TEXT,
  "kind" "CircleAssetKind" NOT NULL,
  "name" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "circle_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "circle_assets_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "circle_assets_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "circle_assets_size_check" CHECK ("size" > 0)
);
CREATE INDEX "circle_assets_circleId_kind_deletedAt_createdAt_idx" ON "circle_assets"("circleId", "kind", "deletedAt", "createdAt");
CREATE INDEX "circle_assets_uploaderId_idx" ON "circle_assets"("uploaderId");
CREATE UNIQUE INDEX "circle_assets_one_active_cover" ON "circle_assets"("circleId") WHERE "kind" = 'COVER' AND "deletedAt" IS NULL;
