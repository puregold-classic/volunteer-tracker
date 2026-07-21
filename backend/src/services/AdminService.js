// src/services/AdminService.js — v2.1
//
// Admin-only operations that don't fit into other services:
// - resetToSystemAdmin: nuke all volunteer/support/audit data (dev sandbox use)
// - importVolunteersCsv: bulk-create Volunteer+Account pairs from CSV
//
// All single-account operations live in AccountService. v1's
// generateMissingAccounts is gone — under v2.1 every volunteer has an account
// by construction (atomic creation).

import prisma from '../utils/prismaClient.js';
import {
  createVolunteerAccount, createAdminAccount,
  ALLOWED_ROLES, ALLOWED_STATUSES, ALLOWED_REGIONS,
} from './AccountService.js';
import { isValidProvince } from '../utils/provinces.js';
import { serializeAccount } from '../utils/serializer.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Map a CSV row → the same field object importVolunteersCsv builds (so validate
// and import stay in lockstep). Kept module-level for reuse by both.
const rowToVolunteerFields = (row) => ({
  chineseName: pick(row, ['chineseName', '中文姓名', '姓名']),
  englishName: pick(row, ['englishName', '英文姓名']),
  status: pick(row, ['status', '状态']) || '在职',
  region: pick(row, ['region', '地区']) || '其他',
  province: pick(row, ['province', '省份']),
  departmentId: pick(row, ['departmentId', '部门', '部门ID']),
  email: pick(row, ['email', '邮箱']),
  phone: pick(row, ['phone', '电话', '手机号', '手机']),
  role: pick(row, ['role', '角色']) || 'user',
  birthday: pick(row, ['birthday', '生日', '出生日期']),
});

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
  return cells.map((v) => v.replace(/^"|"$/g, '').trim());
};

// v3.7: 支持 Excel 直接粘贴（Tab 分隔）+ 无表头的定位模式 + 逗号 CSV。
// - 分隔符：任一行含 Tab → Tab 模式（Excel 复制）；否则逗号。
// - 表头：首行有已知字段名 → 按表头映射；否则按固定列序（POSITIONAL_ORDER）。
const HEADER_TOKENS = new Set([
  'chineseName', '中文姓名', '姓名', 'englishName', '英文姓名', 'status', '状态',
  'region', '地区', 'province', '省份', 'departmentId', '部门', '部门ID', 'email', '邮箱',
  'phone', '电话', '手机号', '手机', 'role', '角色', 'birthday', '生日', '出生日期', 'password', '密码', 'name', '账号姓名',
]);
// ⚠️ 必须和 Excel 模板（scripts/gen-volunteer-template.py 的 HEADERS）列序完全一致，
// 否则用户只复制数据行（无表头）时会错位。模板列序：中文名·英文名·状态·地区·省份·部门·邮箱·手机号·生日·角色
const POSITIONAL_ORDER = ['chineseName', 'englishName', 'status', 'region', 'province', 'departmentId', 'email', 'phone', 'birthday', 'role', 'password'];

const splitLine = (line, delim) => (delim === '\t'
  ? line.split('\t').map((v) => v.trim())
  : parseCsvLine(line));

const parseImportText = (text) => {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = lines.some((l) => l.includes('\t')) ? '\t' : ',';
  const firstCells = splitLine(lines[0], delim);
  const hasHeader = firstCells.some((c) => HEADER_TOKENS.has(c));

  if (hasHeader) {
    return lines.slice(1).map((line) => {
      const values = splitLine(line, delim);
      const row = {};
      firstCells.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return row;
    });
  }
  // 无表头：按固定列序定位
  return lines.map((line) => {
    const values = splitLine(line, delim);
    const row = {};
    POSITIONAL_ORDER.forEach((key, i) => { row[key] = values[i] ?? ''; });
    return row;
  });
};

