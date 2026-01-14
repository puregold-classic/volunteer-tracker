// src/utils/IDGenerator.js
import mongoose from 'mongoose';
import ServiceApplication from '../models/ServiceApplication.js';
import NonProjectService from '../models/NonProjectService.js';
import AuditLog from '../models/AuditLog.js';

/**
 * ID生成器工具类
 * 生成格式: {PREFIX}-{关联ID}-{序号}
 * 示例: APP-PG-0001-001, NPS-PG-0001-001, AUDIT-PG-0003-001
 */
class IDGenerator {
  
  /**
   * 生成申请ID (APP-{submitterId}-{seq})
   * @param {string} submitterId - 提交人ID
   * @returns {Promise<string>} - 生成的申请ID
   */
  static async generateApplicationId(submitterId) {
    try {
      // 验证提交人ID格式
      if (!this.isValidVolunteerId(submitterId)) {
        throw new Error(`无效的提交人ID格式: ${submitterId}`);
      }
      
      // 获取下一个序号
      const nextSeq = await this.getNextApplicationSequence(submitterId);
      
      // 格式化序号为3位数字
      const formattedSeq = this.formatSequence(nextSeq);
      
      // 生成完整ID
      return `APP-${submitterId}-${formattedSeq}`;
    } catch (error) {
      console.error('生成申请ID失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成服务记录ID (NPS-{volunteerId}-{seq})
   * @param {string} volunteerId - 志愿者ID
   * @returns {Promise<string>} - 生成的服务记录ID
   */
  static async generateServiceId(volunteerId) {
    try {
      // 验证志愿者ID格式
      if (!this.isValidVolunteerId(volunteerId)) {
        throw new Error(`无效的志愿者ID格式: ${volunteerId}`);
      }
      
      // 获取下一个序号
      const nextSeq = await this.getNextServiceSequence(volunteerId);
      
      // 格式化序号为3位数字
      const formattedSeq = this.formatSequence(nextSeq);
      
      // 生成完整ID
      return `NPS-${volunteerId}-${formattedSeq}`;
    } catch (error) {
      console.error('生成服务记录ID失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成审计ID (AUDIT-{reviewerId}-{seq})
   * @param {string} reviewerId - 审核人ID
   * @returns {Promise<string>} - 生成的审计ID
   */
  static async generateAuditId(reviewerId) {
    try {
      // 验证审核人ID格式
      if (!this.isValidVolunteerId(reviewerId)) {
        throw new Error(`无效的审核人ID格式: ${reviewerId}`);
      }
      
      // 获取下一个序号
      const nextSeq = await this.getNextAuditSequence(reviewerId);
      
      // 格式化序号为3位数字
      const formattedSeq = this.formatSequence(nextSeq);
      
      // 生成完整ID
      return `AUDIT-${reviewerId}-${formattedSeq}`;
    } catch (error) {
      console.error('生成审计ID失败:', error);
      throw error;
    }
  }
  
  // ========== 私有方法 ==========
  
  /**
   * 获取下一个申请序号
   * @private
   */
  static async getNextApplicationSequence(submitterId) {
    try {
      // 查找该提交人最新的申请记录
      const latestApp = await ServiceApplication.findOne(
        { 
          applicationId: new RegExp(`^APP-${submitterId}-`) 
        },
        { applicationId: 1 }
      ).sort({ createdAt: -1 }).lean();
      
      if (!latestApp) {
        return 1; // 第一个序号
      }
      
      // 从ID中提取序号: APP-PG-0001-001 -> 1
      const currentSeq = this.extractSequenceFromId(latestApp.applicationId);
      return currentSeq + 1;
    } catch (error) {
      console.error('获取申请序号失败:', error);
      // 如果查询失败，尝试使用计数方法
      return await this.getSequenceByCount('ServiceApplication', submitterId, 'APP');
    }
  }
  
  /**
   * 获取下一个服务记录序号
   * @private
   */
  static async getNextServiceSequence(volunteerId) {
    try {
      // 查找该志愿者最新的服务记录
      const latestService = await NonProjectService.findOne(
        { 
          serviceId: new RegExp(`^NPS-${volunteerId}-`) 
        },
        { serviceId: 1 }
      ).sort({ createdAt: -1 }).lean();
      
      if (!latestService) {
        return 1; // 第一个序号
      }
      
      // 从ID中提取序号: NPS-PG-0001-001 -> 1
      const currentSeq = this.extractSequenceFromId(latestService.serviceId);
      return currentSeq + 1;
    } catch (error) {
      console.error('获取服务记录序号失败:', error);
      // 如果查询失败，尝试使用计数方法
      return await this.getSequenceByCount('NonProjectService', volunteerId, 'NPS');
    }
  }
  
  /**
   * 获取下一个审计序号
   * @private
   */
  static async getNextAuditSequence(reviewerId) {
    try {
      // 查找该审核人最新的审计记录
      const latestAudit = await AuditLog.findOne(
        { 
          auditId: new RegExp(`^AUDIT-${reviewerId}-`) 
        },
        { auditId: 1 }
      ).sort({ timestamp: -1 }).lean();
      
      if (!latestAudit) {
        return 1; // 第一个序号
      }
      
      // 从ID中提取序号: AUDIT-PG-0003-001 -> 1
      const currentSeq = this.extractSequenceFromId(latestAudit.auditId);
      return currentSeq + 1;
    } catch (error) {
      console.error('获取审计序号失败:', error);
      // 如果查询失败，尝试使用计数方法
      return await this.getSequenceByCount('AuditLog', reviewerId, 'AUDIT');
    }
  }
  
  /**
   * 备选方案：通过计数获取序号
   * @private
   */
  static async getSequenceByCount(modelName, relatedId, prefix) {
    try {
      const Model = mongoose.model(modelName);
      const count = await Model.countDocuments({
        // 使用正则表达式匹配相关ID
        [`${this.getFieldNameByPrefix(prefix)}`]: new RegExp(`^${prefix}-${relatedId}-`)
      });
      return count + 1;
    } catch (error) {
      console.error(`通过计数获取序号失败 (${prefix}):`, error);
      throw new Error(`无法生成${prefix}类型的ID序号`);
    }
  }
  
  /**
   * 根据前缀获取字段名
   * @private
   */
  static getFieldNameByPrefix(prefix) {
    const fieldMap = {
      'APP': 'applicationId',
      'NPS': 'serviceId', 
      'AUDIT': 'auditId'
    };
    return fieldMap[prefix] || 'id';
  }
  
  /**
   * 从ID中提取序号部分
   * @private
   */
  static extractSequenceFromId(id) {
    // 匹配最后的数字部分: XXX-XXX-001 -> 1
    const match = id.match(/-(\d+)$/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return 0; // 如果没有找到序号，返回0
  }
  
  /**
   * 格式化序号为3位数字
   * @private
   */
  static formatSequence(seq) {
    if (seq < 1 || seq > 999) {
      throw new Error(`序号超出范围 (1-999): ${seq}`);
    }
    return seq.toString().padStart(3, '0');
  }
  
  /**
   * 验证志愿者ID格式
   * @private
   */
  static isValidVolunteerId(id) {
    // 格式: 字母+横线+数字 (例如: PG-0001, VM-1001)
    const pattern = /^[A-Z]+-\d{3,}$/;
    return pattern.test(id);
  }
  
  /**
   * 批量生成ID（未来扩展）
   * @param {Array} requests - 生成请求数组
   * @returns {Promise<Array>} - 生成的ID数组
   */
  static async batchGenerate(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        let id;
        switch (request.type) {
          case 'application':
            id = await this.generateApplicationId(request.submitterId);
            break;
          case 'service':
            id = await this.generateServiceId(request.volunteerId);
            break;
          case 'audit':
            id = await this.generateAuditId(request.reviewerId);
            break;
          default:
            throw new Error(`未知的ID类型: ${request.type}`);
        }
        
        results.push({
          success: true,
          type: request.type,
          relatedId: request.submitterId || request.volunteerId || request.reviewerId,
          id: id
        });
      } catch (error) {
        results.push({
          success: false,
          type: request.type,
          relatedId: request.submitterId || request.volunteerId || request.reviewerId,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * 验证ID格式是否正确
   * @param {string} id - 要验证的ID
   * @param {string} expectedType - 期望的类型 ('application', 'service', 'audit')
   * @returns {Object} - 验证结果
   */
  static validateIdFormat(id, expectedType = null) {
    const patterns = {
      application: /^APP-[A-Z]+-\d{3,}-\d{3}$/,
      service: /^NPS-[A-Z]+-\d{3,}-\d{3}$/,
      audit: /^AUDIT-[A-Z]+-\d{3,}-\d{3}$/
    };
    
    // 如果没有指定类型，尝试所有模式
    if (!expectedType) {
      for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(id)) {
          return {
            isValid: true,
            type: type,
            parts: this.parseId(id)
          };
        }
      }
      return { isValid: false, error: '未知的ID格式' };
    }
    
    // 验证特定类型
    const pattern = patterns[expectedType];
    if (!pattern) {
      return { isValid: false, error: `未知的类型: ${expectedType}` };
    }
    
    const isValid = pattern.test(id);
    return {
      isValid,
      type: expectedType,
      parts: isValid ? this.parseId(id) : null,
      error: isValid ? null : `ID格式不正确，期望格式: ${expectedType.toUpperCase()}-{ID}-{序号}`
    };
  }
}

export default IDGenerator;