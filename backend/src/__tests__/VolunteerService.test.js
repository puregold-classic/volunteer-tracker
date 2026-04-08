// src/__tests__/VolunteerService.test.js — v2.1
//
// Smoke tests for the read/update layer. Heavier business logic lives in
// AccountService (creation) and ProjectSupportService (writes), so these
// are mostly happy-path coverage of the where-builder + simple mutations.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    volunteer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    projectSupport: { aggregate: vi.fn(), groupBy: vi.fn() },
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));

import {
  buildVolunteerWhere,
  findAll,
  findByIdOrCode,
  update,
  getStats,
  getDerivedStats,
} from '../services/VolunteerService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── buildVolunteerWhere (pure function, no mocks needed) ────────────────────

describe('buildVolunteerWhere', () => {
  it('empty params → empty where', () => {
    expect(buildVolunteerWhere({})).toEqual({});
  });

  it('translates 在职 status to PG enum', () => {
    const w = buildVolunteerWhere({ status: '在职' });
    expect(w.status).toBe('ACTIVE');
  });

  it('single region → region: <enum>', () => {
    const w = buildVolunteerWhere({ region: '中国大陆' });
    expect(w.region).toBe('MAINLAND');
  });

  it('multiple regions → region: { in: [...] }', () => {
    const w = buildVolunteerWhere({ region: '中国大陆,中国台湾' });
    expect(w.region).toEqual({ in: ['MAINLAND', 'TAIWAN'] });
  });

  it('search term builds OR clause across name + code + province', () => {
    const w = buildVolunteerWhere({ search: '王' });
    expect(w.OR).toBeDefined();
    expect(w.OR.length).toBeGreaterThanOrEqual(4);
    const fields = w.OR.map((c) => Object.keys(c)[0]);
    expect(fields).toContain('chineseName');
    expect(fields).toContain('volunteerCode');
  });

  it('departmentId single → flat field', () => {
    const w = buildVolunteerWhere({ departmentId: 'TECH' });
    expect(w.departmentId).toBe('TECH');
  });

  it('mixed mainland province + non-mainland region builds AND/OR nested', () => {
    const w = buildVolunteerWhere({ region: '中国大陆,美国', province: '上海市' });
    expect(w.OR).toBeDefined();
    expect(w.OR.length).toBeGreaterThan(1);
  });
});

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('findAll', () => {
  it('returns paginated list with totals', async () => {
    mockPrisma.volunteer.count.mockResolvedValue(2);
    mockPrisma.volunteer.findMany.mockResolvedValue([
      { id: 'v1', volunteerCode: 'PG-0001', chineseName: '王', englishName: 'W', status: 'ACTIVE', region: 'MAINLAND', activityLevel: 'MEDIUM', departmentId: 'TECH', avatar: 'x' },
      { id: 'v2', volunteerCode: 'PG-0002', chineseName: '李', englishName: 'L', status: 'ACTIVE', region: 'MAINLAND', activityLevel: 'MEDIUM', departmentId: 'BY_PROJECT', avatar: 'x' },
    ]);
    const r = await findAll({ page: 1, limit: 10 });
    expect(r.total).toBe(2);
    expect(r.volunteers).toHaveLength(2);
    expect(r.volunteers[0].volunteerCode).toBe('PG-0001');
  });
});

// ─── findByIdOrCode ──────────────────────────────────────────────────────────

