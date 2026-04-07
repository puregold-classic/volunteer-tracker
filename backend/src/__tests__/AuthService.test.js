import { describe, it, expect, vi, beforeEach } from 'vitest';
import { register, login, createAccountByAdmin, getMe } from '../services/AuthService.js';

vi.mock('../utils/prismaClient.js', () => ({
  default: {
    account: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    volunteer: {
      findFirst: vi.fn(),
    },
  },
  getPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

vi.mock('../utils/passwordUtils.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn(),
}));

import prisma from '../utils/prismaClient.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';

// JWT_SECRET must be set before signToken is called
process.env.JWT_SECRET = 'vitest-secret-key-32chars-padding!';
process.env.JWT_EXPIRES_IN = '1h';

const makeAccount = (overrides = {}) => ({
  id: 'acc1',
  email: 'user@example.com',
  passwordHash: '$hashed$',
  name: '张三',
  role: 'user',
  volunteerId: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ─── register ────────────────────────────────────────────────────────────────

describe('register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingFields when email is absent', async () => {
    expect((await register({ password: 'pass1234', name: '张三' })).missingFields).toBe(true);
  });

  it('returns missingFields when password is absent', async () => {
    expect((await register({ email: 'a@b.com', name: '张三' })).missingFields).toBe(true);
  });

  it('returns missingFields when name is absent', async () => {
    expect((await register({ email: 'a@b.com', password: 'pass1234' })).missingFields).toBe(true);
  });

  it('returns weakPassword when password is shorter than 8 chars', async () => {
    const result = await register({ email: 'a@b.com', password: 'short', name: '张三' });
    expect(result.weakPassword).toBe(true);
  });

  it('returns emailTaken when email already registered', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount());
    const result = await register({ email: 'user@example.com', password: 'pass1234', name: '张三' });
    expect(result.emailTaken).toBe(true);
  });

  it('returns volunteerNotFound when volunteerId does not exist', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.volunteer.findFirst.mockResolvedValue(null);
    const result = await register({ email: 'new@example.com', password: 'pass1234', name: '张三', volunteerId: 'PG-9999' });
    expect(result.volunteerNotFound).toBe(true);
  });

  it('returns volunteerBound when volunteerId already linked to another account', async () => {
    prisma.account.findUnique.mockImplementation(({ where }) => {
      if (where.email) return Promise.resolve(null);
      if (where.volunteerId) return Promise.resolve(makeAccount({ email: 'other@example.com' }));
      return Promise.resolve(null);
    });
    prisma.volunteer.findFirst.mockResolvedValue({ volunteerId: 'PG-0001' });

    const result = await register({ email: 'new@example.com', password: 'pass1234', name: '张三', volunteerId: 'PG-0001' });
    expect(result.volunteerBound).toBe('other@example.com');
  });

  it('creates account and returns serialized data on success', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(makeAccount());

    const result = await register({ email: 'New@Example.com', password: 'pass1234', name: '张三' });

    expect(result.account).toBeDefined();
    expect(result.account.email).toBe('user@example.com');
    expect(hashPassword).toHaveBeenCalledWith('pass1234');
  });

  it('lowercases email before saving', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(makeAccount({ email: 'upper@example.com' }));

    await register({ email: 'UPPER@EXAMPLE.COM', password: 'pass1234', name: '张三' });

    const createArg = prisma.account.create.mock.calls[0][0].data;
    expect(createArg.email).toBe('upper@example.com');
  });
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingFields when email is absent', async () => {
    expect((await login({ password: 'pass1234' })).missingFields).toBe(true);
  });

  it('returns missingFields when password is absent', async () => {
    expect((await login({ email: 'a@b.com' })).missingFields).toBe(true);
  });

  it('returns invalidCredentials when account is not found', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    expect((await login({ email: 'no@one.com', password: 'pass1234' })).invalidCredentials).toBe(true);
  });

  it('returns invalidCredentials when account is inactive', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount({ isActive: false }));
    expect((await login({ email: 'user@example.com', password: 'pass1234' })).invalidCredentials).toBe(true);
  });

  it('returns invalidCredentials when password is wrong', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount());
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect((await login({ email: 'user@example.com', password: 'wrongpass' })).invalidCredentials).toBe(true);
  });

  it('returns token and account on successful login', async () => {
    const account = makeAccount();
    prisma.account.findUnique.mockResolvedValue(account);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    prisma.account.update.mockResolvedValue(account);

    const result = await login({ email: 'user@example.com', password: 'pass1234' });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.account.email).toBe('user@example.com');
  });

  it('updates lastLoginAt on successful login', async () => {
    const account = makeAccount();
    prisma.account.findUnique.mockResolvedValue(account);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    prisma.account.update.mockResolvedValue(account);

    await login({ email: 'user@example.com', password: 'pass1234' });

    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'acc1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });
});

// ─── createAccountByAdmin ────────────────────────────────────────────────────

describe('createAccountByAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingFields when required fields absent', async () => {
    expect((await createAccountByAdmin({ email: 'a@b.com', name: '张三' })).missingFields).toBe(true);
  });

  it('returns weakPassword when password too short', async () => {
    const result = await createAccountByAdmin({ email: 'a@b.com', password: 'short', name: '张三' });
    expect(result.weakPassword).toBe(true);
  });

  it('returns invalidRole for unknown role', async () => {
    const result = await createAccountByAdmin({ email: 'a@b.com', password: 'pass1234', name: '张三', role: 'superadmin' });
    expect(result.invalidRole).toBe(true);
  });

  it('accepts valid roles: user, b_admin, a_admin, admin', async () => {
    for (const role of ['user', 'b_admin', 'a_admin', 'admin']) {
      vi.clearAllMocks();
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.account.findMany.mockResolvedValue([]);
      prisma.account.create.mockResolvedValue(makeAccount({ role }));

      const result = await createAccountByAdmin({ email: `${role}@test.com`, password: 'pass1234', name: 'Test', role });
      expect(result.invalidRole).toBeUndefined();
    }
  });

  it('returns emailTaken when email already registered', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount());
    const result = await createAccountByAdmin({ email: 'user@example.com', password: 'pass1234', name: '张三', role: 'user' });
    expect(result.emailTaken).toBe(true);
  });

  it('creates account successfully', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    prisma.account.create.mockResolvedValue(makeAccount({ role: 'b_admin' }));

    const result = await createAccountByAdmin({ email: 'new@example.com', password: 'pass1234', name: '张三', role: 'b_admin' });
    expect(result.account).toBeDefined();
  });
});

// ─── getMe ───────────────────────────────────────────────────────────────────

describe('getMe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when account not found', async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    expect(await getMe('acc-missing')).toBeNull();
  });

  it('returns null when account is inactive', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount({ isActive: false }));
    expect(await getMe('acc1')).toBeNull();
  });

  it('returns serialized account when active', async () => {
    prisma.account.findUnique.mockResolvedValue(makeAccount());
    const result = await getMe('acc1');
    expect(result).not.toBeNull();
    expect(result.email).toBe('user@example.com');
  });
});
