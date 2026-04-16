// src/services/VolunteerService.js — v2.1
//
// Volunteer is the "person" model. The Account model handles login identity
// and is bound 1:1 via FK (Account.volunteerId → Volunteer.id).
//
// Removed in v2.1:
// - services ServiceType[] (replaced by Department + ServiceItem)
// - role (truth source moved to Account.role)
// - nonProjectHours / nonProjectCount (derived via aggregation)
// - volunteerId field (renamed to volunteerCode to avoid FK ambiguity)

import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';
import {
  serializeVolunteer,
  VOLUNTEER_STATUS_TO_PG,
  REGION_TO_PG,
} from '../utils/serializer.js';

const parseMulti = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : value;
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
};

export const buildVolunteerWhere = (queryParams = {}) => {
  const { status, region, province, departmentId, search } = queryParams;
  const where = {};

  if (status) {
    const pgStatus = VOLUNTEER_STATUS_TO_PG[status];
    if (pgStatus) where.status = pgStatus;
  }

  const pgRegions = region ? parseMulti(region).map((r) => REGION_TO_PG[r]).filter(Boolean) : [];
  const provinces = province ? parseMulti(province) : [];

  if (pgRegions.length > 0 && provinces.length > 0) {
    const MAINLAND = REGION_TO_PG['中国大陆'];
    const nonMainlandRegions = pgRegions.filter((r) => r !== MAINLAND);
    const orConditions = [];

    orConditions.push({
      region: MAINLAND,
      ...(provinces.length === 1 ? { province: provinces[0] } : { province: { in: provinces } }),
    });

    if (pgRegions.includes(MAINLAND)) {
      orConditions.push({ region: MAINLAND });
    }
    for (const r of nonMainlandRegions) {
      orConditions.push({ region: r });
    }
    where.OR = orConditions;
  } else if (pgRegions.length > 0) {
    if (pgRegions.length === 1) where.region = pgRegions[0];
    else where.region = { in: pgRegions };
  } else if (provinces.length > 0) {
    if (provinces.length === 1) where.province = provinces[0];
    else where.province = { in: provinces };
  }

  if (departmentId) {
    const ids = parseMulti(departmentId);
    if (ids.length === 1) where.departmentId = ids[0];
    else if (ids.length > 1) where.departmentId = { in: ids };
  }

  if (search) {
    const searchOr = [
      { chineseName: { contains: search, mode: 'insensitive' } },
      { englishName: { contains: search, mode: 'insensitive' } },
      { volunteerCode: { contains: search, mode: 'insensitive' } },
      { province: { contains: search, mode: 'insensitive' } },
      { subRegion: { contains: search, mode: 'insensitive' } },
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  return where;
};

export const findAll = async ({
  status, region, province, departmentId, search,
  page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
} = {}) => {
  const where = buildVolunteerWhere({ status, region, province, departmentId, search });
  const pagination = QueryUtils.buildPaginationOptions(page, limit);

  const [total, volunteers] = await Promise.all([
    prisma.volunteer.count({ where }),
    prisma.volunteer.findMany({
      where,
      include: { department: true },
      orderBy: { [sortBy]: order },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { total, volunteers: volunteers.map(serializeVolunteer), pagination };
};

/**
 * Lookup by either cuid (id) or volunteerCode (PG-XXXX).
 * Auto-detects by format.
 */
export const findByIdOrCode = async (idOrCode) => {
  if (!idOrCode) return null;
  const where = /^PG-\d{4}$/.test(idOrCode)
    ? { volunteerCode: idOrCode }
    : { id: idOrCode };
  const volunteer = await prisma.volunteer.findFirst({
    where,
    include: { department: true, account: true },
  });
  return volunteer ? serializeVolunteer(volunteer) : null;
};

/**
 * Get a volunteer's aggregate stats: total hours, count, by month, etc.
 * Replaces the v1 denormalized nonProjectHours / nonProjectCount fields.
 */
export const getDerivedStats = async (volunteerId) => {
  const where = { volunteerId, status: 'ACTIVE' };
  const [totals, byItem] = await Promise.all([
    prisma.projectSupport.aggregate({
      where,
      _count: { id: true },
      _sum: { duration: true },
    }),
    prisma.projectSupport.groupBy({
      by: ['serviceItemId'],
      where,
      _count: { id: true },
      _sum: { duration: true },
    }),
  ]);

  const totalHours = totals._sum.duration ?? 0;
  const totalCount = totals._count.id ?? 0;
  const activityLevel = totalHours >= 100 ? 'HIGH' : totalHours >= 30 ? 'MEDIUM' : 'LOW';

  return {
    totalHours,
    totalCount,
    activityLevel,
    byItem,
  };
};

/**
 * Update mutable volunteer fields. Does NOT touch role (lives on Account)
 * or services (replaced by department). Department change triggers an audit.
 */
export const update = async (idOrCode, body) => {
  const target = await prisma.volunteer.findFirst({
    where: /^PG-\d{4}$/.test(idOrCode) ? { volunteerCode: idOrCode } : { id: idOrCode },
  });
  if (!target) return null;

  const data = {};
  if (body.chineseName !== undefined) data.chineseName = body.chineseName;
  if (body.englishName !== undefined) data.englishName = body.englishName;
  if (body.avatar !== undefined) data.avatar = body.avatar;
  if (body.status !== undefined) data.status = VOLUNTEER_STATUS_TO_PG[body.status] ?? body.status;
  if (body.region !== undefined) data.region = REGION_TO_PG[body.region] ?? body.region;
  if (body.province !== undefined) data.province = body.province;
  if (body.subRegion !== undefined) data.subRegion = body.subRegion;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId;
  if (body.activityLevel !== undefined) {
    data.activityLevel = body.activityLevel === '高' ? 'HIGH' : body.activityLevel === '低' ? 'LOW' : 'MEDIUM';
  }
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;

  const updated = await prisma.volunteer.update({
    where: { id: target.id },
    data,
    include: { department: true },
  });
  return serializeVolunteer(updated);
};

/**
 * Province-level headcount for the homepage heatmap. Counts ACTIVE volunteers
 * only, globally (no filter applied) — the heatmap is meant to show 全球分布,
 * not a filtered subset. NULL provinces are excluded.
 */
export const getProvinceCounts = async () => {
  const rows = await prisma.volunteer.groupBy({
    by: ['province'],
    where: { status: 'ACTIVE', province: { not: null } },
    _count: { id: true },
  });
  return rows.map((r) => ({ province: r.province, count: r._count.id }));
};

export const getStats = async (queryParams = {}) => {
  const where = buildVolunteerWhere(queryParams);

  const [summary, regionStats, departmentStats, activeCount, inactiveCount] = await Promise.all([
    prisma.volunteer.aggregate({ where, _count: { id: true } }),
    prisma.volunteer.groupBy({
      by: ['region'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.volunteer.groupBy({
      by: ['departmentId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.volunteer.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.volunteer.count({ where: { ...where, status: 'INACTIVE' } }),
  ]);

  // Hours come from ProjectSupport aggregation, joined back to volunteers
  const hoursAgg = await prisma.projectSupport.aggregate({
    where: { status: 'ACTIVE', volunteer: { ...where } },
    _sum: { duration: true },
    _avg: { duration: true },
  });

  return {
    summary: {
      totalVolunteers: summary._count.id ?? 0,
      totalHours: hoursAgg._sum.duration ?? 0,
      totalActive: activeCount,
      totalInactive: inactiveCount,
      avgHours: hoursAgg._avg.duration ? Math.round(hoursAgg._avg.duration * 100) / 100 : 0,
    },
    regionDistribution: regionStats.map((r) => ({
      region: r.region,
      count: r._count.id,
    })),
    departmentDistribution: departmentStats.map((d) => ({
      departmentId: d.departmentId,
      count: d._count.id,
    })),
  };
};
