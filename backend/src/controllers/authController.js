import * as AuthService from '../services/AuthService.js';

class AuthController {
  static async register(req, res) {
    try {
      const result = await AuthService.register(req.body);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'email、password、name为必填字段' });
      if (result.weakPassword) return res.status(400).json({ success: false, error: '密码长度至少8位' });
      if (result.emailTaken) return res.status(409).json({ success: false, error: '邮箱已被注册' });
      if (result.volunteerNotFound) return res.status(400).json({ success: false, error: 'volunteerId不存在' });
      if (result.volunteerBound) return res.status(409).json({ success: false, error: `该volunteerId已绑定账号: ${result.volunteerBound}` });
      return res.status(201).json({ success: true, message: '注册成功', data: result.account });
    } catch (error) {
      return res.status(500).json({ success: false, error: '注册失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async createAccountByAdmin(req, res) {
    try {
      const result = await AuthService.createAccountByAdmin(req.body);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'email、password、name为必填字段' });
      if (result.weakPassword) return res.status(400).json({ success: false, error: '密码长度至少8位' });
      if (result.invalidRole) return res.status(400).json({ success: false, error: 'role必须是: user, b_admin, a_admin, admin' });
      if (result.emailTaken) return res.status(409).json({ success: false, error: '邮箱已被注册' });
      if (result.volunteerNotFound) return res.status(400).json({ success: false, error: 'volunteerId不存在' });
      if (result.volunteerBound) return res.status(409).json({ success: false, error: `该volunteerId已绑定账号: ${result.volunteerBound}` });
      return res.status(201).json({ success: true, message: '账号创建成功', data: result.account });
    } catch (error) {
      return res.status(500).json({ success: false, error: '创建账号失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async login(req, res) {
    try {
      const result = await AuthService.login(req.body);
      if (result.missingFields) return res.status(400).json({ success: false, error: 'email和password为必填字段' });
      if (result.invalidCredentials) return res.status(401).json({ success: false, error: '邮箱或密码错误' });
      return res.status(200).json({ success: true, message: '登录成功', data: { token: result.token, account: result.account } });
    } catch (error) {
      return res.status(500).json({ success: false, error: '登录失败', detail: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }

  static async me(req, res) {
    try {
      const account = await AuthService.getMe(req.user.accountId);
      if (!account) return res.status(401).json({ success: false, error: '账号不存在或已停用' });
      return res.status(200).json({ success: true, data: account });
    } catch (error) {
      return res.status(500).json({ success: false, error: '获取当前账号失败' });
    }
  }

  static async logout(req, res) {
    return res.status(200).json({ success: true, message: '已登出（客户端请删除token）' });
  }
}

export default AuthController;
