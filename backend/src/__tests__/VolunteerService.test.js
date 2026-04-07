import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildVolunteerWhere,
  findAll,
  findById,
  create,
  update,
  remove,
  getStats,
} from '../services/VolunteerService.js';

vi.mock('../utils/prismaClient.js', () => ({
  default: {
    volunteer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  getPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

import prisma from '../utils/prismaClient.js';

/** Build a fake Prisma volunteer row (enum member names, not display strings). */
const makeRow = (overrides = {}) => ({
  id: 'cuid1',
  volunteerId: 'PG-0001',
  chineseName: '张三',
  englishName: 'Zhang San',
  avatar: null,
  status: 'ACTIVE',
  region: 'MAINLAND',
  province: '北京',
  subRegion: null,
  services: ['TRANSLATION'],
  nonProjectHours: 10,
  nonProjectCount: 2,
  activityLevel: 'MEDIUM',
  email: 'zs@test.com',
  phone: null,
  role: 'user',
  joinDate: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ─── buildVolunteerWhere (pure — no Prisma) ───────────────────────────────────

describe('buildVolunteerWhere', () => {
  it('returns empty object when called with no args', () => {
    expect(buildVolunteerWhere()).toEqual({});
  });

  it('maps Chinese status to Prisma enum', () => {
    expect(buildVolunteerWhere({ status: '在职' })).toMatchObject({ status: 'ACTIVE' });
    expect(buildVolunteerWhere({ status: '不在职' })).toMatchObject({ status: 'INACTIVE' });
  });

  it('ignores unknown status value', () => {
    expect(buildVolunteerWhere({ status: '未知' })).toEqual({});
  });

  it('maps single region to scalar value', () => {
    expect(buildVolunteerWhere({ region: '中国大陆' })).toMatchObject({ region: 'MAINLAND' });
    expect(buildVolunteerWhere({ region: '美国' })).toMatchObject({ region: 'USA' });
  });

  it('maps multiple regions to { in: [...] }', () => {
    const { region } = buildVolunteerWhere({ region: '中国大陆,美国' });
    expect(region).toEqual({ in: ['MAINLAND', 'USA'] });
  });

  it('maps single province to scalar value', () => {
    expect(buildVolunteerWhere({ province: '北京' })).toMatchObject({ province: '北京' });
  });

  it('maps multiple provinces to { in: [...] }', () => {
    const { province } = buildVolunteerWhere({ province: '北京,上海' });
    expect(province).toEqual({ in: ['北京', '上海'] });
  });

  it('maps service types to hasSome filter', () => {
    const { services } = buildVolunteerWhere({ services: '翻译,校对' });
    expect(services).toEqual({ hasSome: ['TRANSLATION', 'PROOFREADING'] });
  });

  it('ignores unknown service types', () => {
    expect(buildVolunteerWhere({ services: '未知服务' })).toEqual({});
  });

  it('builds OR search across 5 fields', () => {
    const { OR } = buildVolunteerWhere({ search: 'test' });
    expect(OR).toHaveLength(5);
    expect(OR[0]).toMatchObject({ chineseName: { contains: 'test', mode: 'insensitive' } });
    expect(OR[2]).toMatchObject({ volunteerId: { contains: 'test', mode: 'insensitive' } });
  });

  it('combines multiple filters', () => {
    const where = buildVolunteerWhere({ status: '在职', region: '中国大陆', search: 'abc' });
    expect(where.status).toBe('ACTIVE');
    expect(where.region).toBe('MAINLAND');
    expect(where.OR).toBeDefined();
  });
});

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('findAll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated serialized volunteers', async () => {
    prisma.volunteer.count.mockResolvedValue(1);
    prisma.volunteer.findMany.mockResolvedValue([makeRow()]);

    const result = await findAll({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.volunteers).toHaveLength(1);
    expect(result.volunteers[0].id).toBe('PG-0001');
    expect(result.volunteers[0].status).toBe('在职');
    expect(result.volunteers[0].region).toBe('中国大陆');
    expect(result.pagination).toBeDefined();
  });

  it('returns empty list when no volunteers match', async () => {
    prisma.volunteer.count.mockResolvedValue(0);
    prisma.volunteer.findMany.mockResolvedValue([]);

    const result = await findAll({ status: '在职' });
    expect(result.total).toBe(0);
    expect(result.volunteers).toEqual([]);
  });
});

// ─── findById ────────────────────────────────────────────────────────────────

describe('findById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns serialized volunteer when found', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(makeRow());

    const result = await findById('PG-0001');

    expect(result).not.toBeNull();
    expect(result.id).toBe('PG-0001');
    expect(result.status).toBe('在职');
    expect(result.region).toBe('中国大陆');
    expect(result.services).toEqual(['翻译']);
  });

  it('returns null when volunteer does not exist', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(null);

    const result = await findById('PG-XXXX');
    expect(result).toBeNull();
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns conflict when volunteerId already exists', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(makeRow());

    const result = await create({ id: 'PG-0001' });

    expect(result).toEqual({ conflict: true, id: 'PG-0001' });
    expect(prisma.volunteer.create).not.toHaveBeenCalled();
  });

  it('creates and returns serialized volunteer when id is new', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(null);
    prisma.volunteer.create.mockResolvedValue(makeRow());

    const result = await create({
      id: 'PG-0001',
      chineseName: '张三',
      englishName: 'Zhang San',
      status: '在职',
      region: '中国大陆',
      services: ['翻译'],
    });

    expect(result.conflict).toBeUndefined();
    expect(result.volunteer).toBeDefined();
    expect(result.volunteer.id).toBe('PG-0001');
    expect(prisma.volunteer.create).toHaveBeenCalledOnce();
  });

  it('passes correct enum values to Prisma', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(null);
    prisma.volunteer.create.mockResolvedValue(makeRow());

    await create({ id: 'PG-0002', status: '在职', region: '美国', services: ['翻译', '校对'], activityLevel: '高' });

    const callData = prisma.volunteer.create.mock.calls[0][0].data;
    expect(callData.status).toBe('ACTIVE');
    expect(callData.region).toBe('USA');
    expect(callData.services).toContain('TRANSLATION');
    expect(callData.services).toContain('PROOFREADING');
    expect(callData.activityLevel).toBe('HIGH');
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when volunteer does not exist', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(null);

    const result = await update('PG-XXXX', { chineseName: '新名' });
    expect(result).toBeNull();
    expect(prisma.volunteer.update).not.toHaveBeenCalled();
  });

  it('updates and returns serialized volunteer', async () => {
    const updated = makeRow({ chineseName: '李四' });
    prisma.volunteer.findFirst.mockResolvedValue(makeRow());
    prisma.volunteer.update.mockResolvedValue(updated);

    const result = await update('PG-0001', { chineseName: '李四' });
    expect(result.chineseName).toBe('李四');
    expect(prisma.volunteer.update).toHaveBeenCalledOnce();
  });

  it('only includes provided fields in update data', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(makeRow());
    prisma.volunteer.update.mockResolvedValue(makeRow());

    await update('PG-0001', { chineseName: '李四' });

    const updateData = prisma.volunteer.update.mock.calls[0][0].data;
    expect(updateData.chineseName).toBe('李四');
    expect(updateData.englishName).toBeUndefined();
  });
});

