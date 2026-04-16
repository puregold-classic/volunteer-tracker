// src/__tests__/ProjectSupportService.test.js — v2.1
//
// Tests the ProjectSupport state machine, dedup detection, month-lock check,
// proxy submission flow, and confirm/reject transitions. Uses prisma mocks —
// no real DB required.
//
// Coverage focus:
// - create: self-submit → ACTIVE; proxy → PENDING_CONFIRMATION
// - create: validation rejects (missing fields, bad duration, future date)
// - create: lock guard (non-admin can't submit before lockedBefore)
// - create: dedup catches P2002
// - confirm: only owner / admin can confirm; only PENDING_CONFIRMATION → ACTIVE
// - reject: similar
// - update / remove: ownership + lock check

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────
//
// vi.mock factories are hoisted to top of file. To share state between tests
// and the factory, declare via vi.hoisted() so the constants ARE hoisted too.

const { mockPrisma, mockSettings, mockIDGen } = vi.hoisted(() => {
  const prisma = {
    projectSupport: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    volunteer: { findUnique: vi.fn() },
    serviceItem: { findUnique: vi.fn() },
    systemSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Recursive: $transaction passes prisma itself as the tx client
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  return {
    mockPrisma: prisma,
    mockSettings: { isDateLocked: vi.fn(), get: vi.fn() },
    mockIDGen: {
      generateSupportId: vi.fn(async (code) => `PS-${code}-001`),
      generateAuditId: vi.fn(() => 'AUDIT-deadbeef'),
    },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/IDGenerator.js', () => ({ default: mockIDGen }));
vi.mock('../services/SystemSettingsService.js', () => ({ default: mockSettings }));

import ProjectSupportService from '../services/ProjectSupportService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const userOperator = {
  accountId: 'acc-user-1',
  volunteerId: 'vol-user-1',
  name: '王技术',
  role: 'user',
};

const adminOperator = {
  accountId: 'acc-admin-1',
  volunteerId: null,
  name: 'Sandbox Admin',
  role: 'admin',
};

const otherUserOperator = {
  accountId: 'acc-other',
  volunteerId: 'vol-other',
  name: '张笔译',
  role: 'b_admin',
};

const sampleVolunteer = {
  id: 'vol-user-1',
  volunteerCode: 'PG-0001',
  chineseName: '王技术',
};

const sampleServiceItem = {
  id: 'svc-tech-recording',
  name: '录制',
  departmentId: 'TECH',
  category: 'PROJECT_SUPPORT',
  isActive: true,
};

const baseInput = {
  volunteerId: 'vol-user-1',
  serviceItemId: 'svc-tech-recording',
  serviceDate: '2026-04-01',
  duration: 2,
  description: '测试录制工作',
};

const fakeRecord = (overrides = {}) => ({
  id: 'sup-1',
  supportId: 'PS-PG-0001-001',
  volunteerId: 'vol-user-1',
  submittedById: 'vol-user-1',
  serviceItemId: 'svc-tech-recording',
  serviceDate: new Date('2026-04-01'),
  duration: 2,
  description: '测试录制工作',
  status: 'ACTIVE',
  confirmedAt: null,
  ...overrides,
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: nothing is locked
  mockSettings.isDateLocked.mockResolvedValue(false);
});

// ─── create() ─────────────────────────────────────────────────────────────────

describe('ProjectSupportService.create', () => {
  it('self-submit → status ACTIVE with confirmedAt', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord({ status: 'ACTIVE', confirmedAt: new Date() }));

    const result = await ProjectSupportService.create(baseInput, userOperator);

    expect(result.record).toBeDefined();
    expect(result.record.status).toBe('ACTIVE');
    expect(mockPrisma.projectSupport.create).toHaveBeenCalledOnce();
    const createArgs = mockPrisma.projectSupport.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('ACTIVE');
    expect(createArgs.data.submittedById).toBe('vol-user-1');
    expect(createArgs.data.volunteerId).toBe('vol-user-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('regular-user proxy (B for A) → status PENDING_CONFIRMATION', async () => {
    const regularProxy = { ...otherUserOperator, role: 'user' };
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer); // target
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord({
      status: 'PENDING_CONFIRMATION',
      submittedById: 'vol-other',
    }));

    const result = await ProjectSupportService.create(baseInput, regularProxy);

    expect(result.record).toBeDefined();
    const createArgs = mockPrisma.projectSupport.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('PENDING_CONFIRMATION');
    expect(createArgs.data.submittedById).toBe('vol-other');
    expect(createArgs.data.volunteerId).toBe('vol-user-1');
  });

  it('b_admin proxy → ACTIVE (bypasses confirmation, audit flagged)', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord({
      status: 'ACTIVE',
      submittedById: 'vol-other',
      confirmedAt: new Date(),
    }));

    const result = await ProjectSupportService.create(baseInput, otherUserOperator); // b_admin
    expect(result.record).toBeDefined();
    const createArgs = mockPrisma.projectSupport.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('ACTIVE');
    expect(createArgs.data.confirmedAt).toBeInstanceOf(Date);
    const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.actionDetails.proxyBypassedConfirm).toBe(true);
  });

  it('a_admin proxy → ACTIVE (bypasses confirmation)', async () => {
    const aAdminProxy = { ...otherUserOperator, role: 'a_admin' };
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord({ status: 'ACTIVE' }));

    const result = await ProjectSupportService.create(baseInput, aAdminProxy);
    expect(result.record).toBeDefined();
    const createArgs = mockPrisma.projectSupport.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('ACTIVE');
  });

  it('admin self-submit with forceActive override → ACTIVE', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord({ status: 'ACTIVE' }));

    const result = await ProjectSupportService.create(
      { ...baseInput, forceActive: true },
      adminOperator,
    );
    expect(result.record).toBeDefined();
    const createArgs = mockPrisma.projectSupport.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('ACTIVE');
  });

  it('rejects when volunteerId missing', async () => {
    const result = await ProjectSupportService.create({ ...baseInput, volunteerId: '' }, userOperator);
    expect(result.validationError).toBeDefined();
    expect(mockPrisma.projectSupport.create).not.toHaveBeenCalled();
  });

  it('rejects duration not a 0.5 multiple', async () => {
    const result = await ProjectSupportService.create({ ...baseInput, duration: 1.3 }, userOperator);
    expect(result.validationError).toMatch(/0\.5 倍数/);
  });

  it('rejects future serviceDate', async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const result = await ProjectSupportService.create(
      { ...baseInput, serviceDate: future.toISOString() },
      userOperator,
    );
    expect(result.validationError).toMatch(/未来/);
  });

  it('rejects description too short', async () => {
    const result = await ProjectSupportService.create({ ...baseInput, description: '太短' }, userOperator);
    expect(result.validationError).toMatch(/5-1000/);
  });

  it('non-admin rejected by month-lock', async () => {
    mockSettings.isDateLocked.mockResolvedValue(true);
    const result = await ProjectSupportService.create(baseInput, userOperator);
    expect(result.locked).toBeDefined();
    expect(mockPrisma.projectSupport.create).not.toHaveBeenCalled();
  });

  it('admin bypasses month-lock', async () => {
    mockSettings.isDateLocked.mockResolvedValue(true);
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    mockPrisma.projectSupport.create.mockResolvedValue(fakeRecord());

    const result = await ProjectSupportService.create(baseInput, adminOperator);
    expect(result.record).toBeDefined();
    expect(result.locked).toBeUndefined();
  });

  it('rejects nonexistent target volunteer', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(null);
    const result = await ProjectSupportService.create(baseInput, userOperator);
    expect(result.validationError).toMatch(/志愿者不存在/);
  });

  it('rejects inactive service item', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue({ ...sampleServiceItem, isActive: false });
    const result = await ProjectSupportService.create(baseInput, userOperator);
    expect(result.validationError).toMatch(/已停用|不存在/);
  });

  it('rejects TRAINING_ATTENDANCE item (only project-level batch accepted)', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue({
      ...sampleServiceItem,
      name: '受训',
      category: 'TRAINING_ATTENDANCE',
    });
    const result = await ProjectSupportService.create(baseInput, userOperator);
    expect(result.validationError).toMatch(/受训|项目级/);
    expect(mockPrisma.projectSupport.create).not.toHaveBeenCalled();
  });

  it('catches P2002 dedup violation as friendly error', async () => {
    mockPrisma.volunteer.findUnique.mockResolvedValue(sampleVolunteer);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(sampleServiceItem);
    const dedupError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    mockPrisma.projectSupport.create.mockRejectedValue(dedupError);

    const result = await ProjectSupportService.create(baseInput, userOperator);
    expect(result.duplicate).toBeDefined();
    expect(result.duplicate).toMatch(/重复|相同/);
  });
});

