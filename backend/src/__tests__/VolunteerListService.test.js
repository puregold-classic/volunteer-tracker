// src/__tests__/VolunteerListService.test.js — v3.4 multi-list
//
// 单元测试 list CRUD + member CRUD + 跨 owner 隔离 + 默认 list 守护.
// Prisma + IDGenerator 全 mock.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockIDGen } = vi.hoisted(() => {
  const prisma = {
    volunteerList: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    volunteerListMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    volunteer: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fnOrArr) => {
    if (typeof fnOrArr === 'function') return fnOrArr(prisma);
    return Promise.all(fnOrArr);
  });
  return {
    mockPrisma: prisma,
    mockIDGen: { generateAuditId: vi.fn(() => 'AUD-test') },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/IDGenerator.js', () => ({ default: mockIDGen }));

import VolunteerListService from '../services/VolunteerListService.js';

const OWNER = 'owner-vol-1';
const OTHER_OWNER = 'owner-vol-2';
const OPERATOR = { accountId: 'acc-1', volunteerId: OWNER, name: '测试 admin', role: 'a_admin' };
const TARGET_VOL = { id: 'vol-target', volunteerCode: 'PG-0010', chineseName: '小明' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createList ────────────────────────────────────────────────────────────

describe('createList', () => {
  it('rejects when ownerId missing (pure admin without volunteer)', async () => {
    const r = await VolunteerListService.createList(null, '我的小组', OPERATOR);
    expect(r.forbidden).toBeDefined();
  });

  it('rejects empty name', async () => {
    const r = await VolunteerListService.createList(OWNER, '   ', OPERATOR);
    expect(r.validationError).toBeDefined();
  });

  it('rejects too-long name (33 chars)', async () => {
    const r = await VolunteerListService.createList(OWNER, 'x'.repeat(33), OPERATOR);
    expect(r.validationError).toBeDefined();
  });

  it('rejects duplicate name within owner', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({ id: 'existing', name: '我的小组' });
    const r = await VolunteerListService.createList(OWNER, '我的小组', OPERATOR);
    expect(r.validationError).toMatch(/已存在/);
  });

  it('creates list with isDefault=false', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce(null);
    mockPrisma.volunteerList.create.mockResolvedValueOnce({
      id: 'l-new', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    const r = await VolunteerListService.createList(OWNER, '我的小组', OPERATOR);
    expect(r.list.id).toBe('l-new');
    expect(mockPrisma.volunteerList.create).toHaveBeenCalledWith({
      data: { ownerId: OWNER, name: '我的小组', isDefault: false },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

// ─── renameList ────────────────────────────────────────────────────────────

describe('renameList', () => {
  it('rejects when list belongs to another owner (notFound, no leak)', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OTHER_OWNER, name: '别人的', isDefault: false,
    });
    const r = await VolunteerListService.renameList(OWNER, 'l-1', '新名', OPERATOR);
    expect(r.notFound).toBeDefined();
  });

  it('rejects renaming the default list', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-default', ownerId: OWNER, name: '我的关注', isDefault: true,
    });
    const r = await VolunteerListService.renameList(OWNER, 'l-default', '新名', OPERATOR);
    expect(r.validationError).toMatch(/默认/);
  });

  it('renames successfully', async () => {
    mockPrisma.volunteerList.findUnique
      .mockResolvedValueOnce({ id: 'l-1', ownerId: OWNER, name: '旧名', isDefault: false })
      .mockResolvedValueOnce(null); // dup check
    mockPrisma.volunteerList.update.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '新名', isDefault: false,
    });
    const r = await VolunteerListService.renameList(OWNER, 'l-1', '新名', OPERATOR);
    expect(r.list.name).toBe('新名');
  });

  it('no-op when name unchanged', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '旧名', isDefault: false,
    });
    const r = await VolunteerListService.renameList(OWNER, 'l-1', '旧名', OPERATOR);
    expect(r.list).toBeDefined();
    expect(mockPrisma.volunteerList.update).not.toHaveBeenCalled();
  });
});

// ─── deleteList ────────────────────────────────────────────────────────────

describe('deleteList', () => {
  it('rejects deleting default list', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-default', ownerId: OWNER, name: '我的关注', isDefault: true,
    });
    const r = await VolunteerListService.deleteList(OWNER, 'l-default', OPERATOR);
    expect(r.validationError).toMatch(/默认/);
  });

  it('rejects cross-owner delete', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OTHER_OWNER, name: '别人的', isDefault: false,
    });
    const r = await VolunteerListService.deleteList(OWNER, 'l-1', OPERATOR);
    expect(r.notFound).toBeDefined();
  });

  it('deletes successfully', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteerList.delete.mockResolvedValueOnce({ id: 'l-1' });
    const r = await VolunteerListService.deleteList(OWNER, 'l-1', OPERATOR);
    expect(r.deleted).toBe(true);
  });
});

