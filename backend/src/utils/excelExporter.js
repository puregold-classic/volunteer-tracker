// src/utils/excelExporter.js
import ExcelJS from 'exceljs';

/**
 * Excel导出工具类
 */
class ExcelExporter {
  
  /**
   * 将服务记录导出为Excel
   * @param {Array} services - 服务记录数组
   * @param {Object} options - 导出选项
   * @returns {Promise<Buffer>} - Excel文件Buffer
   */
  static async exportServicesToExcel(services, options = {}) {
    try {
      // 创建工作簿
      const workbook = new ExcelJS.Workbook();
      workbook.creator = '志愿者管理系统';
      workbook.lastModifiedBy = '系统管理员';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // 添加汇总Sheet
      await this.addSummarySheet(workbook, services, options);
      
      // 添加详细数据Sheet
      await this.addServicesSheet(workbook, services, options);
      
      // 添加统计Sheet
      await this.addStatisticsSheet(workbook, services, options);
      
      // 生成Excel文件
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
      
    } catch (error) {
      console.error('Excel导出失败:', error);
      throw error;
    }
  }
  
  /**
   * 添加汇总Sheet
   * @private
   */
  static async addSummarySheet(workbook, services, options) {
    const worksheet = workbook.addWorksheet('汇总');
    
    // 设置列宽
    worksheet.columns = [
      { header: '统计项', key: 'item', width: 25 },
      { header: '数值', key: 'value', width: 25 }
    ];
    
    // 添加标题
    worksheet.mergeCells('A1:B1');
    worksheet.getCell('A1').value = '服务记录导出汇总';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // 计算统计信息
    const totalHours = services.reduce((sum, service) => sum + (service.duration || 0), 0);
    const avgDuration = services.length > 0 ? totalHours / services.length : 0;
    const serviceDates = services.map(s => new Date(s.serviceDate)).filter(d => !isNaN(d));
    const earliestDate = serviceDates.length > 0 ? new Date(Math.min(...serviceDates)) : null;
    const latestDate = serviceDates.length > 0 ? new Date(Math.max(...serviceDates)) : null;
    
    // 添加数据行
    const summaryData = [
      ['导出时间', new Date().toLocaleString('zh-CN')],
      ['总记录数', services.length],
      ['总服务时长(小时)', totalHours.toFixed(2)],
      ['平均服务时长(小时)', avgDuration.toFixed(2)],
      ['最早服务日期', earliestDate ? earliestDate.toLocaleDateString('zh-CN') : '无'],
      ['最近服务日期', latestDate ? latestDate.toLocaleDateString('zh-CN') : '无'],
      ['', ''],
      ['筛选条件', options.filters ? JSON.stringify(options.filters, null, 2) : '无']
    ];
    
    summaryData.forEach(([item, value], index) => {
      const row = worksheet.getRow(index + 3);
      row.getCell(1).value = item;
      row.getCell(2).value = value;
      
      if (index === 0) {
        row.font = { bold: true };
      }
    });
    
    // 添加边框
    worksheet.getRow(3).border = { top: { style: 'thin' } };
    worksheet.getRow(summaryData.length + 2).border = { bottom: { style: 'thin' } };
    
    // 设置单元格样式
    for (let i = 1; i <= 2; i++) {
      worksheet.getColumn(i).eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
      });
    }
  }
  
  /**
   * 添加服务记录详细数据Sheet
   * @private
   */
  static async addServicesSheet(workbook, services, options) {
    const worksheet = workbook.addWorksheet('服务记录');
    
    // 定义列
    worksheet.columns = [
      { header: '服务记录ID', key: 'serviceId', width: 20 },
      { header: '志愿者ID', key: 'volunteerId', width: 15 },
      { header: '志愿者姓名', key: 'volunteerName', width: 15 },
      { header: '地区', key: 'volunteerRegion', width: 12 },
      { header: '服务日期', key: 'serviceDate', width: 12 },
      { header: '服务类型', key: 'serviceType', width: 12 },
      { header: '服务时长(小时)', key: 'duration', width: 15 },
      { header: '服务描述', key: 'description', width: 40 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '状态', key: 'status', width: 10 }
    ];
    
    // 设置标题行样式
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // 添加数据
    services.forEach((service, index) => {
      const row = worksheet.getRow(index + 2);
      
      row.getCell('serviceId').value = service.serviceId || '';
      row.getCell('volunteerId').value = service.volunteerId || '';
      row.getCell('volunteerName').value = service.volunteerName || '';
      row.getCell('volunteerRegion').value = service.volunteerRegion || '';
      row.getCell('serviceDate').value = service.serviceDate ? 
        new Date(service.serviceDate).toLocaleDateString('zh-CN') : '';
      row.getCell('serviceType').value = service.serviceType || '';
      row.getCell('duration').value = service.duration || 0;
      row.getCell('duration').numFmt = '0.00';
      row.getCell('description').value = service.description || '';
      row.getCell('createdAt').value = service.createdAt ? 
        new Date(service.createdAt).toLocaleString('zh-CN') : '';
      row.getCell('status').value = service.isActive ? '有效' : '已删除';
      
      // 隔行变色
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        };
      }
    });
    
    // 设置列对齐方式
    worksheet.columns.forEach(column => {
      column.alignment = { vertical: 'middle' };
      if (column.key === 'duration') {
        column.alignment.horizontal = 'right';
      }
    });
    
    // 自动筛选
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount }
    };
    
    // 冻结标题行
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];
  }
  
  /**
   * 添加统计Sheet
   * @private
   */
  static async addStatisticsSheet(workbook, services, options) {
    const worksheet = workbook.addWorksheet('统计');
    
    // 按服务类型统计
    const byServiceType = this.groupByServiceType(services);
    
    // 添加服务类型统计
    worksheet.mergeCells('A1:C1');
    worksheet.getCell('A1').value = '按服务类型统计';
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.columns = [
      { header: '服务类型', key: 'type', width: 20 },
      { header: '记录数量', key: 'count', width: 15 },
      { header: '总时长(小时)', key: 'totalHours', width: 15 }
    ];
    
    const typeHeaderRow = worksheet.getRow(2);
    typeHeaderRow.font = { bold: true };
    typeHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2EFDA' }
    };
    
    Object.entries(byServiceType).forEach(([type, data], index) => {
      const row = worksheet.getRow(index + 3);
      row.getCell(1).value = type;
      row.getCell(2).value = data.count;
      row.getCell(3).value = data.totalHours;
      row.getCell(3).numFmt = '0.00';
    });
    
    // 按志愿者统计
    const byVolunteer = this.groupByVolunteer(services);
    
    // 添加志愿者统计
    const volunteerStartRow = worksheet.rowCount + 3;
    worksheet.mergeCells(`A${volunteerStartRow}:D${volunteerStartRow}`);
    worksheet.getCell(`A${volunteerStartRow}`).value = '按志愿者统计';
    worksheet.getCell(`A${volunteerStartRow}`).font = { size: 14, bold: true };
    worksheet.getCell(`A${volunteerStartRow}`).alignment = { horizontal: 'center' };
    
    const volunteerDataStartRow = volunteerStartRow + 1;
    worksheet.getRow(volunteerDataStartRow).values = [
      '志愿者ID', '志愿者姓名', '记录数量', '总时长(小时)'
    ];
    
    const volunteerHeaderRow = worksheet.getRow(volunteerDataStartRow);
    volunteerHeaderRow.font = { bold: true };
    volunteerHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDDEBF7' }
    };
    
    Object.entries(byVolunteer).forEach(([volunteerId, data], index) => {
      const row = worksheet.getRow(volunteerDataStartRow + index + 1);
      row.getCell(1).value = volunteerId;
      row.getCell(2).value = data.volunteerName;
      row.getCell(3).value = data.count;
      row.getCell(4).value = data.totalHours;
      row.getCell(4).numFmt = '0.00';
    });
    
    // 设置列对齐
    worksheet.columns.forEach((column, index) => {
      column.alignment = { vertical: 'middle' };
      if (index >= 2) { // 数值列右对齐
        column.alignment.horizontal = 'right';
      }
    });
  }
  
  /**
   * 按服务类型分组统计
   * @private
   */
  static groupByServiceType(services) {
    const groups = {};
    
    services.forEach(service => {
      const type = service.serviceType || '未知';
      if (!groups[type]) {
        groups[type] = {
          count: 0,
          totalHours: 0
        };
      }
      groups[type].count++;
      groups[type].totalHours += service.duration || 0;
    });
    
    return groups;
  }
  
  /**
   * 按志愿者分组统计
   * @private
   */
  static groupByVolunteer(services) {
    const groups = {};
    
    services.forEach(service => {
      const volunteerId = service.volunteerId;
      if (!volunteerId) return;
      
      if (!groups[volunteerId]) {
        groups[volunteerId] = {
          volunteerName: service.volunteerName || volunteerId,
          count: 0,
          totalHours: 0
        };
      }
      groups[volunteerId].count++;
      groups[volunteerId].totalHours += service.duration || 0;
    });
    
    return groups;
  }
  
  /**
   * 导出多Sheet Excel
   * @param {Object} data - 多个Sheet的数据
   * @returns {Promise<Buffer>} - Excel文件Buffer
   */
  static async exportMultiSheetExcel(data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '志愿者管理系统';
    
    for (const [sheetName, sheetData] of Object.entries(data)) {
      if (!Array.isArray(sheetData) || sheetData.length === 0) continue;
      
      const worksheet = workbook.addWorksheet(sheetName);
      
      // 自动创建列
      const sample = sheetData[0];
      const columns = Object.keys(sample).map(key => ({
        header: this.formatHeaderTitle(key),
        key: key,
        width: 20
      }));
      
      worksheet.columns = columns;
      
      // 添加数据
      sheetData.forEach((item, index) => {
        const row = worksheet.getRow(index + 2);
        Object.entries(item).forEach(([key, value]) => {
          row.getCell(key).value = value;
        });
        
        // 隔行变色
        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
          };
        }
      });
      
      // 设置标题行样式
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2EFDA' }
      };
    }
    
    return await workbook.xlsx.writeBuffer();
  }
  
  /**
   * 格式化标题
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
      max: '最大',
      service: '服务',
      volunteer: '志愿者',
      duration: '时长',
      description: '描述',
      status: '状态',
      region: '地区',
      type: '类型'
    };
    
    let title = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    // 替换单词
    Object.entries(titleMap).forEach(([en, zh]) => {
      const regex = new RegExp(`\\b${en}\\b`, 'gi');
      title = title.replace(regex, zh);
    });
    
    return title;
  }
}

export default ExcelExporter;