// ─── confirm() ────────────────────────────────────────────────────────────────

describe('ProjectSupportService.confirm', () => {
  const pendingRecord = fakeRecord({
    status: 'PENDING_CONFIRMATION',
    submittedById: 'vol-other',
    submittedBy: { id: 'vol-other', volunteerCode: 'PG-0099', chineseName: '张笔译' },
  });

  it('owner confirms PENDING → ACTIVE with confirmedAt', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...pendingRecord, status: 'ACTIVE', confirmedAt: new Date() });

    const result = await ProjectSupportService.confirm('PS-PG-0001-001', userOperator);
    expect(result.record).toBeDefined();
    expect(result.record.status).toBe('ACTIVE');
    const updateArgs = mockPrisma.projectSupport.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('ACTIVE');
    expect(updateArgs.data.confirmedAt).toBeInstanceOf(Date);
  });

  it('rejects confirm by non-owner non-admin', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(pendingRecord);
    const result = await ProjectSupportService.confirm('PS-PG-0001-001', otherUserOperator);
    expect(result.forbidden).toBeDefined();
    expect(mockPrisma.projectSupport.update).not.toHaveBeenCalled();
  });

  it('admin can confirm anyone\'s', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...pendingRecord, status: 'ACTIVE' });
    const result = await ProjectSupportService.confirm('PS-PG-0001-001', adminOperator);
    expect(result.record).toBeDefined();
  });

  it('rejects confirm if status is not PENDING_CONFIRMATION', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(fakeRecord({ status: 'ACTIVE' }));
    const result = await ProjectSupportService.confirm('PS-PG-0001-001', userOperator);
    expect(result.invalidStatus).toBeDefined();
  });

  it('returns notFound if record missing', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(null);
    const result = await ProjectSupportService.confirm('PS-PG-9999-999', userOperator);
    expect(result.notFound).toBe(true);
  });
});

