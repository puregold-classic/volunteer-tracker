// src/middleware/validateExport.js
/**
 * 导出请求验证中间件
 */
export const validateExportRequest = (req, res, next) => {
  try {
    const { format, maxRecords = 10000 } = req.query;
    
    // 验证导出格式
    const validFormats = ['csv', 'excel', 'json'];
    if (format && !validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `无效的导出格式。支持格式: ${validFormats.join(', ')}`,
        code: 'INVALID_EXPORT_FORMAT'
      });
    }
    
    // 验证最大记录数
    const maxRecordsNum = parseInt(maxRecords);
    if (isNaN(maxRecordsNum) || maxRecordsNum < 1 || maxRecordsNum > 50000) {
      return res.status(400).json({
        success: false,
        error: '最大记录数必须在 1-50000 之间',
        code: 'INVALID_MAX_RECORDS'
      });
    }
    
    // 验证日期格式
    if (req.query.serviceDateFrom) {
      const date = new Date(req.query.serviceDateFrom);
      if (isNaN(date)) {
        return res.status(400).json({
          success: false,
          error: '无效的开始日期格式',
          code: 'INVALID_DATE_FORMAT'
        });
      }
    }
    
    if (req.query.serviceDateTo) {
      const date = new Date(req.query.serviceDateTo);
      if (isNaN(date)) {
        return res.status(400).json({
          success: false,
          error: '无效的结束日期格式',
          code: 'INVALID_DATE_FORMAT'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('导出验证失败:', error);
    return res.status(500).json({
      success: false,
      error: '导出参数验证失败',
      timestamp: new Date().toISOString()
    });
  }
};