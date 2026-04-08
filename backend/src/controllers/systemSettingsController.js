// src/controllers/systemSettingsController.js — v2.1
import SystemSettingsService from '../services/SystemSettingsService.js';
import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';

const ok = (res, data, message) => res.status(200).json({ success: true, message, data });
const fail = (res, code, error) => res.status(code).json({ success: false, error });

class SystemSettingsController {
  static async get(req, res) {
    try {
      const data = await SystemSettingsService.get();
      return ok(res, data);
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  /**
   * Set the lockedBefore date ("封档至 X"). Admin / a_admin only — route guard
   * enforces this; we still write a month_lock audit log here.
   */
  static async setLockedBefore(req, res) {
    try {
      const { lockedBefore, allowUnlock } = req.body;
      const operator = req.user;

      const result = await SystemSettingsService.setLockedBefore(lockedBefore, operator, { allowUnlock });
      if (result.validationError) return fail(res, 400, result.validationError);

      // Audit log
      await prisma.auditLog.create({
        data: {
          auditId: IDGenerator.generateAuditId(),
          targetType: 'SystemSettings',
          targetId: 'system_settings:1',
          action: 'month_lock',
          actionDetails: { lockedBefore: result.settings.lockedBefore },
          operator: { id: operator.accountId, name: operator.name, role: operator.role },
          submitter: { id: operator.accountId, name: operator.name, role: operator.role },
          changes: [],
        },
      });

      return ok(res, result.settings, '已更新封档日期');
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default SystemSettingsController;
