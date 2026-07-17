// src/services/AccountService.js — v2.1
//
// The single source of truth for creating Volunteer + Account pairs. All
// creation paths (admin form, CSV import, seed, bootstrap) MUST go through
// createVolunteerAccount so that:
//   1. Volunteer + Account are atomic (transaction)
//   2. Default values and validation are uniform
//   3. The CHECK constraint (non-admin must bind volunteer) cannot be violated
//
// Bare prisma.account.create / prisma.volunteer.create elsewhere is forbidden.

import prisma from '../utils/prismaClient.js';
import { hashPassword } from '../utils/passwordUtils.js';
import IDGenerator from '../utils/IDGenerator.js';
import { normalizePhone } from '../utils/identifierUtils.js';
import { isValidProvince } from '../utils/provinces.js';
import {
  serializeAccount,
  serializeVolunteer,
  VOLUNTEER_STATUS_TO_PG,
  REGION_TO_PG,
} from '../utils/serializer.js';

export const ALLOWED_ROLES = ['user', 'b_admin', 'a_admin', 'admin'];
export const ALLOWED_STATUSES = ['在职', '不在职'];
export const ALLOWED_REGIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他'];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Parse a birthday input (Date | "YYYY-MM-DD" | ""). Returns a Date or null.
// Unparseable / empty → null, and the volunteer just gets a legacy PG-NNNN code.
const parseBirthday = (raw) => {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(String(raw).trim());
  return Number.isNaN(d.getTime()) ? null : d;
};

// True iff a Prisma error is a unique-conflict specifically on volunteerCode
// (so the caller retries with the next dedup letter, not bail as email/phone dup).
const isVolunteerCodeConflict = (err) => {
  if (err?.code !== 'P2002') return false;
  const t = err.meta?.target;
  const target = Array.isArray(t) ? t.join(',') : String(t ?? '');
  return target.includes('volunteerCode') || target.includes('volunteer_code');
};

const validateVolunteerPayload = (p) => {
  if (!p.chineseName) return '中文姓名必填';
  // v3.7: englishName 改选填（前端 zod 本就 optional，这里跟齐；收集时很多人没英文名）
  if (!ALLOWED_STATUSES.includes(p.status)) return `状态非法: ${p.status}`;
  if (!ALLOWED_REGIONS.includes(p.region)) return `地区非法: ${p.region}`;
  if (['中国大陆', '中国台湾'].includes(p.region)) {
    if (!p.province) return `${p.region} 必须填写省份`;
    // v3.7 防呆：省份必须是规范全名（如 辽宁省，不能是 辽宁），否则热力图/按省筛选匹配不上
    if (!isValidProvince(p.province)) return `省份不规范: "${p.province}"（需规范全名，如 辽宁省 而非 辽宁）`;
    if (p.region === '中国台湾' && p.province !== '台湾省') return `中国台湾 的省份应为「台湾省」，收到 "${p.province}"`;
  }
  if (!p.departmentId) return '必须指定部门';
  return '';
};

/**
 * Create a Volunteer + Account pair atomically. The single canonical entry.
 *
 * @param {object} input
 * @param {object} input.volunteer - {chineseName, englishName, status?, region, province?, subRegion?, departmentId, email?, phone?}
 * @param {object} input.account - {email, password, name?, role?}
 * @returns {Promise<{volunteer, account}|{validationError}|{conflict}>}
 */
