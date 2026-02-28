// src/services/ExportService.js
import NonProjectService from '../models/NonProjectService.js';
import ServiceService from './ServiceService.js';
import CsvExporter from '../utils/csvExporter.js';
import ExcelExporter from '../utils/excelExporter.js';
import QueryUtils from '../utils/queryUtils.js';

/**
 * 导出业务逻辑服务
 */
class ExportService {
  
  /**
   * 导出服务记录
   * @param {Object} filters - 筛选条件
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} - 导出结果
   */
  static async exportServices(filters = {}, options = {}) {
    try {
      const {
        format = 'csv',
        chunkSize = 1000,
        maxRecords = 10000
      } = options;
      
      console.log('开始导出服务记录:', {
        filters,
        format,
        chunkSize,
        maxRecords
      });
      
      // 获取总记录数
      const query = QueryUtils.buildServiceRecordsQuery(filters);
      const totalCount = await NonProjectService.countDocuments(query);
      
      if (totalCount > maxRecords) {
        throw new Error(`记录数量过多 (${totalCount})，最多支持导出 ${maxRecords} 条记录`);
      }
      
      // 分批获取数据
      const allServices = [];
      const batchCount = Math.ceil(totalCount / chunkSize);
      
      for (let i = 0; i < batchCount; i++) {
        const skip = i * chunkSize;
        const limit = Math.min(chunkSize, totalCount - skip);
        
        const pipeline = QueryUtils.buildServiceAggregationPipeline(filters);
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });
        
        const batchServices = await NonProjectService.aggregate(pipeline);
        allServices.push(...batchServices);
        
        console.log(`导出进度: ${i + 1}/${batchCount} 批次完成`);
      }
      
      // 准备导出数据
      const exportData = {
        services: allServices,
        total: allServices.length,
        generatedAt: new Date().toISOString(),
        filters
      };
      
      // 根据格式生成导出内容
      let result;
      switch (format.toLowerCase()) {
        case 'csv':
          result = await this.exportToCSV(exportData, options);
          break;
        case 'excel':
          result = await this.exportToExcel(exportData, options);
          break;
        case 'json':
          result = await this.exportToJSON(exportData, options);
          break;
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }
      
      console.log('导出完成:', {
        format,
        recordCount: allServices.length,
        fileSize: result.fileSize
      });
      
