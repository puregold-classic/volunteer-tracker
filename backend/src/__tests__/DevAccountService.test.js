import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const { db } = vi.hoisted(() => ({ db: { account: { findUnique: vi.fn(), findMany: vi.fn() } } }));
vi.mock('../utils/prismaClient.js', () => ({ default: db }));
import { listDevAccounts, switchDevAccount, devAccountSwitchEnabled } from '../services/DevAccountService.js';
import { authenticate } from '../middleware/authenticate.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DEV_ACCOUNT_SWITCHER', 'true');
  vi.stubEnv('JWT_SECRET', 'development-switch-tests-only');
});
afterEach(() => vi.unstubAllEnvs());
const auth = async (token) => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
  await authenticate(req, res, next);
  return { req, res, next };
};
describe('development account switching boundaries', () => {
  it.each(['production', 'test', ''])('stays disabled for NODE_ENV=%s even when the flag is enabled', async (env) => {
    vi.stubEnv('NODE_ENV', env);
    expect(devAccountSwitchEnabled()).toBe(false);
    await expect(listDevAccounts()).rejects.toMatchObject({ status: 404 });
    await expect(switchDevAccount('any')).rejects.toMatchObject({ status: 404 });
    expect(db.account.findUnique).not.toHaveBeenCalled();
  });
  it('requires the explicit flag in development', async () => {
    vi.stubEnv('DEV_ACCOUNT_SWITCHER', 'false');
    await expect(listDevAccounts()).rejects.toMatchObject({ status: 404 });
  });
  it('lists active accounts with circle identities and excludes private credentials', async () => {
    db.account.findMany.mockResolvedValue([{ id: 'u', name: '账号名称', email: 'user@example.test', role: 'user', passwordHash: 'never-return', volunteer: { chineseName: '测试用户', volunteerCode: 'PG-0001' }, circleRoles: [{ role: 'STEWARD', circle: { name: '新人圈' } }] }]);
    const result = await listDevAccounts('测试');
    expect(result[0]).toMatchObject({ name: '测试用户', circles: ['新人圈 · 协管员'] });
    expect(JSON.stringify(result)).not.toContain('never-return');
    expect(db.account.findMany.mock.calls[0][0].where.isActive).toBe(true);
  });
  it('switches without an admin session and resolves permissions from the target account', async () => {
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: true, role: 'user' });
    const { token } = await switchDevAccount('u');
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ sub: 'u', devAccountSwitch: true });
    const result = await auth(token);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.req.user).toMatchObject({ accountId: 'u', role: 'user' });
  });
  it.each(['production', 'test'])('rejects a development token in %s even with the same JWT secret', async (env) => {
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: true, role: 'admin' });
    const { token } = await switchDevAccount('u');
    vi.stubEnv('NODE_ENV', env);
    const result = await auth(token);
    expect(result.next).not.toHaveBeenCalled();
    expect(result.res.status).toHaveBeenCalledWith(401);
  });
  it('rejects inactive targets and invalid IDs', async () => {
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: false });
    await expect(switchDevAccount('u')).rejects.toMatchObject({ status: 404 });
    await expect(switchDevAccount({ id: 'u' })).rejects.toMatchObject({ status: 400 });
  });
  it('honors logout/password revocation and still accepts ordinary login tokens when disabled', async () => {
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: true, role: 'user' });
    const { token } = await switchDevAccount('u');
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: true, role: 'user', tokenValidAfter: new Date(Date.now() + 1000) });
    expect((await auth(token)).next).not.toHaveBeenCalled();
    vi.stubEnv('DEV_ACCOUNT_SWITCHER', 'false');
    db.account.findUnique.mockResolvedValue({ id: 'u', isActive: true, role: 'user' });
    const normal = jwt.sign({ sub: 'u' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expect((await auth(normal)).next).toHaveBeenCalledOnce();
    expect((await auth(token)).next).not.toHaveBeenCalled();
  });
});
