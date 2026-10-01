import { actorFor, read, write, context, touchCircle, notify, pageOptions, pageResult, summary, circleDTO } from './PostService.js';
import { getContentPermissions, getForumAccess, buildForumAccess } from '../utils/forumPermissions.js';
import { ForumError } from './CircleService.js';
import IDGenerator from '../utils/IDGenerator.js';
const allowed = (value) => { if (!value) throw new ForumError(403, '没有此操作权限，或内容已不可用'); };

export default class ForumInteractionService {
  static engage(operator, postId, kind, selected) {
    return write(async (db) => {
      if (!['like', 'favorite'].includes(kind)) throw new ForumError(400, '无效的互动类型');
      const { actor, post, access } = await context(db, operator, postId);
      // Removing a personal bookmark remains possible after content is hidden.
      if (kind !== 'favorite' || selected) allowed(getContentPermissions(access, post).canInteract);
      const model = kind === 'like' ? 'postLike' : 'postFavorite';
      const key = { postId_accountId: { postId, accountId: actor.id } };
      const existing = await db[model].findUnique({ where: key });
      if (Boolean(existing) !== selected) {
        await touchCircle(db, post.circleId);
        if (selected) await db[model].create({ data: { postId, accountId: actor.id } });
        else await db[model].delete({ where: key });
      }
      return kind === 'like' ? { isLiked: selected, likeCount: await db.postLike.count({ where: { postId } }) } : { isFavorited: selected };
    });
  }
  static mark(operator, postId, kind, selected) {
    return write(async (db) => {
      if (!['pin', 'feature'].includes(kind)) throw new ForumError(400, '无效的管理操作');
      const { actor, post, access } = await context(db, operator, postId);
      allowed(getContentPermissions(access, post)[kind === 'pin' ? 'canPin' : 'canFeature']);
      const field = kind === 'pin' ? 'isPinned' : 'isFeatured', dateField = kind === 'pin' ? 'pinnedAt' : 'featuredAt';
      let updated = post;
      if (post[field] !== selected) {
        await touchCircle(db, post.circleId);
        updated = await db.post.update({ where: { id: postId }, data: { [field]: selected, [dateField]: selected ? new Date() : null } });
        const identity = { id: actor.id, name: actor.name, role: actor.role };
        const audit = await db.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), targetType: 'Post', targetId: postId,
          action: `post_${selected ? '' : 'un'}${kind}`, actionDetails: { [field]: selected }, operator: identity, submitter: identity } });
        const type = kind === 'pin' ? (selected ? 'POST_PINNED' : 'POST_UNPINNED') : (selected ? 'POST_FEATURED' : 'POST_UNFEATURED');
        await notify(db, actor, post.authorId, audit.id, type, post, postId);
      }
      return { isPinned: updated.isPinned, pinnedAt: updated.pinnedAt, isFeatured: updated.isFeatured, featuredAt: updated.featuredAt, updatedAt: updated.updatedAt };
    });
  }
  static comment(operator, commentId, kind, selected) {
    return write(async (db) => {
      if (!['pin', 'favorite'].includes(kind)) throw new ForumError(400, '无效的评论操作');
      const { actor, row, post, access } = await context(db, operator, commentId, true);
      const permissions = getContentPermissions(access, row);
      if (kind === 'pin') {
        allowed(permissions.canPin);
        if (row.isPinned === selected) return { isPinned: row.isPinned, pinnedAt: row.pinnedAt, updatedAt: row.updatedAt };
        await touchCircle(db, post.circleId);
        const updated = await db.postComment.update({ where: { id: commentId }, data: { isPinned: selected, pinnedAt: selected ? new Date() : null } });
        const identity = { id: actor.id, name: actor.name, role: actor.role };
        await db.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), targetType: 'PostComment', targetId: commentId,
          action: `comment_${selected ? '' : 'un'}pin`, actionDetails: { isPinned: selected }, operator: identity, submitter: identity } });
        return { isPinned: updated.isPinned, pinnedAt: updated.pinnedAt, updatedAt: updated.updatedAt };
      }
      if (selected) allowed(permissions.canInteract);
      const key = { commentId_accountId: { commentId, accountId: actor.id } };
      const existing = await db.commentFavorite.findUnique({ where: key });
      if (Boolean(existing) !== selected) {
        await touchCircle(db, post.circleId);
        if (selected) await db.commentFavorite.create({ data: { commentId, accountId: actor.id } });
        else await db.commentFavorite.delete({ where: key });
      }
      return { isFavorited: selected };
    });
  }
  static commentFavorites(operator, query = {}) {
    return read(async (db) => {
      const actor = await actorFor(operator, db), page = pageOptions(query), where = { accountId: actor.id };
      const total = await db.commentFavorite.count({ where });
      const rows = await db.commentFavorite.findMany({ where, include: { comment: { include: { post: { include: { circle: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { commentId: 'desc' }], skip: page.skip, take: page.limit });
      return pageResult(rows.map(({ comment, createdAt }) => {
        const post = comment.post;
        const hidden = post.circle.status !== 'ACTIVE' ? '圈子已归档' : post.status !== 'ACTIVE' ? '帖子已删除' : comment.status !== 'ACTIVE' ? '评论已删除' : null;
        return { id: comment.id, postId: post.id, circle: circleDTO(post.circle), createdAt, deletedAt: comment.deletedAt, status: comment.status,
          unavailableReason: hidden, title: hidden ? null : post.title, excerpt: hidden ? null : summary(comment.body, comment.bodyFormat), commentCount: null };
      }), total, page);
    });
  }
  static follow(operator, circleId, selected) {
    return write(async (db) => {
      const actor = await actorFor(operator, db), access = await getForumAccess(operator, circleId, db);
      if (!access.circleId) throw new ForumError(404, '圈子不存在');
      if (selected) allowed(access.canParticipate);
      const key = { circleId_accountId: { circleId, accountId: actor.id } };
      const existing = await db.circleFollow.findUnique({ where: key });
      if (Boolean(existing) !== selected) {
        await touchCircle(db, circleId);
        if (selected) await db.circleFollow.create({ data: { circleId, accountId: actor.id } });
        else await db.circleFollow.delete({ where: key });
      }
      return { isFollowing: selected };
    });
  }
  static favorites(operator, query = {}) {
    return read(async (db) => {
      const actor = await actorFor(operator, db), page = pageOptions(query), where = { accountId: actor.id };
      const total = await db.postFavorite.count({ where });
      const rows = await db.postFavorite.findMany({ where, include: { post: { include: { circle: true, _count: { select: { comments: { where: { status: 'ACTIVE' } } } } } } },
        orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }], skip: page.skip, take: page.limit });
      return pageResult(rows.map(({ post, createdAt }) => {
        const hidden = post.circle.status !== 'ACTIVE' ? '圈子已归档' : post.status !== 'ACTIVE' ? '帖子已删除' : null;
        return { id: post.id, postId: post.id, circle: circleDTO(post.circle), createdAt, deletedAt: post.deletedAt, status: post.status,
          unavailableReason: hidden, title: hidden ? null : post.title, excerpt: hidden ? null : summary(post.body, post.bodyFormat), commentCount: hidden ? null : post._count.comments };
      }), total, page);
    });
  }
  static circles(operator, query = {}) {
    return read(async (db) => {
      const actor = await actorFor(operator, db), page = pageOptions(query);
      const where = { OR: [{ follows: { some: { accountId: actor.id } } }, { roles: { some: { accountId: actor.id } } }] };
      const total = await db.circle.count({ where });
      const rows = await db.circle.findMany({ where, include: { follows: { where: { accountId: actor.id }, select: { accountId: true } }, roles: { where: { accountId: actor.id }, select: { role: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.limit });
      return pageResult(rows.map((c) => ({ ...circleDTO(c), description: c.status === 'ACTIVE' ? c.description : null,
        isFollowing: Boolean(c.follows.length), circleRole: c.roles[0]?.role ?? null, canManage: buildForumAccess(actor, c).canViewManagement })), total, page);
    });
  }
}
