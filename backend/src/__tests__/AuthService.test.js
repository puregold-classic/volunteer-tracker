// src/__tests__/AuthService.test.js — v2.1
//
// Tests the v2.1 self-register-by-claiming-volunteer flow + login + getMe.
// The v1 PG-0000 / PG-9000..9999 reserved-id workaround is gone, so the
// register flow now requires a pre-existing volunteerCode.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockHash } = vi.hoisted(() => {
  const tx = {
    account: { update: vi.fn() },
    volunteer: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    mockPrisma: {
      account: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      volunteer: { findUnique: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(async (fn) => fn(tx)),
      _tx: tx,
    },
    mockHash: {
      hashPassword: vi.fn(async () => '$hashed$'),
      verifyPassword: vi.fn(),
    },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/passwordUtils.js', () => mockHash);

// JWT_SECRET must be set BEFORE importing AuthService since it's read at signToken-time
process.env.JWT_SECRET = 'vitest-secret-padding-32-chars-min';
process.env.JWT_EXPIRES_IN = '1h';

import jwt from 'jsonwebtoken';
import {
  register, login, logout, getMe,
  changePassword, adminResetPassword, updateAvatar,
} from '../services/AuthService.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma._tx.account.update.mockReset();
  mockPrisma._tx.volunteer.update.mockReset();
  mockPrisma._tx.auditLog.create.mockReset();
  mockPrisma._tx.account.update.mockResolvedValue({});
  mockPrisma._tx.volunteer.update.mockResolvedValue({});
  mockPrisma._tx.auditLog.create.mockResolvedValue({});
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

  it('rememberMe=true issues a longer-lived token', async () => {
    const accountRow = {
      id: 'acc-r', email: 'r@vt.local', passwordHash: '$hashed$',
      name: '记', role: 'user', volunteerId: 'v1', isActive: true,
      volunteer: { volunteerCode: 'PG-0001' },
    };
    mockPrisma.account.findUnique.mockResolvedValue(accountRow);
    mockHash.verifyPassword.mockResolvedValue(true);
    mockPrisma.account.update.mockResolvedValue(accountRow);

    const rShort = await login({ email: 'r@vt.local', password: 'goodpass' });
    const rLong = await login({ email: 'r@vt.local', password: 'goodpass', rememberMe: true });

    const shortExp = jwt.decode(rShort.token).exp;
    const longExp = jwt.decode(rLong.token).exp;
    // Long-lived token should expire strictly after the short-lived one
    expect(longExp).toBeGreaterThan(shortExp);
    // And span at least ~7 days more (default 8h vs 30d)
    expect(longExp - shortExp).toBeGreaterThan(7 * 24 * 3600);
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  it('bumps tokenValidAfter on the account', async () => {
    mockPrisma.account.update.mockResolvedValue({ id: 'a', tokenValidAfter: new Date() });
    await logout('a');
    expect(mockPrisma.account.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { tokenValidAfter: expect.any(Date) },
    });
  });

  it('is a no-op when called without accountId', async () => {
    await logout(null);
    expect(mockPrisma.account.update).not.toHaveBeenCalled();
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

// ─── v3.2 account self-service ──────────────────────────────────────────────

describe('AuthService.changePassword', () => {
  it('rejects missing fields', async () => {
    const r = await changePassword('a', { currentPassword: '', newPassword: '' });
    expect(r.missingFields).toBe(true);
  });

  it('rejects weak new password', async () => {
    const r = await changePassword('a', { currentPassword: 'oldpass1', newPassword: 'short' });
    expect(r.weakPassword).toBe(true);
  });

  it('rejects when new password equals current', async () => {
    const r = await changePassword('a', { currentPassword: 'samepass', newPassword: 'samepass' });
    expect(r.sameAsCurrent).toBe(true);
  });

  it('rejects when current password is wrong', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'a', passwordHash: 'h', isActive: true });
    mockHash.verifyPassword.mockResolvedValue(false);
    const r = await changePassword('a', { currentPassword: 'wrong', newPassword: 'newpass1!' });
    expect(r.invalidCurrent).toBe(true);
  });

  it('updates password + bumps tokenValidAfter + writes audit', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'a', passwordHash: 'h', isActive: true });
    mockHash.verifyPassword.mockResolvedValue(true);
    const r = await changePassword('a', { currentPassword: 'oldpass1', newPassword: 'newpass1!' });
    expect(r.ok).toBe(true);
    expect(mockPrisma._tx.account.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: expect.objectContaining({ passwordHash: '$hashed$', tokenValidAfter: expect.any(Date) }),
    });
    expect(mockPrisma._tx.auditLog.create).toHaveBeenCalledTimes(1);
    const auditCall = mockPrisma._tx.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('account_password_change');
  });
});

describe('AuthService.adminResetPassword', () => {
  it('rejects missing / weak password', async () => {
    expect((await adminResetPassword('a', { newPassword: '' })).missingFields).toBe(true);
    expect((await adminResetPassword('a', { newPassword: 'short' })).weakPassword).toBe(true);
  });

  it('rejects nonexistent target', async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    const r = await adminResetPassword('missing', { newPassword: 'longenough' });
    expect(r.notFound).toBe(true);
  });

  it('resets password + logs out target + writes audit', async () => {
    mockPrisma.account.findUnique.mockResolvedValue({ id: 'target', email: 't@vt.local' });
    const r = await adminResetPassword('target', { newPassword: 'longenough' }, { accountId: 'admin', role: 'admin' });
    expect(r.ok).toBe(true);
    const auditCall = mockPrisma._tx.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('account_password_reset');
    expect(auditCall.data.actionDetails.self).toBe(false);
    expect(auditCall.data.actionDetails.targetEmail).toBe('t@vt.local');
  });
});

describe('AuthService.updateAvatar', () => {
  it('rejects when volunteerId missing', async () => {
    const r = await updateAvatar(null, { avatar: 'data:image/png;base64,AAAA' });
    expect(r.notFound).toBe(true);
  });

  it('rejects missing avatar string', async () => {
    expect((await updateAvatar('v1', { avatar: '' })).missingFields).toBe(true);
    expect((await updateAvatar('v1', { avatar: '   ' })).missingFields).toBe(true);
  });

  it('rejects payload over cap', async () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(600 * 1024);
    const r = await updateAvatar('v1', { avatar: huge });
    expect(r.tooLarge).toBe(true);
  });

  it('rejects non-image data-URL', async () => {
    const r = await updateAvatar('v1', { avatar: 'data:text/plain;base64,AAAA' });
    expect(r.invalidFormat).toBe(true);
  });

  it('accepts plain URL (non-data)', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue({ id: 'v1', avatar: 'https://ui-avatars.com/x' });
    const r = await updateAvatar('v1', { avatar: 'https://cdn.example.com/a.jpg' });
    expect(r.ok).toBe(true);
    expect(mockPrisma._tx.volunteer.update).toHaveBeenCalled();
  });

  it('writes audit with size + previousWasDefault flag', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue({ id: 'v1', avatar: 'https://ui-avatars.com/xxx' });
    const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
    await updateAvatar('v1', { avatar: dataUrl });
    const auditCall = mockPrisma._tx.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('account_avatar_update');
    expect(auditCall.data.actionDetails.previousWasDefault).toBe(true);
    expect(auditCall.data.actionDetails.size).toBe(dataUrl.length);
  });
});
