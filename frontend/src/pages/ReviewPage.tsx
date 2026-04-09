// frontend/src/pages/ReviewPage.tsx — v2.1
//
// 项目支援台账 (Support Ledger). Replaces v1's "审核中心" entirely — under
// v2.1 there's no approval queue, just a read-only admin view of all
// project support activity. Visual is minimal until chunk 6 redesign.

import { useEffect, useState } from 'react';
import ledgerService, { LedgerOverview } from '@services/ledgerService';
import { useAuth } from '@/context/AuthContext';

interface ReviewPageProps {
  isReviewer: boolean;
}

function ReviewPage({ isReviewer }: ReviewPageProps) {
  const { isAuthenticated } = useAuth();
  const [overview, setOverview] = useState<LedgerOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    setLoading(true);
    setError('');
    ledgerService.overview()
      .then((res) => {
        if (res?.success && res.data) setOverview(res.data);
        else setError((res as any)?.error || '加载失败');
      })
      .catch((err) => setError(err?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, isReviewer]);

  if (!isAuthenticated) {
    return <div className="review-page"><p className="center-empty">请先登录</p></div>;
  }
  if (!isReviewer) {
    return <div className="review-page"><p className="center-empty">需要 b_admin / a_admin / admin 权限</p></div>;
  }
  if (loading) {
    return <div className="review-page"><p className="center-empty">加载台账数据中…</p></div>;
  }
  if (error) {
    return <div className="review-page"><p className="auth-form-error">{error}</p></div>;
  }
  if (!overview) {
    return <div className="review-page"><p className="center-empty">暂无数据</p></div>;
  }

  return (
    <div className="review-page">
      <div className="center-panel__head">
        <h1>项目支援台账</h1>
      </div>

      <section className="nps-panel">
        <h3>总览</h3>
        <p>记录总数：{overview.summary.totalRecords}</p>
        <p>累计时长：{overview.summary.totalHours} 小时</p>
        <p>平均时长：{overview.summary.avgDuration} 小时/记录</p>
        <p>最早日期：{overview.summary.earliestDate ? new Date(overview.summary.earliestDate).toISOString().split('T')[0] : '—'}</p>
        <p>最晚日期：{overview.summary.latestDate ? new Date(overview.summary.latestDate).toISOString().split('T')[0] : '—'}</p>
      </section>

      <section className="nps-panel">
        <h3>按部门</h3>
        {overview.byDepartment.length === 0 ? (
          <p className="center-empty">暂无数据</p>
        ) : (
          <div className="admin-simple-list">
            {overview.byDepartment.map((d) => (
              <article key={d.departmentId} className="admin-simple-card">
                <p><strong>{d.departmentName}</strong></p>
                <p>记录 {d.count} 条 · 时长 {d.totalHours} 小时</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="nps-panel">
        <h3>按志愿者（前 50 名，按总时长降序）</h3>
        {overview.byVolunteer.length === 0 ? (
          <p className="center-empty">暂无数据</p>
        ) : (
          <div className="admin-simple-list">
            {overview.byVolunteer.map((v) => (
              <article key={v.volunteerCode} className="admin-simple-card">
                <p><strong>{v.chineseName}</strong> ({v.volunteerCode}) · {v.departmentId}</p>
                <p>{v.count} 条 · {v.totalHours} 小时 · 最近 {v.lastDate ? new Date(v.lastDate).toISOString().split('T')[0] : '—'}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="nps-panel">
        <h3>按服务项</h3>
        {overview.byServiceItem.length === 0 ? (
          <p className="center-empty">暂无数据</p>
        ) : (
          <div className="admin-simple-list">
            {overview.byServiceItem.map((s) => (
              <article key={s.serviceItemId} className="admin-simple-card">
                <p><strong>{s.departmentName}</strong> / {s.serviceItemName}</p>
                <p>{s.count} 条 · {s.totalHours} 小时</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default ReviewPage;
