import { actorFor, read, write, touchCircle } from './PostService.js';
import { ForumError } from './CircleService.js';
import { compressForumImage } from './ForumImageService.js';
import { getForumAccess } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';
import IDGenerator from '../utils/IDGenerator.js';
export const CIRCLE_FILE_LIMIT = 20 * 1024 * 1024;
export const CIRCLE_STORAGE_LIMIT = 256 * 1024 * 1024;
export const FILE_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md', 'zip', '7z', 'rar', 'png', 'jpg', 'jpeg', 'webp', 'gif']);
const metadata = { id: true, circleId: true, kind: true, name: true, size: true, mimeType: true, createdAt: true, deletedAt: true, uploader: { select: FORUM_AUTHOR_SELECT } };
const dto = row => ({ id: row.id, circleId: row.circleId, name: row.name, size: row.size, createdAt: row.createdAt, deletedAt: row.deletedAt, uploader: serializeForumAuthor(row.uploader) });
export function fileName(value) {
  if (typeof value !== 'string') throw new ForumError(400, '请提供文件名');
  const name = value.normalize('NFC').trim();
  if (!name || [...name].length > 150 || /[\x00-\x1f\x7f/\\]/.test(name) || !FILE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase())) throw new ForumError(400, '请上传文档、表格、演示文稿、文本、压缩包或图片，文件名最多 150 字');
  return name;
}
const authorize = async (operator, circleId, db, management, writing = false) => {
  await actorFor(operator, db);
  const access = await getForumAccess(operator, circleId, db);
  if (!access.circleId) throw new ForumError(404, '圈子不存在');
  if (!(writing ? access.canManageAssets : management ? access.canViewManagement : access.canRead)) throw new ForumError(403, writing ? '仅本圈圈务人员可管理封面和圈文件，归档后只读' : '当前圈子文件不可见');
  return access;
};
const audit = (db, actor, circleId, operation, asset) => db.auditLog.create({ data: {
  auditId: IDGenerator.generateAuditId(), targetType: 'Circle', targetId: circleId, action: 'circle_update',
  operator: { id: actor.id, name: actor.name, role: actor.role }, submitter: { id: actor.id, name: actor.name, role: actor.role },
  actionDetails: { operation, assetId: asset.id, name: asset.name, size: asset.size },
} });
export default class CircleAssetService {
  static async upload(operator, circleId, input, name, cover = false) {
    await read(db => authorize(operator, circleId, db, true, true));
    const normalizedName = cover ? '圈子封面.webp' : fileName(name);
    if (!Buffer.isBuffer(input) || !input.length || input.length > (cover ? 10 : 20) * 1024 * 1024) throw new ForumError(400, cover ? '封面图片不能超过 10 MB' : '文件不能为空且不能超过 20 MB');
    const file = cover ? await compressForumImage(input) : { data: input, size: input.length, mimeType: 'application/octet-stream' };
    return write(async db => {
      await authorize(operator, circleId, db, true, true); const actor = await actorFor(operator, db);
      await touchCircle(db, circleId);
      const usage = await db.circleAsset.aggregate({ where: { circleId }, _sum: { size: true } });
      if ((usage._sum.size || 0) + file.size > CIRCLE_STORAGE_LIMIT) throw new ForumError(400, '圈子存储空间已满，请联系系统管理员');
      if (cover) await db.circleAsset.updateMany({ where: { circleId, kind: 'COVER', deletedAt: null }, data: { deletedAt: new Date() } });
      const row = await db.circleAsset.create({ data: { circleId, uploaderId: actor.id, kind: cover ? 'COVER' : 'FILE', name: normalizedName, data: file.data, size: file.size, mimeType: file.mimeType }, select: metadata });
      await audit(db, actor, circleId, cover ? 'cover_upload' : 'file_upload', row);
      return dto(row);
    });
  }
  static list(operator, circleId, { view, page = '1' } = {}) {
    if (view !== undefined && !['active', 'manage'].includes(view)) throw new ForumError(400, '无效的文件视图');
    if (!/^\d+$/.test(String(page)) || !Number.isSafeInteger(Number(page)) || Number(page) < 1 || Number(page) > 100000) throw new ForumError(400, '页码不正确');
    return read(async db => {
      const management = view === 'manage'; await authorize(operator, circleId, db, management);
      const where = { circleId, kind: 'FILE', ...(!management ? { deletedAt: null } : {}) };
      const total = await db.circleAsset.count({ where });
      const rows = await db.circleAsset.findMany({ where, select: metadata, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (Number(page) - 1) * 20, take: 20 });
      return { data: rows.map(dto), total, totalPages: Math.ceil(total / 20), currentPage: Number(page) };
    });
  }
  static get(operator, id, management = false) {
    return read(async db => {
      await actorFor(operator, db);
      const row = await db.circleAsset.findUnique({ where: { id }, select: metadata });
      if (!row) throw new ForumError(404, '文件不存在');
      await authorize(operator, row.circleId, db, management);
      if (row.deletedAt && (row.kind === 'COVER' || !management)) throw new ForumError(404, '文件已移除');
      const file = await db.circleAsset.findUnique({ where: { id }, select: { data: true } });
      return { ...dto(row), kind: row.kind, mimeType: row.mimeType, data: file.data };
    });
  }
  static setDeleted(operator, id, deleted) {
    return write(async db => {
      await actorFor(operator, db);
      const row = await db.circleAsset.findUnique({ where: { id }, select: metadata });
      if (!row) throw new ForumError(404, '文件不存在');
      await authorize(operator, row.circleId, db, true, true); const actor = await actorFor(operator, db);
      if (row.kind === 'COVER' && !deleted) throw new ForumError(400, '请重新上传封面');
      if (Boolean(row.deletedAt) === deleted) return { id };
      await touchCircle(db, row.circleId);
      await db.circleAsset.update({ where: { id }, data: { deletedAt: deleted ? new Date() : null } });
      await audit(db, actor, row.circleId, deleted ? 'asset_remove' : 'file_restore', row);
      return { id };
    });
  }
}
