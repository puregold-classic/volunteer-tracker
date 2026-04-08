// src/__tests__/AuthService.test.js — v2.1
//
// Tests the v2.1 self-register-by-claiming-volunteer flow + login + getMe.
// The v1 PG-0000 / PG-9000..9999 reserved-id workaround is gone, so the
// register flow now requires a pre-existing volunteerCode.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockHash } = vi.hoisted(() => ({
  mockPrisma: {
    account: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    volunteer: { findUnique: vi.fn() },
  },
  mockHash: {
    hashPassword: vi.fn(async () => '$hashed$'),
    verifyPassword: vi.fn(),
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/passwordUtils.js', () => mockHash);

// JWT_SECRET must be set BEFORE importing AuthService since it's read at signToken-time
process.env.JWT_SECRET = 'vitest-secret-padding-32-chars-min';
process.env.JWT_EXPIRES_IN = '1h';

import { register, login, getMe } from '../services/AuthService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── register (claim flow) ───────────────────────────────────────────────────

describe('AuthService.register', () => {
  const validPayload = {
    email: 'newuser@vt.local',
    password: 'StrongPass@123',
    name: '新用户',
    volunteerCode: 'PG-0099',
  };

  it('claims an existing unbound volunteer', async () => {
    mockPrisma.account.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce(null); // volunteer-binding check
    mockPrisma.volunteer.findUnique.mockResolvedValue({ id: 'vol-99', volunteerCode: 'PG-0099' });
    mockPrisma.account.create.mockResolvedValue({
      id: 'acc-new',
      email: 'newuser@vt.local',
      role: 'user',
      volunteerId: 'vol-99',
      volunteer: { volunteerCode: 'PG-0099' },
    });

    const result = await register(validPayload);
    expect(result.account).toBeDefined();
    expect(mockPrisma.account.create).toHaveBeenCalled();
    const args = mockPrisma.account.create.mock.calls[0][0];
    expect(args.data.role).toBe('user');
    expect(args.data.volunteerId).toBe('vol-99');
  });

  it('rejects missing fields (incl volunteerCode required)', async () => {
    const r = await register({ email: 'a@b.com', password: 'StrongPass@123', name: 'X' });
    expect(r.missingFields).toBe(true);
  });

  it('rejects weak password', async () => {
    const r = await register({ ...validPayload, password: 'short' });
    expect(r.weakPassword).toBe(true);
  });

  it('rejects duplicate email', async () => {
    mockPrisma.account.findUnique.mockResolvedValueOnce({ id: 'existing' });
    const r = await register(validPayload);
    expect(r.emailTaken).toBe(true);
  });

  it('rejects when volunteerCode does not exist', async () => {
    mockPrisma.account.findUnique.mockResolvedValueOnce(null);
    mockPrisma.volunteer.findUnique.mockResolvedValue(null);
    const r = await register(validPayload);
    expect(r.volunteerNotFound).toBe(true);
  });

  it('rejects when volunteer is already bound to another account', async () => {
    mockPrisma.account.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: 'existing-bound', email: 'someone@else.com' }); // bound check
    mockPrisma.volunteer.findUnique.mockResolvedValue({ id: 'vol-99' });
    const r = await register(validPayload);
    expect(r.volunteerBound).toBe('someone@else.com');
  });
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  it('happy path returns token + serialized account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'acc-1', email: 'u@vt.local', passwordHash: '$hashed$',
      name: '王', role: 'user', volunteerId: 'v1', isActive: true,
      volunteer: { volunteerCode: 'PG-0001' },
    });
    mockHash.verifyPassword.mockResolvedValue(true);
    mockPrisma.account.update.mockResolvedValue({
      id: 'acc-1', email: 'u@vt.local', name: '王', role: 'user', volunteerId: 'v1', isActive: true,
      lastLoginAt: new Date(), volunteer: { volunteerCode: 'PG-0001' },
    });

    const r = await login({ email: 'U@vt.local', password: 'goodpass' });
    expect(r.token).toBeDefined();
    expect(r.account).toBeDefined();
    expect(r.account.email).toBe('u@vt.local');
    // Token should be a JWT (3 dot-separated parts)
    expect(r.token.split('.').length).toBe(3);
  });

  it('returns invalidCredentials for unknown email', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    const r = await login({ email: 'nope@vt.local', password: 'x' });
    expect(r.invalidCredentials).toBe(true);
  });

  it('returns invalidCredentials for inactive account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'a', email: 'u@vt.local', passwordHash: 'h', name: 'X', role: 'user', isActive: false,
    });
    const r = await login({ email: 'u@vt.local', password: 'x' });
    expect(r.invalidCredentials).toBe(true);
  });

  it('returns invalidCredentials for wrong password', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'a', email: 'u@vt.local', passwordHash: 'h', name: 'X', role: 'user', isActive: true,
    });
    mockHash.verifyPassword.mockResolvedValue(false);
    const r = await login({ email: 'u@vt.local', password: 'wrong' });
    expect(r.invalidCredentials).toBe(true);
  });

  it('returns missingFields when email or password absent', async () => {
    expect((await login({ email: '', password: 'x' })).missingFields).toBe(true);
    expect((await login({ email: 'a@b.com', password: '' })).missingFields).toBe(true);
  });
});

// ─── getMe ───────────────────────────────────────────────────────────────────

describe('AuthService.getMe', () => {
  it('returns serialized account with volunteerCode', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      id: 'a', email: 'u@vt.local', name: 'X', role: 'user',
      volunteerId: 'v', isActive: true, volunteer: { volunteerCode: 'PG-0001' },
    });
    const r = await getMe('a');
    expect(r).toBeDefined();
    expect(r.volunteerCode).toBe('PG-0001');
  });

  it('returns null for nonexistent account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    expect(await getMe('nope')).toBeNull();
  });

  it('returns null for inactive account', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'a', isActive: false });
    expect(await getMe('a')).toBeNull();
  });
});
