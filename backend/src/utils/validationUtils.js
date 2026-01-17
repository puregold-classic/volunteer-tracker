// src/utils/validationUtils.js
import mongoose from 'mongoose';
import Volunteer from '../models/Volunteer.js';
import NonProjectService from '../models/NonProjectService.js';

/**
 * 验证工具类 - 集中处理业务验证逻辑
 */
class ValidationUtils {
  
  /**
   * 验证志愿者是否存在
   * @param {string} volunteerId - 志愿者ID
   * @returns {Promise<Object>} - 志愿者信息或错误
   */
  static async validateVolunteer(volunteerId) {
    try {
      const volunteer = await Volunteer.findOne({ id: volunteerId });
      
      if (!volunteer) {
        return {
          isValid: false,
          error: `志愿者不存在: ${volunteerId}`
        };
      }
      
      return {
        isValid: true,
        volunteer,
        message: '志愿者验证通过'
      };
    } catch (error) {
      return {
        isValid: false,
        error: `验证志愿者失败: ${error.message}`
      };
    }
  }
  
  /**
   * 验证目标记录是否存在（用于update/delete）
   * @param {string} targetId - 目标记录ID
   * @param {string} volunteerId - 志愿者ID（用于验证归属）
   * @returns {Promise<Object>} - 验证结果
   */
  static async validateTargetRecord(targetId, volunteerId) {
    try {
      // 验证targetId格式
      if (!targetId || !targetId.startsWith('NPS-')) {
        return {
          isValid: false,
          error: `无效的服务记录ID格式: ${targetId}`
        };
      }
      
      // 查找目标记录
      const targetRecord = await NonProjectService.findOne({
        serviceId: targetId,
        isActive: true
      });
      
      if (!targetRecord) {
        return {
          isValid: false,
          error: `服务记录不存在或已被删除: ${targetId}`
        };
      }
      
      // 验证记录归属
      if (targetRecord.volunteerId !== volunteerId) {
        return {
          isValid: false,
          error: `服务记录不属于志愿者 ${volunteerId}`
        };
      }
      
      return {
        isValid: true,
        record: targetRecord,
        message: '目标记录验证通过'
      };
    } catch (error) {
      return {
        isValid: false,
        error: `验证目标记录失败: ${error.message}`
      };
    }
  }
  
