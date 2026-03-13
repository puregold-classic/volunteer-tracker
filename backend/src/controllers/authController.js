// src/controllers/authController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// JWT `sub` is now the PG account cuid (not MongoDB ObjectId).

import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js';
import { serializeAccount } from '../utils/pgSerializer.js';

const signToken = (account) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('JWT_SECRET is not configured');
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  return jwt.sign(
    {
      sub: account.id,           // PG cuid
      role: account.role,
      email: account.email,
      volunteerId: account.volunteerId || null,
      name: account.name,
    },
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

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, name, volunteerId } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'email、password、name为必填字段' });
      }
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: '密码长度至少8位' });
      }

      const existing = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ success: false, error: '邮箱已被注册' });
      }

      if (volunteerId) {
        const volunteer = await prisma.volunteer.findFirst({
          where: { volunteerId },
          select: { volunteerId: true },
        });
        if (!volunteer) {
          return res.status(400).json({ success: false, error: 'volunteerId不存在' });
        }
        const bound = await prisma.account.findUnique({
          where: { volunteerId },
          select: { id: true, email: true },
        });
        if (bound) {
          return res.status(409).json({ success: false, error: `该volunteerId已绑定账号: ${bound.email}` });
        }
      }

      const passwordHash = await hashPassword(password);
      const account = await prisma.account.create({
        data: { email: email.toLowerCase(), passwordHash, name, role: 'user', volunteerId: volunteerId || null },
      });

      return res.status(201).json({ success: true, message: '注册成功', data: serializeAccount(account) });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '注册失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async createAccountByAdmin(req, res) {
    try {
      const { email, password, name, role = 'user', volunteerId: requestedVolunteerId = null } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, error: 'email、password、name为必填字段' });
      }
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: '密码长度至少8位' });
      }

      const allowedRoles = ['user', 'b_admin', 'a_admin', 'admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, error: `role必须是: ${allowedRoles.join(', ')}` });
      }

      const existing = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return res.status(409).json({ success: false, error: '邮箱已被注册' });
      }

      const volunteerId = await resolveReservedVolunteerId(role, requestedVolunteerId);

      if (volunteerId && !['admin', 'a_admin'].includes(role)) {
        const volunteer = await prisma.volunteer.findFirst({
          where: { volunteerId },
          select: { volunteerId: true },
        });
        if (!volunteer) {
          return res.status(400).json({ success: false, error: 'volunteerId不存在' });
        }
        const bound = await prisma.account.findUnique({
          where: { volunteerId },
          select: { id: true, email: true },
        });
        if (bound) {
          return res.status(409).json({ success: false, error: `该volunteerId已绑定账号: ${bound.email}` });
        }
      }

      const passwordHash = await hashPassword(password);
      const account = await prisma.account.create({
        data: { email: email.toLowerCase(), passwordHash, name, role, volunteerId },
      });

      return res.status(201).json({ success: true, message: '账号创建成功', data: serializeAccount(account) });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '创建账号失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'email和password为必填字段' });
      }

      const account = await prisma.account.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!account || !account.isActive) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }

      const valid = await verifyPassword(password, account.passwordHash);
      if (!valid) {
        return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      }

      const updated = await prisma.account.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
      });

      const token = signToken(updated);

      return res.status(200).json({
        success: true,
        message: '登录成功',
        data: { token, account: serializeAccount(updated) },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '登录失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async me(req, res) {
    try {
      const account = await prisma.account.findUnique({ where: { id: req.user.accountId } });
      if (!account || !account.isActive) {
        return res.status(401).json({ success: false, error: '账号不存在或已停用' });
      }
      return res.status(200).json({ success: true, data: serializeAccount(account) });
    } catch (error) {
      return res.status(500).json({ success: false, error: '获取当前账号失败' });
    }
  }

  static async logout(req, res) {
    return res.status(200).json({ success: true, message: '已登出（客户端请删除token）' });
  }
}

export default AuthController;
