import { it, expect } from 'vitest';
import PostService from '../src/services/PostService.js';
import CircleService from '../src/services/CircleService.js';
import ForumInteractionService from '../src/services/ForumInteractionService.js';
import { rankHotPosts, hotScore } from '../src/utils/forumRanking.js';
import { deleteAccount } from '../src/services/AccountService.js';
export function registerInteractionTests({ db, user, circle, getAdmin }) {
  const op = (a) => ({ accountId: a.id });
  const create = (a, c) => PostService.create(op(a), c.slug, { title: '互动测试', body: '私有正文' });
  it('interactions: concurrent repeated likes/favorites are idempotent and do not move activity or notify', async () => {
    const c = await circle(), a = await user(), p = await create(a, c), visitor = await user('b_admin');
    await Promise.all([1, 2, 3].map(() => ForumInteractionService.engage(op(visitor), p.id, 'like', true)));
    await Promise.all([1, 2].map(() => ForumInteractionService.engage(op(visitor), p.id, 'favorite', true)));
    expect(await db.postLike.count({ where: { postId: p.id } })).toBe(1);
    expect(await db.postFavorite.count({ where: { postId: p.id } })).toBe(1);
    expect(await db.notification.count({ where: { postId: p.id } })).toBe(0);
    expect((await PostService.get(op(visitor), p.id))).toMatchObject({ isLiked: true, isFavorited: true, likeCount: 1, lastActivityAt: p.lastActivityAt });
    const authorView = await PostService.get(op(a), p.id);
    expect(authorView).toMatchObject({ isLiked: false, isFavorited: false, likeCount: 1 });
    expect(authorView).not.toHaveProperty('favorites');
    expect(authorView).not.toHaveProperty('favoriteCount');
    await ForumInteractionService.engage(op(visitor), p.id, 'like', false);
    await ForumInteractionService.engage(op(visitor), p.id, 'like', false);
    expect((await PostService.get(op(a), p.id)).likeCount).toBe(0);
    expect((await ForumInteractionService.favorites(op(a))).total).toBe(0);
    expect((await ForumInteractionService.favorites(op(visitor))).total).toBe(1);
  });
  it('interactions: hidden bookmarks redact content and remain removable; archived content rejects interactions', async () => {
    const c = await circle(), a = await user(), p = await create(a, c), other = await create(a, c);
    await ForumInteractionService.engage(op(a), p.id, 'favorite', true);
    await ForumInteractionService.engage(op(a), other.id, 'favorite', true);
    await PostService.setDeleted(op(a), p.id, true);
    const hidden = (await ForumInteractionService.favorites(op(a))).data.find((row) => row.postId === p.id);
    expect(hidden).toMatchObject({ title: null, excerpt: null, unavailableReason: '帖子已删除' });
    await expect(ForumInteractionService.engage(op(a), p.id, 'like', true)).rejects.toMatchObject({ status: 403 });
    await expect(ForumInteractionService.engage(op(a), p.id, 'favorite', true)).rejects.toMatchObject({ status: 403 });
    await ForumInteractionService.engage(op(a), p.id, 'favorite', false);
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    expect((await ForumInteractionService.favorites(op(a))).data[0]).toMatchObject({ title: null, excerpt: null, unavailableReason: '圈子已归档' });
    for (const kind of ['like', 'favorite']) await expect(ForumInteractionService.engage(op(getAdmin()), other.id, kind, true)).rejects.toMatchObject({ status: 403 });
    await ForumInteractionService.engage(op(a), other.id, 'favorite', false);
    expect((await ForumInteractionService.favorites(op(a))).total).toBe(0);
  });
  it('interactions: following is separate from circle roles and can be cleaned after archival', async () => {
    const c = await circle(), a = await user('a_admin');
    await Promise.all([1, 2].map(() => ForumInteractionService.follow(op(a), c.id, true)));
    expect(await db.circleFollow.count({ where: { circleId: c.id, accountId: a.id } })).toBe(1);
    expect((await CircleService.get(op(a), c.slug))).toMatchObject({ isFollowing: true, capabilities: { canViewManagement: false } });
    await CircleService.setRole(op(getAdmin()), c.id, a.id, 'STEWARD');
    expect((await ForumInteractionService.circles(op(a))).data[0]).toMatchObject({ isFollowing: true, circleRole: 'STEWARD', canManage: true });
    await ForumInteractionService.follow(op(a), c.id, false);
    expect((await ForumInteractionService.circles(op(a))).data[0]).toMatchObject({ isFollowing: false, circleRole: 'STEWARD' });
    await ForumInteractionService.follow(op(a), c.id, true);
    await CircleService.setRole(op(getAdmin()), c.id, a.id, 'STEWARD', true);
    expect((await ForumInteractionService.circles(op(a))).data[0]).toMatchObject({ isFollowing: true, circleRole: null, canManage: false });
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    expect((await ForumInteractionService.circles(op(a))).data[0]).toMatchObject({ status: 'ARCHIVED', description: null });
    await expect(ForumInteractionService.follow(op(a), c.id, true)).rejects.toMatchObject({ status: 403 });
    await ForumInteractionService.follow(op(a), c.id, false);
    expect((await ForumInteractionService.circles(op(a))).total).toBe(0);
  });
  it('interactions: pin/feature enforce circle scope, audit actual changes and preserve timestamp on repeat', async () => {
    const c = await circle(), other = await circle(), author = await user(), staff = await user('b_admin');
    const p = await create(author, c), foreign = await create(author, other);
    await CircleService.setRole(op(getAdmin()), c.id, staff.id, 'STEWARD');
    await expect(ForumInteractionService.mark(op(author), p.id, 'pin', true)).rejects.toMatchObject({ status: 403 });
    await expect(ForumInteractionService.mark(op(staff), foreign.id, 'feature', true)).rejects.toMatchObject({ status: 403 });
    const first = await ForumInteractionService.mark(op(staff), p.id, 'pin', true);
    expect(await ForumInteractionService.mark(op(staff), p.id, 'pin', true)).toEqual(first);
    await Promise.all([1, 2].map(() => ForumInteractionService.mark(op(staff), p.id, 'feature', true)));
    expect(await db.auditLog.count({ where: { targetId: p.id, action: 'post_pin' } })).toBe(1);
    expect(await db.auditLog.count({ where: { targetId: p.id, action: 'post_feature' } })).toBe(1);
    expect(await db.notification.count({ where: { postId: p.id } })).toBe(2);
    expect((await PostService.get(op(author), p.id)).lastActivityAt).toEqual(p.lastActivityAt);
    await ForumInteractionService.mark(op(staff), p.id, 'pin', false);
    await ForumInteractionService.mark(op(staff), p.id, 'feature', false);
    expect((await PostService.get(op(author), p.id))).toMatchObject({ isPinned: false, pinnedAt: null, isFeatured: false, featuredAt: null });
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    await expect(ForumInteractionService.mark(op(getAdmin()), p.id, 'pin', true)).rejects.toMatchObject({ status: 403 });
  });
  it('ranking: pins precede every sort with stable pagination; featured filter and reply time are independent', async () => {
    const c = await circle(), a = await user();
    const [old, fresh, pinned] = await Promise.all([create(a, c), create(a, c), create(a, c)]);
    const date = new Date('2025-01-01T00:00:00Z');
    await db.post.update({ where: { id: old.id }, data: { createdAt: date, lastActivityAt: new Date('2026-09-19T00:00:00Z') } });
    await db.post.update({ where: { id: fresh.id }, data: { createdAt: new Date('2026-09-18T00:00:00Z'), lastActivityAt: new Date('2026-09-18T00:00:00Z') } });
    await db.post.update({ where: { id: pinned.id }, data: { createdAt: date, lastActivityAt: date } });
    await ForumInteractionService.mark(op(getAdmin()), pinned.id, 'pin', true);
    await ForumInteractionService.mark(op(getAdmin()), old.id, 'feature', true);
    for (const sort of ['hot', 'new', 'activity']) {
      expect((await PostService.list(op(a), c.slug, { sort, limit: '1' })).data[0].id).toBe(pinned.id);
      const ids = [];
      for (const page of ['1', '2', '3']) ids.push((await PostService.list(op(a), c.slug, { sort, limit: '1', page })).data[0].id);
      expect(new Set(ids).size).toBe(3);
    }
    expect((await PostService.list(op(a), c.slug, { sort: 'new' })).data.map((p) => p.id)).toEqual([pinned.id, fresh.id, old.id]);
    expect((await PostService.list(op(a), c.slug, { sort: 'activity' })).data.map((p) => p.id)).toEqual([pinned.id, old.id, fresh.id]);
    expect((await PostService.list(op(a), c.slug, { featured: 'true' })).data.map((p) => p.id)).toEqual([old.id]);
    await PostService.setDeleted(op(a), old.id, true);
    expect((await PostService.list(op(a), c.slug, { featured: 'true' })).total).toBe(0);
  });
  it('ranking: SQL aggregation excludes self/deleted authors and soft-deleted replies, counts distinct people and window boundaries', async () => {
    const c = await circle(), author = await user(), visitor = await user(), second = await user(), p = await create(author, c);
    const now = new Date('2026-09-19T12:00:00Z'), age = new Date('2020-01-01T00:00:00Z');
    const within = new Date('2026-09-18T12:00:00Z'), cutoff = new Date('2026-09-12T12:00:00Z');
    await db.post.update({ where: { id: p.id }, data: { createdAt: age } });
    await db.postLike.createMany({ data: [
      { postId: p.id, accountId: author.id, createdAt: within }, { postId: p.id, accountId: visitor.id, createdAt: within },
      { postId: p.id, accountId: null, createdAt: within }, { postId: p.id, accountId: second.id, createdAt: new Date(cutoff.getTime() - 1) },
    ] });
    await db.postComment.createMany({ data: [
      ...Array.from({ length: 10 }, () => ({ postId: p.id, authorId: visitor.id, body: '重复回帖', createdAt: within })),
      { postId: p.id, authorId: second.id, body: '边界回帖', createdAt: cutoff },
      { postId: p.id, authorId: author.id, body: '自己回帖', createdAt: within },
      { postId: p.id, authorId: null, body: '注销回帖', createdAt: within },
      { postId: p.id, authorId: getAdmin().id, body: '已删回帖', status: 'DELETED', createdAt: within },
    ] });
    let ranked = await rankHotPosts(db, { circleId: c.id, status: 'ACTIVE' }, now);
    expect(ranked[0].score).toBeCloseTo(hotScore({ createdAt: age, isFeatured: false }, { allLikes: 4, recentLikes: 1, recentCommenters: 2, firstRecentAt: cutoff }, now), 12);
    const afterBoundary = new Date(now.getTime() + 1);
    ranked = await rankHotPosts(db, { circleId: c.id, status: 'ACTIVE' }, afterBoundary);
    expect(ranked[0].score).toBeCloseTo(hotScore({ createdAt: age, isFeatured: false }, { allLikes: 4, recentLikes: 1, recentCommenters: 1, firstRecentAt: within }, afterBoundary), 12);
    await deleteAccount(visitor.id);
    ranked = await rankHotPosts(db, { circleId: c.id, status: 'ACTIVE' }, afterBoundary);
    expect(ranked[0].score).toBeCloseTo(hotScore({ createdAt: age, isFeatured: false }, { allLikes: 4, recentLikes: 0, recentCommenters: 0, firstRecentAt: null }, afterBoundary), 12);
    expect((await PostService.get(op(author), p.id)).likeCount).toBe(4);
  });
  it('interactions: archive racing an interaction preserves hidden reads and removable personal records', async () => {
    const c = await circle(), a = await user(), p = await create(a, c);
    await Promise.allSettled([ForumInteractionService.engage(op(a), p.id, 'favorite', true), CircleService.setArchived(op(getAdmin()), c.id, true)]);
    await expect(PostService.get(op(a), p.id)).rejects.toMatchObject({ status: 410 });
    const favorites = await ForumInteractionService.favorites(op(a));
    expect(favorites.data.every((row) => row.title === null && row.excerpt === null)).toBe(true);
    await ForumInteractionService.engage(op(a), p.id, 'favorite', false);
    expect((await ForumInteractionService.favorites(op(a))).total).toBe(0);
  });
}
