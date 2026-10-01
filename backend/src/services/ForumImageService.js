import sharp from 'sharp';
import { actorFor, read, write, touchCircle } from './PostService.js';
import { ForumError } from './CircleService.js';
import { getForumAccess, getContentPermissions } from '../utils/forumPermissions.js';
import { imageIds } from '../utils/forumDocument.js';
import { DRAFT_IMAGE_TTL } from '../utils/forumImageBinding.js';
export const IMAGE_LIMITS = Object.freeze({ source: 10 * 1024 * 1024, stored: 2 * 1024 * 1024, quota: 100 * 1024 * 1024, pixels: 40_000_000, edge: 1920 });
const metadata = { id: true, ownerId: true, circleId: true, postId: true, commentId: true, createdAt: true, size: true, width: true, height: true, mimeType: true };
export async function compressForumImage(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > IMAGE_LIMITS.source) throw new ForumError(400, '请选择不超过 10 MB 的图片');
  // Reject vector/unknown formats before handing input to the decoder.
  const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp = input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
  const gif = ['GIF87a', 'GIF89a'].includes(input.toString('ascii', 0, 6));
  if (!png && !jpeg && !webp && !gif) throw new ForumError(400, '仅支持 PNG、JPEG、WebP 或 GIF 图片');
  try {
    const { data, info } = await sharp(input, { limitInputPixels: IMAGE_LIMITS.pixels, failOn: 'warning', animated: false }).rotate()
      .resize({ width: IMAGE_LIMITS.edge, height: IMAGE_LIMITS.edge, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (data.length > IMAGE_LIMITS.stored) throw new Error('too large');
    return { data, size: data.length, width: info.width, height: info.height, mimeType: 'image/webp' };
  } catch { throw new ForumError(400, '图片无法处理，请换用较小或完整的图片'); }
}
export default class ForumImageService {
  static async upload(operator, circleId, input) {
    // Check permission before spending CPU on an upload, then recheck in the
    // transaction so an archive or revoked identity cannot race publication.
    const access = await getForumAccess(operator, circleId);
    if (!access.canParticipate) throw new ForumError(403, '当前圈子不可上传图片');
    const compressed = await compressForumImage(input);
    return write(async (db) => {
      const actor = await actorFor(operator, db), current = await getForumAccess(operator, circleId, db);
      if (!current.canParticipate) throw new ForumError(403, '当前圈子不可上传图片');
      await touchCircle(db, circleId);
      await db.account.update({ where: { id: actor.id }, data: { updatedAt: new Date() } });
      await db.forumImage.deleteMany({ where: { postId: null, commentId: null, createdAt: { lt: new Date(Date.now() - DRAFT_IMAGE_TTL) } } });
      const total = await db.forumImage.aggregate({ where: { ownerId: actor.id }, _sum: { size: true } });
      if ((total._sum.size || 0) + compressed.size > IMAGE_LIMITS.quota) throw new ForumError(400, '图片存储空间已满，请联系管理员');
      const row = await db.forumImage.create({ data: { ownerId: actor.id, circleId, ...compressed }, select: metadata });
      return { id: row.id, width: row.width, height: row.height, size: row.size };
    });
  }
  static get(operator, id, management = false) {
    return read(async (db) => {
      const actor = await actorFor(operator, db);
      const row = await db.forumImage.findUnique({ where: { id }, select: metadata });
      if (!row) throw new ForumError(404, '图片不存在');
      const access = await getForumAccess(operator, row.circleId, db);
      if (row.postId || row.commentId) {
        const content = row.commentId ? await db.postComment.findUnique({ where: { id: row.commentId }, include: { post: { select: { circleId: true, status: true } } } })
          : await db.post.findUnique({ where: { id: row.postId } });
        const permissions = getContentPermissions(access, content);
        if (!(management ? permissions.canManageRead : permissions.canRead)) throw new ForumError(403, '图片所在内容不可见');
        let ids = []; try { if (content.bodyFormat === 'RICH_TEXT') ids = imageIds(JSON.parse(content.body)); } catch { /* invalid stored body */ }
        if (!ids.includes(id)) throw new ForumError(404, '图片已从内容中移除');
      } else if (row.ownerId !== actor.id || !access.canParticipate || row.createdAt < new Date(Date.now() - DRAFT_IMAGE_TTL)) throw new ForumError(403, '图片不可用');
      return db.forumImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
    });
  }
}
