import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';
import { serializeAccount } from '../utils/serializer.js';

export const signToken = (account) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is not configured');
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  return jwt.sign(
    { sub: account.id, role: account.role, email: account.email, volunteerId: account.volunteerId || null, name: account.name },
    jwtSecret,
    { expiresIn }
  );
};

const getNextReservedReviewerId = async () => {
  const used = await prisma.account.findMany({
    where: { volunteerId: { startsWith: 'PG-9' } },
    select: { volunteerId: true },
  });
  const usedSet = new Set(used.map(a => a.volunteerId?.toUpperCase()));
  for (let n = 9999; n >= 9000; n -= 1) {
    const candidate = `PG-${String(n).padStart(4, '0')}`;
    if (!usedSet.has(candidate)) return candidate;
  }
  throw new Error('无可用的保留审核员ID（PG-9999..PG-9000已用尽）');
};

const resolveReservedVolunteerId = async (role, requestedVolunteerId) => {
  if (requestedVolunteerId) return requestedVolunteerId;
  if (role === 'admin') return 'PG-0000';
  if (role === 'a_admin') return getNextReservedReviewerId();
  return null;
};

export const register = async ({ email, password, name, volunteerId }) => {
  if (!email || !password || !name) return { missingFields: true };
  if (password.length < 8) return { weakPassword: true };

  const existing = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { emailTaken: true };

  if (volunteerId) {
    const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId }, select: { volunteerId: true } });
    if (!volunteer) return { volunteerNotFound: true };
    const bound = await prisma.account.findUnique({ where: { volunteerId }, select: { id: true, email: true } });
    if (bound) return { volunteerBound: bound.email };
  }

  const passwordHash = await hashPassword(password);
  const account = await prisma.account.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'user', volunteerId: volunteerId || null },
  });
  return { account: serializeAccount(account) };
};

const ALLOWED_ROLES = ['user', 'b_admin', 'a_admin', 'admin'];

export const createAccountByAdmin = async ({ email, password, name, role = 'user', volunteerId: requestedVolunteerId = null }) => {
  if (!email || !password || !name) return { missingFields: true };
  if (password.length < 8) return { weakPassword: true };
  if (!ALLOWED_ROLES.includes(role)) return { invalidRole: true };

  const existing = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { emailTaken: true };

  const volunteerId = await resolveReservedVolunteerId(role, requestedVolunteerId);

  if (volunteerId && !['admin', 'a_admin'].includes(role)) {
    const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId }, select: { volunteerId: true } });
    if (!volunteer) return { volunteerNotFound: true };
    const bound = await prisma.account.findUnique({ where: { volunteerId }, select: { id: true, email: true } });
    if (bound) return { volunteerBound: bound.email };
  }

  const passwordHash = await hashPassword(password);
  const account = await prisma.account.create({
    data: { email: email.toLowerCase(), passwordHash, name, role, volunteerId },
  });
  return { account: serializeAccount(account) };
};

export const login = async ({ email, password }) => {
  if (!email || !password) return { missingFields: true };

  const account = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
  if (!account || !account.isActive) return { invalidCredentials: true };

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) return { invalidCredentials: true };

  const updated = await prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  const token = signToken(updated);
  return { token, account: serializeAccount(updated) };
};

export const getMe = async (accountId) => {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) return null;
  return serializeAccount(account);
};
