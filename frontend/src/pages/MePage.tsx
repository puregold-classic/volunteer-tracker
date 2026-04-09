// frontend/src/pages/MePage.tsx — chunk 6 phase D (mobile-first rewrite)
//
// Information architecture (volunteer view, mobile-first stack):
//
//   ┌────────────────────────────────┐
//   │  Hero                          │
//   │  · 大头像 + 名字 + code         │
//   │  · 部门 / 区域 badges          │
//   │  · 编辑式 stat strip            │
//   ├────────────────────────────────┤
//   │  待我确认 (only if pending > 0) │
//   │  · 显眼的 cards                 │
//   │  · 一键 [确认] [拒绝]           │
//   ├────────────────────────────────┤
//   │  [+ 提交项目支援]  ← big CTA    │
//   ├────────────────────────────────┤
//   │  我的项目支援 (N)               │
//   │  · 时间倒序 cards               │
//   └────────────────────────────────┘
//
// Submit form is a Dialog (mobile bottom-sheet style, sm: centered).
// Form uses react-hook-form + zod for validation.
// Admin role gets the AdminCenter inline (separate page coming in phase E).

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  MapPin,
  PlusCircle,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import AdminCenter from '@components/AdminCenter';
import { useAuth } from '@/context/AuthContext';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import serviceItemService from '@services/serviceItemService';
import type { Volunteer, ProjectSupport, ServiceItemsByDepartment } from '@services/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { HeroAvatar } from '@/components/shared/hero-avatar';
import { SupportRecordCard } from '@/components/shared/support-record-card';
import { SubmitFormDialog } from '@/components/shared/submit-form-dialog';

interface MePageProps {
  homeTotalVolunteers: number;
  onVolunteerDetail: (id: string) => void;
  onBackHome: () => void;
}

// HeroAvatar / SubmitFormDialog / SupportRecordCard now live in
// components/shared so VolunteerDetailPage can reuse them.

// ─── Reject reason Dialog ───────────────────────────────────────────────────

