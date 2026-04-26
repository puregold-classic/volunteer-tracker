// src/middleware/authorizeListOwner.js — v3.4
//
// Volunteer list 系统限定 a_admin / b_admin 使用：
// - user        — 无权访问任何 list 端点
// - admin       — 纯系统 admin 没有 volunteerId，list 是志愿者工作区，跳过
// - a_admin     — 通过
// - b_admin     — 通过
//
// 这是 v3.4 新增的硬 gate.  比 authorizeReviewer 更严（后者也允许 admin），
// 因为 list 是「志愿者身份」上的私有数据，没有 Volunteer FK 就没意义.

const ALLOWED = ['a_admin', 'b_admin'];

export const authorizeListOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未登录', code: 'UNAUTHORIZED' });
  }
  if (!ALLOWED.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'list 仅向 a_admin / b_admin 开放',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRoles: ALLOWED,
      currentRole: req.user.role,
    });
  }
  if (!req.user.volunteerId) {
    return res.status(403).json({
      success: false,
      error: 'list 需要绑定 volunteer 身份',
      code: 'NO_VOLUNTEER_BINDING',
    });
  }
  return next();
};
