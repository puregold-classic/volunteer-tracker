// src/services/ServiceService.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// Complex $facet/$lookup aggregations replaced with multiple parallel Prisma queries
// and prisma.$queryRaw for time-series groupings.

import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';
import {
  serializeNonProjectService,
  SERVICE_TYPE_TO_PG,
  SERVICE_TYPE_DISPLAY,
  REGION_DISPLAY,
  REGION_TO_PG,
  ACTIVITY_LEVEL_DISPLAY,
} from '../utils/serializer.js';

/**
 * Build a Prisma `where` clause for NonProjectService from API filter params.
 */
const buildServiceWhere = (filters = {}) => {
  const {
    volunteerId,
    volunteerName,
    serviceType,
    serviceDateFrom,
    serviceDateTo,
    minDuration,
    maxDuration,
    isActive = true,
    search,
  } = filters;

  const where = { isActive: isActive !== false && isActive !== 'false' };

  if (volunteerId) where.volunteerId = volunteerId;

  if (volunteerName) {
    where.volunteerName = { contains: volunteerName, mode: 'insensitive' };
  }

  if (serviceType) {
    const types = String(serviceType).split(',').map(t => t.trim()).filter(Boolean);
    const pgTypes = types.map(t => SERVICE_TYPE_TO_PG[t] || t).filter(Boolean);
    if (pgTypes.length === 1) where.serviceType = pgTypes[0];
    else if (pgTypes.length > 1) where.serviceType = { in: pgTypes };
  }

  if (serviceDateFrom || serviceDateTo) {
    where.serviceDate = {};
    if (serviceDateFrom) where.serviceDate.gte = new Date(serviceDateFrom);
    if (serviceDateTo) {
      const end = new Date(serviceDateTo);
      end.setHours(23, 59, 59, 999);
      where.serviceDate.lte = end;
    }
  }

  if (minDuration || maxDuration) {
    where.duration = {};
    if (minDuration) where.duration.gte = parseFloat(minDuration);
    if (maxDuration) where.duration.lte = parseFloat(maxDuration);
  }

  if (search && search.trim()) {
    where.OR = [
      { volunteerId: { contains: search.trim(), mode: 'insensitive' } },
      { volunteerName: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
};

class ServiceService {
  /**
   * 获取服务记录列表
   */
  static async getServiceRecords(filters = {}, pagination = {}, sortOptions = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { sortBy = 'serviceDate', order = 'desc' } = sortOptions;
      const pg = QueryUtils.buildPaginationOptions(page, limit);

      const allowedSortFields = ['serviceDate', 'createdAt', 'updatedAt', 'duration', 'volunteerName', 'serviceType'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'serviceDate';
      const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

      // region filter requires joining volunteer — handle separately
      const { region, ...baseFilters } = filters;
      const where = buildServiceWhere(baseFilters);

      let services, total;

      if (region) {
        // Need to filter by volunteer region — use a subquery via volunteerId IN (...)
        const pgRegion = SERVICE_TYPE_TO_PG[region] || region; // region uses REGION_TO_PG actually
        const { REGION_TO_PG } = await import('../utils/serializer.js');
        const pgRegionVal = REGION_TO_PG[region] || region;
        const matchedVolunteers = await prisma.volunteer.findMany({
          where: { region: pgRegionVal },
          select: { volunteerId: true },
        });
        const volunteerIds = matchedVolunteers.map(v => v.volunteerId);
        where.volunteerId = { in: volunteerIds };
      }

      [services, total] = await Promise.all([
        prisma.nonProjectService.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip: pg.skip,
          take: pg.limit,
        }),
        prisma.nonProjectService.count({ where }),
      ]);

      return {
        services: services.map(serializeNonProjectService),
        pagination: {
          page: pg.page,
          limit: pg.limit,
          total,
          totalPages: Math.ceil(total / pg.limit),
          hasNext: pg.page * pg.limit < total,
          hasPrev: pg.page > 1,
        },
      };
    } catch (error) {
      console.error('获取服务记录列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务记录详情（含关联志愿者信息和审计日志）
   */
  static async getServiceRecordById(serviceId) {
    try {
      const record = await prisma.nonProjectService.findFirst({
        where: { serviceId, isActive: true },
      });

      if (!record) {
        throw new Error(`服务记录不存在: ${serviceId}`);
      }

      const [volunteer, relatedAuditLogs] = await Promise.all([
        prisma.volunteer.findFirst({
          where: { volunteerId: record.volunteerId },
          select: {
            volunteerId: true,
            chineseName: true,
            englishName: true,
            region: true,
            status: true,
            activityLevel: true,
            nonProjectHours: true,
            nonProjectCount: true,
          },
        }),
        prisma.auditLog.findMany({
          where: {
            OR: [{ modifiedId: serviceId }, { targetId: serviceId }],
          },
          orderBy: { timestamp: 'desc' },
          select: { auditId: true, action: true, actionDetails: true, operator: true, timestamp: true },
        }),
      ]);

      return {
        ...serializeNonProjectService(record),
        volunteerInfo: volunteer ? {
          id: volunteer.volunteerId,
          chineseName: volunteer.chineseName,
          englishName: volunteer.englishName,
          region: REGION_DISPLAY[volunteer.region] ?? volunteer.region,
          status: volunteer.status,
          activityLevel: ACTIVITY_LEVEL_DISPLAY[volunteer.activityLevel] ?? volunteer.activityLevel,
          nonProjectHours: volunteer.nonProjectHours,
          nonProjectCount: volunteer.nonProjectCount,
        } : null,
        relatedAuditLogs,
      };
    } catch (error) {
      console.error('获取服务记录详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取志愿者的服务记录
   */
  static async getServicesByVolunteer(volunteerId, filters = {}, pagination = {}) {
    try {
      const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId } });
      if (!volunteer) {
        throw new Error(`志愿者不存在: ${volunteerId}`);
      }
      return await this.getServiceRecords({ ...filters, volunteerId }, pagination);
    } catch (error) {
      console.error('获取志愿者服务记录失败:', error);
      throw error;
    }
  }

  /**
   * 搜索服务记录
   */
  static async searchServices(searchTerm, filters = {}, pagination = {}) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }
      return await this.getServiceRecords({ ...filters, search: searchTerm.trim() }, pagination);
    } catch (error) {
      console.error('搜索服务记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务记录统计信息
   */
  static async getServiceStatistics(filters = {}) {
    try {
      const where = buildServiceWhere(filters);

      const [summary, byServiceType, byVolunteer, byMonth] = await Promise.all([
        // 总体统计
        prisma.nonProjectService.aggregate({
          where,
          _count: { id: true },
          _sum: { duration: true },
          _avg: { duration: true },
          _min: { duration: true, serviceDate: true },
          _max: { duration: true, serviceDate: true },
        }),
        // 按服务类型统计
        prisma.nonProjectService.groupBy({
          by: ['serviceType'],
          where,
          _count: { id: true },
          _sum: { duration: true },
          _avg: { duration: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        // 按志愿者统计（前10名）
        prisma.$queryRaw`
          SELECT "volunteerId", "volunteerName",
                 COUNT(*)::int AS count,
                 SUM(duration) AS "totalHours",
                 AVG(duration) AS "avgDuration"
          FROM non_project_services
          WHERE "isActive" = true
          GROUP BY "volunteerId", "volunteerName"
          ORDER BY "totalHours" DESC
          LIMIT 10
        `,
        // 按月统计（最近12个月）
        prisma.$queryRaw`
          SELECT TO_CHAR("serviceDate", 'YYYY-MM') AS period,
                 COUNT(*)::int AS count,
                 SUM(duration) AS "totalHours"
          FROM non_project_services
          WHERE "isActive" = true
          GROUP BY period
          ORDER BY period ASC
          LIMIT 12
        `,
      ]);

      return {
        summary: {
          totalRecords: summary._count.id ?? 0,
          totalHours: summary._sum.duration ?? 0,
          avgDuration: summary._avg.duration ? Math.round(summary._avg.duration * 100) / 100 : 0,
          minDuration: summary._min.duration ?? 0,
          maxDuration: summary._max.duration ?? 0,
          earliestDate: summary._min.serviceDate,
          latestDate: summary._max.serviceDate,
        },
        byServiceType: byServiceType.map(r => ({
          serviceType: SERVICE_TYPE_DISPLAY[r.serviceType] ?? r.serviceType,
          count: r._count.id,
          totalHours: r._sum.duration ?? 0,
          avgDuration: r._avg.duration ? Math.round(r._avg.duration * 100) / 100 : 0,
        })),
        byVolunteer,
        byMonth,
        generatedAt: new Date().toISOString(),
        filters,
      };
    } catch (error) {
      console.error('获取服务统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取志愿者服务统计
   */
  static async getVolunteerServiceStatistics(volunteerId) {
    try {
      const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId } });
      if (!volunteer) {
        throw new Error(`志愿者不存在: ${volunteerId}`);
      }

      const where = { volunteerId, isActive: true };

      const [summary, byServiceType, byYear, byMonth, recentServices] = await Promise.all([
        prisma.nonProjectService.aggregate({
          where,
          _count: { id: true },
          _sum: { duration: true },
          _avg: { duration: true },
          _min: { duration: true, serviceDate: true },
          _max: { duration: true, serviceDate: true },
        }),
        prisma.nonProjectService.groupBy({
          by: ['serviceType'],
          where,
          _count: { id: true },
          _sum: { duration: true },
          _avg: { duration: true },
          orderBy: { _sum: { duration: 'desc' } },
        }),
        // by year
        prisma.$queryRaw`
          SELECT EXTRACT(YEAR FROM "serviceDate")::int AS year,
                 COUNT(*)::int AS count,
                 SUM(duration) AS "totalHours"
          FROM non_project_services
          WHERE "volunteerId" = ${volunteerId} AND "isActive" = true
          GROUP BY year
          ORDER BY year ASC
        `,
        // by month (last 12)
        prisma.$queryRaw`
          SELECT TO_CHAR("serviceDate", 'YYYY-MM') AS period,
                 EXTRACT(YEAR FROM "serviceDate")::int AS year,
                 EXTRACT(MONTH FROM "serviceDate")::int AS month,
                 COUNT(*)::int AS count,
                 SUM(duration) AS "totalHours"
          FROM non_project_services
          WHERE "volunteerId" = ${volunteerId} AND "isActive" = true
          GROUP BY period, year, month
          ORDER BY period ASC
          LIMIT 12
        `,
        // recent 5 records
        prisma.nonProjectService.findMany({
          where,
          orderBy: { serviceDate: 'desc' },
          take: 5,
          select: { serviceId: true, serviceDate: true, serviceType: true, duration: true, description: true },
        }),
      ]);

      return {
        volunteerId,
        volunteerName: volunteer.chineseName,
        summary: {
          totalRecords: summary._count.id ?? 0,
          totalHours: summary._sum.duration ?? 0,
          avgDuration: summary._avg.duration ? Math.round(summary._avg.duration * 100) / 100 : 0,
          minDuration: summary._min.duration ?? 0,
          maxDuration: summary._max.duration ?? 0,
          earliestDate: summary._min.serviceDate,
          latestDate: summary._max.serviceDate,
        },
        byServiceType: byServiceType.map(r => ({
          serviceType: SERVICE_TYPE_DISPLAY[r.serviceType] ?? r.serviceType,
          count: r._count.id,
          totalHours: r._sum.duration ?? 0,
          avgDuration: r._avg.duration ? Math.round(r._avg.duration * 100) / 100 : 0,
        })),
        byYear,
        byMonth,
        recentServices: recentServices.map(r => ({
          ...r,
          serviceType: SERVICE_TYPE_DISPLAY[r.serviceType] ?? r.serviceType,
        })),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('获取志愿者服务统计失败:', error);
      throw error;
    }
  }
}

export default ServiceService;
