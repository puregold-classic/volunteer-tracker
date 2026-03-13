// src/controllers/adminController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// hashPassword is now from passwordUtils (was on Mongoose Account model).

import prisma from '../utils/prismaClient.js';
import { hashPassword } from '../utils/passwordUtils.js';
import {
  serializeAccount,
  serializeVolunteer,
  VOLUNTEER_STATUS_TO_PG,
  REGION_TO_PG,
  SERVICE_TYPE_TO_PG,
} from '../utils/pgSerializer.js';

const ALLOWED_ROLES = ['user', 'b_admin', 'a_admin', 'admin'];
const ALLOWED_STATUSES = ['在职', '不在职'];
const ALLOWED_REGIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他'];
const ALLOWED_SERVICES = ['翻译', '校对', '管理', '技术'];

const parseBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  cells.push(current.trim());
  return cells.map(v => v.replace(/^"|"$/g, '').trim());
};

const toRowsFromCsv = (csvText) => {
  const lines = String(csvText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
};

const pick = (obj, keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return '';
};

const buildVolunteerFromRow = (row, fallbackId) => {
  const id = fallbackId;
  const chineseName = pick(row, ['chineseName', '中文姓名', '姓名']) || '';
  const englishName = pick(row, ['englishName', '英文姓名']) || chineseName || '';
  const status = pick(row, ['status', '状态']) || '在职';
  const region = pick(row, ['region', '地区']) || '其他';
  const province = pick(row, ['province', '省份']) || '';
  const subRegion = pick(row, ['subRegion', '子地区']) || '';
  const email = pick(row, ['email', '邮箱']) || '';
  const username = pick(row, ['username', '用户名', '账号']) || '';
  const phone = pick(row, ['phone', '电话']) || '';
  const role = pick(row, ['role', '角色']) || 'user';
  const servicesRaw = pick(row, ['services', '服务方向', '方向']) || '';
  const services = servicesRaw.split(/[、,，|/]/).map(item => item.trim()).filter(Boolean);
  return { id, chineseName, englishName, status, region, province, subRegion, services, email, username, phone, role };
};

const validateVolunteerPayload = (payload) => {
  if (!payload.id || !/^[A-Z]+-\d{4}$/.test(payload.id)) return '志愿者ID格式错误（需为如 PG-0001）';
  if (!payload.chineseName) return '中文姓名必填';
  if (!payload.englishName) return '英文姓名必填';
  if (!ALLOWED_STATUSES.includes(payload.status)) return `状态非法: ${payload.status}`;
  if (!ALLOWED_REGIONS.includes(payload.region)) return `地区非法: ${payload.region}`;
  if (['中国大陆', '中国台湾'].includes(payload.region) && !payload.province) return `${payload.region}必须填写省份`;
  if (!ALLOWED_ROLES.includes(payload.role)) return `角色非法: ${payload.role}`;
  const invalidService = payload.services.find(item => !ALLOWED_SERVICES.includes(item));
  if (invalidService) return `服务方向非法: ${invalidService}`;
  return '';
};

const getNextVolunteerId = async () => {
  // Find the highest PG-NNNN volunteerId
  const last = await prisma.volunteer.findFirst({
    where: { volunteerId: { startsWith: 'PG-', not: 'PG-0000' } },
    orderBy: { volunteerId: 'desc' },
    select: { volunteerId: true },
  });
  const lastNum = last?.volunteerId ? Number(String(last.volunteerId).split('-')[1]) : 0;
  return `PG-${String(lastNum + 1).padStart(4, '0')}`;
};

const buildGeneratedEmail = async (volunteer, usedEmailSet) => {
  const localName = String(volunteer.username || '').trim().toLowerCase().replace(/\s+/g, '.');
  const fallbackLocal = localName || volunteer.id.toLowerCase();
  const base = (volunteer.email || `${fallbackLocal}@volunteer.local`).toLowerCase();
  if (!usedEmailSet.has(base)) return base;
  let n = 2;
  while (true) {
    const candidate = base.includes('@')
      ? `${base.split('@')[0]}-${n}@${base.split('@')[1]}`
      : `${base}-${n}`;
    if (!usedEmailSet.has(candidate)) return candidate;
    n += 1;
  }
};

const ensureAccountForVolunteer = async (volunteer, defaultPassword, usedEmailSet) => {
  const existing = await prisma.account.findUnique({ where: { volunteerId: volunteer.id }, select: { id: true, email: true } });
  if (existing) return { created: false, accountId: existing.id, email: '' };
  const email = await buildGeneratedEmail(volunteer, usedEmailSet);
  usedEmailSet.add(email);
  const passwordHash = await hashPassword(defaultPassword);
  const account = await prisma.account.create({
    data: { email, passwordHash, name: volunteer.chineseName, role: 'user', volunteerId: volunteer.id },
  });
  return { created: true, accountId: account.id, email };
};

class AdminController {
  static async resetToSystemAdmin(req, res) {
    try {
      const { confirm } = req.body;
      if (confirm !== 'RESET') {
        return res.status(400).json({ success: false, error: '请提供 confirm=RESET 以确认清空数据' });
      }

      const systemEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
      const systemName = process.env.ADMIN_NAME || 'System Admin';
      const systemPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

      let admin = await prisma.account.findUnique({ where: { email: systemEmail } });
      if (!admin) {
        const passwordHash = await hashPassword(systemPassword);
        admin = await prisma.account.create({
          data: { email: systemEmail, passwordHash, name: systemName, role: 'admin', volunteerId: 'PG-0000', isActive: true },
        });
      } else {
        admin = await prisma.account.update({
          where: { id: admin.id },
          data: { role: 'admin', volunteerId: 'PG-0000', isActive: true },
        });
      }

      const [volunteers, services, applications, audits, accounts] = await Promise.all([
        prisma.volunteer.deleteMany({}),
        prisma.nonProjectService.deleteMany({}),
        prisma.serviceApplication.deleteMany({}),
        prisma.auditLog.deleteMany({}),
        prisma.account.deleteMany({ where: { id: { not: admin.id } } }),
      ]);

      return res.status(200).json({
        success: true,
        message: '系统数据已清空，仅保留系统管理员账号',
        data: {
          systemAdmin: serializeAccount(admin),
          deleted: {
            volunteers: volunteers.count,
            services: services.count,
            applications: applications.count,
            audits: audits.count,
            accounts: accounts.count,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '重置失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async importVolunteers(req, res) {
    try {
      const { rows = [], csvText = '', createAccounts = true, defaultPassword = 'Volunteer@123' } = req.body;
      const parsedRows = Array.isArray(rows) && rows.length > 0 ? rows : toRowsFromCsv(csvText);

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        return res.status(400).json({ success: false, error: '未提供可导入数据（rows或csvText）' });
      }

      const existingEmails = await prisma.account.findMany({ select: { email: true } });
      const usedEmailSet = new Set(existingEmails.map(item => item.email.toLowerCase()));

      const nextId = await getNextVolunteerId();
      let nextNum = Number(nextId.split('-')[1]);

      const result = { total: parsedRows.length, createdVolunteers: 0, updatedVolunteers: 0, createdAccounts: 0, skipped: 0, errors: [] };

      for (let idx = 0; idx < parsedRows.length; idx += 1) {
        const row = parsedRows[idx];
        const fallbackId = `PG-${String(nextNum).padStart(4, '0')}`;
        const payload = buildVolunteerFromRow(row, fallbackId);
        nextNum += 1;

        const validationError = validateVolunteerPayload(payload);
        if (validationError) {
          result.skipped += 1;
          result.errors.push({ row: idx + 1, volunteerId: payload.id || '', error: validationError });
          continue;
        }

        try {
          await prisma.volunteer.create({
            data: {
              volunteerId: payload.id,
              chineseName: payload.chineseName,
              englishName: payload.englishName,
              status: VOLUNTEER_STATUS_TO_PG[payload.status] || 'ACTIVE',
              region: REGION_TO_PG[payload.region] || 'OTHER',
              province: payload.province || undefined,
              subRegion: payload.subRegion || undefined,
              services: payload.services.map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean),
              email: payload.email || undefined,
              phone: payload.phone || undefined,
              role: ALLOWED_ROLES.includes(payload.role) ? payload.role : 'user',
            },
          });
          result.createdVolunteers += 1;

          if (parseBoolean(createAccounts, true)) {
            const accountResult = await ensureAccountForVolunteer(
              { id: payload.id, chineseName: payload.chineseName, email: payload.email, username: payload.username },
              defaultPassword,
              usedEmailSet
            );
            if (accountResult.created) result.createdAccounts += 1;
          }
        } catch (err) {
          result.skipped += 1;
          result.errors.push({ row: idx + 1, volunteerId: payload.id, error: err.message });
        }
      }

      return res.status(200).json({ success: true, message: '导入完成', data: result });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '导入失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async createVolunteerWithAccount(req, res) {
    try {
      const {
        chineseName = '', englishName = '',
        status = '在职', region = '其他',
        province = '', subRegion = '', services = [],
        email = '', username = '', phone = '', role = 'user',
        createAccount = true, defaultPassword = 'Volunteer@123',
      } = req.body;

      const nextId = await getNextVolunteerId();
      const payload = {
        id: nextId,
        chineseName: String(chineseName).trim(),
        englishName: String(englishName).trim() || String(chineseName).trim(),
        status: String(status).trim(),
        region: String(region).trim(),
        province: String(province).trim(),
        subRegion: String(subRegion).trim(),
        services: Array.isArray(services) ? services : String(services || '').split(/[、,，|/]/).map(item => item.trim()).filter(Boolean),
        email: String(email).trim(),
        username: String(username).trim(),
        phone: String(phone).trim(),
        role: String(role).trim(),
      };

      const validationError = validateVolunteerPayload(payload);
      if (validationError) {
        return res.status(400).json({ success: false, error: validationError });
      }

      const volunteer = await prisma.volunteer.create({
        data: {
          volunteerId: payload.id,
          chineseName: payload.chineseName,
          englishName: payload.englishName,
          status: VOLUNTEER_STATUS_TO_PG[payload.status] || 'ACTIVE',
          region: REGION_TO_PG[payload.region] || 'OTHER',
          province: payload.province || undefined,
          subRegion: payload.subRegion || undefined,
          services: payload.services.map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean),
          email: payload.email || undefined,
          phone: payload.phone || undefined,
          role: ALLOWED_ROLES.includes(payload.role) ? payload.role : 'user',
        },
      });

      let accountData = null;
      if (parseBoolean(createAccount, true)) {
        const existingEmails = await prisma.account.findMany({ select: { email: true } });
        const usedEmailSet = new Set(existingEmails.map(item => item.email.toLowerCase()));
        const accountResult = await ensureAccountForVolunteer(
          { id: payload.id, chineseName: payload.chineseName, email: payload.email, username: payload.username },
          defaultPassword,
          usedEmailSet
        );
        accountData = accountResult.created ? { accountId: accountResult.accountId, email: accountResult.email } : null;
      }

      return res.status(201).json({
        success: true,
        message: '志愿者创建成功',
        data: {
          volunteer: { id: volunteer.volunteerId, chineseName: volunteer.chineseName, englishName: volunteer.englishName },
          account: accountData,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '创建志愿者失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async generateMissingAccounts(req, res) {
    try {
      const { defaultPassword = 'Volunteer@123' } = req.body;
      const volunteers = await prisma.volunteer.findMany({ select: { volunteerId: true, chineseName: true, email: true } });
      const existingEmails = await prisma.account.findMany({ select: { email: true } });
      const usedEmailSet = new Set(existingEmails.map(item => item.email.toLowerCase()));

      let created = 0;
      for (const volunteer of volunteers) {
        const result = await ensureAccountForVolunteer(
          { id: volunteer.volunteerId, chineseName: volunteer.chineseName, email: volunteer.email, username: '' },
          defaultPassword,
          usedEmailSet
        );
        if (result.created) created += 1;
      }

      return res.status(200).json({
        success: true,
        message: '已完成账号生成',
        data: { scannedVolunteers: volunteers.length, createdAccounts: created },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '生成账号失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async listAccounts(req, res) {
    try {
      const accounts = await prisma.account.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const volunteerIds = accounts.map(a => a.volunteerId).filter(Boolean);
      const volunteers = await prisma.volunteer.findMany({
        where: { volunteerId: { in: volunteerIds } },
        select: { volunteerId: true, chineseName: true, region: true },
      });
      const volunteerMap = new Map(volunteers.map(v => [v.volunteerId, v]));

      return res.status(200).json({
        success: true,
        data: accounts.map(account => ({
          ...serializeAccount(account),
          volunteer: account.volunteerId ? volunteerMap.get(account.volunteerId) || null : null,
        })),
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: '获取账号列表失败' });
    }
  }

  static async updateAccount(req, res) {
    try {
      const { accountId } = req.params;
      const { role, isActive, name, email, volunteer } = req.body;

      const target = await prisma.account.findUnique({ where: { id: accountId } });
      if (!target) {
        return res.status(404).json({ success: false, error: '账号不存在' });
      }
      if (target.id === req.user.accountId) {
        return res.status(400).json({ success: false, error: '不能修改当前系统管理员自身账号' });
      }
      if (role && !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: `role必须是: ${ALLOWED_ROLES.join(', ')}` });
      }
      if (target.role === 'admin' && role && role !== 'admin') {
        const activeAdmins = await prisma.account.count({ where: { role: 'admin', isActive: true } });
        if (activeAdmins <= 1) {
          return res.status(400).json({ success: false, error: '系统至少需要保留一个admin账号' });
        }
      }

      const updateData = {};
      if (name) updateData.name = String(name).trim();
      if (email) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const emailExists = await prisma.account.findFirst({
          where: { email: normalizedEmail, id: { not: accountId } },
        });
        if (emailExists) {
          return res.status(409).json({ success: false, error: '邮箱已被其他账号占用' });
        }
        updateData.email = normalizedEmail;
      }
      if (role) updateData.role = role;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;

      const updated = await prisma.account.update({ where: { id: accountId }, data: updateData });

      // Sync volunteer data if bound to a real volunteer
      if (target.volunteerId && /^PG-\d{4}$/i.test(target.volunteerId) && target.volunteerId !== 'PG-0000') {
        const volunteerUpdate = {};
        if (role) volunteerUpdate.role = role;
        if (volunteer && typeof volunteer === 'object') {
          if (volunteer.chineseName !== undefined) volunteerUpdate.chineseName = String(volunteer.chineseName).trim();
          if (volunteer.englishName !== undefined) volunteerUpdate.englishName = String(volunteer.englishName).trim();
          if (volunteer.status !== undefined) volunteerUpdate.status = VOLUNTEER_STATUS_TO_PG[volunteer.status] ?? volunteer.status;
          if (volunteer.region !== undefined) volunteerUpdate.region = REGION_TO_PG[volunteer.region] ?? volunteer.region;
          if (volunteer.province !== undefined) volunteerUpdate.province = String(volunteer.province).trim() || undefined;
          if (volunteer.phone !== undefined) volunteerUpdate.phone = String(volunteer.phone).trim() || undefined;
          if (volunteer.email !== undefined) volunteerUpdate.email = String(volunteer.email).trim().toLowerCase() || undefined;
          if (volunteer.services !== undefined) {
            const svcs = Array.isArray(volunteer.services)
              ? volunteer.services
              : String(volunteer.services || '').split(/[、,，|/]/).map(item => item.trim()).filter(Boolean);
            volunteerUpdate.services = svcs.map(s => SERVICE_TYPE_TO_PG[s] ?? s).filter(Boolean);
          }
        }
        if (Object.keys(volunteerUpdate).length > 0) {
          await prisma.volunteer.updateMany({ where: { volunteerId: target.volunteerId }, data: volunteerUpdate });
        }
      }

      return res.status(200).json({ success: true, message: '账号信息更新成功', data: serializeAccount(updated) });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '更新账号信息失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const { accountId } = req.params;
      const target = await prisma.account.findUnique({ where: { id: accountId } });
      if (!target) {
        return res.status(404).json({ success: false, error: '账号不存在' });
      }
      if (target.id === req.user.accountId) {
        return res.status(400).json({ success: false, error: '不能删除当前系统管理员自身账号' });
      }

      const volunteerId = target.volunteerId;
      await prisma.account.delete({ where: { id: accountId } });

      if (volunteerId && /^PG-\d{4}$/i.test(volunteerId) && volunteerId !== 'PG-0000') {
        const [volunteerResult, serviceResult, applicationResult, auditResult] = await Promise.all([
          prisma.volunteer.deleteMany({ where: { volunteerId } }),
          prisma.nonProjectService.deleteMany({ where: { volunteerId } }),
          prisma.serviceApplication.deleteMany({ where: { volunteerId } }),
          // auditLog operator/submitter are JSONB — use raw for cascade delete
          prisma.$queryRaw`
            DELETE FROM audit_logs
            WHERE operator->>'id' = ${volunteerId}
               OR submitter->>'id' = ${volunteerId}
          `,
        ]);

        return res.status(200).json({
          success: true,
          message: '账号及关联用户信息已删除',
          data: {
            accountId,
            volunteerId,
            deleted: {
              volunteer: volunteerResult.count,
              services: serviceResult.count,
              applications: applicationResult.count,
              audits: typeof auditResult === 'number' ? auditResult : 0,
            },
          },
        });
      }

      return res.status(200).json({ success: true, message: '账号已删除', data: { accountId } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: '删除账号失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}

export default AdminController;