export const createVolunteerAccount = async ({ volunteer = {}, account = {} } = {}) => {
  // ─── Validate volunteer side ─────────────────────────────────────────────
  const vPayload = {
    chineseName: String(volunteer.chineseName || '').trim(),
    englishName: String(volunteer.englishName || volunteer.chineseName || '').trim(),
    status: String(volunteer.status || '在职').trim(),
    region: String(volunteer.region || '其他').trim(),
    province: String(volunteer.province || '').trim(),
    subRegion: String(volunteer.subRegion || '').trim(),
    departmentId: String(volunteer.departmentId || '').trim(),
    email: String(volunteer.email || '').trim(),
    phone: normalizePhone(volunteer.phone),
    birthday: parseBirthday(volunteer.birthday),
  };
  const vError = validateVolunteerPayload(vPayload);
  if (vError) return { validationError: vError };

  const dept = await prisma.department.findUnique({ where: { id: vPayload.departmentId } });
  if (!dept) return { validationError: `部门不存在: ${vPayload.departmentId}` };

  // ─── Validate account side ──────────────────────────────────────────────
  const aPayload = {
    email: normalizeEmail(account.email),
    password: account.password,
    name: String(account.name || vPayload.chineseName || '').trim(),
    role: String(account.role || 'user').trim(),
  };
  if (!aPayload.email || !aPayload.password) {
    return { validationError: '邮箱和密码必填' };
  }
  if (aPayload.password.length < 8) return { validationError: '密码至少 8 位' };
  if (!ALLOWED_ROLES.includes(aPayload.role)) return { validationError: `角色非法: ${aPayload.role}` };
  if (aPayload.role === 'admin') {
    return { validationError: 'admin 账号不通过此接口创建（admin 不绑 volunteer，请使用 createAdminAccount）' };
  }

  const existingEmail = await prisma.account.findUnique({ where: { email: aPayload.email } });
  if (existingEmail) return { conflict: `邮箱已存在: ${aPayload.email}` };

  if (vPayload.phone) {
    const existingPhone = await prisma.volunteer.findUnique({ where: { phone: vPayload.phone } });
    if (existingPhone) return { conflict: `手机号已被占用: ${vPayload.phone}` };
  }

  // ─── Generate volunteerCode + create (atomic; retry on code collision) ────
  // Hash once up front so retries (which only re-pick the dedup letter) don't
  // re-hash. A birthday-based code can race another same-day create to the same
  // letter; on that unique conflict we regenerate and retry.
  const passwordHash = await hashPassword(aPayload.password);

  const MAX_CODE_RETRIES = 6;
  let result;
  for (let attempt = 0; ; attempt += 1) {
    const volunteerCode = await IDGenerator.generateVolunteerCode(vPayload.birthday);
    try {
      result = await prisma.$transaction(async (tx) => {
        const v = await tx.volunteer.create({
          data: {
            volunteerCode,
            chineseName: vPayload.chineseName,
            englishName: vPayload.englishName,
            status: VOLUNTEER_STATUS_TO_PG[vPayload.status] || 'ACTIVE',
            region: REGION_TO_PG[vPayload.region] || 'OTHER',
            province: vPayload.province || null,
            subRegion: vPayload.subRegion || null,
            birthday: vPayload.birthday,
            departmentId: vPayload.departmentId,
            email: vPayload.email || null,
            phone: vPayload.phone || null,
          },
          include: { department: true },
        });

        const a = await tx.account.create({
          data: {
            email: aPayload.email,
            passwordHash,
            name: aPayload.name,
            role: aPayload.role,
            volunteerId: v.id,
          },
          include: { volunteer: true },
        });

        return { v, a };
      });
      break;
    } catch (err) {
      if (isVolunteerCodeConflict(err) && attempt < MAX_CODE_RETRIES) continue;
      // email / phone raced between the pre-check and the insert
      if (err?.code === 'P2002') return { conflict: '邮箱或手机号已被占用' };
      throw err;
    }
  }

  return {
    volunteer: serializeVolunteer(result.v),
    account: serializeAccount(result.a),
  };
};

/**
 * Create an admin Account with no Volunteer binding. Only path that allows
 * volunteerId=null (the CHECK constraint exempts role='admin').
 */
export const createAdminAccount = async ({ email, password, name }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password || !name) return { validationError: '邮箱、密码、姓名必填' };
  if (password.length < 8) return { validationError: '密码至少 8 位' };

  const existing = await prisma.account.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { conflict: `邮箱已存在: ${normalizedEmail}` };

  const passwordHash = await hashPassword(password);
  const account = await prisma.account.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      role: 'admin',
      volunteerId: null,
    },
  });
  return { account: serializeAccount(account) };
};

