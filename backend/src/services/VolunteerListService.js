// src/services/VolunteerListService.js — v3 wave 3 (multi-list 扩展 v3.4)
//
// Per-volunteer tracking lists.  Default list "我的关注" lazily created on
// first follow.  Custom lists supported via createList/renameList/deleteList.
// All mutations check the caller owns the target list — cross-owner access
// is rejected with notFound (we don't leak list existence).
//
// 权限：list 系统在 v3.4 起限定 a_admin / b_admin（路由层 gate）.  Pure
// system admin（无 volunteerId）由 service 入口的 ownerId 检查拒绝.

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { serializeVolunteer } from '../utils/serializer.js';

const DEFAULT_NAME = '我的关注';
const NAME_MAX = 32;
const NOTE_MAX = 200;

const writeAudit = async (tx, action, { targetId, modifiedId, operator, extraDetails = {} }) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'Volunteer',
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

const validateName = (raw) => {
  if (typeof raw !== 'string') return { error: '名称必填' };
  const name = raw.trim();
  if (!name) return { error: '名称必填' };
  if (name.length > NAME_MAX) return { error: `名称最长 ${NAME_MAX} 字` };
  return { name };
};

const validateNote = (raw) => {
  if (raw === undefined || raw === null) return { note: null };
  if (typeof raw !== 'string') return { error: 'note 必须为字符串' };
  const note = raw.trim();
  if (!note) return { note: null };
  if (note.length > NOTE_MAX) return { error: `备注最长 ${NOTE_MAX} 字` };
  return { note };
};

class VolunteerListService {
  // ─── default-list shortcuts (BC for follow-heart) ────────────────────────

