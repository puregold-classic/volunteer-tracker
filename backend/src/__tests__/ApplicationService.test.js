import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMyApplications,
  deactivateAllMyApplications,
  withdrawApplication,
} from '../services/ApplicationService.js';

vi.mock('../utils/prismaClient.js', () => ({
  default: {
    serviceApplication: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  getPrisma: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

// ValidationUtils and IDGenerator are used by submitApplication which requires
// deeper integration with DB — tested via withdrawApplication / getMyApplications here.
vi.mock('../utils/validationUtils.js', () => ({
  default: {
    validateApplicationData: vi.fn().mockResolvedValue({ isValid: true, validatedChanges: [] }),
  },
}));
vi.mock('../utils/idUtils.js', () => ({
  IDGenerator: { generateApplicationId: vi.fn().mockResolvedValue('APP-001') },
}));

import prisma from '../utils/prismaClient.js';
import ValidationUtils from '../utils/validationUtils.js';
import { IDGenerator } from '../utils/idUtils.js';

const makeApplication = (overrides = {}) => ({
  id: 'dbid1',
  applicationId: 'APP-001',
  applicationType: 'create',
  targetType: 'NonProjectService',
  volunteerId: 'PG-0001',
  volunteerName: '张三',
  changes: [],
  targetId: null,
  submittedBy: { id: 'acc1', name: '张三', role: 'user', timestamp: '2024-01-01T00:00:00.000Z' },
  status: 'pending',
  reviewNotes: '',
  isActive: true,
  expiresAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ─── submitApplication ───────────────────────────────────────────────────────

describe('submitApplication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns validationError when validation fails', async () => {
    const { submitApplication } = await import('../services/ApplicationService.js');

    vi.mocked(ValidationUtils.validateApplicationData).mockResolvedValueOnce({
      isValid: false,
      error: '申请类型不合法',
    });

    const result = await submitApplication({
      applicationType: 'invalid',
      volunteerId: 'PG-0001',
      volunteerName: '张三',
      submittedBy: { id: 'acc1', name: '张三', role: 'user' },
    });

    expect(result.validationError).toBe('申请类型不合法');
    expect(prisma.serviceApplication.create).not.toHaveBeenCalled();
  });

  it('returns conflictError when a pending application exists for same target', async () => {
    const { submitApplication } = await import('../services/ApplicationService.js');

    vi.mocked(ValidationUtils.validateApplicationData).mockResolvedValueOnce({
      isValid: true,
      validatedChanges: [],
    });
    prisma.serviceApplication.findFirst.mockResolvedValue(makeApplication());

    const result = await submitApplication({
      applicationType: 'update',
      volunteerId: 'PG-0001',
      volunteerName: '张三',
      targetId: 'nps-001',
      submittedBy: { id: 'acc1', name: '张三', role: 'user' },
    });

    expect(result.conflictError).toBeDefined();
    expect(result.conflictError).toContain('APP-001');
    expect(prisma.serviceApplication.create).not.toHaveBeenCalled();
  });

  it('creates and returns application on success', async () => {
    const { submitApplication } = await import('../services/ApplicationService.js');

    vi.mocked(ValidationUtils.validateApplicationData).mockResolvedValueOnce({
      isValid: true,
      validatedChanges: [{ field: 'description', from: null, to: '测试' }],
    });
    prisma.serviceApplication.findFirst.mockResolvedValue(null);
    vi.mocked(IDGenerator.generateApplicationId).mockResolvedValueOnce('APP-002');
    const saved = makeApplication({ applicationId: 'APP-002' });
    prisma.serviceApplication.create.mockResolvedValue(saved);

    const result = await submitApplication({
      applicationType: 'create',
      volunteerId: 'PG-0001',
      volunteerName: '张三',
      submittedBy: { id: 'acc1', name: '张三', role: 'user' },
    });

    expect(result.application).toBeDefined();
    expect(result.application.applicationId).toBe('APP-002');
    expect(prisma.serviceApplication.create).toHaveBeenCalledOnce();
  });
});

// ─── getMyApplications ───────────────────────────────────────────────────────

describe('getMyApplications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingId when neither volunteerId nor submittedById provided', async () => {
    const result = await getMyApplications({});
    expect(result.missingId).toBe(true);
  });

  it('returns missingId for empty string volunteerId', async () => {
    const result = await getMyApplications({ volunteerId: '  ' });
    expect(result.missingId).toBe(true);
  });

  it('returns paginated applications by volunteerId', async () => {
    prisma.serviceApplication.findMany.mockResolvedValue([makeApplication()]);
    prisma.serviceApplication.count.mockResolvedValue(1);

    const result = await getMyApplications({ volunteerId: 'PG-0001', page: 1, limit: 10 });

    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].applicationId).toBe('APP-001');
    expect(result.pagination.total).toBe(1);
  });

  it('falls back to submittedById when volunteerId absent', async () => {
    prisma.serviceApplication.findMany.mockResolvedValue([]);
    prisma.serviceApplication.count.mockResolvedValue(0);

    const result = await getMyApplications({ submittedById: 'acc1' });
    expect(result.missingId).toBeUndefined();
    expect(result.applications).toEqual([]);
  });

  it('includes inactive applications when includeInactive=true', async () => {
    prisma.serviceApplication.findMany.mockResolvedValue([makeApplication({ isActive: false })]);
    prisma.serviceApplication.count.mockResolvedValue(1);

    await getMyApplications({ volunteerId: 'PG-0001', includeInactive: 'true' });

    const whereArg = prisma.serviceApplication.findMany.mock.calls[0][0].where;
    expect(whereArg.isActive).toBeUndefined();
  });

  it('filters by status when a valid status is provided', async () => {
    prisma.serviceApplication.findMany.mockResolvedValue([]);
    prisma.serviceApplication.count.mockResolvedValue(0);

    await getMyApplications({ volunteerId: 'PG-0001', status: 'approved' });

    const whereArg = prisma.serviceApplication.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('approved');
  });

  it('ignores invalid status values', async () => {
    prisma.serviceApplication.findMany.mockResolvedValue([]);
    prisma.serviceApplication.count.mockResolvedValue(0);

    await getMyApplications({ volunteerId: 'PG-0001', status: 'invalid' });

    const whereArg = prisma.serviceApplication.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBeUndefined();
  });
});

