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
//   │  [+ 提交项目服务]  ← big CTA    │
//   ├────────────────────────────────┤
//   │  我的项目服务 (N)               │
//   │  · 时间倒序 cards               │
//   └────────────────────────────────┘
//
// Submit form is a Dialog (mobile bottom-sheet style, sm: centered).
// Form uses react-hook-form + zod for validation.
// Admin role gets the AdminCenter inline (separate page coming in phase E).

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  MapPin,
  PlusCircle,
  Send,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
// AdminCenter is lazy-loaded — only ~10% of users (admin role) ever
// see it, but it pulls in 5 dialog forms + react-hook-form/zod which
// otherwise inflate every login session.
const AdminCenter = lazy(() => import('@components/AdminCenter'));
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
import { parseLocalDate, formatLocalDate } from '@/lib/date-utils';
import { HeroAvatar } from '@/components/shared/hero-avatar';
import { SupportRecordCard } from '@/components/shared/support-record-card';
import { SubmitFormDialog } from '@/components/shared/submit-form-dialog';
import { LinkTagsDialog } from '@/components/shared/link-tags-dialog';
import { AccountSettingsDialog } from '@/components/shared/account-settings-dialog';
import { ScrollableBarChart } from '@/components/shared/scrollable-bar-chart';
import { useRecordsDialog } from '@/components/shared/records-dialog';
import { ListsSection } from '@/components/shared/lists-section';
import ledgerService, { type LedgerVolunteerService } from '@services/ledgerService';
import { useFollowed } from '@/context/FollowedContext';
import { deptColor } from '@/lib/ledger-colors';
import { Settings } from 'lucide-react';

interface MePageProps {
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
        <span>{formatLocalDate(support.serviceDate)}</span>
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
  const navigate = useNavigate();
  const isSystemAdmin = account?.role === 'admin';

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [proxyForOthers, setProxyForOthers] = useState<ProjectSupport[]>([]);
  const [pendingForMe, setPendingForMe] = useState<ProjectSupport[]>([]);
  const [serviceItemsGrouped, setServiceItemsGrouped] = useState<ServiceItemsByDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<'ACTIVE' | 'PENDING' | 'HISTORY'>('ACTIVE');
  const [linkingSupport, setLinkingSupport] = useState<ProjectSupport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // v3.4 multi-list: 代提交 target shared between submit dialog + ListsSection
  const [proxyTarget, setProxyTarget] = useState<{ id: string; chineseName: string } | null>(null);
  // v3.4.1: when admin_a/b clicks "为他人提交" CTA, dialog opens in proxy-console mode
  const [proxyConsoleOpen, setProxyConsoleOpen] = useState(false);
  // v3.5: lightweight "为他人提交" for regular users (no console sidebar)
  const [proxyPickOpen, setProxyPickOpen] = useState(false);
  const { refresh: refreshFollowed } = useFollowed();
  // Self records get inline edit / delete in the drill-down dialog; watched
  // others' records stay read-only (ownership checked per-record).
  const recordsDialog = useRecordsDialog({ currentVolunteerId: account?.volunteerId });
  // v3.5: every volunteer gets both CTAs (submit self / for others) and watch
  // lists. admin_a/b get the full proxy console; regular users get the
  // lightweight pick dialog.
  const hasVolunteer = !!account?.volunteerId;
  const isAdminListOwner = account?.role === 'a_admin' || account?.role === 'b_admin';

  // My own service distribution (used in "已生效" view in place of the old
  // grouped-by-month list). Fetched on refresh along with everything else.
  const [mySelfServices, setMySelfServices] = useState<LedgerVolunteerService[]>([]);

  const refresh = async () => {
    if (!account?.volunteerId) return;
    setLoading(true);
    try {
      const [vRes, sRes, pRes, proxyRes, itemsRes, servicesRes] = await Promise.all([
        volunteerService.getVolunteerById(account.volunteerId),
        projectSupportService.list({ volunteerId: account.volunteerId, limit: 50 }),
        projectSupportService.listPendingForMe(),
        projectSupportService.list({ submittedById: account.volunteerId, limit: 50 }),
        serviceItemService.listGrouped(),
        ledgerService.volunteerServices(account.volunteerId),
      ]);
      if (vRes?.success && vRes.data) setVolunteer(vRes.data);
      if (sRes?.success && sRes.data?.records) setSupports(sRes.data.records);
      if (pRes?.success && pRes.data) setPendingForMe(pRes.data);
      // Filter proxy results: only records submitted for someone else
      if (proxyRes?.success && proxyRes.data?.records) {
        setProxyForOthers(proxyRes.data.records.filter((r: ProjectSupport) => r.isProxy));
      }
      if (itemsRes?.success && itemsRes.data) setServiceItemsGrouped(itemsRes.data);
      if (servicesRes?.success && servicesRes.data) setMySelfServices(servicesRes.data);
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

  // Admin gets the AdminCenter inline. AdminCenter owns the page title;
  // MePage wrapper just provides session controls (back home / logout)
  // floating top-right.
  if (isSystemAdmin) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-end gap-2 px-1">
          <Button type="button" variant="outline" size="sm" onClick={onBackHome}>
            返回首页
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            退出
          </Button>
        </div>
        <Suspense fallback={<p className="py-12 text-center text-sm text-muted-foreground">加载管理中心…</p>}>
          <AdminCenter currentAccountId={account?.id} />
        </Suspense>
      </div>
    );
  }

