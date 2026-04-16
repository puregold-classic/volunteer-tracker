// src/services/ServiceItemService.js — v2.1
//
// ServiceItem is reference data scoped to a Department. ~50 fixed items
// seeded once. Lookup pattern is "items in department X" or "by id".

import prisma from '../utils/prismaClient.js';
import { serializeServiceItem } from '../utils/serializer.js';

class ServiceItemService {
  /** List all active items, optionally filtered by department. */
  static async listAll({ departmentId, includeInactive = false } = {}) {
    const where = {};
    if (departmentId) where.departmentId = departmentId;
    if (!includeInactive) where.isActive = true;

    const rows = await prisma.serviceItem.findMany({
      where,
      include: { department: true },
      orderBy: [
        { department: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
      ],
    });
    return rows.map(serializeServiceItem);
  }

  /** List items grouped by department. Useful for the form dropdown. */
  static async listGroupedByDepartment() {
    const departments = await prisma.department.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        serviceItems: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    return departments.map((d) => ({
      department: { id: d.id, name: d.name, displayOrder: d.displayOrder },
      items: d.serviceItems.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        displayOrder: s.displayOrder,
      })),
    }));
  }

  static async findById(id) {
    const row = await prisma.serviceItem.findUnique({
      where: { id },
      include: { department: true },
    });
    return row ? serializeServiceItem(row) : null;
  }

  static async create({ departmentId, name, displayOrder }) {
    if (!departmentId || !name || displayOrder == null) {
      return { validationError: 'departmentId, name, displayOrder 均为必填' };
    }
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return { validationError: `部门不存在: ${departmentId}` };

    try {
      const created = await prisma.serviceItem.create({
        data: { departmentId, name, displayOrder },
        include: { department: true },
      });
      return { serviceItem: serializeServiceItem(created) };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '该部门下已存在同名服务项' };
      throw err;
    }
  }

  static async update(id, { name, displayOrder, isActive }) {
    const existing = await prisma.serviceItem.findUnique({ where: { id } });
    if (!existing) return { notFound: true };

    const data = {};
    if (name !== undefined) data.name = name;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (Object.keys(data).length === 0) return { serviceItem: serializeServiceItem(existing) };

    try {
      const updated = await prisma.serviceItem.update({
        where: { id },
        data,
        include: { department: true },
      });
      return { serviceItem: serializeServiceItem(updated) };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '该部门下已存在同名服务项' };
      throw err;
    }
  }

  /**
   * Soft-disable a service item by setting isActive=false. Hard delete is
   * refused if there are existing ProjectSupport records (FK RESTRICT).
   */
  static async remove(id) {
    const supportCount = await prisma.projectSupport.count({ where: { serviceItemId: id } });
    if (supportCount > 0) {
      // Soft-disable instead — audit history must be preserved
      const updated = await prisma.serviceItem.update({
        where: { id },
        data: { isActive: false },
      });
      return { softDisabled: true, serviceItem: serializeServiceItem(updated) };
    }
    try {
      await prisma.serviceItem.delete({ where: { id } });
      return { deleted: true };
    } catch (err) {
      if (err.code === 'P2025') return { notFound: true };
      throw err;
    }
  }
}

export default ServiceItemService;
