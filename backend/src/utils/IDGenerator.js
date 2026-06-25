// src/utils/IDGenerator.js — v2.1
//
// Human-readable IDs:
// - Volunteer.volunteerCode:
//     · birthday-based "MMDDx" (e.g. "0305a") when a birthday is supplied —
//       4-digit month-day + a dedup letter (a→z) for same-day volunteers
//     · legacy "PG-0001" sequential fallback when no birthday is given
// - ProjectSupport.supportId: "PS-{volunteerCode}-{seq3}" — sequential per owner
// - AuditLog.auditId: "AUDIT-{8-char hex}" — non-sequential, race-free
//
// Removed in v2.1: generateApplicationId (ServiceApplication deleted)
// Renamed: generateServiceId → generateSupportId
// Changed: generateAuditId returns a hex-suffix ID (no sequence query)

import crypto from 'crypto';
import prisma from './prismaClient.js';

class IDGenerator {
  /**
   * Generate a new volunteerCode.
   *
   * @param {Date|string|null} birthday - when provided & parseable, the code is
   *   "MMDD" + the next free dedup letter (a→z). Otherwise falls back to the
   *   legacy sequential "PG-NNNN".
   *
   * NOTE: concurrent creates with the same birthday can still race to the same
   *   letter; the caller (AccountService) retries on the volunteerCode unique
   *   conflict, which re-runs this and picks the next free letter.
   */
  static async generateVolunteerCode(birthday = null) {
    const mmdd = this.birthdayToMMDD(birthday);
    return mmdd ? this.nextBirthdayCode(mmdd) : this.nextLegacyCode();
  }

  /** "MMDD" from a Date / parseable date string, or null if unusable. */
  static birthdayToMMDD(birthday) {
    if (!birthday) return null;
    const d = birthday instanceof Date ? birthday : new Date(birthday);
    if (Number.isNaN(d.getTime())) return null;
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${mm}${dd}`;
  }

  /** Next free "MMDDx" code for a given month-day. Throws if a-z exhausted. */
  static async nextBirthdayCode(mmdd) {
    const rows = await prisma.volunteer.findMany({
      where: { volunteerCode: { startsWith: mmdd } },
      select: { volunteerCode: true },
    });
    const re = new RegExp(`^${mmdd}([a-z])$`);
    const taken = new Set();
    for (const r of rows) {
      const m = re.exec(r.volunteerCode);
      if (m) taken.add(m[1]);
    }
    for (let i = 0; i < 26; i += 1) {
      const letter = String.fromCharCode(97 + i);
      if (!taken.has(letter)) return `${mmdd}${letter}`;
    }
    throw new Error(`生日 ${mmdd} 当天志愿者已超过 26 人，无法分配新 code`);
  }

  /** Legacy sequential "PG-NNNN". */
  static async nextLegacyCode() {
    const last = await prisma.volunteer.findFirst({
      where: { volunteerCode: { startsWith: 'PG-' } },
      orderBy: { volunteerCode: 'desc' },
      select: { volunteerCode: true },
    });
    const lastNum = last?.volunteerCode
      ? parseInt(String(last.volunteerCode).split('-')[1] || '0', 10)
      : 0;
    return `PG-${String(lastNum + 1).padStart(4, '0')}`;
  }

  /**
   * Generate the next "PS-{volunteerCode}-{NNN}" supportId for a given owner.
   */
  static async generateSupportId(volunteerCode) {
    if (!this.isValidVolunteerCode(volunteerCode)) {
      throw new Error(`无效的志愿者 code 格式: ${volunteerCode}`);
    }
    const prefix = `PS-${volunteerCode}-`;
    const latest = await prisma.projectSupport.findFirst({
      where: { supportId: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { supportId: true },
    });
    if (!latest) return `${prefix}001`;
    const next = this.extractSequenceFromId(latest.supportId) + 1;
    return `${prefix}${this.formatSequence(next)}`;
  }

  /**
   * Generate a globally-unique audit ID. No sequence query, race-free.
   * Format: "AUDIT-{8 hex chars}".
   */
  static generateAuditId() {
    return `AUDIT-${crypto.randomBytes(4).toString('hex')}`;
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  static extractSequenceFromId(id) {
    const match = id.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  static formatSequence(seq) {
    if (seq < 1 || seq > 999) throw new Error(`序号超出范围 (1-999): ${seq}`);
    return seq.toString().padStart(3, '0');
  }

  static isValidVolunteerCode(code) {
    return /^PG-\d{4}$/.test(code) || /^\d{4}[a-z]$/.test(code);
  }

  static validateIdFormat(id, expectedType = null) {
    const patterns = {
      // birthday-based "MMDDx" or legacy "PG-NNNN"
      volunteer: /^(PG-\d{4}|\d{4}[a-z])$/,
      support: /^PS-(PG-\d{4}|\d{4}[a-z])-\d{3}$/,
      audit: /^AUDIT-[a-f0-9]{8}$/,
    };
    if (!expectedType) {
      for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(id)) return { isValid: true, type };
      }
      return { isValid: false, error: '未知的ID格式' };
    }
    const pattern = patterns[expectedType];
    if (!pattern) return { isValid: false, error: `未知的类型: ${expectedType}` };
    const isValid = pattern.test(id);
    return { isValid, type: expectedType, error: isValid ? null : 'ID格式不正确' };
  }
}

export default IDGenerator;