  // ─── Volunteer view ───────────────────────────────────────────────────────

  // Stat / heatmap / grouped / status-counts derivations.
  // All computed in one useMemo so we walk the supports list a small fixed
  // number of times instead of recomputing on every render.
  const { stats, heatmap, statusCounts, filteredGroups } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthHours = 0;
    let monthCount = 0;
    let totalHours = 0;
    let totalCount = 0;
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
      totalCount += 1;
      const d = parseLocalDate(s.serviceDate);
      if (!d) continue;
      if (d >= monthStart) { monthHours += dur; monthCount += 1; }
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
      const d = parseLocalDate(s.serviceDate);
      if (!d) continue;
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
      stats: { monthHours, monthCount, totalHours, totalCount },
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
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-2xl ring-2 ring-transparent transition hover:ring-primary/40 focus:outline-none focus:ring-primary/60"
              aria-label="账号设置"
              title="账号设置"
            >
              <HeroAvatar
                name={volunteer?.chineseName || '?'}
                code={volunteer?.volunteerCode || ''}
                size="lg"
                avatarUrl={volunteer?.avatar}
              />
            </button>
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
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                aria-label="账号设置"
                title="账号设置"
              >
                <Settings className="h-4 w-4" />
              </Button>
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
          </div>

          {/* Stat tiles: 本月 / 累计 / 代提交 */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 sm:gap-3">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
              <p className="font-serif text-lg font-semibold tabular-nums leading-none text-foreground">
                {stats.monthCount}<span className="text-xs font-normal text-muted-foreground">次</span>
                <span className="mx-1 text-xs font-normal text-muted-foreground">·</span>
                {stats.monthHours}<span className="text-xs font-normal text-muted-foreground">h</span>
              </p>
              <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground">本月</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-center">
              <p className="font-serif text-lg font-semibold tabular-nums leading-none text-foreground">
                {stats.totalCount}<span className="text-xs font-normal text-muted-foreground">次</span>
                <span className="mx-1 text-xs font-normal text-muted-foreground">·</span>
                {stats.totalHours}<span className="text-xs font-normal text-muted-foreground">h</span>
              </p>
              <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground">累计</p>
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 text-center">
              <p className="font-serif text-lg font-semibold tabular-nums leading-none text-accent">
                {proxyForOthers.length}<span className="text-xs font-normal text-accent/70">次</span>
              </p>
              <p className="mt-1.5 text-[11px] tracking-wider text-muted-foreground">为他人提交</p>
            </div>
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

      {/* ─── Submit CTAs — every volunteer sees both (left: self, right: proxy) ─ */}
      <div className={cn('flex gap-3', hasVolunteer ? 'flex-col sm:flex-row' : '')}>
        <Button
          type="button"
          size="lg"
          className={cn(
            'font-serif text-base h-14 rounded-2xl shadow-md',
            hasVolunteer ? 'flex-1' : 'w-full',
          )}
          onClick={() => setSubmitOpen(true)}
        >
          <PlusCircle className="h-5 w-5" />
          提交项目服务
        </Button>
        {hasVolunteer && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1 font-serif text-base h-14 rounded-2xl"
            onClick={() => (isAdminListOwner ? setProxyConsoleOpen(true) : setProxyPickOpen(true))}
          >
            <Send className="h-5 w-5" />
            为他人提交
          </Button>
        )}
      </div>