// ─── findAll (with filters) ───────────────────────────────────────────────────

describe('findAll with filters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes built where clause to Prisma', async () => {
    prisma.volunteer.count.mockResolvedValue(0);
    prisma.volunteer.findMany.mockResolvedValue([]);

    await findAll({ status: '在职', region: '中国大陆' });

    const countWhere = prisma.volunteer.count.mock.calls[0][0].where;
    expect(countWhere.status).toBe('ACTIVE');
    expect(countWhere.region).toBe('MAINLAND');
  });
});

// ─── getStats ─────────────────────────────────────────────────────────────────

describe('getStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns summary, regionDistribution, and serviceDistribution', async () => {

    prisma.volunteer.aggregate.mockResolvedValue({
      _count: { id: 5 },
      _sum: { nonProjectHours: 100 },
      _avg: { nonProjectHours: 20 },
    });
    prisma.volunteer.groupBy.mockResolvedValue([
      { region: 'MAINLAND', _count: { id: 3 }, _sum: { nonProjectHours: 60 } },
    ]);
    prisma.volunteer.findMany.mockResolvedValue([
      { services: ['TRANSLATION', 'PROOFREADING'] },
      { services: ['TRANSLATION'] },
    ]);
    prisma.volunteer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

    const result = await getStats({});

    expect(result.summary.totalVolunteers).toBe(5);
    expect(result.summary.totalHours).toBe(100);
    expect(result.summary.totalActive).toBe(3);
    expect(result.summary.totalInactive).toBe(2);
    expect(result.regionDistribution).toHaveLength(1);
    expect(result.regionDistribution[0].region).toBe('MAINLAND');
    expect(result.serviceDistribution.find(s => s.service === 'TRANSLATION').count).toBe(2);
    expect(result.serviceDistribution.find(s => s.service === 'PROOFREADING').count).toBe(1);
  });

  it('handles empty data gracefully', async () => {

    prisma.volunteer.aggregate.mockResolvedValue({ _count: { id: 0 }, _sum: { nonProjectHours: null }, _avg: { nonProjectHours: null } });
    prisma.volunteer.groupBy.mockResolvedValue([]);
    prisma.volunteer.findMany.mockResolvedValue([]);
    prisma.volunteer.count.mockResolvedValue(0);

    const result = await getStats({});

    expect(result.summary.totalVolunteers).toBe(0);
    expect(result.summary.totalHours).toBe(0);
    expect(result.summary.avgHours).toBe(0);
    expect(result.regionDistribution).toEqual([]);
    expect(result.serviceDistribution).toEqual([]);
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('remove', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when volunteer does not exist', async () => {
    prisma.volunteer.findFirst.mockResolvedValue(null);

    const result = await remove('PG-XXXX');
    expect(result).toBeNull();
    expect(prisma.volunteer.delete).not.toHaveBeenCalled();
  });

  it('deletes volunteer and returns serialized row', async () => {
    const row = makeRow();
    prisma.volunteer.findFirst.mockResolvedValue(row);
    prisma.volunteer.delete.mockResolvedValue(row);

    const result = await remove('PG-0001');
    expect(result.id).toBe('PG-0001');
    expect(prisma.volunteer.delete).toHaveBeenCalledWith({ where: { id: 'cuid1' } });
  });
});
