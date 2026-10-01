-- PostgreSQL 16: additive forum schema. Keep the migration atomic; the new
-- Audit enum values are not used until after this transaction commits.
BEGIN;

-- CreateEnum
CREATE TYPE "CircleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CircleRole" AS ENUM ('OWNER', 'STEWARD');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "ContentEditKind" AS ENUM ('AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POST_COMMENT', 'CIRCLE_ROLE_ASSIGNED', 'CIRCLE_ROLE_REMOVED', 'CIRCLE_OWNERSHIP_TRANSFERRED', 'CONTENT_EDITED', 'CONTENT_DELETED', 'CONTENT_RESTORED', 'POST_PINNED', 'POST_UNPINNED', 'POST_FEATURED', 'POST_UNFEATURED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditTargetType" ADD VALUE 'Circle';
ALTER TYPE "AuditTargetType" ADD VALUE 'Post';
ALTER TYPE "AuditTargetType" ADD VALUE 'PostComment';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'circle_create';
ALTER TYPE "AuditAction" ADD VALUE 'circle_update';
ALTER TYPE "AuditAction" ADD VALUE 'circle_archive';
ALTER TYPE "AuditAction" ADD VALUE 'circle_restore';
ALTER TYPE "AuditAction" ADD VALUE 'circle_role_assign';
ALTER TYPE "AuditAction" ADD VALUE 'circle_role_remove';
ALTER TYPE "AuditAction" ADD VALUE 'circle_ownership_transfer';
ALTER TYPE "AuditAction" ADD VALUE 'post_moderation_edit';
ALTER TYPE "AuditAction" ADD VALUE 'post_moderation_delete';
ALTER TYPE "AuditAction" ADD VALUE 'post_moderation_restore';
ALTER TYPE "AuditAction" ADD VALUE 'post_pin';
ALTER TYPE "AuditAction" ADD VALUE 'post_unpin';
ALTER TYPE "AuditAction" ADD VALUE 'post_feature';
ALTER TYPE "AuditAction" ADD VALUE 'post_unfeature';
ALTER TYPE "AuditAction" ADD VALUE 'comment_moderation_edit';
ALTER TYPE "AuditAction" ADD VALUE 'comment_moderation_delete';
ALTER TYPE "AuditAction" ADD VALUE 'comment_moderation_restore';

-- CreateTable
CREATE TABLE "circles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CircleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circle_role_assignments" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "CircleRole" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circle_follows" (
    "circleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circle_follows_pkey" PRIMARY KEY ("circleId","accountId")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "lastEditKind" "ContentEditKind",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'ACTIVE',
    "editedAt" TIMESTAMP(3),
    "lastEditKind" "ContentEditKind",
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_favorites" (
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_favorites_pkey" PRIMARY KEY ("postId","accountId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "postId" TEXT,
    "circleId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "circles_slug_key" ON "circles"("slug");

-- CreateIndex
CREATE INDEX "circles_status_createdAt_idx" ON "circles"("status", "createdAt");

-- CreateIndex
CREATE INDEX "circles_createdById_idx" ON "circles"("createdById");

-- CreateIndex
CREATE INDEX "circle_role_assignments_accountId_idx" ON "circle_role_assignments"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "circle_role_assignments_circleId_accountId_key" ON "circle_role_assignments"("circleId", "accountId");

-- CreateIndex
CREATE INDEX "circle_follows_accountId_createdAt_idx" ON "circle_follows"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_circleId_status_isPinned_lastActivityAt_idx" ON "posts"("circleId", "status", "isPinned", "lastActivityAt");

-- CreateIndex
CREATE INDEX "posts_circleId_status_createdAt_idx" ON "posts"("circleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "posts_authorId_createdAt_idx" ON "posts"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "post_comments_postId_status_createdAt_id_idx" ON "post_comments"("postId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "post_comments_authorId_createdAt_idx" ON "post_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "post_likes_accountId_idx" ON "post_likes"("accountId");

-- CreateIndex
CREATE INDEX "post_likes_postId_createdAt_idx" ON "post_likes"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_likes_postId_accountId_key" ON "post_likes"("postId", "accountId");

-- CreateIndex
CREATE INDEX "post_favorites_accountId_createdAt_idx" ON "post_favorites"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_recipientId_readAt_createdAt_idx" ON "notifications"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_actorId_idx" ON "notifications"("actorId");

-- CreateIndex
CREATE INDEX "notifications_postId_idx" ON "notifications"("postId");

-- CreateIndex
CREATE INDEX "notifications_circleId_idx" ON "notifications"("circleId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipientId_eventKey_key" ON "notifications"("recipientId", "eventKey");

-- AddForeignKey
ALTER TABLE "circles" ADD CONSTRAINT "circles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_role_assignments" ADD CONSTRAINT "circle_role_assignments_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_role_assignments" ADD CONSTRAINT "circle_role_assignments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_follows" ADD CONSTRAINT "circle_follows_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_follows" ADD CONSTRAINT "circle_follows_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_favorites" ADD CONSTRAINT "post_favorites_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_favorites" ADD CONSTRAINT "post_favorites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
