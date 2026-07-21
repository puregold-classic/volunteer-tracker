// src/utils/deptScope.js — v3.8
//
// 部长（dept head，role='a_admin'）的**部门作用域**鉴权。
// v3.7 把 a_admin≡b_admin 当"录入员"；v3.8 分化：b_admin 留作录入员（全局录入），
// a_admin 升成**部长**——像 admin 一样的人事 + 本部门台账写权，但每个操作都限在
// **自己部门**。部长的管辖部门 = 他志愿者档案的 departmentId（authenticate 已放进
// req.user.departmentId）。
//
// 三档：
//   - admin       : 全局，任何部门
//   - a_admin(部长): 仅自己部门（operator.departmentId === 目标部门）
//   - 其他         : 无此类权限

export const isSystemAdmin = (op) => op?.role === 'admin';
export const isDeptHead = (op) => op?.role === 'a_admin';

// 能做"人事/账号管理"（建号、设角色、停用、重置密码）的：admin 或 部长
export const canManagePersonnel = (op) => isSystemAdmin(op) || isDeptHead(op);

/**
 * 作用域检查：op 能否对 targetDepartmentId 这个部门的目标（人/记录）动手。
 * 返回 null = 允许；否则返回 { forbidden }。
 */
export const assertDeptScope = (op, targetDepartmentId) => {
  if (isSystemAdmin(op)) return null; // admin 全局
  if (isDeptHead(op)) {
    if (!op.departmentId) return { forbidden: '部长账号未绑定部门，无法确定管辖范围' };
    if (op.departmentId !== targetDepartmentId) return { forbidden: '部长只能操作本部门的成员/记录' };
    return null;
  }
  return { forbidden: '无此操作权限' };
};

// 部长可授予的角色（不能设 admin / 部长本身，防跨界提权）
export const DEPT_HEAD_ASSIGNABLE_ROLES = ['user', 'b_admin'];

// 列表类查询的部门过滤：admin → null(不过滤)；部长 → 本部门 id
export const personnelDeptFilter = (op) => (isDeptHead(op) ? op.departmentId : null);
