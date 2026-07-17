// src/__tests__/AccountService.test.js — v2.1
//
// Tests the unified createVolunteerAccount entry, createAdminAccount, and
// admin update/delete safety. Mocks prisma + passwordUtils.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockHash, mockIDGen } = vi.hoisted(() => {
  const prisma = {
    account: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    volunteer: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    department: { findUnique: vi.fn() },
    projectSupport: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fnOrArr) => {
    if (typeof fnOrArr === 'function') return fnOrArr(prisma);
    return Promise.all(fnOrArr);
  });
  return {
    mockPrisma: prisma,
    mockHash: { hashPassword: vi.fn(async () => '$hashed$') },
    mockIDGen: { generateVolunteerCode: vi.fn(async () => 'PG-0099') },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/passwordUtils.js', () => mockHash);
vi.mock('../utils/IDGenerator.js', () => ({ default: mockIDGen }));

import { createVolunteerAccount, createAdminAccount, updateAccount, deleteAccount } from '../services/AccountService.js';

const validVolunteerInput = {
  chineseName: '王技术',
  englishName: 'Wang Tech',
  status: '在职',
  region: '中国大陆',
  province: '广东省',
  departmentId: 'TECH',
  email: 'test@vt.local',
};

const validAccountInput = {
  email: 'test@vt.local',
  password: 'TestPass@123',
  name: '王技术',
  role: 'user',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: department exists, email not taken
  mockPrisma.department.findUnique.mockResolvedValue({ id: 'TECH', name: '技术部' });
  mockPrisma.account.findUnique.mockResolvedValue(null);
  mockPrisma.volunteer.create.mockResolvedValue({ id: 'vol-new', volunteerCode: 'PG-0099' });
  mockPrisma.account.create.mockResolvedValue({ id: 'acc-new', email: 'test@vt.local', role: 'user', volunteerId: 'vol-new' });
});

// ─── createVolunteerAccount() ─────────────────────────────────────────────────

describe('AccountService.createVolunteerAccount', () => {
  it('happy path: creates volunteer + account atomically', async () => {
    const result = await createVolunteerAccount({ volunteer: validVolunteerInput, account: validAccountInput });
    expect(result.volunteer).toBeDefined();
    expect(result.account).toBeDefined();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.volunteer.create).toHaveBeenCalled();
    expect(mockPrisma.account.create).toHaveBeenCalled();
  });

  it('rejects missing chineseName', async () => {
    const result = await createVolunteerAccount({
      volunteer: { ...validVolunteerInput, chineseName: '' },
      account: validAccountInput,
    });
    expect(result.validationError).toMatch(/姓名/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects mainland without province', async () => {
    const result = await createVolunteerAccount({
      volunteer: { ...validVolunteerInput, province: '' },
      account: validAccountInput,
    });
    expect(result.validationError).toMatch(/省份/);
  });

  // v3.7 防呆：省份必须规范全名
  it('rejects a non-canonical province (辽宁 → needs 辽宁省)', async () => {
    const result = await createVolunteerAccount({
      volunteer: { ...validVolunteerInput, region: '中国大陆', province: '辽宁' },
      account: validAccountInput,
    });
    expect(result.validationError).toMatch(/省份不规范/);
  });

  it('rejects 中国台湾 with a canonical-but-wrong province (must be 台湾省)', async () => {
    const result = await createVolunteerAccount({
      volunteer: { ...validVolunteerInput, region: '中国台湾', province: '北京市' },
      account: validAccountInput,
    });
    expect(result.validationError).toMatch(/台湾省/);
  });

  it('rejects nonexistent department', async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);
    const result = await createVolunteerAccount({ volunteer: validVolunteerInput, account: validAccountInput });
    expect(result.validationError).toMatch(/部门不存在/);
  });

  it('rejects weak password (< 8 chars)', async () => {
    const result = await createVolunteerAccount({
      volunteer: validVolunteerInput,
      account: { ...validAccountInput, password: 'short' },
    });
    expect(result.validationError).toMatch(/密码/);
  });

  it('rejects role=admin (must use createAdminAccount)', async () => {
    const result = await createVolunteerAccount({
      volunteer: validVolunteerInput,
      account: { ...validAccountInput, role: 'admin' },
    });
    expect(result.validationError).toMatch(/admin/);
  });

  it('rejects duplicate email as conflict', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'existing', email: 'test@vt.local' });
    const result = await createVolunteerAccount({ volunteer: validVolunteerInput, account: validAccountInput });
    expect(result.conflict).toMatch(/邮箱已存在/);
  });
});

