// src/__tests__/TagService.test.js
//
// Regression coverage for TagService.listSupports.
//
// Bug: 全部软删 (batchDelete) sets ProjectSupport.status=DELETED but keeps the
// TagAttachment row. listSupports queried attachments by tagId with no status
// filter, so soft-deleted members kept showing in the tag's member list.
// Fix: listSupports must only return attachments whose support is ACTIVE.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    tagAttachment: { findMany: vi.fn() },
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));
vi.mock('../utils/IDGenerator.js', () => ({ default: { generateAuditId: () => 'AUDIT-x' } }));
// Identity serializer so the test stays focused on the where-clause filter.
vi.mock('../utils/serializer.js', () => ({ serializeProjectSupport: (s) => s }));

import TagService from '../services/TagService.js';

describe('TagService.listSupports', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('only queries ACTIVE supports so soft-deleted members drop out', async () => {
    mockPrisma.tagAttachment.findMany.mockResolvedValue([]);

    await TagService.listSupports('tag-1');

    expect(mockPrisma.tagAttachment.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.tagAttachment.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tagId: 'tag-1', support: { status: 'ACTIVE' } });
  });

  it('returns the attached ACTIVE supports', async () => {
    mockPrisma.tagAttachment.findMany.mockResolvedValue([
      { attachedAt: 'D1', attachedById: 'vol-1', support: { id: 'ps-1', status: 'ACTIVE' } },
    ]);

    const rows = await TagService.listSupports('tag-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].support.id).toBe('ps-1');
    expect(rows[0].attachedById).toBe('vol-1');
  });
});
