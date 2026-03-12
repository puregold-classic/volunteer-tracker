// src/utils/validationUtils.js
// Phase 5: Switched from Mongoose to Prisma.

import prisma from './prismaClient.js';

class ValidationUtils {
  static async validateVolunteer(volunteerId) {
    try {
      const volunteer = await prisma.volunteer.findFirst({
        where: { volunteerId },
      });
      if (!volunteer) {
        return { isValid: false, error: `志愿者不存在: ${volunteerId}` };
      }
      return { isValid: true, volunteer, message: '志愿者验证通过' };
    } catch (error) {
      return { isValid: false, error: `验证志愿者失败: ${error.message}` };
    }
  }

  static async validateTargetRecord(targetId, volunteerId) {
    try {
      if (!targetId || !targetId.startsWith('NPS-')) {
        return { isValid: false, error: `无效的服务记录ID格式: ${targetId}` };
      }

      const targetRecord = await prisma.nonProjectService.findFirst({
        where: { serviceId: targetId, isActive: true },
      });

      if (!targetRecord) {
        return { isValid: false, error: `服务记录不存在或已被删除: ${targetId}` };
      }

      if (targetRecord.volunteerId !== volunteerId) {
        return { isValid: false, error: `服务记录不属于志愿者 ${volunteerId}` };
      }

      return { isValid: true, record: targetRecord, message: '目标记录验证通过' };
    } catch (error) {
      return { isValid: false, error: `验证目标记录失败: ${error.message}` };
    }
  }

  static validateChanges(changes, applicationType, existingRecord = null) {
    if (!Array.isArray(changes) || changes.length === 0) {
      return { isValid: false, error: '变更数据不能为空' };
    }

    const errors = [];
    const validatedChanges = [];

    const fieldRules = {
      serviceDate: {
        type: 'string',
        required: applicationType === 'create',
        validate: (value) => {
          const date = new Date(value);
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return !isNaN(date) && date <= today;
        },
        error: '服务日期必须是有效日期且不能是未来',
      },
      serviceType: {
        type: 'string',
        required: applicationType === 'create',
        validate: (value) => ['翻译', '校对', '管理', '技术'].includes(value),
        error: '服务类型必须是: 翻译, 校对, 管理, 技术',
      },
      duration: {
        type: 'number',
        required: applicationType === 'create',
        validate: (value) => typeof value === 'number' && value > 0 && value % 0.5 === 0,
        error: '服务时长必须是大于0的数字且是0.5的倍数',
      },
      description: {
        type: 'string',
        required: applicationType === 'create',
        validate: (value) => typeof value === 'string' && value.trim().length >= 5 && value.trim().length <= 1000,
        error: '服务描述必须是5-1000个字符的字符串',
      },
      isActive: {
        type: 'boolean',
        required: applicationType === 'delete',
        validate: (value) => typeof value === 'boolean',
        error: 'isActive必须是布尔值',
      },
    };

    if (applicationType === 'create') {
      const requiredFields = ['serviceDate', 'serviceType', 'duration', 'description'];
      const providedFields = changes.map(c => c.field);
      const missingFields = requiredFields.filter(f => !providedFields.includes(f));
      if (missingFields.length > 0) {
        errors.push(`创建申请缺少必填字段: ${missingFields.join(', ')}`);
      }
    }

    let hasEffectiveUpdate = false;

    for (const change of changes) {
      const { field, from, to } = change;

      if (!fieldRules[field]) {
        errors.push(`不允许变更的字段: ${field}`);
        continue;
      }

      const rule = fieldRules[field];

      if (to === undefined || to === null) {
        errors.push(`字段 ${field} 的变更后值不能为空`);
        continue;
      }

      if (typeof to !== rule.type) {
        errors.push(`字段 ${field} 必须是 ${rule.type} 类型`);
        continue;
      }

      if (rule.validate && !rule.validate(to)) {
        errors.push(`字段 ${field} ${rule.error}`);
        continue;
      }

      if (applicationType === 'update' && existingRecord) {
        if (from === undefined) {
          errors.push(`更新操作必须提供字段 ${field} 的原始值`);
          continue;
        }

        // For PG records, serviceType is stored as enum member (e.g. TRANSLATION); compare with Chinese display value
        let currentValue = existingRecord[field];
        if (field === 'serviceDate') {
          const currentDate = new Date(currentValue).toISOString().split('T')[0];
          const fromDate = new Date(from).toISOString().split('T')[0];
          if (currentDate !== fromDate) {
            errors.push(`字段 ${field} 的原始值 ${from} 与当前值 ${currentValue} 不匹配`);
          }
          const toDate = new Date(to).toISOString().split('T')[0];
          if (toDate !== fromDate) hasEffectiveUpdate = true;
        } else {
          // serviceType stored as PG enum; from/to are Chinese strings — skip raw equality check
          if (field !== 'serviceType' && currentValue !== from) {
            errors.push(`字段 ${field} 的原始值 ${from} 与当前值 ${currentValue} 不匹配`);
          }
          if (to !== from) hasEffectiveUpdate = true;
        }
        continue;
      }

      if (applicationType === 'delete' && field === 'isActive') {
        if (from !== true) errors.push(`删除操作时 isActive 的原始值必须为 true`);
        if (to !== false) errors.push(`删除操作时 isActive 的变更后值必须为 false`);
      }

      validatedChanges.push({
        field,
        from: applicationType === 'create' ? null : from,
        to,
      });
    }

    if (applicationType === 'update') {
      // Re-collect validatedChanges for update (skipped above due to continue)
      for (const change of changes) {
        if (fieldRules[change.field] && change.to !== undefined && change.to !== null) {
          if (change.field === 'serviceDate') {
            const toDate = new Date(change.to).toISOString().split('T')[0];
            const fromDate = new Date(change.from).toISOString().split('T')[0];
            if (toDate !== fromDate) {
              validatedChanges.push({ field: change.field, from: change.from, to: change.to });
            }
          } else if (change.to !== change.from) {
            validatedChanges.push({ field: change.field, from: change.from, to: change.to });
          }
        }
      }

      if (!hasEffectiveUpdate) {
        return { isValid: false, error: '未检测到有效修改，请调整后再提交' };
      }
    }

    if (errors.length > 0) {
      return { isValid: false, error: errors[0] };
    }

    return { isValid: true, validatedChanges, message: '变更数据验证通过' };
  }