      {/* ─── My support records ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-base font-semibold text-foreground">
            我的服务记录 <span className="text-muted-foreground">({supports.length})</span>
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
                点击上方「提交项目服务」开始记录
              </p>
            </div>
          </div>
        ) : recordFilter === 'ACTIVE' ? (
          // v3 wave-3: ACTIVE view becomes a service-distribution chart.
          // Point of change: service structure > chronological list here —
          // time summaries are already on the stat tiles above. Drill to
          // records via dialog for anyone wanting the raw rows.
          mySelfServices.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              该筛选下暂无记录
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-[11px] font-medium text-muted-foreground">
                  服务分布 · 同部门同色 · 点击柱子看条目
                </p>
              </div>
              <ScrollableBarChart
                bars={mySelfServices.map((s) => ({
                  key: s.serviceItemId,
                  label: s.serviceItemName,
                  sublabel: s.departmentName,
                  value: Number(s.totalHours),
                  color: deptColor(s.departmentId),
                  onClick: () => recordsDialog.open(
                    `我 / ${s.serviceItemName}`,
                    { volunteerId: account?.volunteerId ?? '', serviceItemId: s.serviceItemId },
                  ),
                }))}
                height={160}
                formatValue={(n) => `${n}h`}
              />
            </div>
          )
        ) : filteredGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            该筛选下暂无记录
          </p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto space-y-5 rounded-xl border border-border bg-card p-3">
            {filteredGroups.map((g) => (
              <div key={g.key} className="space-y-2.5">
                <div className="sticky top-0 z-10 -mx-1 flex items-baseline justify-between border-b border-border/60 bg-card/95 px-1 py-1.5 backdrop-blur-sm">
                  <h3 className="font-serif text-sm font-semibold text-foreground">{g.label}</h3>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {g.hours}h · {g.count} 条
                  </p>
                </div>
                <div className="space-y-2.5">
                  {g.records.map((s) => (
                    <SupportRecordCard
                      key={s.id}
                      support={s}
                      onDelete={handleDelete}
                      onEditTags={setLinkingSupport}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Proxy submissions I made for others ──────────────────────────── */}
      {proxyForOthers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-serif text-base font-semibold text-foreground">
              为他人提交 <span className="text-accent">({proxyForOthers.length})</span>
            </h2>
          </div>
          <div className="max-h-[22rem] overflow-y-auto space-y-2 rounded-xl border border-border bg-card p-3">
            {proxyForOthers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/volunteers/${s.volunteerId}`)}
                className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Send className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {s.volunteer?.chineseName}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.volunteer?.volunteerCode}
                    </span>
                    <Badge
                      variant={s.status === 'ACTIVE' ? 'success' : s.status === 'PENDING_CONFIRMATION' ? 'outline' : 'destructive'}
                      className="ml-auto text-[10px] py-0"
                    >
                      {s.statusDisplay}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {s.serviceItem?.name} · {formatLocalDate(s.serviceDate)} · {s.duration}h
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── 我的 list (v3.4 multi-list) ──────────────────────────────── */}
      <ListsSection
        onProxySubmit={(target) => {
          setProxyTarget(target);
          setSubmitOpen(true);
        }}
        recordsDialog={recordsDialog}
      />

      {/* ─── Footer link to home ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBackHome}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3 w-3 rotate-180" />
        返回首页
      </button>

      {/* ─── Submit dialog (self / locked-proxy from list/detail) ──────────── */}
      <SubmitFormDialog
        open={submitOpen}
        onOpenChange={(v) => { setSubmitOpen(v); if (!v) setProxyTarget(null); }}
        groupedItems={serviceItemsGrouped}
        targetVolunteer={proxyTarget ?? undefined}
        onSubmitted={() => { void refresh(); void refreshFollowed(); }}
      />

      {/* ─── Proxy console (admin_a/b "为他人提交" CTA) ──────────────────── */}
      <SubmitFormDialog
        open={proxyConsoleOpen}
        onOpenChange={setProxyConsoleOpen}
        groupedItems={serviceItemsGrouped}
        proxyConsole
        onSubmitted={() => { void refresh(); void refreshFollowed(); }}
      />

      {/* ─── Lightweight proxy pick (regular-user "为他人提交" CTA) ───────── */}
      <SubmitFormDialog
        open={proxyPickOpen}
        onOpenChange={setProxyPickOpen}
        groupedItems={serviceItemsGrouped}
        proxyPick
        onSubmitted={() => { void refresh(); void refreshFollowed(); }}
      />

      {/* Records drill-down dialog (shared primitive) */}
      <recordsDialog.node />

      {/* ─── Reject dialog ───────────────────────────────────────────────── */}
      <RejectDialog
        supportId={rejectingId}
        onConfirm={handleRejectProxy}
        onClose={() => setRejectingId(null)}
      />

      {/* ─── Edit-tags dialog (v3.2 — replaces LinkProjectDialog) ──────── */}
      <LinkTagsDialog
        open={!!linkingSupport}
        support={linkingSupport}
        onOpenChange={(v) => { if (!v) setLinkingSupport(null); }}
        onChanged={() => void refresh()}
      />

      {/* ─── Account settings (v3.2) ─────────────────────────────────────── */}
      <AccountSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        volunteerId={volunteer?.id}
        currentAvatar={volunteer?.avatar}
        onAvatarChanged={(newAvatar) => {
          setVolunteer((prev) => (prev ? { ...prev, avatar: newAvatar } : prev));
        }}
      />
    </div>
  );
}

export default MePage;