// ─── createAdminAccount() ────────────────────────────────────────────────────

describe('AccountService.createAdminAccount', () => {
  beforeEach(() => {
    mockPrisma.account.create.mockResolvedValue({
      id: 'admin-new', email: 'admin@vt.local', role: 'admin', volunteerId: null,
    });
  });

  it('creates admin with null volunteerId', async () => {
    const result = await createAdminAccount({ email: 'admin@vt.local', password: 'AdminPass@123', name: 'Admin' });
    expect(result.account).toBeDefined();
    const args = mockPrisma.account.create.mock.calls[0][0];
    expect(args.data.role).toBe('admin');
    expect(args.data.volunteerId).toBeNull();
  });

  it('rejects missing fields', async () => {
    const result = await createAdminAccount({ email: '', password: 'pass', name: '' });
    expect(result.validationError).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'x' });
    const result = await createAdminAccount({ email: 'admin@vt.local', password: 'AdminPass@123', name: 'Admin' });
    expect(result.conflict).toBeDefined();
  });
});

// ─── updateAccount() ─────────────────────────────────────────────────────────

describe('AccountService.updateAccount', () => {
  it('rejects self-edit', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'me', role: 'admin' });
    const result = await updateAccount('me', { name: 'New' }, 'me');
    expect(result.selfEdit).toBe(true);
  });

  it('rejects demoting last admin', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'admin-1', role: 'admin', volunteerId: null });
    mockPrisma.account.count.mockResolvedValue(1);
    const result = await updateAccount('admin-1', { role: 'user' }, 'someone-else');
    expect(result.lastAdmin).toBe(true);
  });

  it('rejects promoting non-admin to user without volunteer', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'unbound-admin', role: 'admin', volunteerId: null });
    mockPrisma.account.count.mockResolvedValue(2); // not the last admin
    const result = await updateAccount('unbound-admin', { role: 'user' }, 'someone-else');
    expect(result.validationError).toMatch(/volunteer/);
  });

  it('happy path: updates role + isActive when allowed', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'u1', role: 'user', volunteerId: 'v1' });
    mockPrisma.account.findFirst.mockResolvedValue(null); // email not taken
    mockPrisma.account.update.mockResolvedValue({ id: 'u1', role: 'b_admin', isActive: true, volunteerId: 'v1', email: 'u1@vt.local', name: 'U1' });
    const result = await updateAccount('u1', { role: 'b_admin', isActive: true }, 'admin-self');
    expect(result.account).toBeDefined();
    expect(mockPrisma.account.update).toHaveBeenCalled();
  });
});

// ─── deleteAccount() ─────────────────────────────────────────────────────────

describe('AccountService.deleteAccount', () => {
  it('rejects self-delete', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'me', role: 'user' });
    const result = await deleteAccount('me', 'me');
    expect(result.selfDelete).toBe(true);
  });

  it('rejects deleting last admin', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockPrisma.account.count.mockResolvedValue(1);
    const result = await deleteAccount('admin-1', 'someone-else');
    expect(result.lastAdmin).toBe(true);
  });

  it('refuses delete if volunteer has ProjectSupport records', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'u1', role: 'user', volunteerId: 'v1' });
    // Inside transaction: count returns > 0
    mockPrisma.projectSupport.count.mockResolvedValue(3);
    await expect(deleteAccount('u1', 'admin')).rejects.toThrow(/ProjectSupport/);
  });

  it('happy path: deletes account + volunteer when no supports exist', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'u1', role: 'user', volunteerId: 'v1' });
    mockPrisma.projectSupport.count.mockResolvedValue(0);
    mockPrisma.account.delete.mockResolvedValue({});
    mockPrisma.volunteer.delete.mockResolvedValue({});
    const result = await deleteAccount('u1', 'admin');
    expect(result.accountId).toBe('u1');
    expect(result.volunteerId).toBe('v1');
  });

  it('happy path: admin without volunteer just deletes account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'admin-2', role: 'admin', volunteerId: null });
    mockPrisma.account.count.mockResolvedValue(2); // not the last admin
    mockPrisma.account.delete.mockResolvedValue({});
    const result = await deleteAccount('admin-2', 'admin-self');
    expect(result.accountId).toBe('admin-2');
    expect(mockPrisma.volunteer.delete).not.toHaveBeenCalled();
  });
});
