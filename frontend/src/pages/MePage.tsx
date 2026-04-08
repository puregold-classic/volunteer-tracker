// frontend/src/pages/MePage.tsx — v2.1
//
// Personal center: shows current volunteer's department, their ProjectSupport
// records, pending proxy submissions awaiting confirmation, a minimal submit
// form. Admin role gets AdminCenter instead (admin doesn't have a personal
// volunteer record).
//
// Visual is intentionally minimal — full redesign happens in chunk 6 with
// frontend-design + ui-ux-pro-max. This is just "compile + don't crash".

import { useEffect, useState } from 'react';
import './MePage.scss';
import AdminCenter from '@components/AdminCenter';
import { useAuth } from '@/context/AuthContext';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import serviceItemService from '@services/serviceItemService';
import type { Volunteer, ProjectSupport, ServiceItemsByDepartment } from '@services/types';

interface MePageProps {
  homeTotalVolunteers: number;
  onVolunteerDetail: (id: string) => void;
  onBackHome: () => void;
}

function MePage({ onBackHome }: MePageProps) {
  const { account, isAuthenticated, logout } = useAuth();
  const isSystemAdmin = account?.role === 'admin';

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [pendingForMe, setPendingForMe] = useState<ProjectSupport[]>([]);
  const [serviceItemsGrouped, setServiceItemsGrouped] = useState<ServiceItemsByDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // submission form
  const [showForm, setShowForm] = useState(false);
  const [formServiceItemId, setFormServiceItemId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDuration, setFormDuration] = useState('1');
  const [formDescription, setFormDescription] = useState('');
  const [formForAnother, setFormForAnother] = useState(false);
  const [formTargetVolunteerCode, setFormTargetVolunteerCode] = useState('');

  useEffect(() => {
    if (!isAuthenticated || isSystemAdmin) return;
    void refresh();
  }, [isAuthenticated, isSystemAdmin, account?.volunteerId]);

  const refresh = async () => {
    if (!account?.volunteerId) return;
    setLoading(true);
    setMessage('');
    try {
      const [vRes, sRes, pRes, itemsRes] = await Promise.all([
        volunteerService.getVolunteerById(account.volunteerId),
        projectSupportService.list({ volunteerId: account.volunteerId, limit: 50 }),
        projectSupportService.listPendingForMe(),
        serviceItemService.listGrouped(),
      ]);
      if (vRes?.success && vRes.data) setVolunteer(vRes.data);
      if (sRes?.success && sRes.data?.records) setSupports(sRes.data.records);
      if (pRes?.success && pRes.data) setPendingForMe(pRes.data);
      if (itemsRes?.success && itemsRes.data) setServiceItemsGrouped(itemsRes.data);
    } catch (err: any) {
      setMessage(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const submitSupport = async () => {
    if (!formServiceItemId || !formDate || !formDescription.trim()) {
      setMessage('请填写服务项、日期和描述');
      return;
    }
    const duration = Number(formDuration);
    if (!duration || duration <= 0 || duration % 0.5 !== 0) {
      setMessage('时长必须是大于 0 的 0.5 倍数');
      return;
    }

    let targetVolunteerId: string | undefined;
    if (formForAnother) {
      if (!formTargetVolunteerCode.trim()) {
        setMessage('代提交模式：请填写对方的 volunteer code（如 PG-0003）');
        return;
      }
      // Look up target volunteer by code
      const lookup = await volunteerService.getVolunteerById(formTargetVolunteerCode.trim());
      if (!lookup?.success || !lookup.data) {
        setMessage(`未找到 volunteer: ${formTargetVolunteerCode}`);
        return;
      }
      targetVolunteerId = lookup.data.id;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const result = await projectSupportService.create({
        volunteerId: targetVolunteerId,
        serviceItemId: formServiceItemId,
        serviceDate: formDate,
        duration,
        description: formDescription.trim(),
      });
      if (result?.success && result.data) {
        const isProxy = result.data.isProxy;
        setMessage(isProxy ? `已代为提交，等待 ${formTargetVolunteerCode} 确认` : '已提交，记录已生效');
        setFormDate('');
        setFormDescription('');
        setFormDuration('1');
        setFormTargetVolunteerCode('');
        setFormForAnother(false);
        await refresh();
      } else {
        setMessage((result as any)?.error || '提交失败');
      }
    } catch (err: any) {
      setMessage(err?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmProxy = async (supportId: string) => {
    setSubmitting(true);
    try {
      const result = await projectSupportService.confirm(supportId);
      if (result?.success) {
        setMessage('已确认');
        await refresh();
      } else {
        setMessage((result as any)?.error || '确认失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const rejectProxy = async (supportId: string) => {
    if (!window.confirm('确认拒绝这条代提交记录？记录会被标记为已拒绝，不计入统计。')) return;
    setSubmitting(true);
    try {
      const result = await projectSupportService.reject(supportId);
      if (result?.success) {
        setMessage('已拒绝');
        await refresh();
      } else {
        setMessage((result as any)?.error || '拒绝失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSupport = async (supportId: string) => {
    if (!window.confirm('删除这条记录？')) return;
    setSubmitting(true);
    try {
      const result = await projectSupportService.remove(supportId);
      if (result?.success) {
        setMessage('已删除');
        await refresh();
      } else {
        setMessage((result as any)?.error || '删除失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="me-page">
        <p className="center-empty">请先登录</p>
      </div>
    );
  }

  // Admin view: show only AdminCenter (admin has no personal records)
  if (isSystemAdmin) {
    return (
      <div className="me-page">
        <div className="center-panel__head">
          <h1>系统管理员中心</h1>
          <div className="quick-actions-row">
            <button type="button" className="filter-reset" onClick={onBackHome}>返回首页</button>
            <button type="button" className="filter-reset" onClick={() => void logout()}>退出</button>
          </div>
        </div>
        <AdminCenter currentAccountId={account?.id} />
      </div>
    );
  }

  return (
    <div className="me-page">
      <div className="center-panel__head">
        <h1>个人中心 {volunteer?.chineseName ? `· ${volunteer.chineseName}` : ''}</h1>
        <div className="quick-actions-row">
          <button type="button" className="filter-reset" onClick={onBackHome}>返回首页</button>
          <button type="button" className="filter-reset" onClick={() => void logout()}>退出</button>
        </div>
      </div>

      {loading && <p className="center-empty">加载中…</p>}
      {message && <p className="nps-msg">{message}</p>}

      {volunteer && (
        <section className="nps-panel">
          <h3>我的档案</h3>
          <p>姓名：{volunteer.chineseName} ({volunteer.englishName})</p>
          <p>Code：{volunteer.volunteerCode}</p>
          <p>部门：{volunteer.department?.name || '未分配'}</p>
          <p>地区：{volunteer.region}{volunteer.province ? ` / ${volunteer.province}` : ''}</p>
          <p>状态：{volunteer.status}</p>
          <p>角色：{account?.role}</p>
        </section>
      )}

      {/* Pending proxy submissions awaiting MY confirmation */}
      {pendingForMe.length > 0 && (
        <section className="nps-panel">
          <h3>等待我确认的代提交（{pendingForMe.length}）</h3>
          {pendingForMe.map((p) => (
            <article key={p.id} className="admin-simple-card">
              <p><strong>提交人：</strong>{p.submittedBy?.chineseName} ({p.submittedBy?.volunteerCode})</p>
              <p><strong>服务项：</strong>{p.serviceItem?.departmentName} / {p.serviceItem?.name}</p>
              <p><strong>日期：</strong>{new Date(p.serviceDate).toISOString().split('T')[0]}</p>
              <p><strong>时长：</strong>{p.duration}h</p>
              <p><strong>描述：</strong>{p.description}</p>
              <div className="quick-actions-row">
                <button type="button" className="action-chip" onClick={() => confirmProxy(p.supportId)} disabled={submitting}>确认</button>
                <button type="button" className="action-chip" onClick={() => rejectProxy(p.supportId)} disabled={submitting}>拒绝</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Submit form */}
      <section className="nps-panel">
        <div className="center-panel__head">
          <h3>提交项目支援</h3>
          <button type="button" className="filter-reset" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '收起' : '展开'}
          </button>
        </div>
        {showForm && (
          <div className="admin-single-grid">
            <select value={formServiceItemId} onChange={(e) => setFormServiceItemId(e.target.value)}>
              <option value="">— 选择服务项 * —</option>
              {serviceItemsGrouped.map((g) => (
                <optgroup key={g.department.id} label={g.department.name}>
                  {g.items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            <input type="number" step="0.5" min="0.5" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="时长（小时）" />
            <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="服务描述（5-1000 字符）" />
            <label className="admin-checkbox">
              <input type="checkbox" checked={formForAnother} onChange={(e) => setFormForAnother(e.target.checked)} />
              代他人提交
            </label>
            {formForAnother && (
              <input type="text" value={formTargetVolunteerCode} onChange={(e) => setFormTargetVolunteerCode(e.target.value)} placeholder="对方 volunteer code（如 PG-0003）" />
            )}
            <button type="button" className="action-chip" onClick={submitSupport} disabled={submitting}>
              {submitting ? '提交中…' : '提交'}
            </button>
          </div>
        )}
      </section>

      {/* My existing supports */}
      <section className="nps-panel">
        <h3>我的项目支援记录（{supports.length}）</h3>
        {supports.length === 0 ? (
          <p className="center-empty">暂无记录</p>
        ) : (
          supports.map((s) => (
            <article key={s.id} className="admin-simple-card">
              <p><strong>{s.supportId}</strong> · {s.statusDisplay}{s.isProxy ? ' · 代提交' : ''}</p>
              <p>{s.serviceItem?.departmentName} / {s.serviceItem?.name} · {s.duration}h · {new Date(s.serviceDate).toISOString().split('T')[0]}</p>
              <p>{s.description}</p>
              {s.status === 'ACTIVE' && (
                <button type="button" className="action-chip" onClick={() => deleteSupport(s.supportId)} disabled={submitting}>
                  删除
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default MePage;
