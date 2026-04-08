// src/controllers/serviceItemController.js — v2.1
import ServiceItemService from '../services/ServiceItemService.js';

const ok = (res, data, message) => res.status(200).json({ success: true, message, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

class ServiceItemController {
  static async list(req, res) {
    try {
      const data = await ServiceItemService.listAll({
        departmentId: req.query.departmentId,
        includeInactive: req.query.includeInactive === 'true',
      });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async listGrouped(req, res) {
    try {
      const data = await ServiceItemService.listGroupedByDepartment();
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async getById(req, res) {
    try {
      const data = await ServiceItemService.findById(req.params.id);
      if (!data) return fail(res, 404, '服务项不存在');
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async create(req, res) {
    try {
      const result = await ServiceItemService.create(req.body);
      if (result.validationError) return fail(res, 400, result.validationError);
      if (result.conflict) return fail(res, 409, result.conflict);
      return res.status(201).json({ success: true, data: result.serviceItem });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async update(req, res) {
    try {
      const result = await ServiceItemService.update(req.params.id, req.body);
      if (result.notFound) return fail(res, 404, '服务项不存在');
      if (result.validationError) return fail(res, 400, result.validationError);
      if (result.conflict) return fail(res, 409, result.conflict);
      return ok(res, result.serviceItem, '更新成功');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async remove(req, res) {
    try {
      const result = await ServiceItemService.remove(req.params.id);
      if (result.notFound) return fail(res, 404, '服务项不存在');
      if (result.softDisabled) {
        return ok(res, result.serviceItem, '已存在历史记录，已软禁用而非删除');
      }
      return ok(res, null, '删除成功');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default ServiceItemController;
