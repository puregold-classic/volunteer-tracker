// src/utils/queryUtils.js
/**
 * 查询构建工具 - Phase 5: PostgreSQL + Prisma 版本
 * 仅保留分页和格式化方法，其他查询逻辑已在各 Service/Controller 中直接使用 Prisma
 */

class QueryUtils {
  
  /**
   * 构建分页选项
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {Object} - 分页选项
   */
  static buildPaginationOptions(page = 1, limit = 20) {
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20)); // 限制最大100条
    
    return {
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      page: pageNum
    };
  }
  
  /**
   * 格式化查询结果（添加分页信息）
   * @param {Array} data - 查询到的数据
   * @param {number} total - 总记录数
   * @param {Object} pagination - 分页参数
   * @returns {Object} - 格式化的响应数据
   */
  static formatPaginatedResponse(data, total, pagination) {
    const { page, limit } = pagination;
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }
}

export default QueryUtils;
