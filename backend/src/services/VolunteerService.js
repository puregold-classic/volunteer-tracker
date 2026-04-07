import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';
import {
  serializeVolunteer,
  VOLUNTEER_STATUS_TO_PG,
  REGION_TO_PG,
  SERVICE_TYPE_TO_PG,
} from '../utils/serializer.js';

const parseMulti = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : value;
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
};

export const buildVolunteerWhere = (queryParams = {}) => {
  const { status, region, province, services, search } = queryParams;
  const where = {};

  if (status) {
    const pgStatus = VOLUNTEER_STATUS_TO_PG[status];
    if (pgStatus) where.status = pgStatus;
  }

  const pgRegions = region ? parseMulti(region).map(r => REGION_TO_PG[r]).filter(Boolean) : [];
  const provinces = province ? parseMulti(province) : [];

  if (pgRegions.length > 0 && provinces.length > 0) {
    // Mixed mainland provinces + non-mainland regions: need OR conditions
    const MAINLAND = REGION_TO_PG['中国大陆'];
    const nonMainlandRegions = pgRegions.filter(r => r !== MAINLAND);
    const orConditions = [];

    // Mainland volunteers matching specific provinces
    orConditions.push({
      region: MAINLAND,
      ...(provinces.length === 1 ? { province: provinces[0] } : { province: { in: provinces } }),
    });

    // If 中国大陆 explicitly selected (all mainland), also include all mainland
    if (pgRegions.includes(MAINLAND)) {
      orConditions.push({ region: MAINLAND });
    }

    // Non-mainland regions
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

  if (services) {
    const svcValues = parseMulti(services);
    const pgSvcs = svcValues.map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean);
    if (pgSvcs.length > 0) where.services = { hasSome: pgSvcs };
  }

  if (search) {
    const searchOr = [
      { chineseName: { contains: search, mode: 'insensitive' } },
      { englishName: { contains: search, mode: 'insensitive' } },
      { volunteerId: { contains: search, mode: 'insensitive' } },
      { province: { contains: search, mode: 'insensitive' } },
      { subRegion: { contains: search, mode: 'insensitive' } },
    ];
    // If location OR conditions already exist, wrap both with AND
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchOr }];
      delete where.OR;
    } else {
      where.OR = searchOr;
    }
  }

  return where;
};

export const findAll = async ({ status, region, province, services, search, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = {}) => {
  const where = buildVolunteerWhere({ status, region, province, services, search });
  const pagination = QueryUtils.buildPaginationOptions(page, limit);

  const [total, volunteers] = await Promise.all([
    prisma.volunteer.count({ where }),
    prisma.volunteer.findMany({
      where,
      orderBy: { [sortBy]: order },
      skip: pagination.skip,
      take: pagination.limit,
    }),
  ]);

  return { total, volunteers: volunteers.map(serializeVolunteer), pagination };
};

export const findById = async (volunteerId) => {
  const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId } });
  return volunteer ? serializeVolunteer(volunteer) : null;
};

export const create = async (body) => {
  const existing = await prisma.volunteer.findFirst({ where: { volunteerId: body.id } });
  if (existing) return { conflict: true, id: body.id };

  const data = {
    volunteerId: body.id,
    chineseName: body.chineseName,
    englishName: body.englishName,
    avatar: body.avatar,
    status: VOLUNTEER_STATUS_TO_PG[body.status] || 'ACTIVE',
    region: REGION_TO_PG[body.region],
    province: body.province,
    subRegion: body.subRegion,
    services: (body.services || []).map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean),
    nonProjectHours: body.nonProjectHours || 0,
    nonProjectCount: body.nonProjectCount || 0,
    activityLevel: body.activityLevel === '高' ? 'HIGH' : body.activityLevel === '低' ? 'LOW' : 'MEDIUM',
    email: body.email,
    phone: body.phone,
    role: body.role || 'user',
    joinDate: body.joinDate ? new Date(body.joinDate) : undefined,
  };

  const volunteer = await prisma.volunteer.create({ data });
  return { volunteer: serializeVolunteer(volunteer) };
};

export const update = async (volunteerId, body) => {
  const existing = await prisma.volunteer.findFirst({ where: { volunteerId } });
  if (!existing) return null;

  const data = {};
  if (body.chineseName !== undefined) data.chineseName = body.chineseName;
  if (body.englishName !== undefined) data.englishName = body.englishName;
  if (body.avatar !== undefined) data.avatar = body.avatar;
  if (body.status !== undefined) data.status = VOLUNTEER_STATUS_TO_PG[body.status] ?? body.status;
  if (body.region !== undefined) data.region = REGION_TO_PG[body.region] ?? body.region;
  if (body.province !== undefined) data.province = body.province;
  if (body.subRegion !== undefined) data.subRegion = body.subRegion;
  if (body.services !== undefined) data.services = (body.services || []).map(s => SERVICE_TYPE_TO_PG[s] ?? s).filter(Boolean);
  if (body.nonProjectHours !== undefined) data.nonProjectHours = body.nonProjectHours;
  if (body.nonProjectCount !== undefined) data.nonProjectCount = body.nonProjectCount;
  if (body.activityLevel !== undefined) {
    data.activityLevel = body.activityLevel === '高' ? 'HIGH' : body.activityLevel === '低' ? 'LOW' : 'MEDIUM';
  }
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.role !== undefined) data.role = body.role;

  const updated = await prisma.volunteer.update({ where: { id: existing.id }, data });
  return serializeVolunteer(updated);
};

export const remove = async (volunteerId) => {
  const existing = await prisma.volunteer.findFirst({ where: { volunteerId } });
  if (!existing) return null;
  await prisma.volunteer.delete({ where: { id: existing.id } });
  return serializeVolunteer(existing);
};

export const getStats = async (queryParams = {}) => {
  const where = buildVolunteerWhere(queryParams);

  const [summary, regionStats, serviceRows, activeCount, inactiveCount] = await Promise.all([
    prisma.volunteer.aggregate({
      where,
      _count: { id: true },
      _sum: { nonProjectHours: true },
      _avg: { nonProjectHours: true },
    }),
    prisma.volunteer.groupBy({
      by: ['region'],
      where,
      _count: { id: true },
      _sum: { nonProjectHours: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.volunteer.findMany({ where, select: { services: true } }),
    prisma.volunteer.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.volunteer.count({ where: { ...where, status: 'INACTIVE' } }),
  ]);

  const serviceCounter = new Map();
  for (const row of serviceRows) {
    for (const service of row.services || []) {
      serviceCounter.set(service, (serviceCounter.get(service) || 0) + 1);
    }
  }
  const serviceStats = Array.from(serviceCounter.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalVolunteers: summary._count.id ?? 0,
      totalHours: summary._sum.nonProjectHours ?? 0,
      totalActive: activeCount,
      totalInactive: inactiveCount,
      avgHours: summary._avg.nonProjectHours ? Math.round(summary._avg.nonProjectHours * 100) / 100 : 0,
    },
    regionDistribution: regionStats.map(r => ({
      region: r.region,
      count: r._count.id,
      totalHours: r._sum.nonProjectHours ?? 0,
    })),
    serviceDistribution: serviceStats.map(s => ({ service: s.service, count: s.count })),
  };
};