describe('findByIdOrCode', () => {
  it('looks up by volunteerCode when input matches PG-XXXX', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue({
      id: 'v1', volunteerCode: 'PG-0001', chineseName: '王', englishName: 'W',
      status: 'ACTIVE', region: 'MAINLAND', activityLevel: 'MEDIUM', avatar: 'x', departmentId: 'TECH',
    });
    await findByIdOrCode('PG-0001');
    const args = mockPrisma.volunteer.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ volunteerCode: 'PG-0001' });
  });

  it('looks up by id (cuid) when input does not match PG pattern', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue(null);
    await findByIdOrCode('cmnqo0cv20031pe5f5jqzobve');
    const args = mockPrisma.volunteer.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'cmnqo0cv20031pe5f5jqzobve' });
  });

  it('returns null for empty input', async () => {
    expect(await findByIdOrCode('')).toBeNull();
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('update', () => {
  it('returns null when target missing', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue(null);
    expect(await update('PG-9999', { chineseName: 'X' })).toBeNull();
  });

  it('happy path: maps Chinese inputs to PG enums', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue({ id: 'v1' });
    mockPrisma.volunteer.update.mockResolvedValue({
      id: 'v1', volunteerCode: 'PG-0001', chineseName: '王新',
      status: 'INACTIVE', region: 'TAIWAN', activityLevel: 'HIGH', avatar: 'x', departmentId: 'TECH',
    });
    const r = await update('PG-0001', { chineseName: '王新', status: '不在职', region: '中国台湾', activityLevel: '高' });
    expect(r).toBeDefined();
    const args = mockPrisma.volunteer.update.mock.calls[0][0];
    expect(args.data.status).toBe('INACTIVE');
    expect(args.data.region).toBe('TAIWAN');
    expect(args.data.activityLevel).toBe('HIGH');
  });
});

// ─── getStats ────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns aggregated stats', async () => {
    mockPrisma.volunteer.aggregate.mockResolvedValue({ _count: { id: 4 } });
    mockPrisma.volunteer.groupBy
      .mockResolvedValueOnce([{ region: 'MAINLAND', _count: { id: 3 } }])
      .mockResolvedValueOnce([{ departmentId: 'TECH', _count: { id: 1 } }]);
    mockPrisma.volunteer.count
      .mockResolvedValueOnce(4) // active
      .mockResolvedValueOnce(0); // inactive
    mockPrisma.projectSupport.aggregate.mockResolvedValue({
      _sum: { duration: 3.5 },
      _avg: { duration: 1.75 },
    });

    const r = await getStats({});
    expect(r.summary.totalVolunteers).toBe(4);
    expect(r.summary.totalHours).toBe(3.5);
    expect(r.summary.totalActive).toBe(4);
    expect(r.regionDistribution).toHaveLength(1);
    expect(r.departmentDistribution).toHaveLength(1);
  });
});

// ─── getDerivedStats ─────────────────────────────────────────────────────────

describe('getDerivedStats', () => {
  it('aggregates from project_supports + computes activityLevel', async () => {
    mockPrisma.projectSupport.aggregate.mockResolvedValue({
      _count: { id: 2 },
      _sum: { duration: 50 },
    });
    mockPrisma.projectSupport.groupBy.mockResolvedValue([
      { serviceItemId: 'svc-1', _count: { id: 1 }, _sum: { duration: 30 } },
      { serviceItemId: 'svc-2', _count: { id: 1 }, _sum: { duration: 20 } },
    ]);

    const r = await getDerivedStats('vol-1');
    expect(r.totalHours).toBe(50);
    expect(r.totalCount).toBe(2);
    expect(r.activityLevel).toBe('MEDIUM'); // 30 ≤ 50 < 100
    expect(r.byItem).toHaveLength(2);
  });

  it('returns LOW for very few hours', async () => {
    mockPrisma.projectSupport.aggregate.mockResolvedValue({ _count: { id: 1 }, _sum: { duration: 5 } });
    mockPrisma.projectSupport.groupBy.mockResolvedValue([]);
    const r = await getDerivedStats('vol-1');
    expect(r.activityLevel).toBe('LOW');
  });

  it('returns HIGH for ≥ 100 hours', async () => {
    mockPrisma.projectSupport.aggregate.mockResolvedValue({ _count: { id: 5 }, _sum: { duration: 120 } });
    mockPrisma.projectSupport.groupBy.mockResolvedValue([]);
    const r = await getDerivedStats('vol-1');
    expect(r.activityLevel).toBe('HIGH');
  });
});
