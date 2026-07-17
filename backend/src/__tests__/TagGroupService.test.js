// src/__tests__/TagGroupService.test.js
//
// v3.7 regression: tag groups are org-config, not user-owned. createdById is
// now optional audit provenance. A pure system admin (operator.volunteerId=null)
// must be able to create a tag group — before v3.7 the service rejected it with
// "创建标签组需要 volunteer 身份", which contradicted the route that gates group
// creation to the `admin` role alone (and admin.volunteerId is always null), so
// nobody could create a group via API. This locks the fix in.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const tx = {
    tagGroup: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    mockPrisma: {
      _tx: tx,
      serviceItem: { count: vi.fn() },
      $transaction: vi.fn(async (fn) => fn(tx)),
    },
  };
});

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/IDGenerator.js', () => ({ default: { generateAuditId: () => 'AUDIT-x' } }));
vi.mock('../utils/serializer.js', () => ({ serializeTagGroup: (g) => g }));

import TagGroupService from '../services/TagGroupService.js';

const baseInput = {
  name: 'sys group',
  description: null,
  boundServiceItemIds: [],
  selectionMode: 'single',
  opMode: 'tag_only',
  openness: 'closed',
  required: false,
};

describe('TagGroupService.create — v3.7 nullable owner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma._tx.tagGroup.create.mockImplementation(async ({ data }) => ({ id: 'g1', ...data }));
    mockPrisma._tx.auditLog.create.mockResolvedValue({});
  });

  it('lets a pure system admin (volunteerId=null) create a group, stored as createdById:null', async () => {
    const operator = { role: 'admin', volunteerId: null };

    const result = await TagGroupService.create(baseInput, operator);

    expect(result.forbidden).toBeUndefined();
    expect(result.validationError).toBeUndefined();
    expect(result.group).toBeDefined();
    const data = mockPrisma._tx.tagGroup.create.mock.calls[0][0].data;
    expect(data.createdById).toBeNull();
  });

  it('still records the real volunteer id when an a_admin creates a group', async () => {
    const operator = { role: 'a_admin', volunteerId: 'vol-123' };

    await TagGroupService.create(baseInput, operator);

    const data = mockPrisma._tx.tagGroup.create.mock.calls[0][0].data;
    expect(data.createdById).toBe('vol-123');
  });
});