  static async validateApplicationData(applicationData) {
    const { applicationType, volunteerId, volunteerName, targetId, changes } = applicationData;

    if (!applicationType || !volunteerId || !volunteerName) {
      return { isValid: false, error: '申请类型、志愿者ID和志愿者姓名为必填项' };
    }

    if (!['create', 'update', 'delete'].includes(applicationType)) {
      return { isValid: false, error: '申请类型必须是: create, update, delete' };
    }

    const volunteerValidation = await this.validateVolunteer(volunteerId);
    if (!volunteerValidation.isValid) return volunteerValidation;

    if (volunteerValidation.volunteer.chineseName !== volunteerName) {
      return {
        isValid: false,
        error: `志愿者姓名不匹配: 提供 ${volunteerName}, 实际 ${volunteerValidation.volunteer.chineseName}`,
      };
    }

    let existingRecord = null;

    if (applicationType !== 'create') {
      if (!targetId) {
        return { isValid: false, error: `${applicationType} 操作必须提供目标记录ID` };
      }
      const targetValidation = await this.validateTargetRecord(targetId, volunteerId);
      if (!targetValidation.isValid) return targetValidation;
      existingRecord = targetValidation.record;
    }

    const changesValidation = this.validateChanges(changes, applicationType, existingRecord);
    if (!changesValidation.isValid) return changesValidation;

    return {
      isValid: true,
      volunteer: volunteerValidation.volunteer,
      existingRecord,
      validatedChanges: changesValidation.validatedChanges,
      message: '申请数据验证通过',
    };
  }
}

export default ValidationUtils;
