// src/utils/idUtils.js
import IDGenerator from './IDGenerator.js';

/**
 * ID解析工具函数
 */

/**
 * 解析ID的各个部分
 * @param {string} id - 完整ID (如: APP-PG-0001-001)
 * @returns {Object} - 解析后的部分
 */
export function parseId(id) {
  if (!id || typeof id !== 'string') {
    return null;
  }
  
  const parts = id.split('-');
  if (parts.length < 3) {
    return null;
  }
  
  const prefix = parts[0]; // APP, NPS, AUDIT
  const relatedId = parts.slice(1, -1).join('-'); // 中间部分可能是 PG-0001
  const sequence = parts[parts.length - 1]; // 001
  
  return {
    prefix,
    relatedId,
    sequence: parseInt(sequence, 10),
    fullId: id
  };
}

/**
 * 提取志愿者ID（从各种ID中）
 * @param {string} id - 任何格式的ID
 * @returns {string|null} - 志愿者ID
 */
export function extractVolunteerId(id) {
  const parsed = parseId(id);
  if (!parsed) return null;
  
  // 从相关ID中提取志愿者ID部分
  // 例如: APP-PG-0001-001 -> PG-0001
  // 或者: NPS-PG-0001-001 -> PG-0001
  return parsed.relatedId;
}

/**
 * 获取ID前缀
 * @param {string} id - 完整ID
 * @returns {string|null} - 前缀
 */
export function getPrefix(id) {
  const parsed = parseId(id);
  return parsed ? parsed.prefix : null;
}

/**
 * 获取序号
 * @param {string} id - 完整ID
 * @returns {number|null} - 序号
 */
export function getSequence(id) {
  const parsed = parseId(id);
  return parsed ? parsed.sequence : null;
}

/**
 * 生成测试ID（用于开发和测试）
 * @param {string} prefix - 前缀
 * @param {string} relatedId - 相关ID
 * @param {number} sequence - 序号
 * @returns {string} - 测试ID
 */
export function generateTestId(prefix, relatedId, sequence) {
  const formattedSeq = sequence.toString().padStart(3, '0');
  return `${prefix}-${relatedId}-${formattedSeq}`;
}

/**
 * 检查ID是否属于特定志愿者
 * @param {string} id - 要检查的ID
 * @param {string} volunteerId - 志愿者ID
 * @returns {boolean} - 是否属于
 */
export function belongsToVolunteer(id, volunteerId) {
  const parsed = parseId(id);
  if (!parsed) return false;
  
  // 检查relatedId是否以volunteerId开头
  return parsed.relatedId.startsWith(volunteerId);
}

/**
 * 批量验证ID格式
 * @param {Array} ids - ID数组
 * @param {string} expectedType - 期望类型
 * @returns {Array} - 验证结果数组
 */
export function batchValidateIds(ids, expectedType = null) {
  return ids.map(id => ({
    id,
    ...IDGenerator.validateIdFormat(id, expectedType)
  }));
}

// 导出IDGenerator以供使用
export { IDGenerator };