      return result;
      
    } catch (error) {
      console.error('导出服务记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 导出为CSV格式
   * @private
   */
  static async exportToCSV(data, options) {
    const { services } = data;
    
    // 创建多Sheet数据
    const sheets = {};
    
    if (options.includeSummary !== false) {
      sheets.summary = this.generateSummaryData(services);
    }
    
    sheets.services = services;
    
    if (options.includeStatistics !== false) {
      sheets.statistics = this.generateStatisticsData(services);
    }
    
    // 生成CSV内容
    const csvSheets = CsvExporter.exportMultiSheetCSV(sheets);
    
    // 如果是多Sheet，创建ZIP压缩包
    if (Object.keys(csvSheets).length > 1) {
      return {
        contentType: 'application/zip',
        filename: `services-export-${new Date().toISOString().split('T')[0]}.zip`,
        data: await this.createCSVZip(csvSheets),
        fileSize: 'zip'
      };
    } else {
      const csvContent = Object.values(csvSheets)[0];
      return {
        contentType: 'text/csv; charset=utf-8',
        filename: `services-${new Date().toISOString().split('T')[0]}.csv`,
        data: csvContent,
        fileSize: Buffer.from(csvContent).length
      };
    }
  }
  
  /**
   * 导出为Excel格式
   * @private
   */
  static async exportToExcel(data, options) {
    const { services } = data;
    
    let excelData;
    if (options.includeSummary !== false && options.includeStatistics !== false) {
      excelData = await ExcelExporter.exportServicesToExcel(services, options);
    } else {
      // 简单导出
      excelData = await ExcelExporter.exportMultiSheetExcel({
        services: services
      });
    }
    
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `services-export-${new Date().toISOString().split('T')[0]}.xlsx`,
      data: excelData,
      fileSize: excelData.length
    };
  }
  
  /**
   * 导出为JSON格式
   * @private
   */
  static async exportToJSON(data, options) {
    const { services, ...metadata } = data;
    
    const jsonData = {
      metadata: {
        ...metadata,
        recordCount: services.length,
        exportFormat: 'json'
      },
      services: services.map(service => this.sanitizeForExport(service))
    };
    
    if (options.includeSummary !== false) {
      jsonData.summary = this.generateSummaryData(services);
    }
    
    if (options.includeStatistics !== false) {
      jsonData.statistics = this.generateStatisticsData(services);
    }
    
    const jsonContent = JSON.stringify(jsonData, null, 2);
    
    return {
      contentType: 'application/json',
      filename: `services-export-${new Date().toISOString().split('T')[0]}.json`,
      data: jsonContent,
      fileSize: Buffer.from(jsonContent).length
    };
  }
  
  /**
   * 导出志愿者服务统计
   * @param {Object} filters - 筛选条件
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} - 导出结果
   */
  static async exportVolunteerStatistics(filters = {}, options = {}) {
    try {
      const { format = 'csv' } = options;
      
      console.log('导出志愿者统计:', { filters, format });
      
      // 获取统计数据
      const statistics = await ServiceService.getServiceStatistics(filters);
      
      // 准备志愿者详细统计
      const volunteerStats = await this.generateVolunteerStats(filters);
      
      // 根据格式导出
      switch (format.toLowerCase()) {
        case 'csv': {
          const csvContent = CsvExporter.exportStatisticsToCSV(volunteerStats, {
            ...options,
            filters
          });
          
          return {
            contentType: 'text/csv; charset=utf-8',
            filename: `volunteer-stats-${new Date().toISOString().split('T')[0]}.csv`,
            data: csvContent,
            fileSize: Buffer.from(csvContent).length
          };
        }
        case 'excel': {
          const excelBuffer = await ExcelExporter.exportMultiSheetExcel({
            summary: [statistics.summary],
            '按服务类型': Object.entries(statistics.byServiceType).map(([type, data]) => ({
              服务类型: type,
              记录数量: data.count,
              总时长: data.totalHours,
              平均时长: data.avgDuration
            })),
            '按志愿者': volunteerStats,
            '按地区': Object.entries(statistics.byRegion || {}).map(([region, data]) => ({
              地区: region,
              记录数量: data.count,
              总时长: data.totalHours
            }))
          });
          
          return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `volunteer-stats-${new Date().toISOString().split('T')[0]}.xlsx`,
            data: excelBuffer,
            fileSize: excelBuffer.length
          };
        }
        case 'json': {
          const jsonData = {
            metadata: {
              generatedAt: new Date().toISOString(),
              filters,
              format: 'json'
            },
            statistics,
            volunteerStats
          };
          
          const jsonContent = JSON.stringify(jsonData, null, 2);
          
          return {
            contentType: 'application/json',
            filename: `volunteer-stats-${new Date().toISOString().split('T')[0]}.json`,
            data: jsonContent,
            fileSize: Buffer.from(jsonContent).length
          };
        }
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }
      
    } catch (error) {
      console.error('导出志愿者统计失败:', error);
      throw error;
    }
  }
  
  /**
   * 导出数据导入模板
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} - 模板文件
   */
  static async exportImportTemplate(options = {}) {
    try {
      const { format = 'csv' } = options;
      
      // 创建模板数据
      const templateData = [
        {
          volunteerId: 'PG-0001',
          volunteerName: '张三',
          serviceDate: '2024-01-15',
          serviceType: '翻译',
          duration: 3.5,
          description: '服务描述...',
          note: '请填写服务详情'
        }
      ];
      
      // 创建说明数据
      const instructions = [
        { field: 'volunteerId', description: '志愿者ID (必填)', example: 'PG-0001' },
        { field: 'volunteerName', description: '志愿者姓名 (必填)', example: '张三' },
        { field: 'serviceDate', description: '服务日期 (必填, 格式: YYYY-MM-DD)', example: '2024-01-15' },
        { field: 'serviceType', description: '服务类型 (必填)', example: '翻译/校对/管理/技术' },
        { field: 'duration', description: '服务时长 (必填, 单位: 小时)', example: 3.5 },
        { field: 'description', description: '服务描述 (必填, 5-1000字符)', example: '服务详细描述' },
        { field: 'note', description: '备注 (可选)', example: '其他需要说明的信息' }
      ];
      
      switch (format.toLowerCase()) {
        case 'csv': {
          const csvContent = CsvExporter.exportGenericToCSV(templateData, {
            sheetName: '导入模板',
            includeInstructions: true
          });
          
          // 添加说明
          const instructionsCSV = CsvExporter.exportGenericToCSV(instructions, {
            sheetName: '字段说明'
          });
          
          return {
            contentType: 'text/csv; charset=utf-8',
            filename: `service-import-template-${new Date().toISOString().split('T')[0]}.csv`,
            data: `${instructionsCSV}\n\n${csvContent}`,
            fileSize: 'template'
          };
        }
        case 'excel': {
          const excelBuffer = await ExcelExporter.exportMultiSheetExcel({
            字段说明: instructions,
            导入模板: templateData,
            示例数据: templateData
          });
          
          return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `service-import-template-${new Date().toISOString().split('T')[0]}.xlsx`,
            data: excelBuffer,
            fileSize: excelBuffer.length
          };
        }
        default:
          throw new Error(`不支持的模板格式: ${format}`);
      }
      
    } catch (error) {
      console.error('导出导入模板失败:', error);
      throw error;
    }
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 生成汇总数据
   * @private
   */
  static generateSummaryData(services) {
    const totalHours = services.reduce((sum, service) => sum + (service.duration || 0), 0);
    const serviceDates = services
      .map(s => new Date(s.serviceDate))
      .filter(d => !isNaN(d));
    
    return {
      totalRecords: services.length,
      totalHours: totalHours.toFixed(2),
      avgDuration: services.length > 0 ? totalHours / services.length : 0,
      earliestDate: serviceDates.length > 0 ? 
        new Date(Math.min(...serviceDates)).toISOString() : null,
      latestDate: serviceDates.length > 0 ? 
        new Date(Math.max(...serviceDates)).toISOString() : null,
      uniqueVolunteers: [...new Set(services.map(s => s.volunteerId))].length,
      generatedAt: new Date().toISOString()
    };
  }
  
  /**
   * 生成统计数据
   * @private
   */
  static generateStatisticsData(services) {
    const byServiceType = {};
    const byVolunteer = {};
    
    services.forEach(service => {
      // 按服务类型统计
      const type = service.serviceType || '未知';
      if (!byServiceType[type]) {
        byServiceType[type] = {
          count: 0,
          totalHours: 0
        };
      }
      byServiceType[type].count++;
      byServiceType[type].totalHours += service.duration || 0;
      
      // 按志愿者统计
      const volunteerId = service.volunteerId;
      if (volunteerId) {
        if (!byVolunteer[volunteerId]) {
          byVolunteer[volunteerId] = {
            volunteerName: service.volunteerName || volunteerId,
            count: 0,
            totalHours: 0,
            lastServiceDate: null
          };
        }
        byVolunteer[volunteerId].count++;
        byVolunteer[volunteerId].totalHours += service.duration || 0;
        
        // 更新最后服务日期
        const serviceDate = new Date(service.serviceDate);
        if (!isNaN(serviceDate)) {
          if (!byVolunteer[volunteerId].lastServiceDate || 
              serviceDate > new Date(byVolunteer[volunteerId].lastServiceDate)) {
            byVolunteer[volunteerId].lastServiceDate = service.serviceDate;
          }
        }
      }
    });
    
    // 计算平均值
    Object.values(byServiceType).forEach(stat => {
      stat.avgDuration = stat.count > 0 ? stat.totalHours / stat.count : 0;
    });
    
    Object.values(byVolunteer).forEach(stat => {
      stat.avgDuration = stat.count > 0 ? stat.totalHours / stat.count : 0;
    });
    
    return {
      byServiceType,
      byVolunteer: Object.entries(byVolunteer).map(([volunteerId, data]) => ({
        volunteerId,
        ...data
      })).sort((a, b) => b.totalHours - a.totalHours)
    };
  }
  
  /**
   * 生成志愿者详细统计
   * @private
   */
  static async generateVolunteerStats(filters) {
    const query = QueryUtils.buildServiceRecordsQuery(filters);
    
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: '$volunteerId',
          volunteerName: { $first: '$volunteerName' },
          totalHours: { $sum: '$duration' },
          totalCount: { $sum: 1 },
          lastServiceDate: { $max: '$serviceDate' }
        }
      },
      {
        $lookup: {
          from: 'volunteers',
          localField: '_id',
          foreignField: 'id',
          as: 'volunteerInfo'
        }
      },
      {
        $unwind: {
          path: '$volunteerInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          volunteerId: '$_id',
          volunteerName: 1,
          region: '$volunteerInfo.region',
          status: '$volunteerInfo.status',
          totalHours: 1,
          totalCount: 1,
          avgDuration: { $divide: ['$totalHours', '$totalCount'] },
          lastServiceDate: 1,
          activityLevel: '$volunteerInfo.activityLevel'
        }
      },
      { $sort: { totalHours: -1 } }
    ];
    
    return await NonProjectService.aggregate(pipeline);
  }
  
  /**
   * 创建CSV ZIP压缩包
   * @private
   */
  static async createCSVZip(csvSheets) {
    // 使用JSZip库（需要安装）
    try {
      const JSZip = await import('jszip');
      const zip = new JSZip.default();
      
      for (const [sheetName, csvContent] of Object.entries(csvSheets)) {
        if (csvContent) {
          const filename = `${sheetName}.csv`;
          zip.file(filename, csvContent);
        }
      }
      
      // 添加README文件
      const readme = `服务记录导出文件
生成时间: ${new Date().toLocaleString('zh-CN')}
包含文件: ${Object.keys(csvSheets).join(', ')}
编码: UTF-8
`;
      zip.file('README.txt', readme);
      
      return await zip.generateAsync({ type: 'nodebuffer' });
    } catch (error) {
      console.error('创建ZIP压缩包失败:', error);
      throw error;
    }
  }
  
  /**
   * 清理数据用于导出
   * @private
   */
  static sanitizeForExport(service) {
    const sanitized = { ...service };
    
    // 移除内部字段
    delete sanitized._id;
    delete sanitized.__v;
    delete sanitized.indexedVolunteerId;
    delete sanitized.indexedServiceDate;
    delete sanitized.indexedServiceType;
    delete sanitized.indexedIsActive;
    
    // 格式化日期字段
    if (sanitized.serviceDate) {
      sanitized.serviceDate = new Date(sanitized.serviceDate).toISOString();
    }
    if (sanitized.createdAt) {
      sanitized.createdAt = new Date(sanitized.createdAt).toISOString();
    }
    if (sanitized.updatedAt) {
      sanitized.updatedAt = new Date(sanitized.updatedAt).toISOString();
    }
    
    return sanitized;
  }
}

export default ExportService;