// ─── reject() ─────────────────────────────────────────────────────────────────

describe('ProjectSupportService.reject', () => {
  const pendingRecord = fakeRecord({
    status: 'PENDING_CONFIRMATION',
    submittedById: 'vol-other',
  });

  it('owner rejects PENDING → REJECTED_BY_OWNER (preserved)', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(pendingRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...pendingRecord, status: 'REJECTED_BY_OWNER' });

    const result = await ProjectSupportService.reject('PS-PG-0001-001', userOperator, { reason: '搞错日期了' });
    expect(result.record).toBeDefined();
    expect(result.record.status).toBe('REJECTED_BY_OWNER');
    const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('support_reject');
    expect(auditArgs.data.changes).toEqual([{ field: 'reason', from: null, to: '搞错日期了' }]);
  });

  it('rejects reject by stranger', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(pendingRecord);
    const stranger = { ...userOperator, volunteerId: 'vol-stranger' };
    const result = await ProjectSupportService.reject('PS-PG-0001-001', stranger);
    expect(result.forbidden).toBeDefined();
  });
});

// ─── update() ────────────────────────────────────────────────────────────────

describe('ProjectSupportService.update', () => {
  const ownedRecord = {
    ...fakeRecord(),
    volunteer: sampleVolunteer,
    serviceItem: sampleServiceItem,
  };

  it('owner can update own record', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...ownedRecord, description: '新描述测试' });

    const result = await ProjectSupportService.update('PS-PG-0001-001', { description: '新描述测试' }, userOperator);
    expect(result.record).toBeDefined();
    expect(mockPrisma.projectSupport.update).toHaveBeenCalled();
  });

  it('non-owner non-admin rejected', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    const stranger = { ...userOperator, volunteerId: 'vol-stranger' };
    const result = await ProjectSupportService.update('PS-PG-0001-001', { description: '新描述测试' }, stranger);
    expect(result.forbidden).toBeDefined();
  });

  it('non-admin rejected by month-lock on existing date', async () => {
    mockSettings.isDateLocked.mockResolvedValue(true);
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    const result = await ProjectSupportService.update('PS-PG-0001-001', { description: '新描述测试' }, userOperator);
    expect(result.locked).toBeDefined();
  });

  it('returns no-op if no fields changed', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    const result = await ProjectSupportService.update('PS-PG-0001-001', {}, userOperator);
    expect(result.record).toBeDefined(); // returns existing
    expect(mockPrisma.projectSupport.update).not.toHaveBeenCalled();
  });
});

// ─── remove() ────────────────────────────────────────────────────────────────

describe('ProjectSupportService.remove', () => {
  const ownedRecord = {
    ...fakeRecord(),
    volunteer: sampleVolunteer,
  };

  it('owner can soft-delete (status → DELETED)', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...ownedRecord, status: 'DELETED' });

    const result = await ProjectSupportService.remove('PS-PG-0001-001', userOperator);
    expect(result.record).toBeDefined();
    const updateArgs = mockPrisma.projectSupport.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('DELETED');
  });

  it('rejects remove by stranger', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    const stranger = { ...userOperator, volunteerId: 'vol-stranger' };
    const result = await ProjectSupportService.remove('PS-PG-0001-001', stranger);
    expect(result.forbidden).toBeDefined();
  });

  it('admin can remove any', async () => {
    mockPrisma.projectSupport.findUnique.mockResolvedValue(ownedRecord);
    mockPrisma.projectSupport.update.mockResolvedValue({ ...ownedRecord, status: 'DELETED' });
    const result = await ProjectSupportService.remove('PS-PG-0001-001', adminOperator);
    expect(result.record).toBeDefined();
  });
});
