// frontend/src/components/AdminCenter/AdminCenter.tsx — v2.1
//
// Self-contained admin panel: account list + create-volunteer-account form
// + create-admin form + CSV import + reset system. Drops the v1
// "edit-volunteer-detail" panel and "generate-missing-accounts" button —
// neither has a v2.1 equivalent (volunteer creation is always atomic with
// account, edits go through chunk 6 redesign).

import { useEffect, useState } from 'react';
import authService, { AdminAccountItem } from '@services/authService';
import departmentService from '@services/departmentService';
import type { Department } from '@services/types';

interface AdminCenterProps {
  currentAccountId?: string;
}

const REGION_OPTIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他'] as const;
type RegionOption = (typeof REGION_OPTIONS)[number];

const AdminCenter: React.FC<AdminCenterProps> = ({ currentAccountId }) => {
  // ─── Top-level state ────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<AdminAccountItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ─── Create volunteer + account form ────────────────────────────────────
  const [vChineseName, setVChineseName] = useState('');
  const [vEnglishName, setVEnglishName] = useState('');
  const [vStatus, setVStatus] = useState<'在职' | '不在职'>('在职');
  const [vRegion, setVRegion] = useState<RegionOption>('其他');
  const [vProvince, setVProvince] = useState('');
  const [vDepartmentId, setVDepartmentId] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vAccountPassword, setVAccountPassword] = useState('Volunteer@123');
  const [vAccountRole, setVAccountRole] = useState<'user' | 'b_admin' | 'a_admin'>('user');

  // ─── Create admin form ──────────────────────────────────────────────────
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPassword, setAPassword] = useState('');

  // ─── CSV import ─────────────────────────────────────────────────────────
  const [csvText, setCsvText] = useState('');
  const [csvDefaultPassword, setCsvDefaultPassword] = useState('Volunteer@123');

  // ─── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountsRes, deptRes] = await Promise.all([
        authService.adminListAccounts(),
        departmentService.list(),
      ]);
      if (accountsRes?.success) setAccounts(accountsRes.data || []);
      else setError(accountsRes?.error || '加载账号列表失败');
      if (deptRes?.success) setDepartments(deptRes.data || []);
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // ─── Create volunteer + account ─────────────────────────────────────────
  const handleCreateVolunteer = async () => {
    if (!vChineseName.trim()) { setMessage('请填写中文姓名'); return; }
    if (!vDepartmentId) { setMessage('请选择部门'); return; }
    if (!vEmail.trim()) { setMessage('请填写邮箱'); return; }
    if (vAccountPassword.length < 8) { setMessage('密码至少 8 位'); return; }
    if (['中国大陆', '中国台湾'].includes(vRegion) && !vProvince.trim()) {
      setMessage(`${vRegion} 必须填写省份`);
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const result = await authService.adminCreateVolunteerAccount({
        volunteer: {
          chineseName: vChineseName.trim(),
          englishName: vEnglishName.trim() || vChineseName.trim(),
          status: vStatus,
          region: vRegion,
          province: vProvince.trim() || undefined,
          departmentId: vDepartmentId,
          email: vEmail.trim(),
          phone: vPhone.trim() || undefined,
        },
        account: {
          email: vEmail.trim(),
          password: vAccountPassword,
          name: vChineseName.trim(),
          role: vAccountRole,
        },
      });
      if (result?.success) {
        setMessage('志愿者+账号创建成功');
        setVChineseName(''); setVEnglishName(''); setVProvince('');
        setVEmail(''); setVPhone('');
        await refresh();
      } else {
        setMessage(result?.error || '创建失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Create admin ───────────────────────────────────────────────────────
  const handleCreateAdmin = async () => {
    if (!aName.trim() || !aEmail.trim() || aPassword.length < 8) {
      setMessage('admin 创建：姓名+邮箱必填，密码至少 8 位');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const result = await authService.adminCreateAdmin({
        name: aName.trim(),
        email: aEmail.trim(),
        password: aPassword,
      });
      if (result?.success) {
        setMessage('admin 账号创建成功');
        setAName(''); setAEmail(''); setAPassword('');
        await refresh();
      } else {
        setMessage(result?.error || '创建失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── CSV import ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!csvText.trim()) { setMessage('请先粘贴 CSV 数据'); return; }
    setSubmitting(true);
    setMessage('');
    try {
      const result = await authService.adminImportVolunteers({
        csvText: csvText.trim(),
        defaultPassword: csvDefaultPassword || 'Volunteer@123',
      });
      if (result?.success) {
        const data = (result.data as any) || {};
        setMessage(`导入完成：创建 ${data.created || 0}，跳过 ${data.skipped || 0}`);
        await refresh();
      } else {
        setMessage(result?.error || '导入失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete account ─────────────────────────────────────────────────────
  const handleDelete = async (accountId: string) => {
    if (!window.confirm('确认删除该账号及其关联志愿者？此操作不可撤销。')) return;
    setSubmitting(true);
    try {
      const result = await authService.adminDeleteAccount(accountId);
      if (result?.success) {
        setMessage('账号已删除');
        await refresh();
      } else {
        setMessage((result as any)?.error || '删除失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Reset system ───────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!window.confirm('⚠️ 确认清空所有业务数据？此操作不可撤销，仅保留 admin 账号。')) return;
    setSubmitting(true);
    try {
      const result = await authService.adminResetSystem();
      if (result?.success) {
        setMessage('系统数据已清空');
        await refresh();
      } else {
        setMessage((result as any)?.error || '重置失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '重置失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="center-empty">正在加载管理中心数据...</p>;

  return (
    <div className="admin-center">
      <div className="center-panel__head">
        <h2>系统管理中心</h2>
        <button type="button" className="filter-reset" onClick={refresh}>刷新数据</button>
      </div>

      {error && <p className="auth-form-error">{error}</p>}

      {/* Create volunteer + account */}
      <section className="nps-panel">
        <h3>新增志愿者 + 账号（v2.1 统一入口）</h3>
        <div className="admin-single-grid">
          <input type="text" value={vChineseName} onChange={(e) => setVChineseName(e.target.value)} placeholder="中文姓名 *" />
          <input type="text" value={vEnglishName} onChange={(e) => setVEnglishName(e.target.value)} placeholder="英文姓名" />
          <select value={vStatus} onChange={(e) => setVStatus(e.target.value as '在职' | '不在职')}>
            <option value="在职">在职</option>
            <option value="不在职">不在职</option>
          </select>
          <select value={vRegion} onChange={(e) => setVRegion(e.target.value as RegionOption)}>
            {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="text" value={vProvince} onChange={(e) => setVProvince(e.target.value)} placeholder="省份（大陆/台湾必填）" />
          <select value={vDepartmentId} onChange={(e) => setVDepartmentId(e.target.value)}>
            <option value="">— 选择部门 * —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="邮箱 *" />
          <input type="text" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="电话" />
          <input type="text" value={vAccountPassword} onChange={(e) => setVAccountPassword(e.target.value)} placeholder="账号密码 *" />
          <select value={vAccountRole} onChange={(e) => setVAccountRole(e.target.value as 'user' | 'b_admin' | 'a_admin')}>
            <option value="user">user</option>
            <option value="b_admin">b_admin</option>
            <option value="a_admin">a_admin</option>
          </select>
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={handleCreateVolunteer} disabled={submitting}>
            {submitting ? '提交中...' : '新增志愿者+账号'}
          </button>
        </div>
      </section>

      {/* Create admin (no volunteer binding) */}
      <section className="nps-panel">
        <h3>新增 admin 账号（无 volunteer 绑定）</h3>
        <div className="admin-single-grid">
          <input type="text" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="姓名 *" />
          <input type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} placeholder="邮箱 *" />
          <input type="text" value={aPassword} onChange={(e) => setAPassword(e.target.value)} placeholder="密码 ≥ 8 位 *" />
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={handleCreateAdmin} disabled={submitting}>
            新增 admin
          </button>
        </div>
      </section>

      {/* CSV import */}
      <section className="nps-panel">
        <h3>CSV 批量导入</h3>
        <p className="nps-msg">字段：chineseName, englishName, status, region, province, departmentId, email, phone, role, password</p>
        <textarea
          className="admin-csv-input"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`chineseName,englishName,status,region,province,departmentId,email,role\n张三,Zhang San,在职,中国大陆,上海市,TECH,zhangsan@vt.local,user`}
        />
        <div className="admin-form-row">
          <label>
            默认密码
            <input type="text" value={csvDefaultPassword} onChange={(e) => setCsvDefaultPassword(e.target.value)} />
          </label>
        </div>
        <div className="quick-actions-row">
          <button type="button" className="action-chip" onClick={handleImport} disabled={submitting}>开始导入</button>
        </div>
      </section>

      {/* System reset */}
      <section className="quick-actions-panel">
        <h3>⚠️ 系统重置</h3>
        <p>清空所有志愿者、项目支援、审计日志和非 admin 账号。仅 dev sandbox 使用。</p>
        <button type="button" className="action-chip" onClick={handleReset} disabled={submitting}>
          清空数据
        </button>
      </section>

      {message && <p className="nps-msg">{message}</p>}

      {/* Account list */}
      <section className="nps-panel">
        <h3>账号列表</h3>
        {accounts.length === 0 ? (
          <p className="center-empty">暂无账号数据</p>
        ) : (
          <div className="admin-simple-list">
            {accounts.map((item) => (
              <article key={item.id} className="admin-simple-card">
                <p><strong>Code:</strong> {item.volunteerCode || '(admin)'}</p>
                <p><strong>姓名:</strong> {item.name}</p>
                <p><strong>邮箱:</strong> {item.email}</p>
                <p><strong>权限:</strong> {item.role}</p>
                {item.volunteer?.department && (
                  <p><strong>部门:</strong> {item.volunteer.department.name}</p>
                )}
                {item.id !== currentAccountId && (
                  <button type="button" className="action-chip" onClick={() => handleDelete(item.id)} disabled={submitting}>
                    删除
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminCenter;
