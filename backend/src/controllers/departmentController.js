// src/controllers/departmentController.js — v2.1
import DepartmentService from '../services/DepartmentService.js';

const ok = (res, data, message) => res.status(200).json({ success: true, message, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

class DepartmentController {
  static async list(req, res) {
    try {
      const data = await DepartmentService.listAll();
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async getById(req, res) {
    try {
      const data = await DepartmentService.findById(req.params.id);
      if (!data) return fail(res, 404, '部门不存在');
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async create(req, res) {
    try {
      const result = await DepartmentService.create(req.body);
      if (result.validationError) return fail(res, 400, result.validationError);
      if (result.conflict) return fail(res, 409, result.conflict);
      return res.status(201).json({ success: true, data: result.department });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async update(req, res) {
    try {
      const result = await DepartmentService.update(req.params.id, req.body);
      if (result.notFound) return fail(res, 404, '部门不存在');
      if (result.conflict) return fail(res, 409, result.conflict);
      return ok(res, result.department, '更新成功');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async remove(req, res) {
    try {
      const result = await DepartmentService.remove(req.params.id);
      if (result.notFound) return fail(res, 404, '部门不存在');
      if (result.inUse) {
        return fail(res, 409, `部门正在使用：${result.inUse.volunteers} 个志愿者，${result.inUse.serviceItems} 个服务项`);
      }
      return ok(res, null, '删除成功');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default DepartmentController;
