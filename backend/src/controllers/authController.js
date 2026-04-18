// src/controllers/authController.js — v2.1
import * as AuthService from '../services/AuthService.js';

class AuthController {
  /**
   * Self-registration: claim a pre-existing volunteer by code + email.
   * Replaces v1's "register without volunteer" flow.
   */
  static async register(req, res) {
    try {
      const result = await AuthService.register(req.body);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'email、password、name、volunteerCode 为必填' });
      if (result.weakPassword) return res.status(400).json({ success: false, error: '密码长度至少 8 位' });
      if (result.emailTaken) return res.status(409).json({ success: false, error: '邮箱已被注册' });
      if (result.volunteerNotFound) return res.status(404).json({ success: false, error: 'volunteerCode 不存在' });
      if (result.volunteerBound) return res.status(409).json({ success: false, error: `该 volunteer 已绑定账号: ${result.volunteerBound}` });
      return res.status(201).json({ success: true, message: '注册成功', data: result.account });
    } catch (err) {
      return res.status(500).json({ success: false, error: '注册失败', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }

  static async login(req, res) {
    try {
      const result = await AuthService.login(req.body);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'email 和 password 为必填' });
      if (result.invalidCredentials) return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      return res.status(200).json({ success: true, message: '登录成功', data: { token: result.token, account: result.account } });
    } catch (err) {
      return res.status(500).json({ success: false, error: '登录失败', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }

  static async me(req, res) {
    try {
      const account = await AuthService.getMe(req.user.accountId);
      if (!account) return res.status(401).json({ success: false, error: '账号不存在或已停用' });
      return res.status(200).json({ success: true, data: account });
    } catch (err) {
      return res.status(500).json({ success: false, error: '获取当前账号失败' });
    }
  }

  static async logout(req, res) {
    try {
      await AuthService.logout(req.user.accountId);
      return res.status(200).json({ success: true, message: '已登出' });
    } catch (err) {
      return res.status(500).json({ success: false, error: '登出失败' });
    }
  }

  // ─── v3.2: account self-service ──────────────────────────────────────────

  static async changePassword(req, res) {
    try {
      const result = await AuthService.changePassword(req.user.accountId, req.body, req.user);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'currentPassword 和 newPassword 为必填' });
      if (result.weakPassword) return res.status(400).json({ success: false, error: '新密码长度至少 8 位' });
      if (result.sameAsCurrent) return res.status(400).json({ success: false, error: '新密码不能与当前密码一致' });
      if (result.notFound) return res.status(404).json({ success: false, error: '账号不存在' });
      if (result.invalidCurrent) return res.status(401).json({ success: false, error: '当前密码错误' });
      return res.status(200).json({ success: true, message: '密码已更新，请重新登录' });
    } catch (err) {
      return res.status(500).json({ success: false, error: '修改密码失败', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }

  static async adminResetPassword(req, res) {
    try {
      const { accountId } = req.params;
      const result = await AuthService.adminResetPassword(accountId, req.body, req.user);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'newPassword 为必填' });
      if (result.weakPassword) return res.status(400).json({ success: false, error: '新密码长度至少 8 位' });
      if (result.notFound) return res.status(404).json({ success: false, error: '目标账号不存在' });
      return res.status(200).json({ success: true, message: '密码已重置，对方已登出' });
    } catch (err) {
      return res.status(500).json({ success: false, error: '重置密码失败', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }

  static async updateAvatar(req, res) {
    try {
      const volunteerId = req.user.volunteerId;
      if (!volunteerId) return res.status(400).json({ success: false, error: '当前账号未绑定志愿者，无法设置头像' });
      const result = await AuthService.updateAvatar(volunteerId, req.body, req.user);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'avatar 为必填（data-URL 或 URL）' });
      if (result.tooLarge) return res.status(413).json({ success: false, error: '头像数据过大（>512KB），请压缩后再上传' });
      if (result.invalidFormat) return res.status(400).json({ success: false, error: '仅支持 png/jpeg/gif/webp 图片' });
      if (result.notFound) return res.status(404).json({ success: false, error: '志愿者不存在' });
      return res.status(200).json({ success: true, message: '头像已更新' });
    } catch (err) {
      return res.status(500).json({ success: false, error: '更新头像失败', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }
}

export default AuthController;
