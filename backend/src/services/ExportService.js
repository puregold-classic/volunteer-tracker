// src/services/ExportService.js — v2.1
//
// CSV / Excel / JSON export for ProjectSupport records and aggregate stats.
// v1's stale references to NonProjectService and the SERVICE_TYPE enum are gone.

import prisma from '../utils/prismaClient.js';
import CsvExporter from '../utils/csvExporter.js';
import ExcelExporter from '../utils/excelExporter.js';
import SupportLedgerService from './SupportLedgerService.js';

class ExportService {
  /**
   * Export ProjectSupport records (filterable) as CSV / Excel / JSON.
   */
  static async exportSupports(filters = {}, options = {}) {
    const { format = 'csv', maxRecords = 10000 } = options;

    const where = { status: 'ACTIVE' };
    if (filters.volunteerId) where.volunteerId = filters.volunteerId;
    if (filters.departmentId) where.serviceItem = { departmentId: filters.departmentId };
    if (filters.serviceItemId) where.serviceItemId = filters.serviceItemId;
    if (filters.dateFrom || filters.dateTo) {
      where.serviceDate = {};
      if (filters.dateFrom) where.serviceDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        where.serviceDate.lte = end;
      }
    }

    const totalCount = await prisma.projectSupport.count({ where });
    if (totalCount > maxRecords) {
      throw new Error(`记录数量过多 (${totalCount})，最多支持导出 ${maxRecords} 条`);
    }

    const records = await prisma.projectSupport.findMany({
      where,
      include: {
        volunteer: { select: { volunteerCode: true, chineseName: true, departmentId: true } },
        submittedBy: { select: { volunteerCode: true, chineseName: true } },
        serviceItem: { include: { department: true } },
      },
      orderBy: { serviceDate: 'desc' },
    });

    const flattened = records.map((r) => ({
      supportId: r.supportId,
      volunteerCode: r.volunteer?.volunteerCode ?? '',
      volunteerName: r.volunteer?.chineseName ?? '',
      department: r.serviceItem?.department?.name ?? '',
      serviceItem: r.serviceItem?.name ?? '',
      serviceDate: r.serviceDate ? r.serviceDate.toISOString().split('T')[0] : '',
      duration: r.duration,
      description: r.description,
      submittedBy: r.submittedBy?.chineseName ?? '',
      isProxy: r.submittedById !== r.volunteerId,
      confirmedAt: r.confirmedAt ?? '',
      createdAt: r.createdAt,
    }));

    const stamp = new Date().toISOString().split('T')[0];

    switch (String(format).toLowerCase()) {
      case 'csv': {
        const csv = CsvExporter.exportGenericToCSV(flattened, { sheetName: 'project_supports' });
        return {
          contentType: 'text/csv; charset=utf-8',
          filename: `project-supports-${stamp}.csv`,
          data: csv,
          fileSize: Buffer.from(csv).length,
        };
      }
      case 'excel': {
        const excel = await ExcelExporter.exportMultiSheetExcel({ project_supports: flattened });
        return {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: `project-supports-${stamp}.xlsx`,
          data: excel,
          fileSize: excel.length,
        };
      }
      case 'json': {
        const json = JSON.stringify({
          metadata: { generatedAt: new Date().toISOString(), filters, count: flattened.length },
          records: flattened,
        }, null, 2);
        return {
          contentType: 'application/json',
          filename: `project-supports-${stamp}.json`,
          data: json,
          fileSize: Buffer.from(json).length,
        };
      }
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * Export the SupportLedgerService overview (top-of-page admin stats).
   */
  static async exportLedgerOverview(filters = {}, options = {}) {
    const overview = await SupportLedgerService.overview(filters);
    const { format = 'json' } = options;
    const stamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const json = JSON.stringify(overview, null, 2);
      return {
        contentType: 'application/json',
        filename: `ledger-overview-${stamp}.json`,
        data: json,
        fileSize: Buffer.from(json).length,
      };
    }
    if (format === 'excel') {
      const excel = await ExcelExporter.exportMultiSheetExcel({
        summary: [overview.summary],
        byDepartment: overview.byDepartment,
        byVolunteer: overview.byVolunteer,
        byServiceItem: overview.byServiceItem,
      });
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `ledger-overview-${stamp}.xlsx`,
        data: excel,
        fileSize: excel.length,
      };
    }
    throw new Error(`不支持的导出格式: ${format}`);
  }
}

export default ExportService;