const RejectDialog: React.FC<{
  supportId: string | null;
  onConfirm: (supportId: string, reason: string) => Promise<void>;
  onClose: () => void;
}> = ({ supportId, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (supportId) setReason('');
  }, [supportId]);

  const handleConfirm = async () => {
    if (!supportId) return;
    setSubmitting(true);
    try {
      await onConfirm(supportId, reason.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!supportId}
      onOpenChange={(o) => !o && onClose()}
      title="拒绝代提交"
      description="拒绝后该记录会被标记为已拒绝，不计入统计。"
    >
      <div className="space-y-3">
        <label htmlFor="reject-reason" className="text-sm font-medium text-foreground">
          理由（可选）
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          placeholder="说明一下为什么拒绝（可留空）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button type="button" variant="destructive" className="flex-1" onClick={handleConfirm} disabled={submitting}>
            {submitting ? '提交中…' : '确认拒绝'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// ─── Pending proxy submission card ──────────────────────────────────────────

const PendingProxyCard: React.FC<{
  support: ProjectSupport;
  onConfirm: (supportId: string) => Promise<void>;
  onReject: (supportId: string) => void;
  busy: boolean;
}> = ({ support, onConfirm, onReject, busy }) => (
  <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 space-y-3">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
        <UserIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-sm font-semibold text-foreground">
          {support.submittedBy?.chineseName} 代你提交了一条记录
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {support.submittedBy?.volunteerCode}
        </p>
      </div>
    </div>
    <div className="space-y-1.5 rounded-lg bg-card p-3 text-sm">
      <div className="flex items-center gap-2 text-foreground">
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{support.serviceItem?.departmentName} / {support.serviceItem?.name}</span>
      </div>
      <div className="flex items-center gap-2 text-foreground">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{new Date(support.serviceDate).toISOString().split('T')[0]}</span>
        <span className="text-muted-foreground">·</span>
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="tabular-nums">{support.duration}h</span>
      </div>
      <p className="text-sm text-muted-foreground">{support.description}</p>
    </div>
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        className="flex-1"
        onClick={() => onConfirm(support.supportId)}
        disabled={busy}
      >
        <CheckCircle2 className="h-4 w-4" />
        确认
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="flex-1"
        onClick={() => onReject(support.supportId)}
        disabled={busy}
      >
        <XCircle className="h-4 w-4" />
        拒绝
      </Button>
    </div>
  </div>
);

// ─── Main page ──────────────────────────────────────────────────────────────

function MePage({ onBackHome }: MePageProps) {
  const { account, isAuthenticated, logout } = useAuth();
  const isSystemAdmin = account?.role === 'admin';

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [pendingForMe, setPendingForMe] = useState<ProjectSupport[]>([]);
  const [serviceItemsGrouped, setServiceItemsGrouped] = useState<ServiceItemsByDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<'ACTIVE' | 'PENDING' | 'HISTORY'>('ACTIVE');

  const refresh = async () => {
    if (!account?.volunteerId) return;
    setLoading(true);
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
      toast({ title: '加载失败', description: err?.message || '未知错误', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || isSystemAdmin) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSystemAdmin, account?.volunteerId]);

  const handleConfirmProxy = async (supportId: string) => {
    setBusy(true);
    try {
      const result = await projectSupportService.confirm(supportId);
      if (result?.success) {
        toast({ title: '已确认', description: '代提交已生效' });
        await refresh();
      } else {
        toast({ title: '确认失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRejectProxy = async (supportId: string, reason: string) => {
    setBusy(true);
    try {
      const result = await projectSupportService.reject(supportId, reason || undefined);
      if (result?.success) {
        toast({ title: '已拒绝', description: '记录已标记为拒绝' });
        await refresh();
      } else {
        toast({ title: '拒绝失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (supportId: string) => {
    if (!window.confirm('删除这条记录？')) return;
    setBusy(true);
    try {
      const result = await projectSupportService.remove(supportId);
      if (result?.success) {
        toast({ title: '已删除' });
        await refresh();
      } else {
        toast({ title: '删除失败', description: (result as any)?.error || '未知错误', variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  // ─── Render guards ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  // Admin gets the AdminCenter inline (separate desktop page in phase E)
  if (isSystemAdmin) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <h1 className="font-serif text-2xl font-semibold text-foreground">系统管理员中心</h1>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onBackHome}>
              返回首页
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
        </div>
        <AdminCenter currentAccountId={account?.id} />
      </div>
    );
  }

  // ─── Volunteer view ───────────────────────────────────────────────────────

  // Stat / heatmap / grouped / status-counts derivations.
  // All computed in one useMemo so we walk the supports list a small fixed
  // number of times instead of recomputing on every render.
  const { stats, heatmap, statusCounts, filteredGroups } = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthHours = 0;
    let yearHours = 0;
    let totalHours = 0;
    const counts = { ACTIVE: 0, PENDING: 0, HISTORY: 0 };

    // 90-day heatmap: build a date→hours map keyed by YYYY-MM-DD (local)
    const heatmapMap = new Map<string, number>();
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);

    for (const s of supports) {
      // status counts (for filter chips)
      if (s.status === 'ACTIVE') counts.ACTIVE += 1;
      else if (s.status === 'PENDING_CONFIRMATION') counts.PENDING += 1;
      else counts.HISTORY += 1;

      // stats only count ACTIVE
      if (s.status !== 'ACTIVE') continue;
      const dur = s.duration || 0;
      totalHours += dur;
      const d = new Date(s.serviceDate);
      if (d >= yearStart) yearHours += dur;
      if (d >= monthStart) monthHours += dur;
      if (d >= ninetyDaysAgo && d <= now) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + dur);
      }
    }

    // Materialize a 90-element array (oldest → newest)
    const heatmapArr: Array<{ key: string; hours: number }> = [];
    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      heatmapArr.push({ key, hours: heatmapMap.get(key) || 0 });
    }

    // Group filtered records by YYYY-MM
    const filtered = supports.filter((s) => {
      if (recordFilter === 'ACTIVE') return s.status === 'ACTIVE';
      if (recordFilter === 'PENDING') return s.status === 'PENDING_CONFIRMATION';
      return s.status !== 'ACTIVE' && s.status !== 'PENDING_CONFIRMATION';
    });
    const groupMap = new Map<string, { key: string; label: string; hours: number; count: number; records: ProjectSupport[] }>();
    for (const s of filtered) {
      const d = new Date(s.serviceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
      const g = groupMap.get(key) || { key, label, hours: 0, count: 0, records: [] };
      g.records.push(s);
      g.count += 1;
      if (s.status === 'ACTIVE') g.hours += s.duration || 0;
      groupMap.set(key, g);
    }
    const groups = Array.from(groupMap.values()).sort((a, b) => (a.key < b.key ? 1 : -1));

    return {
      stats: { monthHours, yearHours, totalHours, totalCount: counts.ACTIVE },
      heatmap: heatmapArr,
      statusCounts: counts,
      filteredGroups: groups,
    };
  }, [supports, recordFilter]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-20 sm:space-y-5">
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <HeroAvatar name={volunteer?.chineseName || '?'} code={volunteer?.volunteerCode || ''} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl font-semibold text-foreground">
                {volunteer?.chineseName || '加载中…'}
              </h1>
              {volunteer?.englishName && (
                <p className="text-sm text-muted-foreground italic">{volunteer.englishName}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{volunteer?.volunteerCode}</span>
                {volunteer?.department && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {volunteer.department.name}
                  </span>
                )}
                {volunteer?.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {volunteer.region}
                    {volunteer.province ? ` · ${volunteer.province}` : ''}
                  </span>
                )}
              </div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => void logout()}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Stat tiles: 本月 / 本年 / 累计 */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 sm:gap-3">
            {[
              { label: '本月', value: stats.monthHours },
              { label: '本年', value: stats.yearHours },
              { label: '累计', value: stats.totalHours, emphasized: true },
            ].map((tile) => (
              <div
                key={tile.label}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-center',
                  tile.emphasized ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30',
                )}
              >
                <p className="font-serif text-2xl font-semibold tabular-nums leading-none text-foreground">
                  {tile.value}
                  <span className="ml-0.5 text-sm font-normal text-muted-foreground">h</span>
                </p>
                <p className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {tile.label}
                </p>
              </div>
            ))}
          </div>

          {/* 90 天活跃热力条 */}
          {stats.totalCount > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>近 90 天</span>
                <span className="flex items-center gap-1">
                  <span>少</span>
                  <span className="h-2 w-2 rounded-[1px] bg-muted" />
                  <span className="h-2 w-2 rounded-[1px] bg-primary/30" />
                  <span className="h-2 w-2 rounded-[1px] bg-primary/60" />
                  <span className="h-2 w-2 rounded-[1px] bg-primary" />
                  <span>多</span>
                </span>
              </div>
              <div className="flex gap-[2px]">
                {heatmap.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.key} · ${d.hours}h`}
                    className={cn(
                      'h-3 flex-1 rounded-[2px]',
                      d.hours === 0 && 'bg-muted',
                      d.hours > 0 && d.hours < 2 && 'bg-primary/30',
                      d.hours >= 2 && d.hours < 5 && 'bg-primary/60',
                      d.hours >= 5 && 'bg-primary',
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Pending proxy submissions (priority placement) ──────────────── */}
      {pendingForMe.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-serif text-base font-semibold text-foreground">
              待你确认 <span className="text-accent">({pendingForMe.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {pendingForMe.map((p) => (
              <PendingProxyCard
                key={p.id}
                support={p}
                onConfirm={handleConfirmProxy}
                onReject={(supportId) => setRejectingId(supportId)}
                busy={busy}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Submit CTA ──────────────────────────────────────────────────── */}
      <Button
        type="button"
        size="lg"
        className="w-full font-serif text-base h-14 rounded-2xl shadow-md"
        onClick={() => setSubmitOpen(true)}
      >
        <PlusCircle className="h-5 w-5" />
        提交项目支援
      </Button>

      {/* ─── My support records ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-base font-semibold text-foreground">
            我的支援记录 <span className="text-muted-foreground">({supports.length})</span>
          </h2>
        </div>

        {/* Status filter chips */}
        {supports.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            {(['ACTIVE', 'PENDING', 'HISTORY'] as const).map((f) => {
              const labels: Record<typeof f, string> = {
                ACTIVE: '已生效',
                PENDING: '待确认',
                HISTORY: '历史',
              };
              const count = statusCounts[f];
              const isActive = recordFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRecordFilter(f)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {labels[f]}
                  <span className="tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading && supports.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            加载中…
          </p>
        ) : supports.length === 0 ? (
          // Empty state with a faux preview card
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <div className="mx-auto max-w-xs">
              {/* Faux preview card */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 text-left opacity-60">
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-[10px] py-0.5">已生效</Badge>
                </div>
                <p className="mt-1.5 font-serif text-sm font-semibold text-foreground/70">
                  示例 / 你的服务项
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  YYYY-MM-DD
                  <span>·</span>
                  <Clock3 className="h-3 w-3" />
                  <span className="tabular-nums">2h</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  描述会出现在这里…
                </p>
              </div>
              <p className="mt-4 font-serif text-sm font-semibold text-foreground">
                你的第一条记录会出现在这里
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                点击上方「提交项目支援」开始记录
              </p>
            </div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            该筛选下暂无记录
          </p>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map((g) => (
              <div key={g.key} className="space-y-2.5">
                <div className="sticky top-14 z-10 -mx-1 flex items-baseline justify-between border-b border-border/60 bg-background/85 px-1 py-1.5 backdrop-blur-sm">
                  <h3 className="font-serif text-sm font-semibold text-foreground">{g.label}</h3>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {g.hours}h · {g.count} 条
                  </p>
                </div>
                <div className="space-y-2.5">
                  {g.records.map((s) => (
                    <SupportRecordCard key={s.id} support={s} onDelete={handleDelete} busy={busy} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Footer link to home ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBackHome}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3 w-3 rotate-180" />
        返回首页
      </button>

      {/* ─── Submit dialog ───────────────────────────────────────────────── */}
      <SubmitFormDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        groupedItems={serviceItemsGrouped}
        onSubmitted={() => void refresh()}
      />

      {/* ─── Reject dialog ───────────────────────────────────────────────── */}
      <RejectDialog
        supportId={rejectingId}
        onConfirm={handleRejectProxy}
        onClose={() => setRejectingId(null)}
      />
    </div>
  );
}

export default MePage;
