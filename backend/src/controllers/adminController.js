import * as AdminService from '../services/AdminService.js';

class AdminController {
  static async resetToSystemAdmin(req, res) {
    try {
      const result = await AdminService.resetToSystemAdmin(req.body);
      if (result.invalidConfirm) return res.status(400).json({ success: false, error: '请提供 confirm=RESET 以确认清空数据' });
      return res.status(200).json({ success: true, message: '系统数据已清空，仅保留系统管理员账号', data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: '重置失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async importVolunteers(req, res) {
    try {
      const result = await AdminService.importVolunteers(req.body);
      if (result.noData) return res.status(400).json({ success: false, error: '未提供可导入数据（rows或csvText）' });
      return res.status(200).json({ success: true, message: '导入完成', data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: '导入失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async createVolunteerWithAccount(req, res) {
    try {
      const result = await AdminService.createVolunteerWithAccount(req.body);
      if (result.validationError) return res.status(400).json({ success: false, error: result.validationError });
      return res.status(201).json({ success: true, message: '志愿者创建成功', data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: '创建志愿者失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async generateMissingAccounts(req, res) {
    try {
      const result = await AdminService.generateMissingAccounts(req.body);
      return res.status(200).json({ success: true, message: '已完成账号生成', data: result });
    } catch (error) {
      return res.status(500).json({ success: false, error: '生成账号失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async listAccounts(req, res) {
    try {
      const accounts = await AdminService.listAccounts();
      return res.status(200).json({ success: true, data: accounts });
    } catch (error) {
      return res.status(500).json({ success: false, error: '获取账号列表失败' });
    }
  }

  static async updateAccount(req, res) {
    try {
      const { accountId } = req.params;
      const result = await AdminService.updateAccount(accountId, req.body, req.user.accountId);
      if (result.notFound) return res.status(404).json({ success: false, error: '账号不存在' });
      if (result.selfEdit) return res.status(400).json({ success: false, error: '不能修改当前系统管理员自身账号' });
      if (result.invalidRole) return res.status(400).json({ success: false, error: 'role必须是: user, b_admin, a_admin, admin' });
      if (result.lastAdmin) return res.status(400).json({ success: false, error: '系统至少需要保留一个admin账号' });
      if (result.emailTaken) return res.status(409).json({ success: false, error: '邮箱已被其他账号占用' });
      return res.status(200).json({ success: true, message: '账号信息更新成功', data: result.account });
    } catch (error) {
      return res.status(500).json({ success: false, error: '更新账号信息失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const { accountId } = req.params;
      const result = await AdminService.deleteAccount(accountId, req.user.accountId);
      if (result.notFound) return res.status(404).json({ success: false, error: '账号不存在' });
      if (result.selfDelete) return res.status(400).json({ success: false, error: '不能删除当前系统管理员自身账号' });
      if (result.volunteerId) {
        return res.status(200).json({
          success: true, message: '账号及关联用户信息已删除',
          data: { accountId: result.accountId, volunteerId: result.volunteerId, deleted: result.deleted },
        });
      }
      return res.status(200).json({ success: true, message: '账号已删除', data: { accountId: result.accountId } });
    } catch (error) {
      return res.status(500).json({ success: false, error: '删除账号失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
}

export default AdminController;
