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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  MapPin,
  PlusCircle,
  Trash2,
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

interface MePageProps {
  homeTotalVolunteers: number;
  onVolunteerDetail: (id: string) => void;
  onBackHome: () => void;
}

// ─── Avatar (matches VolunteerCard but bigger) ──────────────────────────────

const AVATAR_TONES = [
  'bg-primary/15 text-primary ring-primary/30',
  'bg-accent/15 text-accent ring-accent/30',
  'bg-chart-3/15 text-chart-3 ring-chart-3/30',
  'bg-chart-4/15 text-chart-4 ring-chart-4/30',
  'bg-chart-5/15 text-chart-5 ring-chart-5/30',
] as const;

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

const HeroAvatar: React.FC<{ name: string; code: string; size?: 'lg' | 'md' }> = ({ name, code, size = 'lg' }) => {
  const tone = AVATAR_TONES[hashCode(code) % AVATAR_TONES.length];
  const initial = name?.charAt(0) || '?';
  const sizeCls = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-base';
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl font-serif font-semibold ring-2',
        sizeCls,
        tone,
      )}
    >
      {initial}
    </div>
  );
};

// ─── Submit form schema ─────────────────────────────────────────────────────

// Duration is kept as a string in the form (avoids zod coerce input/output
// type-inference friction with react-hook-form resolver). Parsed in onSubmit.
const submitSchema = z
  .object({
    serviceItemId: z.string().min(1, '请选择服务项'),
    serviceDate: z.string().min(1, '请选择服务日期'),
    duration: z.string().min(1, '请填时长').refine((s) => {
      const n = parseFloat(s);
      return !Number.isNaN(n) && n > 0 && (n * 2) % 1 === 0;
    }, '时长必须是大于 0 的 0.5 倍数'),
    description: z.string().trim().min(5, '描述至少 5 个字').max(1000, '描述不超过 1000 字'),
    forAnother: z.boolean().optional(),
    targetVolunteerCode: z.string().optional(),
  })
  .refine(
    (d) => !d.forAnother || (d.targetVolunteerCode && d.targetVolunteerCode.trim().length > 0),
    { message: '代提交需要填写对方 volunteer code', path: ['targetVolunteerCode'] },
  );

type SubmitFormData = z.infer<typeof submitSchema>;

// ─── Submit Dialog ──────────────────────────────────────────────────────────

