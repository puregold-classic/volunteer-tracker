// src/utils/IDGenerator.js — v2.1
//
// Human-readable IDs:
// - Volunteer.volunteerCode: "PG-0001" — sequential per system
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
   * Generate the next "PG-NNNN" code for a new Volunteer.
   * Scans existing volunteerCode values and increments.
   */
  static async generateVolunteerCode() {
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

  /**
   * Generate the next "PROJ-NNNN" projectCode. Sequential across the
   * whole system; projects are low-volume so no per-department scoping.
   */
  static async generateProjectCode() {
    const last = await prisma.project.findFirst({
      where: { projectCode: { startsWith: 'PROJ-' } },
      orderBy: { projectCode: 'desc' },
      select: { projectCode: true },
    });
    const lastNum = last?.projectCode
      ? parseInt(String(last.projectCode).split('-')[1] || '0', 10)
      : 0;
    return `PROJ-${String(lastNum + 1).padStart(4, '0')}`;
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
    return /^PG-\d{4}$/.test(code);
  }

  static validateIdFormat(id, expectedType = null) {
    const patterns = {
      volunteer: /^PG-\d{4}$/,
      support: /^PS-PG-\d{4}-\d{3}$/,
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