/**
 * List all accounts with their bound volunteer + department. Admin only.
 */
export const listAccounts = async () => {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: 'desc' },
    include: { volunteer: { include: { department: true } } },
  });
  return accounts.map((a) => ({
    ...serializeAccount(a),
    volunteer: a.volunteer ? serializeVolunteer(a.volunteer) : null,
  }));
};

/**
 * Update an account. role/email/name/isActive on the account itself; volunteer
 * fields delegate to VolunteerService.update via the FK.
 */
export const updateAccount = async (accountId, patch, currentUserId) => {
  const target = await prisma.account.findUnique({ where: { id: accountId } });
  if (!target) return { notFound: true };
  if (target.id === currentUserId) return { selfEdit: true };

  const { role, isActive, name, email } = patch;
  if (role && !ALLOWED_ROLES.includes(role)) return { invalidRole: true };
  // v3.7: 不能把账号提升为系统 admin —— 系统 admin 仅由启动时 bootstrap 创建，不可后天授予
  if (role === 'admin' && target.role !== 'admin') {
    return { validationError: '不能将账号提升为系统 admin（系统 admin 仅由初始 bootstrap 创建）' };
  }

  // Cannot demote the last active admin
  if (target.role === 'admin' && role && role !== 'admin') {
    const activeAdmins = await prisma.account.count({ where: { role: 'admin', isActive: true } });
    if (activeAdmins <= 1) return { lastAdmin: true };
  }
  // Promoting to non-admin requires the target to have a volunteer (CHECK constraint)
  if (role && role !== 'admin' && !target.volunteerId) {
    return { validationError: '非 admin 角色必须绑定 volunteer，请先创建 volunteer 关联' };
  }
  // Demoting to admin: clear volunteerId? No — keep it (admin CAN have volunteer, just not required)
  // (intentional: an admin who used to be a volunteer keeps the historical link)

  const data = {};
  if (name) data.name = String(name).trim();
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    const conflict = await prisma.account.findFirst({
      where: { email: normalizedEmail, id: { not: accountId } },
    });
    if (conflict) return { emailTaken: true };
    data.email = normalizedEmail;
  }
  if (role) data.role = role;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const updated = await prisma.account.update({
    where: { id: accountId },
    data,
    include: { volunteer: { include: { department: true } } },
  });
  return { account: serializeAccount(updated) };
};

/**
 * Delete an account and (if bound) its volunteer + cascade. Refuses to delete
 * the last active admin or self.
 */
export const deleteAccount = async (accountId, currentUserId) => {
  const target = await prisma.account.findUnique({ where: { id: accountId } });
  if (!target) return { notFound: true };
  if (target.id === currentUserId) return { selfDelete: true };
  if (target.role === 'admin') {
    const activeAdmins = await prisma.account.count({ where: { role: 'admin', isActive: true } });
    if (activeAdmins <= 1) return { lastAdmin: true };
  }

  const volunteerId = target.volunteerId;

  return prisma.$transaction(async (tx) => {
    // Account first (FK from account → volunteer)
    await tx.account.delete({ where: { id: accountId } });

    if (!volunteerId) return { accountId };

    // Volunteer cascade: refuse if any ProjectSupport references it.
    // Caller must explicitly cleanup support records first.
    const supportCount = await tx.projectSupport.count({
      where: { OR: [{ volunteerId }, { submittedById: volunteerId }] },
    });
    if (supportCount > 0) {
      throw new Error(
        `volunteer 仍有 ${supportCount} 条 ProjectSupport 记录，请先处理（删除或转移）`,
      );
    }

    await tx.volunteer.delete({ where: { id: volunteerId } });
    return { accountId, volunteerId, deleted: { volunteer: 1 } };
  });
};
