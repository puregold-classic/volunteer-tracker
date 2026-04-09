// src/services/SupportLedgerService.js — v2.1
//
// Read-only ledger for the「项目支援台账」admin page. Replaces v1's
// ReviewService entirely (which was a gatekeeping queue) — under v2.1 there's
// no approval queue, just a comprehensive view of what's been recorded plus
// the ability to drill into individual records.
//
// Provides aggregations admins need:
// - Per-volunteer (top contributors, hours, count, last activity)
// - Per-department (rollup of all members)
// - Per-service-item (which categories of work happen most)
// - Per-time-period (monthly / quarterly trends)
// - Per-submitter (who's helping others — the proxy contribution metric)
// - Recent activity feed (drawn from AuditLog)

import prisma from '../utils/prismaClient.js';

class SupportLedgerService {
  /**
   * High-level summary of all ACTIVE ProjectSupport records, sliced by the
   * usual dimensions. Admin dashboard uses this for the top-of-page widgets.
   */
  static async overview({ dateFrom, dateTo, departmentId } = {}) {
    // Normalize bounds. NULL means "no bound on this side". `to` is bumped
    // to end-of-day so callers can pass a calendar date and have the
    // upper bound include records made anywhere on that day.
    const from = dateFrom ? new Date(dateFrom) : null;
    let to = null;
    if (dateTo) {
      to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
    }
    const dept = departmentId || null;

    // Mirror filters into the Prisma operator-style `where` for the
    // aggregate totals. The 3 raw queries below all share the same
    // logical filter expressed as inline COALESCE clauses.
    const where = { status: 'ACTIVE' };
    if (dept) where.serviceItem = { departmentId: dept };
    if (from || to) {
      where.serviceDate = {};
      if (from) where.serviceDate.gte = from;
      if (to) where.serviceDate.lte = to;
    }

    const [totals, byVolunteer, byDepartment, byServiceItem] = await Promise.all([
      prisma.projectSupport.aggregate({
        where,
        _count: { id: true },
        _sum: { duration: true },
        _avg: { duration: true },
        _min: { serviceDate: true },
        _max: { serviceDate: true },
      }),
      prisma.$queryRaw`
        SELECT v.id                 AS "volunteerId",
               v."volunteerCode",
               v."chineseName",
               v."departmentId",
               COUNT(*)::int        AS "count",
               SUM(p.duration)      AS "totalHours",
               MAX(p."serviceDate") AS "lastDate"
        FROM project_supports p
        JOIN volunteers v ON v.id = p."volunteerId"
        JOIN service_items si ON si.id = p."serviceItemId"
        WHERE p.status = 'ACTIVE'
          AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
          AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
          AND si."departmentId" = COALESCE(${dept}::text,     si."departmentId")
        GROUP BY v.id, v."volunteerCode", v."chineseName", v."departmentId"
        ORDER BY "totalHours" DESC NULLS LAST
        LIMIT 50
      `,
      prisma.$queryRaw`
        SELECT d.id           AS "departmentId",
               d.name         AS "departmentName",
               COUNT(p.id)::int AS "count",
               SUM(p.duration)  AS "totalHours"
        FROM project_supports p
        JOIN service_items si ON si.id = p."serviceItemId"
        JOIN departments d   ON d.id  = si."departmentId"
        WHERE p.status = 'ACTIVE'
          AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
          AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
          AND si."departmentId" = COALESCE(${dept}::text,     si."departmentId")
        GROUP BY d.id, d.name, d."displayOrder"
        ORDER BY d."displayOrder" ASC
      `,
      prisma.$queryRaw`
        SELECT si.id           AS "serviceItemId",
               si.name         AS "serviceItemName",
               d.name          AS "departmentName",
               COUNT(p.id)::int AS "count",
               SUM(p.duration)  AS "totalHours"
        FROM project_supports p
        JOIN service_items si ON si.id = p."serviceItemId"
        JOIN departments d   ON d.id  = si."departmentId"
        WHERE p.status = 'ACTIVE'
          AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
          AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
          AND si."departmentId" = COALESCE(${dept}::text,     si."departmentId")
        GROUP BY si.id, si.name, d.name, d."displayOrder", si."displayOrder"
        ORDER BY d."displayOrder" ASC, si."displayOrder" ASC
      `,
    ]);

    return {
      summary: {
        totalRecords: totals._count.id ?? 0,
        totalHours: totals._sum.duration ?? 0,
        avgDuration: totals._avg.duration
          ? Math.round(totals._avg.duration * 100) / 100
          : 0,
        earliestDate: totals._min.serviceDate,
        latestDate: totals._max.serviceDate,
      },
      byVolunteer,
      byDepartment,
      byServiceItem,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Time-series trend (monthly buckets). Used for the trend chart.
   */
  static async timeSeries({ months = 12 } = {}) {
    return prisma.$queryRaw`
      SELECT TO_CHAR("serviceDate", 'YYYY-MM') AS period,
             COUNT(*)::int                       AS count,
             SUM(duration)                       AS "totalHours"
      FROM project_supports
      WHERE status = 'ACTIVE'
        AND "serviceDate" >= NOW() - (${months} || ' months')::interval
      GROUP BY period
      ORDER BY period ASC
    `;
  }

  /**
   * Proxy contribution leaderboard: who has helped others by submitting on
   * their behalf. Returns { submitter, count } pairs.
   *
   * Date filters are passed as bounded params; NULL means "open-ended".
   * COALESCE inside the SQL collapses the optional bounds into single
   * comparisons, which keeps the query as one safe tagged template.
   */
  static async proxyContributions({ dateFrom, dateTo } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    return prisma.$queryRaw`
      SELECT s."volunteerCode",
             s."chineseName",
             COUNT(*)::int AS "proxyCount"
      FROM project_supports p
      JOIN volunteers s ON s.id = p."submittedById"
      WHERE p.status = 'ACTIVE'
        AND p."volunteerId" != p."submittedById"
        AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
        AND p."serviceDate" <= COALESCE(${to}::timestamp, p."serviceDate")
      GROUP BY s."volunteerCode", s."chineseName"
      ORDER BY "proxyCount" DESC
      LIMIT 50
    `;
  }

  /**
   * Recent activity feed for admins — drawn from AuditLog filtered to
   * ProjectSupport actions.
   */
  static async recentActivity({ limit = 50, action } = {}) {
    const where = { targetType: 'ProjectSupport' };
    if (action) {
      if (Array.isArray(action)) where.action = { in: action };
      else where.action = action;
    }
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    });
    return logs;
  }

