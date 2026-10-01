import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';

// The deployed sandbox uses NODE_ENV=production and never enables this flag.
export const devAccountSwitchEnabled = () => process.env.NODE_ENV === 'development' && process.env.DEV_ACCOUNT_SWITCHER === 'true';
export class DevAccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const requireEnabled = () => { if (!devAccountSwitchEnabled()) throw new DevAccountError(404, '功能不存在'); };
export const validateDevLogin = (payload) => {
  requireEnabled();
  if (!Number.isFinite(payload.devIssuedAtMs)) throw new DevAccountError(401, '开发登录凭证无效');
};
export const listDevAccounts = async (search = '') => {
  requireEnabled();
  if (typeof search !== 'string' || search.length > 100) throw new DevAccountError(400, '搜索内容过长');
  const query = search.trim();
  const rows = await prisma.account.findMany({
    where: { isActive: true, ...(query ? { OR: [
      { name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } },
      { volunteer: { chineseName: { contains: query, mode: 'insensitive' } } },
      { volunteer: { volunteerCode: { contains: query, mode: 'insensitive' } } },
    ] } : {}) },
    select: { id: true, name: true, email: true, role: true,
      volunteer: { select: { chineseName: true, volunteerCode: true } },
      circleRoles: { select: { role: true, circle: { select: { name: true } } }, take: 4 },
    }, orderBy: [{ role: 'asc' }, { name: 'asc' }, { id: 'asc' }], take: 50,
  });
  return rows.map((a) => ({ id: a.id, name: a.volunteer?.chineseName || a.name, email: a.email, role: a.role,
    volunteerCode: a.volunteer?.volunteerCode || null,
    circles: a.circleRoles.map((r) => `${r.circle.name} · ${r.role === 'OWNER' ? '圈主' : '协管员'}`) }));
};
export const switchDevAccount = async (accountId) => {
  requireEnabled();
  if (typeof accountId !== 'string' || !accountId) throw new DevAccountError(400, '请选择账号');
  const target = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, isActive: true } });
  if (!target?.isActive) throw new DevAccountError(404, '账号已删除或停用，请刷新列表');
  // Dev tokens carry their own marker and are rejected outside local development.
  const loginToken = jwt.sign({ sub: target.id, devAccountSwitch: true, devIssuedAtMs: Date.now() }, process.env.JWT_SECRET,
  { expiresIn: '1h' });
  return { token: loginToken };
};
