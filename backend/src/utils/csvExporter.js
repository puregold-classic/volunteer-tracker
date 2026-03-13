// src/utils/csvExporter.js
import { createObjectCsvStringifier } from 'csv-writer';

/**
 * CSV导出工具类
 */
class CsvExporter {
  
  /**
   * 将服务记录转换为CSV格式
   * @param {Array} services - 服务记录数组
   * @param {Object} options - 导出选项
   * @returns {string} - CSV字符串
   */
  static exportServicesToCSV(services, options = {}) {
    try {
      const {
        includeHeaders = true,
        delimiter = ','
      } = options;
      
      // 定义CSV列映射
      const headers = [
        { id: 'serviceId', title: '服务记录ID' },
        { id: 'volunteerId', title: '志愿者ID' },
        { id: 'volunteerName', title: '志愿者姓名' },
        { id: 'volunteerRegion', title: '志愿者地区' },
        { id: 'volunteerStatus', title: '志愿者状态' },
        { id: 'serviceDate', title: '服务日期' },
        { id: 'serviceType', title: '服务类型' },
        { id: 'duration', title: '服务时长(小时)' },
        { id: 'description', title: '服务描述' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '最后更新时间' },
        { id: 'isActive', title: '是否有效' },
        { id: 'auditCount', title: '审核次数' }
      ];
      
      // 创建CSV字符串化器
      const csvStringifier = createObjectCsvStringifier({
        header: headers,
        fieldDelimiter: delimiter,
        alwaysQuote: true // 始终使用引号包裹
      });
      
      // 准备数据
      const records = services.map(service => ({
        serviceId: service.serviceId || '',
        volunteerId: service.volunteerId || '',
        volunteerName: service.volunteerName || '',
        volunteerRegion: service.volunteerRegion || '',
        volunteerStatus: service.volunteerStatus || '',
        serviceDate: service.serviceDate ? 
          new Date(service.serviceDate).toLocaleDateString('zh-CN') : '',
        serviceType: service.serviceType || '',
        duration: service.duration || 0,
        description: this.sanitizeText(service.description || ''),
        createdAt: service.createdAt ? 
          new Date(service.createdAt).toLocaleString('zh-CN') : '',
        updatedAt: service.updatedAt ? 
          new Date(service.updatedAt).toLocaleString('zh-CN') : '',
        isActive: service.isActive ? '是' : '否',
        auditCount: service.auditHistory?.length || 0
      }));
      
      // 生成CSV内容
      let csvContent = '';
      
      if (includeHeaders) {
        csvContent += csvStringifier.getHeaderString();
      }
      
      csvContent += csvStringifier.stringifyRecords(records);
      
      // 添加元数据注释
      const metaData = this.generateMetaData(services.length, options);
      csvContent = `# ${metaData}\n${csvContent}`;
      
      return csvContent;
      
    } catch (error) {
      console.error('CSV导出失败:', error);
      throw error;
    }
  }
  
  /**
   * 将志愿者统计数据转换为CSV
   * @param {Array} statistics - 统计数据
   * @param {Object} options - 导出选项
   * @returns {string} - CSV字符串
   */
  static exportStatisticsToCSV(statistics, options = {}) {
    try {
      const headers = [
        { id: 'volunteerId', title: '志愿者ID' },
        { id: 'volunteerName', title: '志愿者姓名' },
        { id: 'region', title: '地区' },
        { id: 'status', title: '状态' },
        { id: 'totalHours', title: '总服务时长(小时)' },
        { id: 'totalCount', title: '总服务次数' },
        { id: 'avgDuration', title: '平均服务时长(小时)' },
        { id: 'lastServiceDate', title: '最后服务日期' },
        { id: 'activityLevel', title: '活跃度' }
      ];
      
      const csvStringifier = createObjectCsvStringifier({
        header: headers,
        fieldDelimiter: options.delimiter || ',',
        alwaysQuote: true
      });
      
      const records = statistics.map(stat => ({
        volunteerId: stat.volunteerId || '',
        volunteerName: stat.volunteerName || '',
        region: stat.region || '',
        status: stat.status || '',
        totalHours: stat.totalHours || 0,
        totalCount: stat.totalCount || 0,
        avgDuration: stat.avgDuration ? stat.avgDuration.toFixed(2) : 0,
        lastServiceDate: stat.lastServiceDate ? 
          new Date(stat.lastServiceDate).toLocaleDateString('zh-CN') : '',
        activityLevel: stat.activityLevel || ''
      }));
      
      let csvContent = '';
      
      if (options.includeHeaders !== false) {
        csvContent += csvStringifier.getHeaderString();
      }
      
      csvContent += csvStringifier.stringifyRecords(records);
      
      const metaData = this.generateMetaData(records.length, options);
      csvContent = `# ${metaData}\n${csvContent}`;
      
      return csvContent;
      
    } catch (error) {
      console.error('统计数据CSV导出失败:', error);
      throw error;
    }
  }
  
