// Characterization of the legacy flow for docs/training-tags-plan.md.
// Tests labelled "legacy limitation" describe gaps to replace during implementation.
// Prisma is mocked: these tests do not establish database rollback/concurrency safety.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: {
  tag: { findUnique: vi.fn() },
  volunteer: { findMany: vi.fn() },
  serviceItem: { findUnique: vi.fn() },
  projectSupport: { create: vi.fn(), findUnique: vi.fn() },
  tagAttachment: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock('../utils/prismaClient.js', () => ({ default: db }));
vi.mock('../utils/IDGenerator.js', () => ({ default: {
  generateSupportId: async (code) => `PS-${code}-001`, generateAuditId: () => 'audit-test',
} }));
import TagService from '../services/TagService.js';

const volunteers = [
  { id: 'v1', volunteerCode: 'PG-0001', chineseName: '张三', englishName: 'Alice' },
  { id: 'v2', volunteerCode: 'PG-0002', chineseName: '李四', englishName: 'Bob' },
];
const operator = { accountId: 'acc-entry', volunteerId: 'entry', role: 'b_admin' };
const input = { names: ['张三', '李四'], serviceItemId: 'training', serviceDate: '2026-04-01', duration: 2 };

beforeEach(() => {
  vi.resetAllMocks();
  db.tag.findUnique.mockResolvedValue({ id: 'tag1', name: '笔译培训', group: { opMode: 'managed', boundServiceItemIds: [] } });
  db.serviceItem.findUnique.mockResolvedValue({ id: 'training', category: 'TRAINING_ATTENDANCE', isActive: true });
  db.volunteer.findMany.mockResolvedValue(volunteers);
  db.tagAttachment.findMany.mockResolvedValue([]);
  db.projectSupport.create.mockImplementation(async ({ data }) => ({ id: `ps-${data.volunteerId}`, supportId: data.supportId }));
  db.$transaction.mockImplementation(async (fn) => fn(db));
});

describe('legacy training/tag baseline', () => {
  it('creates attendance for plain names, ignoring whitespace, empty inputs and repeated names', async () => {
    const result = await TagService.batchCreate('tag1', { ...input, names: [' 张三 ', '', '张三', '李四'] }, operator);
    expect(result.created.map((row) => row.volunteer.id)).toEqual(['v1', 'v2']);
    expect(db.projectSupport.create).toHaveBeenCalledTimes(2);
    expect(db.tagAttachment.create).toHaveBeenCalledTimes(2);
  });

  it('already deduplicates Chinese name, English name and code by volunteer identity', async () => {
    const result = await TagService.batchCreate('tag1', { ...input, names: ['张三', 'alice', 'pg-0001'] }, operator);
    expect(result.created).toHaveLength(1);
    expect(db.projectSupport.create).toHaveBeenCalledTimes(1);
  });

  it('returns ambiguous and unmatched names while saving uniquely matched names', async () => {
    db.volunteer.findMany.mockResolvedValue([...volunteers, { id: 'v3', volunteerCode: 'PG-0003', chineseName: '张三' }]);
    const result = await TagService.batchCreate('tag1', { ...input, names: ['张三', '李四', '不存在'] }, operator);
    expect(result.created.map((row) => row.volunteer.id)).toEqual(['v2']);
    expect(result.unmatched).toEqual(['不存在']);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidates).toHaveLength(2);
  });

  it('appends new people and skips people already attached to this tag', async () => {
    db.tagAttachment.findMany.mockResolvedValue([{ support: { volunteerId: 'v1' } }]);
    const result = await TagService.batchCreate('tag1', input, operator);
    expect(result.created.map((row) => row.volunteer.id)).toEqual(['v2']);
    expect(result.alreadyRecorded.map((row) => row.volunteer.id)).toEqual(['v1']);
  });

  it('rejects more than 500 input entries before deduplication', async () => {
    const result = await TagService.batchCreate('tag1', { ...input, names: Array(501).fill('张三') }, operator);
    expect(result.validationError).toBe('单次最多 500 人');
    expect(db.projectSupport.create).not.toHaveBeenCalled();
  });

  it('limits department-head matching to active volunteers in their department', async () => {
    await TagService.batchCreate('tag1', input, { ...operator, role: 'a_admin', departmentId: 'BY' });
    expect(db.volunteer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', departmentId: 'BY' } }));
  });

  it('legacy limitation: rejects a pure system admin for batch attendance', async () => {
    const result = await TagService.batchCreate('tag1', input, { accountId: 'admin', role: 'admin', volunteerId: null });
    expect(result.forbidden).toBe('操作员必须绑定 volunteer 档案');
    expect(db.projectSupport.create).not.toHaveBeenCalled();
  });

  it('legacy limitation: refuses tags on pending proxy records', async () => {
    db.projectSupport.findUnique.mockResolvedValue({ id: 'pending', volunteerId: 'v1', status: 'PENDING_CONFIRMATION' });
    const result = await TagService.attach('tag1', 'pending', operator);
    expect(result.validationError).toContain('PENDING_CONFIRMATION');
    expect(db.tagAttachment.create).not.toHaveBeenCalled();
  });
});
