CREATE TYPE "ForumBodyFormat" AS ENUM ('MARKDOWN', 'RICH_TEXT');
ALTER TABLE "posts" ADD COLUMN "bodyFormat" "ForumBodyFormat" NOT NULL DEFAULT 'MARKDOWN';
ALTER TABLE "post_comments" ADD COLUMN "bodyFormat" "ForumBodyFormat" NOT NULL DEFAULT 'MARKDOWN';
CREATE TABLE "forum_images" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT,
  "circleId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "data" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
  "size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forum_images_single_target" CHECK ("postId" IS NULL OR "commentId" IS NULL),
  CONSTRAINT "forum_images_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "forum_images_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "forum_images_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "forum_images_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "post_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "forum_images_ownerId_createdAt_idx" ON "forum_images"("ownerId", "createdAt");
CREATE INDEX "forum_images_circleId_idx" ON "forum_images"("circleId");
CREATE INDEX "forum_images_postId_idx" ON "forum_images"("postId");
CREATE INDEX "forum_images_commentId_idx" ON "forum_images"("commentId");
CREATE INDEX "forum_images_createdAt_idx" ON "forum_images"("createdAt");
