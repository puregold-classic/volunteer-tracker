// frontend/src/pages/VolunteerDetailPage.tsx — v2.1
//
// Minimal volunteer profile + support records list. The submission form has
// moved to MePage (用户只能从自己的个人中心提交). Visual minimal until chunk 6.

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import type { Volunteer, ProjectSupport } from '@services/types';

interface VolunteerDetailPageProps {
  volunteerId: string;
  onBackHome: () => void;
}

function VolunteerDetailPage({ volunteerId, onBackHome }: VolunteerDetailPageProps) {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const vRes = await volunteerService.getVolunteerById(volunteerId);
        if (cancelled) return;
        if (!vRes?.success || !vRes.data) {
          setError('未找到该志愿者');
          setVolunteer(null);
          setSupports([]);
          return;
        }
        setVolunteer(vRes.data);

        // Now fetch supports using the cuid (vRes.data.id)
        const sRes = await projectSupportService.list({ volunteerId: vRes.data.id, limit: 50 });
        if (cancelled) return;
        if (sRes?.success && sRes.data?.records) setSupports(sRes.data.records);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [volunteerId]);

  if (loading) return <p className="center-empty">加载中…</p>;
  if (error) return <p className="auth-form-error">{error}</p>;
  if (!volunteer) return <p className="center-empty">未找到</p>;

  return (
    <div className="space-y-6">
      <Card variant="elevated" className="p-6">
        <div className="flex items-start gap-4">
          <img
            src={volunteer.avatar}
            alt={volunteer.chineseName}
            className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg dark:border-neutral-950"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{volunteer.chineseName}</h1>
              <Badge variant={volunteer.status === '在职' ? 'success' : 'outline'}>{volunteer.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-500">{volunteer.englishName || '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">Code：{volunteer.volunteerCode}</Badge>
              <Badge variant="info">地区：{volunteer.region}{volunteer.province ? ` / ${volunteer.province}` : ''}</Badge>
              {volunteer.department && <Badge variant="default">部门：{volunteer.department.name}</Badge>}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onBackHome}>返回首页</Button>
        </div>
      </Card>

      <Card variant="elevated" className="p-6">
        <h2 className="text-lg font-semibold">联系方式</h2>
        <div className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <p>邮箱：{volunteer.email || '—'}</p>
          <p>电话：{volunteer.phone || '—'}</p>
          <p>加入时间：{volunteer.joinDate ? new Date(volunteer.joinDate).toISOString().split('T')[0] : '—'}</p>
        </div>
      </Card>

      <Card variant="elevated" className="p-6">
        <h2 className="text-lg font-semibold">项目支援记录（{supports.length}）</h2>
        {supports.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">暂无记录</p>
        ) : (
          <div className="mt-3 space-y-3">
            {supports.map((s) => (
              <div key={s.id} className="rounded-2xl border border-neutral-100 p-4 dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-neutral-500">{s.supportId}</span>
                  <Badge variant={s.status === 'ACTIVE' ? 'success' : 'outline'}>{s.statusDisplay}</Badge>
                </div>
                <p className="mt-1 text-sm">
                  {s.serviceItem?.departmentName} / {s.serviceItem?.name} · {s.duration}h · {new Date(s.serviceDate).toISOString().split('T')[0]}
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{s.description}</p>
                {s.isProxy && (
                  <p className="mt-1 text-xs text-neutral-400">代提交人：{s.submittedBy?.chineseName} ({s.submittedBy?.volunteerCode})</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default VolunteerDetailPage;
