// src/middleware/authorizeReviewer.js — v2.1
//
// Reviewer = anyone with elevated role (b_admin / a_admin / admin) for the
// purposes of cross-volunteer ledger operations and proxy confirmations.
// Under v2.1 admin may have null volunteerId, so we no longer reject that.
//
// Sets req.reviewer = {id (cuid), volunteerId, name, role} on success.

const REVIEWER_ROLES = ['admin', 'a_admin', 'b_admin'];

export const authorizeReviewer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: '未登录', code: 'UNAUTHORIZED' });
  }
  if (!REVIEWER_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: '没有审核权限',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRoles: REVIEWER_ROLES,
      currentRole: req.user.role,
    });
  }
  req.reviewer = {
    id: req.user.accountId,
    volunteerId: req.user.volunteerId || null,
    name: req.user.name || req.user.email,
    role: req.user.role,
  };
  return next();
};
