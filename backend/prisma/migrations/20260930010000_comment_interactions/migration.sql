ALTER TYPE "AuditAction" ADD VALUE 'comment_pin';
ALTER TYPE "AuditAction" ADD VALUE 'comment_unpin';
ALTER TABLE "post_comments" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "pinnedAt" TIMESTAMP(3);
CREATE INDEX "post_comments_postId_status_isPinned_createdAt_id_idx"
    ON "post_comments"("postId", "status", "isPinned", "createdAt", "id");
CREATE TABLE "comment_favorites" (
    "commentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_favorites_pkey" PRIMARY KEY ("commentId", "accountId"),
    CONSTRAINT "comment_favorites_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comment_favorites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "comment_favorites_accountId_createdAt_idx" ON "comment_favorites"("accountId", "createdAt");
