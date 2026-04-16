// src/__tests__/ProjectService.test.js — v3 wave 2
//
// Covers:
// - create: MVP accepts only TRAINING_ATTENDANCE; validates name/date/duration/operator
// - create: rejects other categories (PROJECT_MGMT / TRAINING / SUPPORT) at service layer
// - update: sessionDuration frozen on TRAINING_ATTENDANCE; other fields updatable
// - remove: refuses when projectSupports count > 0
// - audit log: project_create written on create, project_update with changes

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockIDGen } = vi.hoisted(() => {
  const prisma = {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    department: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  return {
    mockPrisma: prisma,
    mockIDGen: {
      generateProjectCode: vi.fn(async () => 'PROJ-0001'),
      generateAuditId: vi.fn(() => 'AUDIT-deadbeef'),
    },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/IDGenerator.js', () => ({ default: mockIDGen }));

import ProjectService from '../services/ProjectService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const aAdmin = {
  accountId: 'acc-a-admin',
  volunteerId: 'vol-a-admin',
  name: '李口译',
  role: 'a_admin',
};

const sampleDept = { id: 'BY_TRAINING', name: '笔译培训部', displayOrder: 4 };

const baseInput = {
  name: '2026-04 笔译培训 第 12 期',
  category: 'TRAINING_ATTENDANCE',
  departmentId: 'BY_TRAINING',
  sessionDate: '2026-04-10',
  sessionDuration: 2,
};

const fakeProject = (overrides = {}) => ({
  id: 'proj-1',
  projectCode: 'PROJ-0001',
  name: baseInput.name,
  category: 'TRAINING_ATTENDANCE',
  departmentId: 'BY_TRAINING',
  department: { id: 'BY_TRAINING', name: '笔译培训部' },
  sessionDate: new Date('2026-04-10'),
  sessionDuration: 2,
  attributes: {},
  createdById: aAdmin.volunteerId,
  createdBy: { id: aAdmin.volunteerId, volunteerCode: 'PG-0002', chineseName: '李口译' },
  _count: { projectSupports: 0 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── create() ─────────────────────────────────────────────────────────────────

describe('ProjectService.create', () => {
  it('creates TRAINING_ATTENDANCE project with audit log', async () => {
    mockPrisma.department.findUnique.mockResolvedValue(sampleDept);
    mockPrisma.project.create.mockResolvedValue(fakeProject());

    const result = await ProjectService.create(baseInput, aAdmin);
    expect(result.project).toBeDefined();
    expect(result.project.category).toBe('TRAINING_ATTENDANCE');
    expect(result.project.projectCode).toBe('PROJ-0001');
    expect(mockPrisma.project.create).toHaveBeenCalledOnce();
    const createArgs = mockPrisma.project.create.mock.calls[0][0];
    expect(createArgs.data.createdById).toBe(aAdmin.volunteerId);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    expect(mockPrisma.auditLog.create.mock.calls[0][0].data.action).toBe('project_create');
  });

  it('rejects non-TRAINING_ATTENDANCE category at service layer (MVP)', async () => {
    const result = await ProjectService.create(
      { ...baseInput, category: 'PROJECT_MGMT' },
      aAdmin,
    );
    expect(result.validationError).toMatch(/TRAINING_ATTENDANCE/);
    expect(mockPrisma.project.create).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    const result = await ProjectService.create({ ...baseInput, sessionDate: undefined }, aAdmin);
    expect(result.validationError).toBeDefined();
  });

  it('requires sessionDuration for TRAINING_ATTENDANCE', async () => {
    const result = await ProjectService.create(
      { ...baseInput, sessionDuration: undefined },
      aAdmin,
    );
    expect(result.validationError).toMatch(/sessionDuration/);
  });

  it('rejects sessionDuration that is not a 0.5 multiple', async () => {
    const result = await ProjectService.create(
      { ...baseInput, sessionDuration: 1.3 },
      aAdmin,
    );
    expect(result.validationError).toMatch(/0\.5/);
  });

  it('rejects operator without a volunteer profile', async () => {
    const result = await ProjectService.create(baseInput, { ...aAdmin, volunteerId: null, role: 'admin' });
    expect(result.forbidden).toBeDefined();
  });

  it('rejects unknown department', async () => {
    mockPrisma.department.findUnique.mockResolvedValue(null);
    const result = await ProjectService.create(baseInput, aAdmin);
    expect(result.validationError).toMatch(/部门不存在/);
  });
});

// ─── update() ─────────────────────────────────────────────────────────────────

describe('ProjectService.update', () => {
  it('refuses to change sessionDuration on TRAINING_ATTENDANCE', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fakeProject());
    const result = await ProjectService.update('proj-1', { sessionDuration: 3 }, aAdmin);
    expect(result.validationError).toMatch(/不可修改/);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it('updates name + writes audit with changes', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fakeProject());
    mockPrisma.project.update.mockResolvedValue(fakeProject({ name: '改名后' }));

    const result = await ProjectService.update('proj-1', { name: '改名后' }, aAdmin);
    expect(result.project).toBeDefined();
    const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('project_update');
    expect(auditArgs.data.changes).toEqual(
      expect.arrayContaining([{ field: 'name', from: expect.any(String), to: '改名后' }]),
    );
  });

  it('returns notFound when id does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const result = await ProjectService.update('no-such-id', { name: '...' }, aAdmin);
    expect(result.notFound).toBe(true);
  });
});

// ─── remove() ─────────────────────────────────────────────────────────────────

describe('ProjectService.remove', () => {
  it('hard-deletes when no projectSupports reference it', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fakeProject());
    mockPrisma.project.delete.mockResolvedValue({});

    const result = await ProjectService.remove('proj-1', aAdmin);
    expect(result.deleted).toBe(true);
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } });
  });

  it('refuses to delete when supports exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(
      fakeProject({ _count: { projectSupports: 3 } }),
    );
    const result = await ProjectService.remove('proj-1', aAdmin);
    expect(result.conflict).toMatch(/3 条支援记录/);
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();
  });

  it('returns notFound when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const result = await ProjectService.remove('no-such-id', aAdmin);
    expect(result.notFound).toBe(true);
  });
});
