// src/controllers/adminController.js — v2.1
//
// Thin wrapper over AdminService + AccountService for the admin-facing APIs.

import * as AdminService from '../services/AdminService.js';
import * as AccountService from '../services/AccountService.js';

const fail = (res, code, error) => res.status(code).json({ success: false, error });

class AdminController {
  // ─── Account / Volunteer creation ───────────────────────────────────────

  static async createVolunteerAccount(req, res) {
    try {
      const result = await AccountService.createVolunteerAccount(req.body);
      if (result.validationError) return fail(res, 400, result.validationError);
      if (result.conflict) return fail(res, 409, result.conflict);
      return res.status(201).json({ success: true, message: '志愿者+账号创建成功', data: result });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async createAdminAccount(req, res) {
    try {
      const result = await AccountService.createAdminAccount(req.body);
      if (result.validationError) return fail(res, 400, result.validationError);
      if (result.conflict) return fail(res, 409, result.conflict);
      return res.status(201).json({ success: true, message: 'admin 账号创建成功', data: result.account });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  // ─── Account management ────────────────────────────────────────────────

  static async listAccounts(req, res) {
    try {
      const accounts = await AccountService.listAccounts();
      return res.status(200).json({ success: true, data: accounts });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async updateAccount(req, res) {
    try {
      const result = await AccountService.updateAccount(req.params.accountId, req.body, req.user.accountId);
      if (result.notFound) return fail(res, 404, '账号不存在');
      if (result.selfEdit) return fail(res, 400, '不能修改自身账号');
      if (result.invalidRole) return fail(res, 400, 'role 必须是: user / b_admin / a_admin / admin');
      if (result.lastAdmin) return fail(res, 400, '系统至少需要保留一个 admin 账号');
      if (result.emailTaken) return fail(res, 409, '邮箱已被其他账号占用');
      if (result.validationError) return fail(res, 400, result.validationError);
      return res.status(200).json({ success: true, data: result.account });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async deleteAccount(req, res) {
    try {
      const result = await AccountService.deleteAccount(req.params.accountId, req.user.accountId);
      if (result.notFound) return fail(res, 404, '账号不存在');
      if (result.selfDelete) return fail(res, 400, '不能删除自身账号');
      if (result.lastAdmin) return fail(res, 400, '不能删除最后一个 admin');
      return res.status(200).json({ success: true, message: '账号已删除', data: result });
    } catch (err) {
      return fail(res, err.message?.includes('请先处理') ? 409 : 500, err.message);
    }
  }

  // ─── Bulk operations ───────────────────────────────────────────────────

  static async importVolunteersCsv(req, res) {
    try {
      const result = await AdminService.importVolunteersCsv(req.body);
      if (result.noData) return fail(res, 400, '未提供可导入数据');
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  // v3.7: 提交前逐行 dry-run 校验（不写库）
  static async validateVolunteersCsv(req, res) {
    try {
      const result = await AdminService.validateVolunteersCsv(req.body);
      if (result.noData) return fail(res, 400, '未提供可校验数据');
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }

  static async resetSystem(req, res) {
    try {
      const result = await AdminService.resetToSystemAdmin(req.body);
      if (result.invalidConfirm) return fail(res, 400, '请提供 confirm=RESET 以确认清空数据');
      if (result.error) return fail(res, 500, result.error);
      return res.status(200).json({ success: true, message: '系统已重置', data: result });
    } catch (err) {
      return fail(res, 500, err.message);
    }
  }
}

export default AdminController;
