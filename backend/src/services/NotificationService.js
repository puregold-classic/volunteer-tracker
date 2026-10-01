import { actorFor, read, write, pageOptions, pageResult } from './PostService.js';
import { ForumError } from './CircleService.js';
import { buildForumAccess } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';

// Replies become invisible together with their parent content. Moderation and
// role events remain readable as generic results, even after the target hides.
const visibleWhere = (recipientId) => ({ recipientId, OR: [
  { type: { notIn: ['POST_COMMENT', 'MENTION'] } },
  { type: { in: ['POST_COMMENT', 'MENTION'] }, post: { is: { status: 'ACTIVE', circle: { status: 'ACTIVE' } } } },
] });
const circleSelect = (accountId) => ({ id: true, slug: true, name: true, status: true,
  roles: { where: { accountId }, select: { role: true } } });
const include = (accountId) => ({ actor: { select: FORUM_AUTHOR_SELECT },
  circle: { select: circleSelect(accountId) },
  post: { select: { id: true, title: true, status: true, circle: { select: circleSelect(accountId) } } },
});
const summary = (row) => {
  const content = row.targetType === 'PostComment' ? '评论' : '帖子';
  return {
    MENTION: `在${content}中提及了你`, POST_COMMENT: '评论了你的帖子', CIRCLE_ROLE_ASSIGNED: '任命你为圈务成员',
    CIRCLE_ROLE_REMOVED: '移除了你的圈务身份', CIRCLE_OWNERSHIP_TRANSFERRED: '将圈主身份转让给你',
    CONTENT_EDITED: `编辑了你的${content}`, CONTENT_DELETED: `删除了你的${content}`,
    CONTENT_RESTORED: `恢复了你的${content}`, POST_PINNED: '置顶了你的帖子',
    POST_UNPINNED: '取消了你帖子的置顶', POST_FEATURED: '将你的帖子设为精华', POST_UNFEATURED: '取消了你帖子的精华',
  }[row.type] || '发送了一条通知';
};
async function serialize(db, actor, rows) {
  const ids = rows.filter((r) => r.targetType === 'PostComment').map((r) => r.targetId);
  const comments = ids.length ? await db.postComment.findMany({ where: { id: { in: ids } }, select: { id: true, postId: true, status: true } }) : [];
  const byId = new Map(comments.map((c) => [c.id, c]));
  return rows.map((row) => {
    const circle = row.post?.circle || row.circle;
    const comment = row.targetType === 'PostComment' ? byId.get(row.targetId) : null;
    let unavailableReason = null, href = null;
    if (!circle) unavailableReason = '目标已不可用';
    else if (circle.status !== 'ACTIVE') unavailableReason = '圈子已归档';
    else if (row.targetType === 'Circle') href = `/forum/c/${circle.slug}${buildForumAccess(actor, circle).canViewManagement ? '/manage' : ''}`;
    else if (!row.post || row.post.status !== 'ACTIVE') unavailableReason = '帖子已删除';
    else if (row.targetType === 'PostComment' && (!comment || comment.status !== 'ACTIVE' || comment.postId !== row.post.id)) unavailableReason = '评论已删除';
    else if (row.targetType === 'Post' || row.targetType === 'PostComment') href = `/forum/p/${row.post.id}${comment ? `?commentId=${comment.id}#comment-${comment.id}` : ''}`;
    else unavailableReason = '目标已不可用';
    const identity = serializeForumAuthor(row.actor);
    return { id: row.id, type: row.type, actor: { name: identity.name, isDeleted: Boolean(identity.isDeleted) },
      summary: summary(row), contextTitle: unavailableReason ? null : row.post?.title || circle?.name || null,
      createdAt: row.createdAt, readAt: row.readAt, href, unavailableReason };
  });
}
export default class NotificationService {
  static list(operator, query = {}) {
    return read(async (db) => {
      const actor = await actorFor(operator, db), page = pageOptions(query), viewedAt = new Date();
      const filter = query.filter ?? 'all';
      if (!['all', 'unread'].includes(filter)) throw new ForumError(400, '无效的消息筛选');
      const base = { ...visibleWhere(actor.id), createdAt: { lte: viewedAt } };
      const where = { ...base, ...(filter === 'unread' ? { readAt: null } : {}) };
      const total = await db.notification.count({ where });
      const unreadCount = await db.notification.count({ where: { ...base, readAt: null } });
      const rows = await db.notification.findMany({ where, include: include(actor.id), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.limit });
      return { ...pageResult(await serialize(db, actor, rows), total, page), unreadCount, viewedAt, filter };
    });
  }
  static unreadCount(operator) {
    return read(async (db) => {
      const actor = await actorFor(operator, db);
      return { unreadCount: await db.notification.count({ where: { ...visibleWhere(actor.id), readAt: null, createdAt: { lte: new Date() } } }) };
    });
  }
  static markRead(operator, id) {
    return write(async (db) => {
      const actor = await actorFor(operator, db);
      const where = { id, recipientId: actor.id };
      const existing = await db.notification.findFirst({ where });
      if (!existing) throw new ForumError(404, '消息不存在');
      await db.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
      const row = await db.notification.findFirst({ where, include: include(actor.id) });
      return (await serialize(db, actor, [row]))[0];
    });
  }
  static readAll(operator, input = {}) {
    return write(async (db) => {
      const actor = await actorFor(operator, db), now = new Date();
      if (typeof input.viewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(input.viewedAt) || !Number.isFinite(Date.parse(input.viewedAt))) throw new ForumError(400, '请提供有效的消息查看时间');
      const cutoff = new Date(Math.min(Date.parse(input.viewedAt), now.getTime()));
      const result = await db.notification.updateMany({ where: { recipientId: actor.id, readAt: null, createdAt: { lte: cutoff } }, data: { readAt: now } });
      return { updatedCount: result.count, viewedAt: cutoff };
    });
  }
}
