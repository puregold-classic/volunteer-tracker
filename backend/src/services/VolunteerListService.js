// src/services/VolunteerListService.js — v3 wave 3
//
// Private per-volunteer tracking lists. MVP scope: single default list per
// owner, auto-created on first follow. Schema supports multi-list; adding
// create/rename/delete endpoints is a small extension when user asks.
//
// Permissions: each list is scoped to its owner (owner = Volunteer.id).
// Admin accounts without a volunteerId do not own lists — lists are a
// volunteer-workspace feature, admin can still query via the ledger.
// a_admin / b_admin / user roles each see only their own lists.

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { serializeVolunteer } from '../utils/serializer.js';

const DEFAULT_NAME = '我的关注';

const writeAudit = async (tx, action, { targetId, modifiedId, operator, extraDetails = {} }) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'Volunteer', // list changes modify a volunteer's tracking set
      targetId,
      action,
      actionDetails: extraDetails,
      modifiedId: modifiedId ?? null,
      changes: [],
      operator: {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
      submitter: {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
    },
  });
};

class VolunteerListService {
  /**
   * Ensure the default "我的关注" list exists for the given owner. Idempotent.
   * Returns the list (fresh or existing).
   */
  static async ensureDefaultList(ownerId, operator) {
    const existing = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: DEFAULT_NAME } },
    });
    if (existing) return existing;

    return prisma.$transaction(async (tx) => {
      const created = await tx.volunteerList.create({
        data: {
          ownerId,
          name: DEFAULT_NAME,
          isDefault: true,
        },
      });
      await writeAudit(tx, 'list_create', {
        targetId: created.id,
        operator,
        extraDetails: { listName: DEFAULT_NAME, isDefault: true },
      });
      return created;
    });
  }

  /**
   * List the current user's own lists with expanded volunteer member data.
   * Shape: [{ id, name, isDefault, members: [{ volunteer, addedAt, note }] }]
   */
  static async listMine(ownerId) {
    if (!ownerId) return [];
    const rows = await prisma.volunteerList.findMany({
      where: { ownerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        members: {
          orderBy: { addedAt: 'desc' },
          include: {
            volunteer: {
              include: { department: true },
            },
          },
        },
      },
    });
    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      isDefault: l.isDefault,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      members: l.members.map((m) => ({
        id: m.id,
        note: m.note,
        addedAt: m.addedAt,
        volunteer: serializeVolunteer(m.volunteer),
      })),
    }));
  }

  /**
   * Follow shortcut: add a volunteer to the default list, creating it lazily.
   * Returns { list, member, alreadyMember: boolean }.
   */
  static async followDefault(ownerId, volunteerId, operator, { note } = {}) {
    if (!ownerId) return { forbidden: '需要志愿者身份才能关注（admin 请切到个人账号）' };

    const target = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    if (!target) return { validationError: `志愿者不存在: ${volunteerId}` };

    const list = await this.ensureDefaultList(ownerId, operator);

    // Already a member?
    const existing = await prisma.volunteerListMember.findUnique({
      where: { listId_volunteerId: { listId: list.id, volunteerId } },
    });
    if (existing) {
      return { list, member: existing, alreadyMember: true };
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.volunteerListMember.create({
        data: { listId: list.id, volunteerId, note: note || null },
      });
      await writeAudit(tx, 'list_member_add', {
        targetId: list.id,
        modifiedId: volunteerId,
        operator,
        extraDetails: { volunteerCode: target.volunteerCode, volunteerName: target.chineseName },
      });
      return row;
    });
    return { list, member: created, alreadyMember: false };
  }

  /** Remove from default list. Idempotent — no error if not a member. */
  static async unfollowDefault(ownerId, volunteerId, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const list = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: DEFAULT_NAME } },
    });
    if (!list) return { removed: false };

    const existing = await prisma.volunteerListMember.findUnique({
      where: { listId_volunteerId: { listId: list.id, volunteerId } },
    });
    if (!existing) return { removed: false };

    await prisma.$transaction(async (tx) => {
      await tx.volunteerListMember.delete({ where: { id: existing.id } });
      await writeAudit(tx, 'list_member_remove', {
        targetId: list.id,
        modifiedId: volunteerId,
        operator,
      });
    });
    return { removed: true };
  }

  /**
   * Public-ish: count how many unique owners have followed this volunteer.
   * Used for the "N 人关注" badge on the volunteer detail page.
   */
  static async followerCount(volunteerId) {
    const distinctOwners = await prisma.volunteerListMember.findMany({
      where: { volunteerId },
      select: { list: { select: { ownerId: true } } },
      distinct: ['volunteerId'],
    });
    // The distinct above is per-member, we actually want distinct owners.
    // Simpler query: group by ownerId.
    const count = await prisma.volunteerListMember.groupBy({
      by: ['listId'],
      where: { volunteerId },
    });
    // count rows = number of lists containing this volunteer, which ≈ followers.
    // If multi-list is enabled later, dedupe by ownerId instead.
    void distinctOwners;
    return count.length;
  }
}

export default VolunteerListService;