  /**
   * 生成多Sheet的CSV文件
   * @param {Object} sheets - Sheet数据 { sheetName: data }
   * @returns {Object} - 多SheetCSV数据
   */
  static exportMultiSheetCSV(sheets) {
    const result = {};
    
    for (const [sheetName, data] of Object.entries(sheets)) {
      try {
        if (sheetName === 'summary') {
          result[sheetName] = this.exportSummaryToCSV(data);
        } else if (sheetName === 'services') {
          result[sheetName] = this.exportServicesToCSV(data);
        } else if (sheetName === 'statistics') {
          result[sheetName] = this.exportStatisticsToCSV(data);
        } else {
          result[sheetName] = this.exportGenericToCSV(data, { sheetName });
        }
      } catch (error) {
        console.error(`Sheet ${sheetName} 导出失败:`, error);
        result[sheetName] = `# 导出失败: ${error.message}`;
      }
    }
    
    return result;
  }
  
  /**
   * 通用CSV导出
   * @private
   */
  static exportGenericToCSV(data, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }
    
    // 自动推断列
    const sample = data[0];
    const headers = Object.keys(sample).map(key => ({
      id: key,
      title: this.formatHeaderTitle(key)
    }));
    
    const csvStringifier = createObjectCsvStringifier({
      header: headers,
      alwaysQuote: true
    });
    
    let csvContent = '';
    csvContent += csvStringifier.getHeaderString();
    csvContent += csvStringifier.stringifyRecords(data);
    
    const metaData = this.generateMetaData(data.length, options);
    csvContent = `# ${metaData}\n${csvContent}`;
    
    return csvContent;
  }
  
  /**
   * 导出汇总数据到CSV
   * @private
   */
  static exportSummaryToCSV(summary) {
    const rows = [
      ['统计项', '数值'],
      ['总记录数', summary.totalRecords || 0],
      ['总服务时长(小时)', summary.totalHours || 0],
      ['平均服务时长(小时)', summary.avgDuration ? summary.avgDuration.toFixed(2) : 0],
      ['最早服务日期', summary.earliestDate ? 
        new Date(summary.earliestDate).toLocaleDateString('zh-CN') : ''],
      ['最近服务日期', summary.latestDate ? 
        new Date(summary.latestDate).toLocaleDateString('zh-CN') : ''],
      ['导出时间', new Date().toLocaleString('zh-CN')]
    ];
    
    return rows.map(row => row.map(cell => 
      `"${this.sanitizeText(cell.toString())}"`
    ).join(',')).join('\n');
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 清理文本（处理CSV特殊字符）
   * @private
   */
  static sanitizeText(text) {
    if (typeof text !== 'string') return text;
    
    // 移除换行符，替换为空格
    return text
      .replace(/\r\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/"/g, '""') // 转义双引号
      .trim();
  }
  
  /**
   * 生成元数据注释
   * @private
   */
  static generateMetaData(count, options = {}) {
    const meta = {
      导出时间: new Date().toLocaleString('zh-CN'),
      记录数量: count,
      导出格式: 'CSV',
      编码: options.encoding || 'UTF-8'
    };
    
    if (options.filters) {
      meta.筛选条件 = JSON.stringify(options.filters, null, 2)
        .replace(/[{}"]/g, '')
        .replace(/,/g, ';');
    }
    
    return Object.entries(meta)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  }
  
  /**
   * 格式化列标题
   * @private
   */
  static formatHeaderTitle(key) {
    const titleMap = {
      id: 'ID',
      name: '名称',
      date: '日期',
      time: '时间',
      count: '数量',
      total: '总计',
      avg: '平均',
      min: '最小',
      max: '最大'
    };
    
    // 简单的标题转换
    let title = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    // 替换常见单词
    Object.entries(titleMap).forEach(([en, zh]) => {
      const regex = new RegExp(`\\b${en}\\b`, 'gi');
      title = title.replace(regex, zh);
    });
    
    return title;
  }
}

export default CsvExporter;
