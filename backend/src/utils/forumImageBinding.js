import { ForumError } from '../services/CircleService.js';
// Unpublished uploads remain private to their owner while local drafts are retained.
export const DRAFT_IMAGE_TTL = 30 * 24 * 60 * 60 * 1000;
export async function bindForumImages(db, ids, actorId, circleId, targetId, comment = false) {
  if (!ids.length) return;
  const rows = await db.forumImage.findMany({ where: { id: { in: ids } }, select: { id: true, ownerId: true, circleId: true, postId: true, commentId: true, createdAt: true } });
  if (rows.length !== ids.length) throw new ForumError(400, '图片已失效，请重新上传');
  const key = comment ? 'commentId' : 'postId';
  const cutoff = new Date(Date.now() - DRAFT_IMAGE_TTL);
  if (rows.some((row) => row.circleId !== circleId || (row[key] !== targetId && !(row.postId === null && row.commentId === null && row.ownerId === actorId && row.createdAt >= cutoff)))) throw new ForumError(403, '图片不属于当前内容，请重新上传');
  await db.forumImage.updateMany({ where: { id: { in: ids }, postId: null, commentId: null }, data: { [key]: targetId } });
}
