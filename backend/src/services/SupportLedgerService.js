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
  static async overview({ dateFrom, dateTo, departmentId, category } = {}) {
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
    const cat = category || null;

    // Mirror filters into the Prisma operator-style `where` for the
    // aggregate totals. The 3 raw queries below all share the same
    // logical filter expressed as inline COALESCE clauses.
    const where = { status: 'ACTIVE' };
    if (dept || cat) {
      where.serviceItem = {};
      if (dept) where.serviceItem.departmentId = dept;
      if (cat) where.serviceItem.category = cat;
    }
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
          AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
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
          AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
        GROUP BY d.id, d.name, d."displayOrder"
        ORDER BY d."displayOrder" ASC
      `,
      prisma.$queryRaw`
        SELECT si.id           AS "serviceItemId",
               si.name         AS "serviceItemName",
               si."category"   AS "category",
               d.id            AS "departmentId",
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
          AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
        GROUP BY si.id, si.name, si."category", d.id, d.name, d."displayOrder", si."displayOrder"
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
   * Respects the same dateFrom/dateTo/departmentId filters as overview.
   * Falls back to a 12-month rolling window when no date range is given.
   */
  /**
   * @param {object} opts
   * @param {number}  [opts.months=12]       Fallback rolling window when no dateFrom
   * @param {string}  [opts.dateFrom]        ISO date lower bound
   * @param {string}  [opts.dateTo]          ISO date upper bound
   * @param {string}  [opts.departmentId]    Optional department filter
   * @param {'month'|'day'} [opts.granularity='month']  Bucket size
   */
  static async timeSeries({
    months = 12, dateFrom, dateTo, departmentId, category, groupBy, granularity = 'month',
  } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    let to = null;
    if (dateTo) {
      to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
    }
    const dept = departmentId || null;
    const cat = category || null;
    const effectiveFrom = from || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
    const fmt = granularity === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    // groupBy=category: multi-series output for the v3 trend chart.
    // Shape: [{ period, byCategory: {MGMT,TRAINING,SUPPORT,ATTENDANCE}, total }]
    if (groupBy === 'category') {
      const rows = await prisma.$queryRaw`
        SELECT TO_CHAR(p."serviceDate", ${fmt}) AS period,
               si."category"                    AS category,
               COUNT(*)::int                    AS count,
               SUM(p.duration)                  AS "totalHours"
        FROM project_supports p
        JOIN service_items si ON si.id = p."serviceItemId"
        WHERE p.status = 'ACTIVE'
          AND p."serviceDate" >= ${effectiveFrom}::timestamp
          AND p."serviceDate" <= COALESCE(${to}::timestamp, p."serviceDate")
          AND si."departmentId" = COALESCE(${dept}::text, si."departmentId")
          AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
        GROUP BY period, si."category"
        ORDER BY period ASC
      `;
      const byPeriod = new Map();
      const EMPTY = () => ({ PROJECT_MGMT: 0, PROJECT_TRAINING: 0, PROJECT_SUPPORT: 0, TRAINING_ATTENDANCE: 0 });
      for (const r of rows) {
        if (!byPeriod.has(r.period)) {
          byPeriod.set(r.period, { period: r.period, byCategory: EMPTY(), total: 0 });
        }
        const entry = byPeriod.get(r.period);
        entry.byCategory[r.category] = Number(r.totalHours || 0);
        entry.total += Number(r.totalHours || 0);
      }
      return Array.from(byPeriod.values());
    }

    return prisma.$queryRaw`
      SELECT TO_CHAR(p."serviceDate", ${fmt}) AS period,
             COUNT(*)::int                     AS count,
             SUM(p.duration)                   AS "totalHours"
      FROM project_supports p
      JOIN service_items si ON si.id = p."serviceItemId"
      WHERE p.status = 'ACTIVE'
        AND p."serviceDate" >= ${effectiveFrom}::timestamp
        AND p."serviceDate" <= COALESCE(${to}::timestamp, p."serviceDate")
        AND si."departmentId" = COALESCE(${dept}::text, si."departmentId")
        AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
      GROUP BY period
      ORDER BY period ASC
    `;
  }

  /**
   * Per-department stacked breakdown by category — feeds the v3 Phase D
   * department stacked bar view. Returns one row per department with
   * byCategory totals. Optional dateFrom/dateTo / departmentId / category
   * narrow the scope.
   */
  static async categoryBreakdown({ dateFrom, dateTo, departmentId, category } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    let to = null;
    if (dateTo) {
      to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
    }
    const dept = departmentId || null;
    const cat = category || null;

    const rows = await prisma.$queryRaw`
      SELECT d.id             AS "departmentId",
             d.name           AS "departmentName",
             d."displayOrder" AS "displayOrder",
             si."category"    AS category,
             COUNT(*)::int    AS count,
             SUM(p.duration)  AS "totalHours"
      FROM project_supports p
      JOIN service_items si ON si.id = p."serviceItemId"
      JOIN departments d    ON d.id  = si."departmentId"
      WHERE p.status = 'ACTIVE'
        AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
        AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
        AND d.id              = COALESCE(${dept}::text,     d.id)
        AND si."category"     = COALESCE(${cat}::"ServiceCategory", si."category")
      GROUP BY d.id, d.name, d."displayOrder", si."category"
      ORDER BY d."displayOrder" ASC
    `;

    const byDept = new Map();
    const EMPTY = () => ({ PROJECT_MGMT: 0, PROJECT_TRAINING: 0, PROJECT_SUPPORT: 0, TRAINING_ATTENDANCE: 0 });
    for (const r of rows) {
      if (!byDept.has(r.departmentId)) {
        byDept.set(r.departmentId, {
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          displayOrder: r.displayOrder,
          byCategory: EMPTY(),
          total: 0,
        });
      }
      const entry = byDept.get(r.departmentId);
      entry.byCategory[r.category] = Number(r.totalHours || 0);
      entry.total += Number(r.totalHours || 0);
    }
    return Array.from(byDept.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * Volunteer breakdown for a single service item — feeds View 2 drill-down
   * (the "skippable middle layer" in v3 plan). Which volunteers produced
   * hours for this service? Sorted by totalHours desc.
   */
  static async serviceVolunteers(serviceItemId, { dateFrom, dateTo } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    let to = null;
    if (dateTo) {
      to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
    }

    return prisma.$queryRaw`
      SELECT v.id              AS "volunteerId",
             v."volunteerCode" AS "volunteerCode",
             v."chineseName"   AS "chineseName",
             v."departmentId"  AS "departmentId",
             COUNT(*)::int     AS count,
             SUM(p.duration)   AS "totalHours",
             MAX(p."serviceDate") AS "lastDate"
      FROM project_supports p
      JOIN volunteers v ON v.id = p."volunteerId"
      WHERE p."serviceItemId" = ${serviceItemId}
        AND p.status = 'ACTIVE'
        AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
        AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
      GROUP BY v.id, v."volunteerCode", v."chineseName", v."departmentId"
      ORDER BY "totalHours" DESC NULLS LAST
    `;
  }

  /**
   * Service breakdown for a single volunteer — feeds View 3 drill-down.
   * Returns service items with deptId/category so the frontend can colour
   * bars by department-within-category. Sorted by totalHours desc.
   */
  static async volunteerServices(volunteerId, { dateFrom, dateTo } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    let to = null;
    if (dateTo) {
      to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
    }

    return prisma.$queryRaw`
      SELECT si.id            AS "serviceItemId",
             si.name          AS "serviceItemName",
             si."category"    AS category,
             d.id             AS "departmentId",
             d.name           AS "departmentName",
             d."displayOrder" AS "deptDisplayOrder",
             COUNT(*)::int    AS count,
             SUM(p.duration)  AS "totalHours",
             MAX(p."serviceDate") AS "lastDate"
      FROM project_supports p
      JOIN service_items si ON si.id = p."serviceItemId"
      JOIN departments d    ON d.id  = si."departmentId"
      WHERE p."volunteerId" = ${volunteerId}
        AND p.status = 'ACTIVE'
        AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
        AND p."serviceDate" <= COALESCE(${to}::timestamp,   p."serviceDate")
      GROUP BY si.id, si.name, si."category", d.id, d.name, d."displayOrder", si."displayOrder"
      ORDER BY "totalHours" DESC NULLS LAST
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
  static async proxyContributions({ dateFrom, dateTo, departmentId } = {}) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const dept = departmentId || null;
    return prisma.$queryRaw`
      SELECT s."volunteerCode",
             s."chineseName",
             COUNT(*)::int AS "proxyCount"
      FROM project_supports p
      JOIN volunteers s ON s.id = p."submittedById"
      JOIN service_items si ON si.id = p."serviceItemId"
      WHERE p.status = 'ACTIVE'
        AND p."volunteerId" != p."submittedById"
        AND p."serviceDate" >= COALESCE(${from}::timestamp, p."serviceDate")
        AND p."serviceDate" <= COALESCE(${to}::timestamp, p."serviceDate")
        AND si."departmentId" = COALESCE(${dept}::text, si."departmentId")
      GROUP BY s."volunteerCode", s."chineseName"
      ORDER BY "proxyCount" DESC
      LIMIT 50
    `;
  }

  /**
   * Recent activity feed for admins — drawn from AuditLog filtered to
   * ProjectSupport actions.
   */
  static async recentActivity({ limit = 50, action, dateFrom, dateTo } = {}) {
    const where = { targetType: 'ProjectSupport' };
    if (action) {
      if (Array.isArray(action)) where.action = { in: action };
      else where.action = action;
    }
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.timestamp.lte = to;
      }
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