// 部门可写 id（NET_TECH）或中文名（网络技术部）。解析成 id；解析不出返回 ''。
const buildDeptResolver = async () => {
  const depts = await prisma.department.findMany({ select: { id: true, name: true } });
  const byId = new Set(depts.map((d) => d.id));
  const byName = new Map(depts.map((d) => [d.name, d.id]));
  return (raw) => {
    const v = String(raw ?? '').trim();
    if (!v) return '';
    if (byId.has(v)) return v;
    return byName.get(v) || '';
  };
};

const pick = (obj, keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return '';
};

/**
 * Wipe all volunteer / support / audit data and ensure a system admin exists.
 * For dev sandbox use only. Requires confirm='RESET' to fire.
 */
export const resetToSystemAdmin = async ({ confirm }) => {
  if (confirm !== 'RESET') return { invalidConfirm: true };

  const systemEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const systemName = process.env.ADMIN_NAME || 'System Admin';
  const systemPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

  // Order matters: Account → Volunteer (FK), then ProjectSupport must go before
  // Volunteer (FK), AuditLog can go any time.
  await prisma.$transaction([
    prisma.projectSupport.deleteMany({}),
    prisma.account.deleteMany({}),
    prisma.volunteer.deleteMany({}),
    prisma.auditLog.deleteMany({}),
  ]);

  const result = await createAdminAccount({
    email: systemEmail,
    password: systemPassword,
    name: systemName,
  });

  if (result.validationError || result.conflict) {
    return { error: result.validationError || result.conflict };
  }

  return {
    systemAdmin: result.account,
    deleted: 'all data wiped',
  };
};

/**
 * v3.7: 提交前的**逐行 dry-run 校验**。不写库，返回每行是否规范 + 具体错在哪。
 * 覆盖：必填（中/英文名/邮箱/部门）、状态/地区/角色枚举合法、**部门存在**、
 * **省份规范全名**（大陆/台湾必填且为规范省名，如 辽宁省 而非 辽宁）、
 * 邮箱格式/已占用/本批次内重复、生日可解析。
 */
// scope（v3.8 部长导入用）：{ forceDepartmentId, allowedRoles } —— 强制每行部门 + 限定可导入角色。
export const validateVolunteersCsv = async ({ rows = [], csvText = '', scope = null } = {}) => {
  const parsedRows = Array.isArray(rows) && rows.length > 0 ? rows : parseImportText(csvText);
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) return { noData: true };

  const [resolveDept, accounts] = await Promise.all([
    buildDeptResolver(),
    prisma.account.findMany({ select: { email: true } }),
  ]);
  const takenEmails = new Set(accounts.map((a) => a.email.toLowerCase()));
  const seenEmails = new Set(); // 本批次内查重

  const outRows = parsedRows.map((row, idx) => {
    const f = rowToVolunteerFields(row);
    // v3.8 部长导入：部门强制归本部门（忽略表格里的部门列）
    if (scope?.forceDepartmentId) f.departmentId = scope.forceDepartmentId;
    const errors = [];

    if (!f.chineseName) errors.push('中文姓名必填');
    if (scope?.allowedRoles && !scope.allowedRoles.includes(f.role)) {
      errors.push(`角色越权: "${f.role}"（部长只能导入 志愿者(user) / 录入员(b_admin)）`);
    }
    if (!ALLOWED_STATUSES.includes(f.status)) errors.push(`状态不规范: "${f.status}"（应为 在职/不在职）`);
    if (!ALLOWED_REGIONS.includes(f.region)) errors.push(`地区不规范: "${f.region}"`);

    if (['中国大陆', '中国台湾'].includes(f.region)) {
      if (!f.province) errors.push(`${f.region} 必须填省份`);
      else if (f.region === '中国台湾' && f.province !== '台湾省') errors.push(`台湾省份应为 "台湾省"，收到 "${f.province}"`);
      else if (f.region === '中国大陆' && !isValidProvince(f.province)) errors.push(`省份不规范: "${f.province}"（需规范全名，如 辽宁省 而非 辽宁）`);
    }

    const resolvedDeptId = resolveDept(f.departmentId);
    if (!f.departmentId) errors.push('必须指定部门');
    else if (!resolvedDeptId) errors.push(`部门不存在/不规范: "${f.departmentId}"（用部门名如 网络技术部 或 id 如 NET_TECH）`);

    if (!ALLOWED_ROLES.includes(f.role)) errors.push(`角色不规范: "${f.role}"`);

    if (!f.email) errors.push('邮箱必填');
    else if (!EMAIL_RE.test(f.email)) errors.push(`邮箱格式错误: "${f.email}"`);
    else {
      const lower = f.email.toLowerCase();
      if (takenEmails.has(lower)) errors.push(`邮箱已被占用: ${f.email}`);
      if (seenEmails.has(lower)) errors.push(`邮箱在本次导入中重复: ${f.email}`);
      seenEmails.add(lower);
    }

    if (f.birthday && Number.isNaN(new Date(f.birthday).getTime())) errors.push(`生日无法解析: "${f.birthday}"`);

    return { row: idx + 1, chineseName: f.chineseName, email: f.email, departmentId: f.departmentId, ok: errors.length === 0, errors };
  });

  const validCount = outRows.filter((r) => r.ok).length;
  return { total: outRows.length, validCount, invalidCount: outRows.length - validCount, rows: outRows };
};