// ─── addMemberToList ───────────────────────────────────────────────────────

describe('addMemberToList', () => {
  it('rejects cross-owner add', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OTHER_OWNER, name: '别人的', isDefault: false,
    });
    const r = await VolunteerListService.addMemberToList(OWNER, 'l-1', TARGET_VOL.id, OPERATOR);
    expect(r.notFound).toBeDefined();
  });

  it('rejects nonexistent volunteer', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteer.findUnique.mockResolvedValueOnce(null);
    const r = await VolunteerListService.addMemberToList(OWNER, 'l-1', 'ghost', OPERATOR);
    expect(r.validationError).toMatch(/志愿者不存在/);
  });

  it('returns alreadyMember when duplicate', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteer.findUnique.mockResolvedValueOnce(TARGET_VOL);
    mockPrisma.volunteerListMember.findUnique.mockResolvedValueOnce({
      id: 'm-1', listId: 'l-1', volunteerId: TARGET_VOL.id,
    });
    const r = await VolunteerListService.addMemberToList(OWNER, 'l-1', TARGET_VOL.id, OPERATOR);
    expect(r.alreadyMember).toBe(true);
    expect(mockPrisma.volunteerListMember.create).not.toHaveBeenCalled();
  });

  it('adds member with note, writes audit', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteer.findUnique.mockResolvedValueOnce(TARGET_VOL);
    mockPrisma.volunteerListMember.findUnique.mockResolvedValueOnce(null);
    mockPrisma.volunteerListMember.create.mockResolvedValueOnce({
      id: 'm-new', listId: 'l-1', volunteerId: TARGET_VOL.id, note: '常代提交',
    });
    const r = await VolunteerListService.addMemberToList(
      OWNER, 'l-1', TARGET_VOL.id, OPERATOR, { note: '常代提交' },
    );
    expect(r.alreadyMember).toBe(false);
    expect(r.member.note).toBe('常代提交');
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

// ─── removeMemberFromList ──────────────────────────────────────────────────

describe('removeMemberFromList', () => {
  it('idempotent — returns removed:false when not a member', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteerListMember.findUnique.mockResolvedValueOnce(null);
    const r = await VolunteerListService.removeMemberFromList(OWNER, 'l-1', TARGET_VOL.id, OPERATOR);
    expect(r.removed).toBe(false);
  });

  it('removes successfully + audit', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteerListMember.findUnique.mockResolvedValueOnce({
      id: 'm-1', listId: 'l-1', volunteerId: TARGET_VOL.id,
    });
    mockPrisma.volunteerListMember.delete.mockResolvedValueOnce({ id: 'm-1' });
    const r = await VolunteerListService.removeMemberFromList(OWNER, 'l-1', TARGET_VOL.id, OPERATOR);
    expect(r.removed).toBe(true);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});

// ─── updateMemberNote ──────────────────────────────────────────────────────

describe('updateMemberNote', () => {
  it('rejects too-long note (201 chars)', async () => {
    const r = await VolunteerListService.updateMemberNote(
      OWNER, 'l-1', TARGET_VOL.id, 'x'.repeat(201), OPERATOR,
    );
    expect(r.validationError).toMatch(/最长/);
  });

  it('updates note and clears empty string to null', async () => {
    mockPrisma.volunteerList.findUnique.mockResolvedValueOnce({
      id: 'l-1', ownerId: OWNER, name: '我的小组', isDefault: false,
    });
    mockPrisma.volunteerListMember.findUnique.mockResolvedValueOnce({
      id: 'm-1', listId: 'l-1', volunteerId: TARGET_VOL.id, note: '旧的',
    });
    mockPrisma.volunteerListMember.update.mockResolvedValueOnce({
      id: 'm-1', listId: 'l-1', volunteerId: TARGET_VOL.id, note: null,
    });
    const r = await VolunteerListService.updateMemberNote(OWNER, 'l-1', TARGET_VOL.id, '   ', OPERATOR);
    expect(r.member.note).toBeNull();
  });
});

// ─── followerCount ─────────────────────────────────────────────────────────

describe('followerCount', () => {
  it('dedupes by ownerId across multiple lists', async () => {
    // 同一 owner 有 2 个 list 都加了同一志愿者 → 应当只算 1 个 follower.
    mockPrisma.volunteerListMember.findMany.mockResolvedValueOnce([
      { list: { ownerId: 'owner-A' } },
      { list: { ownerId: 'owner-A' } },
      { list: { ownerId: 'owner-B' } },
    ]);
    const count = await VolunteerListService.followerCount('vol-x');
    expect(count).toBe(2);
  });

  it('returns 0 when nobody follows', async () => {
    mockPrisma.volunteerListMember.findMany.mockResolvedValueOnce([]);
    const count = await VolunteerListService.followerCount('vol-x');
    expect(count).toBe(0);
  });
});
