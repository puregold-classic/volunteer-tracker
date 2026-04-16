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
    projectSupport: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    serviceItem: { findUnique: vi.fn() },
    volunteer: { findMany: vi.fn() },
    department: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
  return {
    mockPrisma: prisma,
    mockIDGen: {
      generateProjectCode: vi.fn(async () => 'PROJ-0001'),
      generateSupportId: vi.fn(async (code) => `PS-${code}-001`),
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

// ─── batchAttendance() ───────────────────────────────────────────────────────

describe('ProjectService.batchAttendance', () => {
  const attendanceItem = {
    id: 'svc-training-attend',
    name: '受训',
    departmentId: 'BY_TRAINING',
    category: 'TRAINING_ATTENDANCE',
    isActive: true,
  };

  const projectRow = {
    id: 'proj-1',
    projectCode: 'PROJ-0001',
    name: '2026-04 笔译培训 第 12 期',
    category: 'TRAINING_ATTENDANCE',
    departmentId: 'BY_TRAINING',
    sessionDate: new Date('2026-04-10'),
    sessionDuration: 2,
    attributes: {},
  };

  const volA = { id: 'vol-a', volunteerCode: 'PG-0010', chineseName: '王一', englishName: 'Wang Yi' };
  const volB = { id: 'vol-b', volunteerCode: 'PG-0011', chineseName: '李二', englishName: 'Li Er' };
  // Two volunteers share 中文名 to exercise the ambiguous-match path
  const volCduplicate1 = { id: 'vol-c1', volunteerCode: 'PG-0020', chineseName: '同名', englishName: 'Tong Ming A' };
  const volCduplicate2 = { id: 'vol-c2', volunteerCode: 'PG-0021', chineseName: '同名', englishName: 'Tong Ming B' };

  beforeEach(() => {
    mockPrisma.project.findUnique.mockResolvedValue(projectRow);
    mockPrisma.serviceItem.findUnique.mockResolvedValue(attendanceItem);
    mockPrisma.volunteer.findMany.mockResolvedValue([volA, volB, volCduplicate1, volCduplicate2]);
    mockPrisma.projectSupport.findMany.mockResolvedValue([]); // nothing recorded yet
    mockPrisma.projectSupport.create.mockImplementation(async ({ data, select }) => ({
      id: `ps-${data.volunteerId}`,
      supportId: `PS-MOCK-${data.volunteerId}`,
      volunteerId: data.volunteerId,
    }));
  });

  it('creates records for matched names, skips unmatched, records all in audit', async () => {
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一', 'PG-0011', 'unknown-name'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.total).toBe(3);
    expect(result.created).toHaveLength(2);
    expect(result.created.map((c) => c.volunteer.volunteerCode).sort()).toEqual(['PG-0010', 'PG-0011']);
    expect(result.unmatched).toEqual(['unknown-name']);
    expect(mockPrisma.projectSupport.create).toHaveBeenCalledTimes(2);

    const auditArgs = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(auditArgs.data.action).toBe('project_attendance_batch');
    expect(auditArgs.data.actionDetails).toMatchObject({
      projectCode: 'PROJ-0001',
      created: 2,
      unmatched: 1,
    });
  });

  it('reports ambiguous names with candidates instead of creating', async () => {
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['同名'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.created).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidates.map((v) => v.volunteerCode).sort()).toEqual(['PG-0020', 'PG-0021']);
    expect(mockPrisma.projectSupport.create).not.toHaveBeenCalled();
  });

  it('skips volunteers already recorded for this project (re-paste is safe)', async () => {
    mockPrisma.projectSupport.findMany.mockResolvedValue([{ volunteerId: 'vol-a' }]);

    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一', '李二'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.created).toHaveLength(1);
    expect(result.created[0].volunteer.volunteerCode).toBe('PG-0011');
    expect(result.alreadyRecorded).toHaveLength(1);
    expect(result.alreadyRecorded[0].volunteer.volunteerCode).toBe('PG-0010');
  });

  it('dedupes identical input names (same name pasted twice counts once)', async () => {
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一', '王一', 'PG-0010'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    // 王一 and PG-0010 both refer to volA; after normalization there are 2 unique
    // inputs but they match the same person → only one create
    expect(result.total).toBe(2);
    expect(result.created).toHaveLength(1);
  });

  it('rejects non-TRAINING_ATTENDANCE project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ ...projectRow, category: 'PROJECT_MGMT' });
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.validationError).toMatch(/受训考勤/);
  });

  it('rejects service-item whose department differs from the project', async () => {
    mockPrisma.serviceItem.findUnique.mockResolvedValue({
      ...attendanceItem,
      departmentId: 'TECH',
    });
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.validationError).toMatch(/不属于项目所在部门/);
  });

  it('rejects service-item whose category is not TRAINING_ATTENDANCE', async () => {
    mockPrisma.serviceItem.findUnique.mockResolvedValue({
      ...attendanceItem,
      category: 'PROJECT_TRAINING',
    });
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.validationError).toMatch(/受训考勤类/);
  });

  it('rejects batch larger than 500 names', async () => {
    const big = Array.from({ length: 600 }, (_, i) => `name-${i}`);
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: big, serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.validationError).toMatch(/500/);
  });

  it('rejects operator without volunteer binding', async () => {
    const result = await ProjectService.batchAttendance(
      'proj-1',
      { names: ['王一'], serviceItemId: attendanceItem.id },
      { ...aAdmin, volunteerId: null, role: 'admin' },
    );
    expect(result.forbidden).toBeDefined();
  });

  it('returns notFound when project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const result = await ProjectService.batchAttendance(
      'missing',
      { names: ['王一'], serviceItemId: attendanceItem.id },
      aAdmin,
    );
    expect(result.notFound).toBe(true);
  });
});
