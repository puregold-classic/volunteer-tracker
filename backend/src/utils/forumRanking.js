export const HOT_CONFIG = Object.freeze({ windowDays: 7, offsetHours: 12, gravity: 1.2, commentWeight: 2, featuredMultiplier: 2 });
const hour = 3_600_000;
export const hotScore = (post, stats, now) => {
  const age = Math.max(0, (now - post.createdAt) / hour);
  const recentAge = stats.firstRecentAt ? Math.max(0, (now - stats.firstRecentAt) / hour) : 0;
  const historical = (1 + Math.log1p(stats.allLikes)) / (age + HOT_CONFIG.offsetHours) ** HOT_CONFIG.gravity;
  const recent = stats.firstRecentAt
    ? (stats.recentLikes + HOT_CONFIG.commentWeight * stats.recentCommenters) / (recentAge + HOT_CONFIG.offsetHours) ** HOT_CONFIG.gravity : 0;
  return (post.isFeatured ? HOT_CONFIG.featuredMultiplier : 1) * (historical + recent);
};
const idDesc = (a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
export const compareHot = (a, b) => {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.isPinned) return (b.pinnedAt?.getTime() || 0) - (a.pinnedAt?.getTime() || 0) || idDesc(a, b);
  return b.score - a.score || idDesc(a, b);
};

// Read only ranking fields for the entire circle. Bodies and avatars are loaded
// after pagination; SQL groups interactions without materializing every reply.
export async function rankHotPosts(db, where, now) {
  const posts = await db.post.findMany({ where, select: { id: true, authorId: true, createdAt: true, isPinned: true, pinnedAt: true, isFeatured: true } });
  if (!posts.length) return [];
  const recent = { gte: new Date(now.getTime() - HOT_CONFIG.windowDays * 24 * hour), lte: now };
  const [allLikes, likes, comments] = await Promise.all([
    db.postLike.groupBy({ by: ['postId'], where: { post: where }, _count: { id: true } }),
    db.postLike.groupBy({ by: ['postId', 'accountId'], where: { post: where, accountId: { not: null }, createdAt: recent }, _min: { createdAt: true } }),
    db.postComment.groupBy({ by: ['postId', 'authorId'], where: { post: where, status: 'ACTIVE', authorId: { not: null }, createdAt: recent }, _min: { createdAt: true } }),
  ]);
  const stats = new Map(posts.map((p) => [p.id, { authorId: p.authorId, allLikes: 0, recentLikes: 0, recentCommenters: 0, firstRecentAt: null }]));
  for (const group of allLikes) stats.get(group.postId).allLikes = group._count.id;
  for (const [groups, field, authorKey] of [[likes, 'recentLikes', 'accountId'], [comments, 'recentCommenters', 'authorId']]) {
    for (const group of groups) {
      const stat = stats.get(group.postId);
      if (group[authorKey] === stat.authorId) continue;
      stat[field] += 1;
      if (!stat.firstRecentAt || group._min.createdAt < stat.firstRecentAt) stat.firstRecentAt = group._min.createdAt;
    }
  }
  return posts.map((post) => ({ ...post, score: hotScore(post, stats.get(post.id), now) })).sort(compareHot);
}

export async function chronologicalPosts(db, where, page, sort, include) {
  const total = await db.post.count({ where });
  const pinnedCount = await db.post.count({ where: { ...where, isPinned: true } });
  const pinned = page.skip < pinnedCount ? await db.post.findMany({ where: { ...where, isPinned: true }, include,
    orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], skip: page.skip, take: page.limit }) : [];
  const normal = pinned.length < page.limit ? await db.post.findMany({ where: { ...where, isPinned: false }, include,
    orderBy: [{ [sort === 'activity' ? 'lastActivityAt' : 'createdAt']: 'desc' }, { id: 'desc' }],
    skip: Math.max(0, page.skip - pinnedCount), take: page.limit - pinned.length }) : [];
  return { total, rows: [...pinned, ...normal] };
}
