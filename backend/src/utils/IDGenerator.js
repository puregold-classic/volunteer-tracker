// src/utils/IDGenerator.js
// Phase 5: Switched from Mongoose model lookups to Prisma.
// ID format is unchanged: {PREFIX}-{relatedId}-{seq3}
// e.g. APP-PG-0001-001, NPS-PG-0001-001, AUDIT-PG-9001-001

import prisma from './prismaClient.js';

class IDGenerator {

  static async generateApplicationId(submitterId) {
    if (!this.isValidVolunteerId(submitterId)) {
      throw new Error(`无效的提交人ID格式: ${submitterId}`);
    }
    const nextSeq = await this.getNextApplicationSequence(submitterId);
    return `APP-${submitterId}-${this.formatSequence(nextSeq)}`;
  }

  static async generateServiceId(volunteerId) {
    if (!this.isValidVolunteerId(volunteerId)) {
      throw new Error(`无效的志愿者ID格式: ${volunteerId}`);
    }
    const nextSeq = await this.getNextServiceSequence(volunteerId);
    return `NPS-${volunteerId}-${this.formatSequence(nextSeq)}`;
  }

  static async generateAuditId(reviewerId) {
    if (!this.isValidVolunteerId(reviewerId)) {
      throw new Error(`无效的审核人ID格式: ${reviewerId}`);
    }
    const nextSeq = await this.getNextAuditSequence(reviewerId);
    return `AUDIT-${reviewerId}-${this.formatSequence(nextSeq)}`;
  }

  // ─── private ──────────────────────────────────────────────────────────────

  static async getNextApplicationSequence(submitterId) {
    const prefix = `APP-${submitterId}-`;
    const latest = await prisma.serviceApplication.findFirst({
      where: { applicationId: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { applicationId: true },
    });
    if (!latest) return 1;
    return this.extractSequenceFromId(latest.applicationId) + 1;
  }

  static async getNextServiceSequence(volunteerId) {
    const prefix = `NPS-${volunteerId}-`;
    const latest = await prisma.nonProjectService.findFirst({
      where: { serviceId: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { serviceId: true },
    });
    if (!latest) return 1;
    return this.extractSequenceFromId(latest.serviceId) + 1;
  }

  static async getNextAuditSequence(reviewerId) {
    const prefix = `AUDIT-${reviewerId}-`;
    const latest = await prisma.auditLog.findFirst({
      where: { auditId: { startsWith: prefix } },
      orderBy: { timestamp: 'desc' },
      select: { auditId: true },
    });
    if (!latest) return 1;
    return this.extractSequenceFromId(latest.auditId) + 1;
  }

  static extractSequenceFromId(id) {
    const match = id.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  static formatSequence(seq) {
    if (seq < 1 || seq > 999) throw new Error(`序号超出范围 (1-999): ${seq}`);
    return seq.toString().padStart(3, '0');
  }

  static isValidVolunteerId(id) {
    return /^[A-Z]+-\d{3,}$/.test(id);
  }

  static validateIdFormat(id, expectedType = null) {
    const patterns = {
      application: /^APP-[A-Z]+-\d{3,}-\d{3}$/,
      service: /^NPS-[A-Z]+-\d{3,}-\d{3}$/,
      audit: /^AUDIT-[A-Z]+-\d{3,}-\d{3}$/,
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
    return { isValid, type: expectedType, error: isValid ? null : `ID格式不正确` };
  }
}

export default IDGenerator;