  /**
   * Per-volunteer detail page: full stats + recent records for one volunteer.
   */
  static async volunteerDetail(volunteerId) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: volunteerId },
      include: { department: true },
    });
    if (!volunteer) throw new Error(`志愿者不存在: ${volunteerId}`);

    const where = { volunteerId, status: 'ACTIVE' };
    const [agg, byItem, byMonth, recent, proxyHelped] = await Promise.all([
      prisma.projectSupport.aggregate({
        where,
        _count: { id: true },
        _sum: { duration: true },
        _avg: { duration: true },
        _min: { serviceDate: true },
        _max: { serviceDate: true },
      }),
      prisma.$queryRaw`
        SELECT si.name AS "serviceItemName",
               d.name  AS "departmentName",
               COUNT(*)::int AS count,
               SUM(p.duration) AS "totalHours"
        FROM project_supports p
        JOIN service_items si ON si.id = p."serviceItemId"
        JOIN departments   d  ON d.id  = si."departmentId"
        WHERE p."volunteerId" = ${volunteerId} AND p.status = 'ACTIVE'
        GROUP BY si.name, d.name, d."displayOrder", si."displayOrder"
        ORDER BY d."displayOrder", si."displayOrder"
      `,
      prisma.$queryRaw`
        SELECT TO_CHAR("serviceDate", 'YYYY-MM') AS period,
               COUNT(*)::int AS count,
               SUM(duration) AS "totalHours"
        FROM project_supports
        WHERE "volunteerId" = ${volunteerId} AND status = 'ACTIVE'
        GROUP BY period
        ORDER BY period DESC
        LIMIT 12
      `,
      prisma.projectSupport.findMany({
        where: { volunteerId, status: 'ACTIVE' },
        include: {
          serviceItem: { include: { department: true } },
          submittedBy: { select: { volunteerCode: true, chineseName: true } },
        },
        orderBy: { serviceDate: 'desc' },
        take: 10,
      }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM project_supports
        WHERE "submittedById" = ${volunteerId}
          AND "volunteerId" != ${volunteerId}
          AND status = 'ACTIVE'
      `,
    ]);

    return {
      volunteer: {
        id: volunteer.id,
        volunteerCode: volunteer.volunteerCode,
        chineseName: volunteer.chineseName,
        department: volunteer.department ? { id: volunteer.department.id, name: volunteer.department.name } : null,
      },
      summary: {
        totalRecords: agg._count.id ?? 0,
        totalHours: agg._sum.duration ?? 0,
        avgDuration: agg._avg.duration ? Math.round(agg._avg.duration * 100) / 100 : 0,
        earliestDate: agg._min.serviceDate,
        latestDate: agg._max.serviceDate,
        proxyContributions: proxyHelped[0]?.count ?? 0,
      },
      byServiceItem: byItem,
      byMonth,
      recentRecords: recent,
    };
  }
}

export default SupportLedgerService;
