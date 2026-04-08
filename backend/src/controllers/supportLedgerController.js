// src/controllers/supportLedgerController.js — v2.1
//
// Read-only admin ledger ("项目支援台账"). Replaces the v1 ReviewController.

import SupportLedgerService from '../services/SupportLedgerService.js';

const ok = (res, data) => res.status(200).json({ success: true, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

class SupportLedgerController {
  static async overview(req, res) {
    try {
      const data = await SupportLedgerService.overview({
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        departmentId: req.query.departmentId,
      });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async timeSeries(req, res) {
    try {
      const months = parseInt(req.query.months || '12', 10);
      const data = await SupportLedgerService.timeSeries({ months });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async proxyContributions(req, res) {
    try {
      const data = await SupportLedgerService.proxyContributions({
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async recentActivity(req, res) {
    try {
      const data = await SupportLedgerService.recentActivity({
        limit: parseInt(req.query.limit || '50', 10),
        action: req.query.action,
      });
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async volunteerDetail(req, res) {
    try {
      const data = await SupportLedgerService.volunteerDetail(req.params.volunteerId);
      return ok(res, data);
    } catch (err) {
      const code = err.message.includes('不存在') ? 404 : 500;
      return fail(res, code, err.message);
    }
  }
}

export default SupportLedgerController;
