import { prepareMentions, sendMentions } from '../utils/forumMentions.js';
import prisma from '../utils/prismaClient.js';
import { normalizeForumBody, forumSummary, mentionIds } from '../utils/forumDocument.js';
import { bindForumImages } from '../utils/forumImageBinding.js';
import { rankHotPosts, chronologicalPosts } from '../utils/forumRanking.js';
import { getForumAccess, getContentPermissions } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';
import QueryUtils from '../utils/queryUtils.js';
import IDGenerator from '../utils/IDGenerator.js';
import { ForumError } from './CircleService.js';

const requirePermission = (allowed) => { if (!allowed) throw new ForumError(403, '没有此内容操作权限'); };
export const contentText = (value, label, limit) => {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > limit) throw new ForumError(400, `${label}不能为空，且最多 ${limit} 字`);
  return value.trim();
};
const pageOptions = (query) => {
  for (const key of ['page', 'limit']) {
    if (query[key] !== undefined && (!/^\d+$/.test(String(query[key])) || !Number.isSafeInteger(Number(query[key])) || Number(query[key]) < 1)) throw new ForumError(400, '分页参数不正确');
  }
  const result = QueryUtils.buildPaginationOptions(query.page, query.limit);
  if (!Number.isSafeInteger(result.skip)) throw new ForumError(400, '页码过大');
  return result;
};
const pageResult = (data, total, page) => ({ data, count: data.length, total, totalPages: Math.ceil(total / page.limit), currentPage: page.page });
const managementView = (query) => {
  if (query.view !== undefined && !['active', 'manage'].includes(query.view)) throw new ForumError(400, '无效的内容视图');
  return query.view === 'manage';
};
const postInclude = { author: { select: FORUM_AUTHOR_SELECT }, _count: { select: { comments: { where: { status: 'ACTIVE' } }, likes: true } } };
const personalPostInclude = (accountId) => ({ ...postInclude,
  likes: { where: { accountId }, select: { id: true } }, favorites: { where: { accountId }, select: { accountId: true } },
});
const commentInclude = { author: { select: FORUM_AUTHOR_SELECT } };
const personalCommentInclude = (accountId) => ({ ...commentInclude, favorites: { where: { accountId }, select: { accountId: true } } });
// Keyset order matches isPinned DESC, createdAt ASC, id ASC, including equal timestamps.
const commentBoundary = (row, before = false, inclusive = false) => {
  const direction = before ? 'lt' : 'gt';
  const sameGroup = { isPinned: row.isPinned, OR: [{ createdAt: { [direction]: row.createdAt } }, { createdAt: row.createdAt, id: { [inclusive ? `${direction}e` : direction]: row.id } }] };
  const otherGroup = before ? !row.isPinned : row.isPinned;
  return otherGroup ? { OR: [{ isPinned: !row.isPinned }, sameGroup] } : sameGroup;
};
const summary = forumSummary;
const circleDTO = (c) => ({ id: c.id, slug: c.slug, name: c.name, status: c.status });
const baseDTO = (row, access) => ({
  id: row.id, author: serializeForumAuthor(row.author), status: row.status,
  createdAt: row.createdAt, updatedAt: row.updatedAt, editedAt: row.editedAt,
  lastEditKind: row.lastEditKind, deletedAt: row.deletedAt, capabilities: getContentPermissions(access, row),
});
const postDTO = (row, access, full = false) => ({ ...baseDTO(row, access), circle: circleDTO(row.circle),
  title: row.title, bodyFormat: row.bodyFormat, ...(full ? { body: row.body } : { excerpt: summary(row.body, row.bodyFormat) }),
  commentCount: row._count.comments, lastActivityAt: row.lastActivityAt,
  likeCount: row._count.likes, isLiked: Boolean(row.likes?.length), isFavorited: Boolean(row.favorites?.length),
  isPinned: row.isPinned, pinnedAt: row.pinnedAt, isFeatured: row.isFeatured, featuredAt: row.featuredAt,
});
const commentDTO = (row, access) => ({ ...baseDTO(row, access), postId: row.postId, circleId: row.post.circleId, body: row.body, bodyFormat: row.bodyFormat, isPinned: row.isPinned, pinnedAt: row.pinnedAt, isFavorited: Boolean(row.favorites?.length) });
const actorFor = async (operator, db) => {
  const account = operator?.accountId && await db.account.findUnique({ where: { id: operator.accountId }, select: { id: true, name: true, role: true, isActive: true } });
  if (!account?.isActive) throw new ForumError(401, '请先登录');
  return account;
};
const read = (work) => prisma.$transaction(work, { isolationLevel: 'RepeatableRead' });
const write = async (work) => {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable' }); }
    catch (error) {
      if (error.code === 'P2034' && attempt < 4) continue;
      if (['P2034', 'P2025', 'P2003'].includes(error.code)) throw new ForumError(409, '内容或权限已变化，请刷新后重试');
      throw error;
    }
  }
};
const readAllowed = (access, row, management) => {
  if (management) { requirePermission(getContentPermissions(access, row).canManageRead); return; }
  if (access.circleStatus !== 'ACTIVE') throw new ForumError(410, '圈子已归档');
  if (!getContentPermissions(access, row).canRead) throw new ForumError(410, '内容已删除');
};
const context = async (db, operator, id, comment = false) => {
  const actor = await actorFor(operator, db);
  const row = await db[comment ? 'postComment' : 'post'].findUnique({ where: { id }, include: comment
    ? { ...personalCommentInclude(actor.id), post: { include: { circle: true } } }
    : { ...personalPostInclude(actor.id), circle: true } });
  if (!row) throw new ForumError(404, '内容不存在');
  const circle = comment ? row.post.circle : row.circle;
  const access = await getForumAccess(operator, circle.id, db);
  return { actor, row, access, circle, post: comment ? row.post : row };
};
const touchCircle = (db, circleId) => db.circle.update({ where: { id: circleId }, data: { updatedAt: new Date() } });
const notify = async (db, actor, recipientId, eventKey, type, post, targetId, comment = false) => {
  if (!recipientId || recipientId === actor.id) return;
  await db.notification.create({ data: { recipientId, actorId: actor.id, eventKey, type,
    targetType: comment ? 'PostComment' : 'Post', targetId, postId: post.id, circleId: post.circleId } });
};
const moderation = async (db, actor, row, post, action, details, comment) => {
  const identity = { id: actor.id, name: actor.name, role: actor.role };
  const audit = await db.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(),
    targetType: comment ? 'PostComment' : 'Post', targetId: row.id,
    action: `${comment ? 'comment' : 'post'}_moderation_${action}`, actionDetails: details,
    operator: identity, submitter: identity } });
  await notify(db, actor, row.authorId, audit.id, { edit: 'CONTENT_EDITED', delete: 'CONTENT_DELETED', restore: 'CONTENT_RESTORED' }[action], post, row.id, comment);
};
const recalculateActivity = async (db, post) => {
  const latest = await db.postComment.aggregate({ where: { postId: post.id, status: 'ACTIVE' }, _max: { createdAt: true } });
  await db.post.update({ where: { id: post.id }, data: { lastActivityAt: latest._max.createdAt && latest._max.createdAt > post.createdAt ? latest._max.createdAt : post.createdAt } });
};

