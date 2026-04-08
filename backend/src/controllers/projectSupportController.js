// src/controllers/projectSupportController.js — v2.1
import ProjectSupportService from '../services/ProjectSupportService.js';

const ok = (res, data, message) => res.status(200).json({ success: true, message, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

const handleResult = (res, result, successMessage = '操作成功', successCode = 200) => {
  if (result.notFound) return fail(res, 404, '记录不存在');
  if (result.forbidden) return fail(res, 403, result.forbidden);
  if (result.locked) return fail(res, 423, result.locked);
  if (result.duplicate) return fail(res, 409, result.duplicate);
  if (result.validationError) return fail(res, 400, result.validationError);
  if (result.invalidStatus) return fail(res, 409, result.invalidStatus);
  return res.status(successCode).json({ success: true, message: successMessage, data: result.record });
};

class ProjectSupportController {
  static async list(req, res) {
    try {
      const filters = {
        volunteerId: req.query.volunteerId,
        submittedById: req.query.submittedById,
        serviceItemId: req.query.serviceItemId,
        departmentId: req.query.departmentId,
        status: req.query.status,
        serviceDateFrom: req.query.serviceDateFrom,
        serviceDateTo: req.query.serviceDateTo,
        minDuration: req.query.minDuration,
        maxDuration: req.query.maxDuration,
        search: req.query.search,
      };
      const pagination = { page: req.query.page, limit: req.query.limit };
      const sort = { sortBy: req.query.sortBy, order: req.query.order };
      const result = await ProjectSupportService.list(filters, pagination, sort);
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async getBySupportId(req, res) {
    try {
      const data = await ProjectSupportService.findBySupportId(req.params.supportId);
      return ok(res, data);
    } catch (err) {
      const code = err.message.includes('不存在') ? 404 : 500;
      return fail(res, code, err.message);
    }
  }

  /**
   * GET /me/pending — pending proxy submissions awaiting current user's confirmation
   */
  static async listPendingForMe(req, res) {
    try {
      if (!req.user?.volunteerId) return fail(res, 403, '没有绑定 volunteer');
      const data = await ProjectSupportService.listPendingForOwner(req.user.volunteerId);
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async create(req, res) {
    try {
      // Default volunteerId to the operator's own when not provided
      const input = {
        ...req.body,
        volunteerId: req.body.volunteerId || req.user?.volunteerId,
      };
      const result = await ProjectSupportService.create(input, req.user);
      return handleResult(res, result, '记录创建成功', 201);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async update(req, res) {
    try {
      const result = await ProjectSupportService.update(req.params.supportId, req.body, req.user);
      return handleResult(res, result, '记录更新成功');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async remove(req, res) {
    try {
      const result = await ProjectSupportService.remove(req.params.supportId, req.user);
      return handleResult(res, result, '记录已删除');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async confirm(req, res) {
    try {
      const result = await ProjectSupportService.confirm(req.params.supportId, req.user);
      return handleResult(res, result, '已确认');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async reject(req, res) {
    try {
      const result = await ProjectSupportService.reject(req.params.supportId, req.user, { reason: req.body?.reason });
      return handleResult(res, result, '已拒绝');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default ProjectSupportController;
