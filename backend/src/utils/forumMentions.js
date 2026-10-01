import { normalizeForumBody, mentionIds } from './forumDocument.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from './forumIdentity.js';
import { ForumError } from '../services/CircleService.js';

export async function prepareMentions(db, body, format, limit, previous) {
  const ids = mentionIds(body, format);
  if (!ids.length) return body;
  const rows = await db.account.findMany({ where: { id: { in: ids }, isActive: true }, select: FORUM_AUTHOR_SELECT });
  const names = new Map(rows.map(row => [row.id, serializeForumAuthor(row).name]));
  const retained = new Set(previous ? mentionIds(previous.body, previous.bodyFormat) : []);
  if (ids.some(id => !names.has(id) && !retained.has(id))) throw new ForumError(400, '被提及的账号已不可用，请重新选择');
  const doc = JSON.parse(body);
  const walk = node => { if (node.type === 'mention') node.attrs.label = names.get(node.attrs.accountId) || '已注销'; node.content?.forEach(walk); };
  walk(doc);
  return normalizeForumBody(JSON.stringify(doc), format, limit).body;
}

export async function sendMentions(db, actor, post, targetId, body, format, comment = false, previous = []) {
  const ids = mentionIds(body, format).filter(id => id !== actor.id && !previous.includes(id));
  if (!ids.length) return;
  const recipients = await db.account.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } });
  await db.notification.createMany({ data: recipients.map(({ id }) => ({ recipientId: id, actorId: actor.id,
    eventKey: `mention:${targetId}`, type: 'MENTION', targetType: comment ? 'PostComment' : 'Post', targetId,
    postId: post.id, circleId: post.circleId })), skipDuplicates: true });
}
