// src/controllers/volunteerController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// Enum values (status, region, activityLevel, services) are translated
// via pgSerializer both for query inputs and API responses.

import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';
import {
  serializeVolunteer,
  VOLUNTEER_STATUS_TO_PG,
  REGION_TO_PG,
  SERVICE_TYPE_TO_PG,
} from '../utils/pgSerializer.js';

// Build a Prisma `where` clause from API query parameters (Chinese string values).
const buildVolunteerWhere = (queryParams = {}) => {
  const { status, region, province, services, search } = queryParams;
  const where = {};

  const parseMulti = (value) => {
    const raw = Array.isArray(value) ? value.join(',') : value;
    return String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  };

  if (status) {
    const pgStatus = VOLUNTEER_STATUS_TO_PG[status];
    if (pgStatus) where.status = pgStatus;
  }

  if (region) {
    const regions = parseMulti(region);
    const pgRegions = regions.map(r => REGION_TO_PG[r]).filter(Boolean);
    if (pgRegions.length === 1) where.region = pgRegions[0];
    else if (pgRegions.length > 1) where.region = { in: pgRegions };
  }

  if (province) {
    const provinces = parseMulti(province);
    if (provinces.length === 1) where.province = provinces[0];
    else if (provinces.length > 1) where.province = { in: provinces };
  }

  if (services) {
    const svcValues = parseMulti(services);
    const pgSvcs = svcValues.map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean);
    if (pgSvcs.length > 0) where.services = { hasSome: pgSvcs };
  }

  if (search) {
    where.OR = [
      { chineseName: { contains: search, mode: 'insensitive' } },
      { englishName: { contains: search, mode: 'insensitive' } },
      { volunteerId: { contains: search, mode: 'insensitive' } },
      { province: { contains: search, mode: 'insensitive' } },
      { subRegion: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

// 获取所有志愿者
export const getAllVolunteers = async (req, res) => {
  try {
    const {
      status, region, province, services, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

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

    res.status(200).json({
      success: true,
      count: volunteers.length,
      total,
      totalPages: Math.ceil(total / pagination.limit),
      currentPage: pagination.page,
      data: volunteers.map(serializeVolunteer),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取志愿者列表失败', error: error.message });
  }
};

// 获取单个志愿者
export const getVolunteerById = async (req, res) => {
  try {
    const volunteer = await prisma.volunteer.findFirst({
      where: { volunteerId: req.params.id },
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }

    res.status(200).json({ success: true, data: serializeVolunteer(volunteer) });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取志愿者信息失败', error: error.message });
  }
};

// 创建志愿者
export const createVolunteer = async (req, res) => {
  try {
    const existing = await prisma.volunteer.findFirst({
      where: { volunteerId: req.body.id },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `志愿者ID ${req.body.id} 已存在` });
    }

    // Translate enum fields from Chinese to PG member names
    const data = {
      volunteerId: req.body.id,
      chineseName: req.body.chineseName,
      englishName: req.body.englishName,
      avatar: req.body.avatar,
      status: VOLUNTEER_STATUS_TO_PG[req.body.status] || 'ACTIVE',
      region: REGION_TO_PG[req.body.region],
      province: req.body.province,
      subRegion: req.body.subRegion,
      services: (req.body.services || []).map(s => SERVICE_TYPE_TO_PG[s]).filter(Boolean),
      nonProjectHours: req.body.nonProjectHours || 0,
      nonProjectCount: req.body.nonProjectCount || 0,
      activityLevel: req.body.activityLevel === '高' ? 'HIGH'
        : req.body.activityLevel === '低' ? 'LOW' : 'MEDIUM',
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role || 'user',
      joinDate: req.body.joinDate ? new Date(req.body.joinDate) : undefined,
    };

    const volunteer = await prisma.volunteer.create({ data });
    res.status(201).json({ success: true, message: '志愿者创建成功', data: serializeVolunteer(volunteer) });
  } catch (error) {
    res.status(400).json({ success: false, message: '创建志愿者失败', error: error.message });
  }
};

// 更新志愿者
export const updateVolunteer = async (req, res) => {
  try {
    const volunteer = await prisma.volunteer.findFirst({
      where: { volunteerId: req.params.id },
    });
    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }

    // Build update data, only including fields that were provided
    const body = req.body;
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
      data.activityLevel = body.activityLevel === '高' ? 'HIGH'
        : body.activityLevel === '低' ? 'LOW' : 'MEDIUM';
    }
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.role !== undefined) data.role = body.role;

    const updated = await prisma.volunteer.update({
      where: { id: volunteer.id },
      data,
    });

    res.status(200).json({ success: true, message: '志愿者更新成功', data: serializeVolunteer(updated) });
  } catch (error) {
    res.status(400).json({ success: false, message: '更新志愿者失败', error: error.message });
  }
};

// 删除志愿者
export const deleteVolunteer = async (req, res) => {
  try {
    const volunteer = await prisma.volunteer.findFirst({
      where: { volunteerId: req.params.id },
    });
    if (!volunteer) {
      return res.status(404).json({ success: false, message: `未找到ID为 ${req.params.id} 的志愿者` });
    }

    await prisma.volunteer.delete({ where: { id: volunteer.id } });

    res.status(200).json({ success: true, message: '志愿者删除成功', data: serializeVolunteer(volunteer) });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除志愿者失败', error: error.message });
  }
};

// 获取统计信息
export const getVolunteerStats = async (req, res) => {
  try {
    const where = buildVolunteerWhere(req.query);

    const [summary, regionStats, serviceRows] = await Promise.all([
      // Summary aggregation
      prisma.volunteer.aggregate({
        where,
        _count: { id: true },
        _sum: { nonProjectHours: true },
        _avg: { nonProjectHours: true },
      }),
      // Group by region
      prisma.volunteer.groupBy({
        by: ['region'],
        where,
        _count: { id: true },
        _sum: { nonProjectHours: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Services distribution
      prisma.volunteer.findMany({
        where,
        select: { services: true },
      }),
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

    // Count active/inactive
    const [activeCount, inactiveCount] = await Promise.all([
      prisma.volunteer.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.volunteer.count({ where: { ...where, status: 'INACTIVE' } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalVolunteers: summary._count.id ?? 0,
          totalHours: summary._sum.nonProjectHours ?? 0,
          totalActive: activeCount,
          totalInactive: inactiveCount,
          avgHours: summary._avg.nonProjectHours
            ? Math.round(summary._avg.nonProjectHours * 100) / 100
            : 0,
        },
        regionDistribution: regionStats.map(r => ({
          region: r.region,
          count: r._count.id,
          totalHours: r._sum.nonProjectHours ?? 0,
        })),
        serviceDistribution: (serviceStats || []).map(s => ({
          service: s.service,
          count: s.count,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计信息失败', error: error.message });
  }
};