// ─── deactivateAllMyApplications ─────────────────────────────────────────────

describe('deactivateAllMyApplications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingId when neither id is provided', async () => {
    const result = await deactivateAllMyApplications({});
    expect(result.missingId).toBe(true);
  });

  it('returns deactivated count on success', async () => {
    prisma.serviceApplication.updateMany.mockResolvedValue({ count: 3 });

    const result = await deactivateAllMyApplications({ volunteerId: 'PG-0001' });
    expect(result.deactivatedCount).toBe(3);
  });

  it('uses submittedById when volunteerId absent', async () => {
    prisma.serviceApplication.updateMany.mockResolvedValue({ count: 1 });

    const result = await deactivateAllMyApplications({ submittedById: 'acc1' });
    expect(result.deactivatedCount).toBe(1);

    const whereArg = prisma.serviceApplication.updateMany.mock.calls[0][0].where;
    expect(whereArg.volunteerId).toBe('acc1');
  });

  it('only deactivates currently active applications', async () => {
    prisma.serviceApplication.updateMany.mockResolvedValue({ count: 2 });

    await deactivateAllMyApplications({ volunteerId: 'PG-0001' });

    const callArg = prisma.serviceApplication.updateMany.mock.calls[0][0];
    expect(callArg.where.isActive).toBe(true);
    expect(callArg.data.isActive).toBe(false);
  });
});

// ─── withdrawApplication ─────────────────────────────────────────────────────

describe('withdrawApplication', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingWithdrawnBy when withdrawnBy has no id', async () => {
    const result = await withdrawApplication({ applicationId: 'APP-001', withdrawnBy: {} });
    expect(result.missingWithdrawnBy).toBe(true);
  });

  it('returns missingWithdrawnBy when withdrawnBy is absent', async () => {
    const result = await withdrawApplication({ applicationId: 'APP-001' });
    expect(result.missingWithdrawnBy).toBe(true);
  });

  it('returns notFound when application does not exist or is not pending', async () => {
    prisma.serviceApplication.findFirst.mockResolvedValue(null);

    const result = await withdrawApplication({
      applicationId: 'APP-XXXX',
      withdrawnBy: { id: 'acc1' },
    });
    expect(result.notFound).toBe(true);
    expect(prisma.serviceApplication.update).not.toHaveBeenCalled();
  });

  it('returns forbidden when requester did not submit and is not the volunteer', async () => {
    prisma.serviceApplication.findFirst.mockResolvedValue(
      makeApplication({ volunteerId: 'PG-0001', submittedBy: { id: 'acc1' } })
    );

    const result = await withdrawApplication({
      applicationId: 'APP-001',
      withdrawnBy: { id: 'acc-stranger' },
    });
    expect(result.forbidden).toBe(true);
    expect(prisma.serviceApplication.update).not.toHaveBeenCalled();
  });

  it('allows withdrawal when withdrawnBy is the submitter', async () => {
    const app = makeApplication({ submittedBy: { id: 'acc1' }, volunteerId: 'PG-0001' });
    const updated = { ...app, status: 'withdrawn' };
    prisma.serviceApplication.findFirst.mockResolvedValue(app);
    prisma.serviceApplication.update.mockResolvedValue(updated);

    const result = await withdrawApplication({ applicationId: 'APP-001', withdrawnBy: { id: 'acc1' } });

    expect(result.application.status).toBe('withdrawn');
    expect(prisma.serviceApplication.update).toHaveBeenCalledWith({
      where: { applicationId: 'APP-001' },
      data: { status: 'withdrawn', updatedAt: expect.any(Date) },
    });
  });

  it('allows withdrawal when withdrawnBy is the volunteer', async () => {
    const app = makeApplication({ submittedBy: { id: 'acc2' }, volunteerId: 'PG-0001' });
    const updated = { ...app, status: 'withdrawn' };
    prisma.serviceApplication.findFirst.mockResolvedValue(app);
    prisma.serviceApplication.update.mockResolvedValue(updated);

    // withdrawnBy.id matches volunteerId
    const result = await withdrawApplication({ applicationId: 'APP-001', withdrawnBy: { id: 'PG-0001' } });
    expect(result.application.status).toBe('withdrawn');
  });
});
