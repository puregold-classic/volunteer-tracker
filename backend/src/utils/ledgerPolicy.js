export class LedgerError extends Error {
  constructor(status, message, details = undefined) { super(message); this.status = status; this.details = details; }
}
export const requireLedgerManager = (op) => {
  if (!op?.accountId || !['admin', 'b_admin', 'a_admin'].includes(op.role)) throw new LedgerError(403, '需要培训管理权限');
  if (op.role === 'a_admin' && !op.departmentId) throw new LedgerError(403, '无法确定所属部门');
};
export const volunteerScope = (op) => op.role === 'a_admin' ? { departmentId: op.departmentId || '__none__' } : {};
export const canManageVolunteer = (op, volunteer) => ['admin', 'b_admin'].includes(op?.role)
  || (op?.role === 'a_admin' && !!op.departmentId && volunteer.departmentId === op.departmentId);
export function businessDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new LedgerError(400, '日期须为 YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new LedgerError(400, '日期无效');
  return date;
}
export async function assertUnlocked(tx, op, ...dates) {
  if (op.role === 'admin') return;
  const settings = await tx.systemSettings.findUnique({ where: { id: 1 } });
  if (settings?.lockedBefore && dates.some((d) => new Date(d) < settings.lockedBefore)) throw new LedgerError(423, '该日期所在的统计周期已封档，无法变更');
}
export async function ledgerTransaction(db, work) {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: 'Serializable', timeout: 60000 }); }
    catch (error) {
      if (error.code === 'P2034' && attempt < 3) continue;
      if (['P2034', 'P2002'].includes(error.code)) throw new LedgerError(409, '数据已发生变化，请刷新后重试；你的输入可以保留');
      throw error;
    }
  }
}
