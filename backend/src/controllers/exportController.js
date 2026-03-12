// src/controllers/exportController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
import ExportService from '../services/ExportService.js';
import prisma from '../utils/prismaClient.js';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * 导出控制器
 */
class ExportController {
  
  /**
   * 导出服务记录
   * GET /api/v1/services/export
   */
  static async exportServices(req, res) {
    try {
      // 从查询参数获取筛选条件
      const filters = {
        volunteerId: req.query.volunteerId,
        volunteerName: req.query.volunteerName,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        minDuration: req.query.minDuration,
        maxDuration: req.query.maxDuration,
        region: req.query.region,
        isActive: req.query.isActive !== 'false'
      };
      
      // 导出选项
      const options = {
        format: req.query.format || 'csv',
        includeSummary: req.query.includeSummary !== 'false',
        includeStatistics: req.query.includeStatistics !== 'false',
        maxRecords: parsePositiveInt(req.query.maxRecords, 10000),
        chunkSize: parsePositiveInt(req.query.chunkSize, 1000)
      };
      
      console.log('导出服务记录请求:', {
        filters,
        options
      });
      
      // 调用导出服务
      const exportResult = await ExportService.exportServices(filters, options);
      
      // 设置响应头
      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.setHeader('Content-Length', exportResult.fileSize || Buffer.from(exportResult.data).length);
      res.setHeader('X-Export-Filename', exportResult.filename);
      res.setHeader('X-Export-Records', req.query.recordCount || 'unknown');
      res.setHeader('X-Export-Timestamp', new Date().toISOString());
      
      // 发送文件
      if (exportResult.contentType.includes('json')) {
        return res.status(200).json({
          success: true,
          message: '导出成功',
          data: JSON.parse(exportResult.data),
          downloadUrl: `/api/v1/services/export/download/${exportResult.filename}`
        });
      } else {
        return res.status(200).send(exportResult.data);
      }
      
    } catch (error) {
      console.error('导出服务记录失败:', error);
      
      const statusCode = error.message.includes('过多') ? 413 : 
                        error.message.includes('不支持') ? 400 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'EXPORT_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 导出志愿者统计
   * GET /api/v1/services/export/stats
   */
  static async exportStatistics(req, res) {
    try {
      const filters = {
        volunteerId: req.query.volunteerId,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        region: req.query.region
      };
      
      const options = {
        format: req.query.format || 'csv'
      };
      
      console.log('导出统计请求:', { filters, options });
      
      const exportResult = await ExportService.exportVolunteerStatistics(filters, options);
      
      // 设置响应头
      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      res.setHeader('Content-Length', exportResult.fileSize);
      res.setHeader('X-Export-Type', 'statistics');
      
      if (exportResult.contentType.includes('json')) {
        return res.status(200).json({
          success: true,
          message: '统计导出成功',
          data: JSON.parse(exportResult.data)
        });
      } else {
        return res.status(200).send(exportResult.data);
      }
      
    } catch (error) {
      console.error('导出统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '导出统计失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 下载导入模板
   * GET /api/v1/services/export/template
   */
  static async downloadTemplate(req, res) {
    try {
      const options = {
        format: req.query.format || 'csv'
      };
      
      console.log('下载模板请求:', { options });
      
      const exportResult = await ExportService.exportImportTemplate(options);
      
      // 设置响应头
      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      
      if (exportResult.contentType.includes('json')) {
        return res.status(200).json({
          success: true,
          message: '模板下载成功',
          data: JSON.parse(exportResult.data)
        });
      } else {
        return res.status(200).send(exportResult.data);
      }
      
    } catch (error) {
      console.error('下载模板失败:', error);
      return res.status(500).json({
        success: false,
        error: '下载模板失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 流式导出（适用于大数据量）
   * GET /api/v1/services/export/stream
   */
  static async streamExport(req, res) {
    try {
      const filters = {
        volunteerId: req.query.volunteerId,
        serviceType: req.query.serviceType,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo
      };
      
      console.log('流式导出请求:', { filters });
      
      // 设置流式响应头
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 
        `attachment; filename="services-stream-${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // 构建 Prisma where clause
      const where = { isActive: true };
      if (filters.volunteerId) where.volunteerId = filters.volunteerId;
      if (filters.serviceType) {
        const { SERVICE_TYPE_TO_PG } = await import('../utils/pgSerializer.js');
        where.serviceType = SERVICE_TYPE_TO_PG[filters.serviceType] || filters.serviceType;
      }
      if (filters.serviceDateFrom || filters.serviceDateTo) {
        where.serviceDate = {};
        if (filters.serviceDateFrom) where.serviceDate.gte = new Date(filters.serviceDateFrom);
        if (filters.serviceDateTo) where.serviceDate.lte = new Date(filters.serviceDateTo);
      }

      // 创建CSV头部
      const headers = [
        '服务记录ID', '志愿者ID', '志愿者姓名',
        '服务日期', '服务类型', '服务时长(小时)', '服务描述', '创建时间'
      ].join(',');

      res.write(headers + '\n');

      // 分页流式读取 (Prisma doesn't support cursors; use batched pagination)
      const BATCH_SIZE = 1000;
      let skip = 0;
      let count = 0;

      while (true) {
        const batch = await prisma.nonProjectService.findMany({
          where,
          orderBy: { serviceDate: 'desc' },
          skip,
          take: BATCH_SIZE,
        });

        if (batch.length === 0) break;

        for (const doc of batch) {
          const row = [
            doc.serviceId,
            doc.volunteerId,
            doc.volunteerName,
            new Date(doc.serviceDate).toISOString().split('T')[0],
            doc.serviceType,
            doc.duration,
            `"${(doc.description || '').replace(/"/g, '""')}"`,
            new Date(doc.createdAt).toISOString()
          ].join(',');
          res.write(row + '\n');
          count++;
        }

        skip += BATCH_SIZE;
        if (batch.length < BATCH_SIZE) break;
        console.log(`流式导出进度: ${count} 条记录`);
      }

      console.log(`流式导出完成: ${count} 条记录`);
      res.end();
      
    } catch (error) {
      console.error('流式导出失败:', error);
      
      // 如果响应头已发送，只能结束响应
      if (res.headersSent) {
        res.end();
      } else {
        return res.status(500).json({
          success: false,
          error: '流式导出失败',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

export default ExportController;