const SubmitFormDialog: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupedItems: ServiceItemsByDepartment[];
  onSubmitted: () => void;
}> = ({ open, onOpenChange, groupedItems, onSubmitted }) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubmitFormData>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      serviceItemId: '',
      serviceDate: today,
      duration: '1',
      description: '',
      forAnother: false,
      targetVolunteerCode: '',
    },
  });

  const forAnother = watch('forAnother');

  // Reset form whenever the dialog opens (clean state for next use)
  useEffect(() => {
    if (open) reset({ serviceItemId: '', serviceDate: today, duration: '1', description: '', forAnother: false, targetVolunteerCode: '' });
  }, [open, reset, today]);

  const onSubmit = async (data: SubmitFormData) => {
    let targetVolunteerId: string | undefined;
    if (data.forAnother && data.targetVolunteerCode) {
      const lookup = await volunteerService.getVolunteerById(data.targetVolunteerCode.trim());
      if (!lookup?.success || !lookup.data) {
        setError('targetVolunteerCode', { message: `未找到 volunteer: ${data.targetVolunteerCode}` });
        return;
      }
      targetVolunteerId = lookup.data.id;
    }

    const result = await projectSupportService.create({
      volunteerId: targetVolunteerId,
      serviceItemId: data.serviceItemId,
      serviceDate: data.serviceDate,
      duration: parseFloat(data.duration),
      description: data.description,
    });

    if (result?.success && result.data) {
      const isProxy = result.data.isProxy;
      toast({
        title: '提交成功',
        description: isProxy
          ? `已代为提交，等待 ${data.targetVolunteerCode} 确认`
          : '记录已生效',
      });
      onSubmitted();
      onOpenChange(false);
    } else {
      const errMsg = (result as any)?.error || '提交失败';
      toast({ title: '提交失败', description: errMsg, variant: 'destructive' });
      setError('root', { message: errMsg });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="提交项目支援"
      description="记录你完成的支援工作，提交后立即生效"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Service item */}
        <div className="space-y-1.5">
          <label htmlFor="ms-service-item" className="text-sm font-medium text-foreground">
            服务项 <span className="text-destructive">*</span>
          </label>
          <select
            id="ms-service-item"
            {...register('serviceItemId')}
            className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">— 选择服务项 —</option>
            {groupedItems.map((g) => (
              <optgroup key={g.department.id} label={g.department.name}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.serviceItemId && <p className="text-xs text-destructive">{errors.serviceItemId.message}</p>}
        </div>

        {/* Date + Duration row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ms-date" className="text-sm font-medium text-foreground">
              服务日期 <span className="text-destructive">*</span>
            </label>
            <input
              id="ms-date"
              type="date"
              max={today}
              {...register('serviceDate')}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.serviceDate && <p className="text-xs text-destructive">{errors.serviceDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ms-duration" className="text-sm font-medium text-foreground">
              时长（小时） <span className="text-destructive">*</span>
            </label>
            <input
              id="ms-duration"
              type="number"
              step="0.5"
              min="0.5"
              {...register('duration')}
              className="h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.duration && <p className="text-xs text-destructive">{errors.duration.message}</p>}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="ms-desc" className="text-sm font-medium text-foreground">
            描述 <span className="text-destructive">*</span>
          </label>
          <textarea
            id="ms-desc"
            rows={3}
            placeholder="简述你做了什么（5-1000 字符）"
            {...register('description')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>

        {/* Proxy submission toggle */}
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              {...register('forAnother')}
              className="h-4 w-4 rounded border-border text-primary"
            />
            为他人提交（对方需要确认）
          </label>
          {forAnother && (
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="对方的 volunteer code，如 PG-0003"
                {...register('targetVolunteerCode')}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {errors.targetVolunteerCode && (
                <p className="text-xs text-destructive">{errors.targetVolunteerCode.message}</p>
              )}
            </div>
          )}
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting} size="lg">
            {isSubmitting ? '提交中…' : '提交'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

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

// ─── Volunteer's own support record card ────────────────────────────────────

const SupportRecordCard: React.FC<{
  support: ProjectSupport;
  onDelete: (supportId: string) => void;
  busy: boolean;
}> = ({ support, onDelete, busy }) => (
  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{support.supportId}</span>
          <Badge variant={support.status === 'ACTIVE' ? 'success' : 'outline'} className="text-[10px] py-0.5">
            {support.statusDisplay}
          </Badge>
          {support.isProxy && (
            <Badge variant="info" className="text-[10px] py-0.5">代提交</Badge>
          )}
        </div>
        <p className="mt-1 font-serif text-sm font-semibold text-foreground">
          {support.serviceItem?.departmentName} / {support.serviceItem?.name}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(support.serviceDate).toISOString().split('T')[0]}
          <span>·</span>
          <Clock3 className="h-3 w-3" />
          <span className="tabular-nums">{support.duration}h</span>
        </div>
      </div>
      {support.status === 'ACTIVE' && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => onDelete(support.supportId)}
          disabled={busy}
          aria-label="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
    <p className="text-xs text-muted-foreground line-clamp-2">{support.description}</p>
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

  const totalHours = supports
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + (s.duration || 0), 0);
  const activeCount = supports.filter((s) => s.status === 'ACTIVE').length;

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

          {/* Stat strip — editorial */}
          <div className="mt-5 border-t border-border pt-4 font-serif text-sm leading-7 text-foreground">
            <span className="font-semibold text-primary tabular-nums">{activeCount}</span>
            <span className="text-muted-foreground"> 条支援 · </span>
            <span className="font-semibold text-foreground tabular-nums">{totalHours}h</span>
            <span className="text-muted-foreground"> 累计 · </span>
            <span className="font-semibold text-foreground">{volunteer?.status || '—'}</span>
          </div>
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
        {loading && supports.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            加载中…
          </p>
        ) : supports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">还没有任何支援记录</p>
            <p className="mt-1 text-xs text-muted-foreground">
              点击上方"提交项目支援"按钮记录第一条
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {supports.map((s) => (
              <SupportRecordCard key={s.id} support={s} onDelete={handleDelete} busy={busy} />
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
