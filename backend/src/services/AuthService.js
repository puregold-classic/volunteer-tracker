// src/services/AuthService.js — v2.1
//
// Login + JWT issuance + self-register-by-claiming-existing-volunteer.
// Account creation goes through AccountService (createVolunteerAccount /
// createAdminAccount), not here. The PG-0000 / PG-9000..9999 reserved-id
// hacks from v1 are gone — v2.1's CHECK constraint enforces 1:1 binding
// at the DB level, so the workarounds are unnecessary.

import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';
import { serializeAccount } from '../utils/serializer.js';
import IDGenerator from '../utils/IDGenerator.js';

const serializeOperator = (op) => ({
  id: op?.accountId ?? null,
  volunteerId: op?.volunteerId ?? null,
  name: op?.name ?? null,
  role: op?.role ?? null,
});

export const signToken = (account, { rememberMe = false } = {}) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is not configured');
  // Short-lived token by default. If the user checked "remember me" at login
  // we extend it — tokenValidAfter on Account + logout invalidation makes
  // this reasonably safe to the session-theft risk of long-lived JWTs.
  const expiresIn = rememberMe
    ? process.env.JWT_EXPIRES_IN_REMEMBER || '30d'
    : process.env.JWT_EXPIRES_IN || '8h';
  return jwt.sign(
    {
      sub: account.id,
      role: account.role,
      email: account.email,
      // volunteerId is the FK (cuid). Middleware joins to get the volunteerCode.
      volunteerId: account.volunteerId || null,
      name: account.name,
    },
    jwtSecret,
    { expiresIn },
  );
};

/**
 * Self-register: claim a pre-existing Volunteer by its volunteerCode + email match.
 * The Volunteer must already exist (admin-created or CSV-imported) and have no
 * Account bound yet. This replaces v1's "register without volunteer" path which
 * is no longer possible under the v2.1 CHECK constraint.
 */
export const register = async ({ email, password, name, volunteerCode }) => {
  if (!email || !password || !name || !volunteerCode) {
    return { missingFields: true };
  }
  if (password.length < 8) return { weakPassword: true };

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await prisma.account.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { emailTaken: true };

  const volunteer = await prisma.volunteer.findUnique({ where: { volunteerCode } });
  if (!volunteer) return { volunteerNotFound: true };

  const bound = await prisma.account.findUnique({
    where: { volunteerId: volunteer.id },
    select: { id: true, email: true },
  });
  if (bound) return { volunteerBound: bound.email };

  const passwordHash = await hashPassword(password);
  const account = await prisma.account.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      role: 'user',
      volunteerId: volunteer.id,
    },
    include: { volunteer: { include: { department: true } } },
  });
  return { account: serializeAccount(account) };
};

export const login = async ({ email, password, rememberMe = false }) => {
  if (!email || !password) return { missingFields: true };

  const account = await prisma.account.findUnique({
    where: { email: String(email).trim().toLowerCase() },
    include: { volunteer: { include: { department: true } } },
  });
  if (!account || !account.isActive) return { invalidCredentials: true };

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) return { invalidCredentials: true };

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
    include: { volunteer: { include: { department: true } } },
  });
  const token = signToken(updated, { rememberMe: !!rememberMe });
  return { token, account: serializeAccount(updated) };
};

/**
 * Logout: bump tokenValidAfter to now, which invalidates every JWT issued
 * before this moment (authenticate middleware rejects tokens with
 * `iat < tokenValidAfter`). Idempotent.
 */
export const logout = async (accountId) => {
  if (!accountId) return;
  await prisma.account.update({
    where: { id: accountId },
    data: { tokenValidAfter: new Date() },
  });
};

export const getMe = async (accountId) => {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { volunteer: { include: { department: true } } },
  });
  if (!account || !account.isActive) return null;
  return serializeAccount(account);
};

// ─── v3.2: self-service account ops ─────────────────────────────────────────

/**
 * User self-change password. Requires current password.
 * Bumps tokenValidAfter so other sessions are invalidated.
 */
export const changePassword = async (accountId, { currentPassword, newPassword }, operator) => {
  if (!currentPassword || !newPassword) return { missingFields: true };
  if (newPassword.length < 8) return { weakPassword: true };
  if (currentPassword === newPassword) return { sameAsCurrent: true };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) return { notFound: true };

  const valid = await verifyPassword(currentPassword, account.passwordHash);
  if (!valid) return { invalidCurrent: true };

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: accountId },
      data: { passwordHash, tokenValidAfter: new Date() },
    });
    await tx.auditLog.create({
      data: {
        auditId: IDGenerator.generateAuditId(),
        targetType: 'Account',
        targetId: accountId,
        action: 'account_password_change',
        actionDetails: { self: true },
        modifiedId: accountId,
        changes: [],
        operator: serializeOperator(operator),
        submitter: serializeOperator(operator),
      },
    });
  });
  return { ok: true };
};

/**
 * Admin reset another account's password. Operator must be admin.
 */
export const adminResetPassword = async (targetAccountId, { newPassword }, operator) => {
  if (!newPassword) return { missingFields: true };
  if (newPassword.length < 8) return { weakPassword: true };

  const target = await prisma.account.findUnique({ where: { id: targetAccountId } });
  if (!target) return { notFound: true };

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: targetAccountId },
      data: { passwordHash, tokenValidAfter: new Date() },
    });
    await tx.auditLog.create({
      data: {
        auditId: IDGenerator.generateAuditId(),
        targetType: 'Account',
        targetId: targetAccountId,
        action: 'account_password_reset',
        actionDetails: { targetEmail: target.email, self: false },
        modifiedId: targetAccountId,
        changes: [],
        operator: serializeOperator(operator),
        submitter: serializeOperator(operator),
      },
    });
  });
  return { ok: true };
};

/**
 * Update own avatar. Accepts data-URL (base64) or plain URL string.
 * Size capped at ~500KB of base64 payload (roughly 375KB raw).
 */
const MAX_AVATAR_BYTES = 512 * 1024;

export const updateAvatar = async (volunteerId, { avatar }, operator) => {
  if (!volunteerId) return { notFound: true };
  if (typeof avatar !== 'string' || !avatar.trim()) return { missingFields: true };
  if (avatar.length > MAX_AVATAR_BYTES) return { tooLarge: true };

  // Reject obvious non-image strings when a data-URL prefix is present
  if (avatar.startsWith('data:') && !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(avatar)) {
    return { invalidFormat: true };
  }

  const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) return { notFound: true };

  const previous = volunteer.avatar;
  await prisma.$transaction(async (tx) => {
    await tx.volunteer.update({
      where: { id: volunteerId },
      data: { avatar },
    });
    await tx.auditLog.create({
      data: {
        auditId: IDGenerator.generateAuditId(),
        targetType: 'Volunteer',
        targetId: volunteerId,
        action: 'account_avatar_update',
        actionDetails: {
          size: avatar.length,
          previousWasDefault: previous.startsWith('https://ui-avatars.com/'),
        },
        modifiedId: volunteerId,
        changes: [{ field: 'avatar', from: '(omitted)', to: '(omitted)' }],
        operator: serializeOperator(operator),
        submitter: serializeOperator(operator),
      },
    });
  });
  return { ok: true };
};
