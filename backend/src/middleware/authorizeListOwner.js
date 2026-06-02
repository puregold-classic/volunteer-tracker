// src/middleware/authorizeListOwner.js — v3.4 (opened to all volunteers in v3.5)
//
// Volunteer list 是「志愿者身份」上的私有数据（关注谁、代提交工作区），所以
// gate 的本质是「有没有绑定 Volunteer」，而不是角色高低：
// - user / a_admin / b_admin — 都有 volunteerId，通过（每人只能管自己的 list，
//   服务层按 ownerId 防越权）
// - admin（纯系统 admin，volunteerId = null）— list 对它无意义，拒绝；它走 AdminCenter
//
// 原 v3.4 把 list 限定在 a_admin / b_admin，v3.5 放开给普通志愿者关注别人。

export const authorizeListOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未登录', code: 'UNAUTHORIZED' });
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
