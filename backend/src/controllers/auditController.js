// src/controllers/auditController.js — v2.1
import AuditService from '../services/AuditService.js';

const ok = (res, data) => res.status(200).json({ success: true, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

class AuditController {
  static async getAuditLogs(req, res) {
    try {
      const filters = {
        targetType: req.query.targetType,
        targetId: req.query.targetId,
        modifiedId: req.query.modifiedId,
        action: req.query.action,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      };
      const pagination = { page: req.query.page || 1, limit: req.query.limit || 20 };
      const sortOptions = { sortBy: req.query.sortBy || 'timestamp', order: req.query.order || 'desc' };
      const result = await AuditService.getAuditLogs(filters, pagination, sortOptions);
      return ok(res, result);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async getAuditLogById(req, res) {
    try {
      const data = await AuditService.getAuditLogById(req.params.auditId);
      return ok(res, data);
    } catch (err) {
      const code = err.message.includes('不存在') ? 404 : 500;
      return fail(res, code, err.message);
    }
  }

  static async getTargetAuditHistory(req, res) {
    try {
      const data = await AuditService.getTargetAuditHistory(req.params.targetType, req.params.targetId);
      return ok(res, data);
    } catch (err) {
      const code = err.message.includes('无效') ? 400 : 500;
      return fail(res, code, err.message);
    }
  }

  static async getAuditStatistics(req, res) {
    try {
      const data = await AuditService.getAuditStatistics({
        action: req.query.action,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default AuditController;