  /**
   * 验证变更数据
   * @param {Array} changes - 变更数组
   * @param {string} applicationType - 申请类型
   * @param {Object} existingRecord - 现有记录（update/delete时需要）
   * @returns {Object} - 验证结果
   */
  static validateChanges(changes, applicationType, existingRecord = null) {
    if (!Array.isArray(changes) || changes.length === 0) {
      return {
        isValid: false,
        error: '变更数据不能为空'
      };
    }
    
    const errors = [];
    const validatedChanges = [];
    
    // 字段验证规则
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
        error: '服务日期必须是有效日期且不能是未来'
      },
      serviceType: {
        type: 'string',
        required: applicationType === 'create',
        validate: (value) => ['翻译', '校对', '项目培训', '非项目培训', '受训'].includes(value),
        error: '服务类型必须是: 翻译, 校对, 项目培训, 非项目培训, 受训'
      },
      duration: {
        type: 'number',
        required: applicationType === 'create',
        validate: (value) => {
          return typeof value === 'number' && 
                 value > 0 && 
                 value % 0.5 === 0;
        },
        error: '服务时长必须是大于0的数字且是0.5的倍数'
      },
      description: {
        type: 'string',
        required: applicationType === 'create',
        validate: (value) => {
          return typeof value === 'string' && 
                 value.trim().length >= 5 && 
                 value.trim().length <= 1000;
        },
        error: '服务描述必须是5-1000个字符的字符串'
      },
      isActive: {
        type: 'boolean',
        required: applicationType === 'delete',
        validate: (value) => typeof value === 'boolean',
        error: 'isActive必须是布尔值'
      }
    };
    
    // 检查必填字段
    if (applicationType === 'create') {
      const requiredFields = ['serviceDate', 'serviceType', 'duration', 'description'];
      const providedFields = changes.map(c => c.field);
      const missingFields = requiredFields.filter(f => !providedFields.includes(f));
      
      if (missingFields.length > 0) {
        errors.push(`创建申请缺少必填字段: ${missingFields.join(', ')}`);
      }
    }
    
    // 验证每个变更项
    for (const change of changes) {
      const { field, from, to } = change;
      
      // 检查字段是否允许变更
      if (!fieldRules[field]) {
        errors.push(`不允许变更的字段: ${field}`);
        continue;
      }
      
      const rule = fieldRules[field];
      
      // 验证to值
      if (to === undefined || to === null) {
        errors.push(`字段 ${field} 的变更后值不能为空`);
        continue;
      }
      
      // 类型检查
      if (typeof to !== rule.type) {
        errors.push(`字段 ${field} 必须是 ${rule.type} 类型`);
        continue;
      }
      
      // 自定义验证
      if (rule.validate && !rule.validate(to)) {
        errors.push(`字段 ${field} ${rule.error}`);
        continue;
      }
      
      // 对于update，验证from值是否与现有记录匹配
      if (applicationType === 'update' && existingRecord) {
        if (from === undefined) {
          errors.push(`更新操作必须提供字段 ${field} 的原始值`);
          continue;
        }
        
        const currentValue = existingRecord[field];
        
        // 特殊处理日期字段
        if (field === 'serviceDate') {
          const currentDate = new Date(currentValue).toISOString().split('T')[0];
          const fromDate = new Date(from).toISOString().split('T')[0];
          if (currentDate !== fromDate) {
            errors.push(`字段 ${field} 的原始值 ${from} 与当前值 ${currentValue} 不匹配`);
          }
        } else if (currentValue !== from) {
          errors.push(`字段 ${field} 的原始值 ${from} 与当前值 ${currentValue} 不匹配`);
        }
      }
      
      // 对于delete，验证from值
      if (applicationType === 'delete' && field === 'isActive') {
        if (from !== true) {
          errors.push(`删除操作时 isActive 的原始值必须为 true`);
        }
        if (to !== false) {
          errors.push(`删除操作时 isActive 的变更后值必须为 false`);
        }
      }
      
      validatedChanges.push({
        field,
        from: applicationType === 'create' ? null : from,
        to: applicationType === 'delete' && field === 'isActive' ? null : to
      });
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        error: errors[0] // 按约定返回第一个错误
      };
    }
    
    return {
      isValid: true,
      validatedChanges,
      message: '变更数据验证通过'
    };
  }
  
  /**
   * 验证申请数据的完整性
   * @param {Object} applicationData - 申请数据
   * @returns {Promise<Object>} - 验证结果
   */
  static async validateApplicationData(applicationData) {
    const { 
      applicationType, 
      volunteerId, 
      volunteerName,
      targetId,
      changes 
    } = applicationData;
    
    // 基本字段检查
    if (!applicationType || !volunteerId || !volunteerName) {
      return {
        isValid: false,
        error: '申请类型、志愿者ID和志愿者姓名为必填项'
      };
    }
    
    if (!['create', 'update', 'delete'].includes(applicationType)) {
      return {
        isValid: false,
        error: '申请类型必须是: create, update, delete'
      };
    }
    
    // 验证志愿者
    const volunteerValidation = await this.validateVolunteer(volunteerId);
    if (!volunteerValidation.isValid) {
      return volunteerValidation;
    }
    
    // 验证志愿者姓名一致性
    if (volunteerValidation.volunteer.chineseName !== volunteerName) {
      return {
        isValid: false,
        error: `志愿者姓名不匹配: 提供 ${volunteerName}, 实际 ${volunteerValidation.volunteer.chineseName}`
      };
    }
    
    let existingRecord = null;
    
    // 对于update/delete，验证目标记录
    if (applicationType !== 'create') {
      if (!targetId) {
        return {
          isValid: false,
          error: `${applicationType} 操作必须提供目标记录ID`
        };
      }
      
      const targetValidation = await this.validateTargetRecord(targetId, volunteerId);
      if (!targetValidation.isValid) {
        return targetValidation;
      }
      
      existingRecord = targetValidation.record;
    }
    
    // 验证变更数据
    const changesValidation = this.validateChanges(changes, applicationType, existingRecord);
    if (!changesValidation.isValid) {
      return changesValidation;
    }
    
    return {
      isValid: true,
      volunteer: volunteerValidation.volunteer,
      existingRecord,
      validatedChanges: changesValidation.validatedChanges,
      message: '申请数据验证通过'
    };
  }
}

export default ValidationUtils;