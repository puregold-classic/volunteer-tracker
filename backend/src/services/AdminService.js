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
import { createVolunteerAccount, createAdminAccount } from './AccountService.js';
import { serializeAccount } from '../utils/serializer.js';

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

const toRowsFromCsv = (csvText) => {
  const lines = String(csvText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
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
} = {}) => {
  const parsedRows = Array.isArray(rows) && rows.length > 0 ? rows : toRowsFromCsv(csvText);
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    return { noData: true };
  }

  const result = {
    total: parsedRows.length,
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (let idx = 0; idx < parsedRows.length; idx += 1) {
    const row = parsedRows[idx];
    const volunteer = {
      chineseName: pick(row, ['chineseName', '中文姓名', '姓名']),
      englishName: pick(row, ['englishName', '英文姓名']),
      status: pick(row, ['status', '状态']) || '在职',
      region: pick(row, ['region', '地区']) || '其他',
      province: pick(row, ['province', '省份']),
      subRegion: pick(row, ['subRegion', '子地区']),
      departmentId: pick(row, ['departmentId', '部门', '部门ID']),
      email: pick(row, ['email', '邮箱']),
      phone: pick(row, ['phone', '电话']),
      birthday: pick(row, ['birthday', '生日', '出生日期']),
    };
    const account = {
      email: pick(row, ['email', '邮箱']),
      password: pick(row, ['password', '密码']) || defaultPassword,
      name: pick(row, ['name', '账号姓名']) || volunteer.chineseName,
      role: pick(row, ['role', '角色']) || 'user',
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
