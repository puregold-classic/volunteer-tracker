import { actorFor, read, summary } from './PostService.js';
import { buildForumAccess } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';

const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];

const commentNode = (comment, post, inheritedReason, accountId) => {
  const unavailableReason = inheritedReason || (comment.status !== 'ACTIVE' ? '评论已删除' : null);
  const excerpt = unavailableReason ? null : summary(comment.body, comment.bodyFormat);
  return {
    id: comment.id, postId: post.id, circleId: post.circleId,
    label: unavailableReason ? '评论不可用' : excerpt || '图片评论',
    mine: comment.authorId === accountId, saved: comment.favorites.length > 0,
    status: comment.status, unavailableReason, createdAt: comment.createdAt,
    excerpt, body: unavailableReason ? null : comment.body,
    bodyFormat: unavailableReason ? null : comment.bodyFormat,
    author: unavailableReason ? null : serializeForumAuthor(comment.author),
    isPinned: !unavailableReason && comment.isPinned,
  };
};

const postNode = (post, inheritedReason, accountId) => {
  const unavailableReason = inheritedReason || (post.status !== 'ACTIVE' ? '帖子已删除' : null);
  return {
    id: post.id, circleId: post.circleId,
    label: unavailableReason ? '帖子不可用' : post.title,
    mine: post.authorId === accountId, saved: post.favorites.length > 0,
    status: post.status, unavailableReason, createdAt: post.createdAt,
    title: unavailableReason ? null : post.title,
    excerpt: unavailableReason ? null : summary(post.body, post.bodyFormat),
    author: unavailableReason ? null : serializeForumAuthor(post.author),
    commentCount: unavailableReason ? null : post._count.comments,
    comments: post.comments.map(comment => commentNode(comment, post, unavailableReason, accountId)),
  };
};

export default class ForumDirectoryService {
  static get(operator) {
    return read(async db => {
      const actor = await actorFor(operator, db);
      const favorites = { where: { accountId: actor.id }, select: { accountId: true } };
      const commentWhere = { OR: [{ authorId: actor.id }, { favorites: { some: { accountId: actor.id } } }] };
      const postWhere = { OR: [
        { authorId: actor.id }, { favorites: { some: { accountId: actor.id } } },
        { comments: { some: commentWhere } },
      ] };
      // Only direct personal relations select children. An owned/followed circle
      // never imports its other posts; an owned/saved post never imports replies.
      // The ancestor query uses the same predicates, so paths are complete and
      // records satisfying more than one relation still appear exactly once.
      const circles = await db.circle.findMany({
        where: { OR: [
          { roles: { some: { accountId: actor.id, role: { in: ['OWNER', 'STEWARD'] } } } },
          { follows: { some: { accountId: actor.id } } },
          { posts: { some: postWhere } },
        ] },
        orderBy,
        include: {
          roles: { where: { accountId: actor.id }, select: { role: true } },
          follows: { where: { accountId: actor.id }, select: { accountId: true } },
          assets: { where: { kind: 'COVER', deletedAt: null }, select: { id: true }, take: 1 },
          posts: {
            where: postWhere, orderBy,
            include: {
              author: { select: FORUM_AUTHOR_SELECT }, favorites,
              _count: { select: { comments: { where: { status: 'ACTIVE' } } } },
              comments: { where: commentWhere, orderBy, include: { author: { select: FORUM_AUTHOR_SELECT }, favorites } },
            },
          },
        },
      });
      return { circles: circles.map(circle => {
        const unavailableReason = circle.status !== 'ACTIVE' ? '圈子已归档' : null;
        const access = buildForumAccess(actor, circle);
        return {
          id: circle.id, label: unavailableReason ? '已归档圈子' : circle.name,
          mine: ['OWNER', 'STEWARD'].includes(access.circleRole), saved: circle.follows.length > 0,
          status: circle.status, unavailableReason, createdAt: circle.createdAt,
          name: unavailableReason ? null : circle.name,
          slug: unavailableReason ? null : circle.slug,
          managementSlug: access.canViewManagement ? circle.slug : null,
          description: unavailableReason ? null : circle.description,
          coverId: unavailableReason ? null : circle.assets[0]?.id ?? null,
          circleRole: access.circleRole, canManage: access.canViewManagement,
          posts: circle.posts.map(post => postNode(post, unavailableReason, actor.id)),
        };
      }) };
    });
  }
}
