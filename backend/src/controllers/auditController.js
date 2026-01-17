// src/controllers/auditController.js
import AuditService from '../services/AuditService.js';

/**
 * 审计日志控制器
 */
class AuditController {
  
  /**
   * 获取审计日志列表
   * GET /api/v1/audit/logs
   */
  static async getAuditLogs(req, res) {
    try {
      // 从查询参数获取筛选条件
      const filters = {
        targetType: req.query.targetType,
        targetId: req.query.targetId,
        modifiedId: req.query.modifiedId,
        action: req.query.action,
        operatorId: req.query.operatorId,
        operatorName: req.query.operatorName,
        submitterId: req.query.submitterId,
        submitterName: req.query.submitterName,
        applicationType: req.query.applicationType,
        reviewResult: req.query.reviewResult,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search
      };
      
      // 分页参数
      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 20
      };
      
      // 排序参数
      const sortOptions = {
        sortBy: req.query.sortBy || 'timestamp',
        order: req.query.order || 'desc'
      };
      
      console.log('查询审计日志:', {
        filters,
        pagination,
        sortOptions
      });
      
      // 调用服务层
      const result = await AuditService.getAuditLogs(filters, pagination, sortOptions);
      
      return res.status(200).json({
        success: true,
        message: '获取审计日志列表成功',
        data: {
          auditLogs: result.auditLogs,
          pagination: result.pagination
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取审计日志列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取审计日志列表失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取审计日志详情
   * GET /api/v1/audit/:auditId
   */
  static async getAuditLogById(req, res) {
    try {
      const { auditId } = req.params;
      
      console.log('获取审计日志详情:', { auditId });
      
      const auditLog = await AuditService.getAuditLogById(auditId);
      
      return res.status(200).json({
        success: true,
        message: '获取审计日志详情成功',
        data: auditLog,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取审计日志详情失败:', error);
      
      const statusCode = error.message.includes('不存在') ? 404 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'AUDIT_LOG_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取目标审计历史
   * GET /api/v1/audit/target/:targetType/:targetId
   */
  static async getTargetAuditHistory(req, res) {
    try {
      const { targetType, targetId } = req.params;
      
      console.log('获取目标审计历史:', {
        targetType,
        targetId
      });
      
      const auditHistory = await AuditService.getTargetAuditHistory(targetType, targetId);
      
      return res.status(200).json({
        success: true,
        message: '获取目标审计历史成功',
        data: auditHistory,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取目标审计历史失败:', error);
      
      const statusCode = error.message.includes('无效') ? 400 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'TARGET_AUDIT_HISTORY_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取审计统计总览
   * GET /api/v1/audit/stats/summary
   */
  static async getAuditStatistics(req, res) {
    try {
      // 筛选条件
      const filters = {
        action: req.query.action,
        operatorId: req.query.operatorId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };
      
      console.log('获取审计统计总览:', { filters });
      
      const statistics = await AuditService.getAuditStatistics(filters);
      
      return res.status(200).json({
        success: true,
        message: '获取审计统计总览成功',
        data: statistics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取审计统计总览失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取审计统计总览失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取操作人审计统计
   * GET /api/v1/audit/stats/operator/:operatorId
   */
  static async getOperatorAuditStatistics(req, res) {
    try {
      const { operatorId } = req.params;
      
      console.log('获取操作人审计统计:', { operatorId });
      
      const statistics = await AuditService.getOperatorAuditStatistics(operatorId);
      
      return res.status(200).json({
        success: true,
        message: '获取操作人审计统计成功',
        data: statistics,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取操作人审计统计失败:', error);
      
      const statusCode = error.message.includes('不存在') ? 404 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'OPERATOR_STATS_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取审计时间线分析
   * GET /api/v1/audit/stats/timeline
   */
  static async getAuditTimelineAnalysis(req, res) {
    try {
      // 筛选条件
      const filters = {
        action: req.query.action,
        operatorId: req.query.operatorId,
        dateFrom: req.query.dateFrom || this.getDefaultDateRange().from,
        dateTo: req.query.dateTo || this.getDefaultDateRange().to
      };
      
      console.log('获取审计时间线分析:', { filters });
      
      const timelineAnalysis = await AuditService.getAuditTimelineAnalysis(filters);
      
      return res.status(200).json({
        success: true,
        message: '获取审计时间线分析成功',
        data: timelineAnalysis,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取审计时间线分析失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取审计时间线分析失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 导出审计日志
   * GET /api/v1/audit/export
   */
  static async exportAuditLogs(req, res) {
    try {
      // 筛选条件
      const filters = {
        targetType: req.query.targetType,
        action: req.query.action,
        operatorId: req.query.operatorId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };
      
      console.log('导出审计日志:', { filters });
      
      const exportData = await AuditService.exportAuditLogs(filters);
      
      // 设置响应头，提供CSV文件
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      
      // 如果是JSON请求，返回数据
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: '审计日志导出数据',
          data: exportData,
          timestamp: new Date().toISOString()
        });
      }
      
      // 生成CSV内容
      const headers = Object.keys(exportData.data[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.data.map(row => 
          headers.map(header => {
            const value = row[header];
            // 处理包含逗号或引号的值
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');
      
      return res.status(200).send(csvContent);
      
    } catch (error) {
      console.error('导出审计日志失败:', error);
      return res.status(500).json({
        success: false,
        error: '导出审计日志失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 获取默认日期范围（最近30天）
   * @private
   */
  static getDefaultDateRange() {
    const now = new Date();
    const to = new Date(now);
    const from = new Date(now);
    from.setDate(from.getDate() - 29); // 最近30天
    
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }
}

export default AuditController;