  static async ensureDefaultList(ownerId, operator) {
    const existing = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: DEFAULT_NAME } },
    });
    if (existing) return existing;

    return prisma.$transaction(async (tx) => {
      const created = await tx.volunteerList.create({
        data: { ownerId, name: DEFAULT_NAME, isDefault: true },
      });
      await writeAudit(tx, 'list_create', {
        targetId: created.id,
        operator,
        extraDetails: { listName: DEFAULT_NAME, isDefault: true },
      });
      return created;
    });
  }

  static async followDefault(ownerId, volunteerId, operator, { note } = {}) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const list = await this.ensureDefaultList(ownerId, operator);
    return this.addMemberToList(ownerId, list.id, volunteerId, operator, { note });
  }

  static async unfollowDefault(ownerId, volunteerId, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const list = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: DEFAULT_NAME } },
    });
    if (!list) return { removed: false };
    return this.removeMemberFromList(ownerId, list.id, volunteerId, operator);
  }

  // ─── reads ────────────────────────────────────────────────────────────────

  static async listMine(ownerId) {
    if (!ownerId) return [];
    const rows = await prisma.volunteerList.findMany({
      where: { ownerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        members: {
          orderBy: { addedAt: 'desc' },
          include: { volunteer: { include: { department: true } } },
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
   * Distinct owners (volunteer accounts) that have this volunteer in any of
   * their lists.  Replaces the v3-wave-3 listId-count which over-counted
   * once multi-list shipped.
   */
  static async followerCount(volunteerId) {
    const rows = await prisma.volunteerListMember.findMany({
      where: { volunteerId },
      select: { list: { select: { ownerId: true } } },
    });
    const owners = new Set(rows.map((r) => r.list.ownerId));
    return owners.size;
  }

  // ─── list CRUD ────────────────────────────────────────────────────────────

  static async createList(ownerId, rawName, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const v = validateName(rawName);
    if (v.error) return { validationError: v.error };

    const dup = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: v.name } },
    });
    if (dup) return { validationError: `已存在同名 list：${v.name}` };

    return prisma.$transaction(async (tx) => {
      const created = await tx.volunteerList.create({
        data: { ownerId, name: v.name, isDefault: false },
      });
      await writeAudit(tx, 'list_create', {
        targetId: created.id,
        operator,
        extraDetails: { listName: v.name, isDefault: false },
      });
      return { list: created };
    });
  }

  static async renameList(ownerId, listId, rawName, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const v = validateName(rawName);
    if (v.error) return { validationError: v.error };

    const list = await prisma.volunteerList.findUnique({ where: { id: listId } });
    if (!list || list.ownerId !== ownerId) return { notFound: 'list 不存在' };
    if (list.isDefault) return { validationError: '默认 list 不能改名' };
    if (list.name === v.name) return { list };

    const dup = await prisma.volunteerList.findUnique({
      where: { ownerId_name: { ownerId, name: v.name } },
    });
    if (dup) return { validationError: `已存在同名 list：${v.name}` };

    return prisma.$transaction(async (tx) => {
      const updated = await tx.volunteerList.update({
        where: { id: listId },
        data: { name: v.name },
      });
      await writeAudit(tx, 'list_rename', {
        targetId: listId,
        operator,
        extraDetails: { from: list.name, to: v.name },
      });
      return { list: updated };
    });
  }

  static async deleteList(ownerId, listId, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const list = await prisma.volunteerList.findUnique({ where: { id: listId } });
    if (!list || list.ownerId !== ownerId) return { notFound: 'list 不存在' };
    if (list.isDefault) return { validationError: '默认 list 不能删除' };

    return prisma.$transaction(async (tx) => {
      // Cascade configured on schema (onDelete: Cascade).
      await tx.volunteerList.delete({ where: { id: listId } });
      await writeAudit(tx, 'list_delete', {
        targetId: listId,
        operator,
        extraDetails: { listName: list.name },
      });
      return { deleted: true };
    });
  }

  // ─── member CRUD ──────────────────────────────────────────────────────────

  static async addMemberToList(ownerId, listId, volunteerId, operator, { note } = {}) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const noteV = validateNote(note);
    if (noteV.error) return { validationError: noteV.error };

    const list = await prisma.volunteerList.findUnique({ where: { id: listId } });
    if (!list || list.ownerId !== ownerId) return { notFound: 'list 不存在' };

    const target = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    if (!target) return { validationError: `志愿者不存在: ${volunteerId}` };

    const existing = await prisma.volunteerListMember.findUnique({
      where: { listId_volunteerId: { listId, volunteerId } },
    });
    if (existing) {
      return { list, member: existing, alreadyMember: true };
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.volunteerListMember.create({
        data: { listId, volunteerId, note: noteV.note },
      });
      await writeAudit(tx, 'list_member_add', {
        targetId: listId,
        modifiedId: volunteerId,
        operator,
        extraDetails: {
          listName: list.name,
          volunteerCode: target.volunteerCode,
          volunteerName: target.chineseName,
        },
      });
      return row;
    });
    return { list, member: created, alreadyMember: false };
  }

  static async removeMemberFromList(ownerId, listId, volunteerId, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const list = await prisma.volunteerList.findUnique({ where: { id: listId } });
    if (!list || list.ownerId !== ownerId) return { notFound: 'list 不存在' };

    const existing = await prisma.volunteerListMember.findUnique({
      where: { listId_volunteerId: { listId, volunteerId } },
    });
    if (!existing) return { removed: false };

    await prisma.$transaction(async (tx) => {
      await tx.volunteerListMember.delete({ where: { id: existing.id } });
      await writeAudit(tx, 'list_member_remove', {
        targetId: listId,
        modifiedId: volunteerId,
        operator,
        extraDetails: { listName: list.name },
      });
    });
    return { removed: true };
  }

  static async updateMemberNote(ownerId, listId, volunteerId, rawNote, operator) {
    if (!ownerId) return { forbidden: '需要志愿者身份' };
    const noteV = validateNote(rawNote);
    if (noteV.error) return { validationError: noteV.error };

    const list = await prisma.volunteerList.findUnique({ where: { id: listId } });
    if (!list || list.ownerId !== ownerId) return { notFound: 'list 不存在' };

    const existing = await prisma.volunteerListMember.findUnique({
      where: { listId_volunteerId: { listId, volunteerId } },
    });
    if (!existing) return { notFound: '成员不在该 list' };

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.volunteerListMember.update({
        where: { id: existing.id },
        data: { note: noteV.note },
      });
      await writeAudit(tx, 'list_member_note_update', {
        targetId: listId,
        modifiedId: volunteerId,
        operator,
        extraDetails: { listName: list.name, from: existing.note, to: noteV.note },
      });
      return row;
    });
    return { member: updated };
  }
}

export default VolunteerListService;
