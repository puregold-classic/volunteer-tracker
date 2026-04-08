// src/services/DepartmentService.js — v2.1
//
// Department is reference data: 10 fixed organizational units, seeded once
// and changed rarely. CRUD is admin-only. Most callers just read the list.

import prisma from '../utils/prismaClient.js';
import { serializeDepartment } from '../utils/serializer.js';

class DepartmentService {
  /** List all departments ordered by displayOrder. */
  static async listAll() {
    const rows = await prisma.department.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map(serializeDepartment);
  }

  static async findById(id) {
    const row = await prisma.department.findUnique({ where: { id } });
    return row ? serializeDepartment(row) : null;
  }

  /**
   * Admin-only: create a new department. Used by seed and (rarely) manual additions.
   * id, name, and displayOrder must all be unique.
   */
  static async create({ id, name, displayOrder }) {
    if (!id || !name || displayOrder == null) {
      return { validationError: 'id, name, displayOrder 均为必填' };
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(id)) {
      return { validationError: 'id 必须是大写字母/数字/下划线（如 BY_PROJECT）' };
    }
    try {
      const created = await prisma.department.create({
        data: { id, name, displayOrder },
      });
      return { department: serializeDepartment(created) };
    } catch (err) {
      if (err.code === 'P2002') {
        return { conflict: `已存在: ${err.meta?.target?.join(', ') || ''}` };
      }
      throw err;
    }
  }

  static async update(id, { name, displayOrder }) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return { notFound: true };

    const data = {};
    if (name !== undefined) data.name = name;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (Object.keys(data).length === 0) return { department: serializeDepartment(existing) };

    try {
      const updated = await prisma.department.update({ where: { id }, data });
      return { department: serializeDepartment(updated) };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '名称或顺序冲突' };
      throw err;
    }
  }

  /**
   * Refuses to delete a department that has volunteers or service items
   * (the FK ON DELETE RESTRICT enforces this at DB level too — we surface
   * a friendly error instead of letting Prisma throw).
   */
  static async remove(id) {
    const counts = await prisma.$transaction([
      prisma.volunteer.count({ where: { departmentId: id } }),
      prisma.serviceItem.count({ where: { departmentId: id } }),
    ]);
    const [volunteerCount, itemCount] = counts;
    if (volunteerCount > 0 || itemCount > 0) {
      return { inUse: { volunteers: volunteerCount, serviceItems: itemCount } };
    }
    try {
      await prisma.department.delete({ where: { id } });
      return { deleted: true };
    } catch (err) {
      if (err.code === 'P2025') return { notFound: true };
      throw err;
    }
  }
}

export default DepartmentService;
