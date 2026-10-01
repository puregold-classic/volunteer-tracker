import { actorFor, read } from './PostService.js';
import { ForumError } from './CircleService.js';
import { getForumAccess } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';
export default class ForumMentionService {
  static candidates(operator, circleId, search = '') {
    if (typeof search !== 'string' || [...search].length > 100) throw new ForumError(400, '搜索内容过长');
    return read(async db => {
      const actor = await actorFor(operator, db);
      if (!(await getForumAccess(operator, circleId, db)).canParticipate) throw new ForumError(403, '当前圈子不可提及用户');
      const query = search.trim();
      const rows = await db.account.findMany({ where: { isActive: true, id: { not: actor.id }, ...(query ? { OR: [
        { name: { contains: query, mode: 'insensitive' } }, { volunteer: { chineseName: { contains: query, mode: 'insensitive' } } },
        { volunteer: { volunteerCode: { contains: query, mode: 'insensitive' } } },
      ] } : {}) }, select: { ...FORUM_AUTHOR_SELECT, volunteer: { select: { ...FORUM_AUTHOR_SELECT.volunteer.select, volunteerCode: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 10 });
      return rows.map(row => ({ ...serializeForumAuthor(row), volunteerCode: row.volunteer?.volunteerCode ?? null }));
    });
  }
}