/**
 * Bulk-import volunteer+account pairs from CSV. Each row creates a
 * Volunteer + Account atomically via AccountService.createVolunteerAccount.
 *
 * Expected CSV columns (Chinese aliases supported):
 *   chineseName / 中文姓名, englishName / 英文姓名,
 *   email / 邮箱, phone / 电话,
 *   region / 地区, province / 省份, subRegion / 子地区,
 *   departmentId / 部门, role / 角色, status / 状态,
 *   birthday / 生日 (YYYY-MM-DD; 给了就用生日制 code，否则 PG-NNNN)
 *
 * For each row, password defaults to defaultPassword. Errors are collected
 * and reported per-row; the import continues past failures.
 */
export const importVolunteersCsv = async ({
  rows = [],
  csvText = '',
  defaultPassword = 'Volunteer@123',
  scope = null, // v3.8 部长导入：{ forceDepartmentId, allowedRoles }
} = {}) => {
  const parsedRows = Array.isArray(rows) && rows.length > 0 ? rows : parseImportText(csvText);
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    return { noData: true };
  }

  const resolveDept = await buildDeptResolver();

  const result = {
    total: parsedRows.length,
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (let idx = 0; idx < parsedRows.length; idx += 1) {
    const row = parsedRows[idx];
    const f = rowToVolunteerFields(row);
    // v3.8 部长导入：部门强制本部门；角色越权直接跳过
    if (scope?.forceDepartmentId) f.departmentId = scope.forceDepartmentId;
    if (scope?.allowedRoles && !scope.allowedRoles.includes(f.role)) {
      result.skipped += 1;
      result.errors.push({ row: idx + 1, error: `角色越权: "${f.role}"（部长只能导入 user/b_admin）` });
      continue;
    }
    // 部门可写 id 或中文名；解析成 id（解析不出保留原值让下游 createVolunteerAccount 报"部门不存在"）
    const departmentId = resolveDept(f.departmentId) || f.departmentId;
    const volunteer = {
      chineseName: f.chineseName,
      englishName: f.englishName,
      status: f.status,
      region: f.region,
      province: f.province,
      subRegion: pick(row, ['subRegion', '子地区']),
      departmentId,
      email: f.email,
      phone: f.phone,
      birthday: f.birthday,
    };
    const account = {
      email: f.email,
      password: pick(row, ['password', '密码']) || defaultPassword,
      name: pick(row, ['name', '账号姓名']) || f.chineseName,
      role: f.role,
    };

    try {
      const r = await createVolunteerAccount({ volunteer, account });
      if (r.validationError) {
        result.skipped += 1;
        result.errors.push({ row: idx + 1, error: r.validationError });
      } else if (r.conflict) {
        result.skipped += 1;
        result.errors.push({ row: idx + 1, error: r.conflict });
      } else {
        result.created += 1;
      }
    } catch (err) {
      result.skipped += 1;
      result.errors.push({ row: idx + 1, error: err.message });
    }
  }

  return result;
};