export default class PostService {
  static list(operator, slug, query = {}) {
    return read(async (db) => {
      await actorFor(operator, db);
      const circle = await db.circle.findUnique({ where: { slug } });
      if (!circle) throw new ForumError(404, '圈子不存在');
      const access = await getForumAccess(operator, circle.id, db);
      const management = managementView(query);
      if (management) requirePermission(access.canViewManagement);
      else if (!access.canRead) throw new ForumError(410, '圈子已归档');
      const sort = query.sort ?? (management ? 'new' : 'hot');
      if (!['hot', 'activity', 'new'].includes(sort)) throw new ForumError(400, '无效的排序方式');
      if (query.featured !== undefined && !['true', 'false'].includes(query.featured)) throw new ForumError(400, '无效的精华筛选');
      const featuredOnly = query.featured === 'true';
      const page = pageOptions(query), now = new Date();
      const where = { circleId: circle.id, ...(management ? {} : { status: 'ACTIVE' }), ...(featuredOnly ? { isFeatured: true } : {}) };
      const include = personalPostInclude(access.accountId);
      let rows, total;
      if (sort === 'hot') {
        const ranked = await rankHotPosts(db, where, now);
        total = ranked.length;
        const ids = ranked.slice(page.skip, page.skip + page.limit).map((p) => p.id);
        const found = ids.length ? await db.post.findMany({ where: { id: { in: ids } }, include }) : [];
        const byId = new Map(found.map((p) => [p.id, p]));
        rows = ids.map((id) => byId.get(id));
      } else ({ rows, total } = await chronologicalPosts(db, where, page, sort, include));
      return { ...pageResult(rows.map((p) => postDTO({ ...p, circle }, access)), total, page), sort, featuredOnly };

    });
  }
  static get(operator, id, query = {}) {
    return read(async (db) => {
      const { row, access } = await context(db, operator, id);
      readAllowed(access, row, managementView(query));
      return postDTO(row, access, true);
    });
  }
  static create(operator, slug, input = {}) {
    return write(async (db) => {
      const actor = await actorFor(operator, db);
      const circle = await db.circle.findUnique({ where: { slug } });
      if (!circle) throw new ForumError(404, '圈子不存在');
      const access = await getForumAccess(operator, circle.id, db);
      requirePermission(access.canParticipate);
      const title = contentText(input.title, '标题', 100);
      let { body, bodyFormat, imageIds } = normalizeForumBody(input.body, input.bodyFormat, 5000);
      body = await prepareMentions(db, body, bodyFormat, 5000);
      await touchCircle(db, circle.id);
      const now = new Date();
      const row = await db.post.create({ data: { circleId: circle.id, authorId: actor.id, title, body, bodyFormat, createdAt: now, lastActivityAt: now }, include: postInclude });
      await bindForumImages(db, imageIds, actor.id, circle.id, row.id);
      await sendMentions(db, actor, row, row.id, body, bodyFormat);
      return postDTO({ ...row, circle }, access, true);
    });
  }
  static edit(operator, id, input = {}, comment = false) {
    return write(async (db) => {
      const { actor, row, access, circle, post } = await context(db, operator, id, comment);
      requirePermission(getContentPermissions(access, row).canEdit);
      let { body, bodyFormat, imageIds } = normalizeForumBody(input.body, input.bodyFormat ?? row.bodyFormat, comment ? 1000 : 5000);
      body = await prepareMentions(db, body, bodyFormat, comment ? 1000 : 5000, row);
      const data = { body, bodyFormat,
        ...(!comment ? { title: contentText(input.title, '标题', 100) } : {}) };
      if (input.updatedAt !== undefined && input.updatedAt !== row.updatedAt.toISOString()) throw new ForumError(409, '内容已被修改，请刷新后再编辑');
      if (Object.entries(data).every(([key, value]) => row[key] === value)) return { id: row.id };
      await touchCircle(db, circle.id);
      await bindForumImages(db, imageIds, actor.id, circle.id, id, comment);
      const adminEdit = actor.id !== row.authorId;
      await db[comment ? 'postComment' : 'post'].update({ where: { id }, data: { ...data, editedAt: new Date(), lastEditKind: adminEdit ? 'ADMIN' : 'AUTHOR' } });
      if (!adminEdit) await sendMentions(db, actor, post, row.id, body, bodyFormat, comment, mentionIds(row.body, row.bodyFormat));
      if (adminEdit) await moderation(db, actor, row, post, 'edit', { before: { body: row.body, bodyFormat: row.bodyFormat, ...(!comment ? { title: row.title } : {}) }, after: data }, comment);
      return { id: row.id };
    });
  }
  static setDeleted(operator, id, deleted, comment = false) {
    return write(async (db) => {
      const { actor, row, access, circle, post } = await context(db, operator, id, comment);
      requirePermission(access.canParticipate && (!comment || post.status === 'ACTIVE'));
      requirePermission(deleted ? actor.id === row.authorId || access.canModerate : access.canModerate);
      const status = deleted ? 'DELETED' : 'ACTIVE';
      if (row.status === status) return { id, status };
      await touchCircle(db, circle.id);
      await db[comment ? 'postComment' : 'post'].update({ where: { id }, data: { status, deletedAt: deleted ? new Date() : null } });
      if (deleted) await db.notification.deleteMany({ where: { type: { in: ['POST_COMMENT', 'MENTION'] }, ...(comment ? { targetId: id, targetType: 'PostComment' } : { postId: id }) } });
      if (comment) await recalculateActivity(db, post);
      if (actor.id !== row.authorId || !deleted) await moderation(db, actor, row, post, deleted ? 'delete' : 'restore', {}, comment);
      return { id, status };
    });
  }
  static addComment(operator, id, input = {}) {
    return write(async (db) => {
      const { actor, row: post, access } = await context(db, operator, id);
      requirePermission(getContentPermissions(access, post).canInteract);
      let { body, bodyFormat, imageIds } = normalizeForumBody(input.body, input.bodyFormat, 1000);
      body = await prepareMentions(db, body, bodyFormat, 1000);
      await touchCircle(db, post.circleId);
      const row = await db.postComment.create({ data: { postId: id, authorId: actor.id, body, bodyFormat }, include: commentInclude });
      await bindForumImages(db, imageIds, actor.id, post.circleId, row.id, true);
      await recalculateActivity(db, post);
      await sendMentions(db, actor, post, row.id, body, bodyFormat, true);
      if (!mentionIds(body, bodyFormat).includes(post.authorId)) await notify(db, actor, post.authorId, row.id, 'POST_COMMENT', post, row.id, true);
      return commentDTO({ ...row, post }, access);
    });
  }
  static comments(operator, id, query = {}) {
    return read(async (db) => {
      const { row: post, access } = await context(db, operator, id);
      const management = managementView(query);
      readAllowed(access, post, management);
      const page = pageOptions(query);
      const where = { postId: id, ...(management ? {} : { status: 'ACTIVE' }) };
      const total = await db.postComment.count({ where });
      if (query.cursor && query.commentId) throw new ForumError(400, '不能同时指定游标和定位评论');
      const targetId = query.commentId || query.cursor;
      let boundary = null, before = 0;
      if (targetId !== undefined) {
        if (typeof targetId !== 'string' || !targetId) throw new ForumError(400, '评论定位参数不正确');
        boundary = await db.postComment.findFirst({ where: { id: targetId, postId: id, ...(query.commentId ? (management ? {} : { status: 'ACTIVE' }) : {}) } });
        if (!boundary) throw new ForumError(410, '评论已删除或不存在');
        before = await db.postComment.count({ where: { ...where, ...commentBoundary(boundary, true) } });
      }
      const seek = boundary ? commentBoundary(boundary, false, Boolean(query.commentId)) : {};
      const rows = await db.postComment.findMany({ where: { ...where, ...seek }, include: personalCommentInclude(access.accountId),
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }], take: page.limit + 1 });
      const data = rows.slice(0, page.limit).map((c) => commentDTO({ ...c, post }, access));
      return { ...pageResult(data, total, { ...page, page: Math.floor(before / page.limit) + 1 }),
        nextCursor: rows.length > page.limit ? data.at(-1).id : null, locatedCommentId: query.commentId || null, hasEarlier: Boolean(boundary && (before > 0 || query.cursor)) };
    });
  }
  static mine(operator, comment = false, query = {}) {
    return read(async (db) => {
      const actor = await actorFor(operator, db);
      const page = pageOptions(query), model = comment ? 'postComment' : 'post';
      const where = { authorId: actor.id };
      const total = await db[model].count({ where });
      const parentInclude = { ...postInclude, circle: true };
      const rows = await db[model].findMany({ where, include: comment ? { ...commentInclude, post: { include: parentInclude } } : parentInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.limit });
      return pageResult(rows.map((row) => {
        const post = comment ? row.post : row, circle = post.circle;
        const hidden = circle.status !== 'ACTIVE' ? '圈子已归档' : post.status !== 'ACTIVE' ? '帖子已删除' : row.status !== 'ACTIVE' ? '评论已删除' : null;
        return { id: row.id, postId: post.id, circle: circleDTO(circle), createdAt: row.createdAt, deletedAt: row.deletedAt, status: row.status,
          unavailableReason: hidden, title: hidden ? null : post.title, excerpt: hidden ? null : summary(row.body, row.bodyFormat), commentCount: hidden ? null : post._count.comments };
      }), total, page);
    });
  }
}

// Shared content state/transaction helpers for forum interactions.
export { actorFor, read, write, context, touchCircle, notify, pageOptions, pageResult, summary, circleDTO };
