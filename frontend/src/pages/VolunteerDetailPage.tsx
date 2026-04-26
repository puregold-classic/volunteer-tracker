// frontend/src/pages/VolunteerDetailPage.tsx — chunk 6 phase E
//
// Visual parity with MePage. Layout:
//
//   ┌────────────────────────────────┐
//   │  Hero (avatar + name + meta)   │
//   │  · 3 stat tiles                │
//   │  · 90 day heatmap              │
//   ├────────────────────────────────┤
//   │  联系方式 (inline strip)        │
//   ├────────────────────────────────┤
//   │  [+ 为 XX 提交项目支援]         │ ← only for logged-in non-self volunteers/admins
//   ├────────────────────────────────┤
//   │  支援记录 (按月分组, sticky)    │
//   └────────────────────────────────┘
//
// Auth model:
//   • Anonymous viewers — page is reachable but project-support records are
//     gated behind a "请登录" prompt (the API rejects anonymous list calls).
//     The Home page itself blocks anonymous clicks before navigation, so
//     this is the deep-link safety net.
//   • Logged-in volunteers viewing themselves — VolunteerCard click handler
//     in App.tsx redirects to /me. As a defensive measure we also redirect
//     here on mount.
//   • Logged-in volunteers viewing someone else — see "为 XX 提交" CTA
//     (locked-proxy mode of SubmitFormDialog).
//   • Admins — same CTA; backend allows admin to create on behalf of any
//     volunteer.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Calendar, ChevronRight, Mail, MapPin, Phone, PlusCircle } from 'lucide-react';
import volunteerService from '@services/volunteerService';
import projectSupportService from '@services/projectSupportService';
import serviceItemService from '@services/serviceItemService';
import type { Volunteer, ProjectSupport, ServiceItemsByDepartment } from '@services/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { parseLocalDate, formatLocalDate } from '@/lib/date-utils';
import { HeroAvatar } from '@/components/shared/hero-avatar';
import { FollowHeart } from '@/components/shared/follow-heart';
import { FollowListPopover } from '@/components/shared/follow-list-popover';
import volunteerListService from '@services/volunteerListService';
import ledgerService, { type LedgerVolunteerService } from '@services/ledgerService';
import { ScrollableBarChart } from '@/components/shared/scrollable-bar-chart';
import { useRecordsDialog } from '@/components/shared/records-dialog';
import { deptColor } from '@/lib/ledger-colors';
import { SubmitFormDialog } from '@/components/shared/submit-form-dialog';

interface VolunteerDetailPageProps {
  volunteerId: string;
  onBackHome: () => void;
}

function VolunteerDetailPage({ volunteerId, onBackHome }: VolunteerDetailPageProps) {
  const { account, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isSystemAdmin = account?.role === 'admin';
  const isSelf = !!account?.volunteerId && account.volunteerId === volunteerId;
  const canProxySubmit = isAuthenticated && !isSelf && (!!account?.volunteerId || isSystemAdmin);

  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [supports, setSupports] = useState<ProjectSupport[]>([]);
  const [serviceItemsGrouped, setServiceItemsGrouped] = useState<ServiceItemsByDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [services, setServices] = useState<LedgerVolunteerService[]>([]);
  const recordsDialog = useRecordsDialog();

  // Defensive self-redirect: should be unreachable when navigating from
  // Home (App.tsx blocks it) but catches deep-links and bookmarks.
  useEffect(() => {
    if (isSelf) navigate('/me', { replace: true });
  }, [isSelf, navigate]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const vRes = await volunteerService.getVolunteerById(volunteerId);
      if (!vRes?.success || !vRes.data) {
        setError('未找到该志愿者');
        setVolunteer(null);
        setSupports([]);
        return;
      }
      setVolunteer(vRes.data);

      // Records and service items both need auth.
      if (isAuthenticated) {
        const [sRes, itemsRes, fRes, svcRes] = await Promise.all([
          projectSupportService.list({ volunteerId: vRes.data.id, limit: 50 }),
          canProxySubmit ? serviceItemService.listGrouped() : Promise.resolve({ success: false }) as any,
          volunteerListService.followerCount(vRes.data.id),
          ledgerService.volunteerServices(vRes.data.id),
        ]);
        if (sRes?.success && sRes.data?.records) setSupports(sRes.data.records);
        if (itemsRes?.success && itemsRes.data) setServiceItemsGrouped(itemsRes.data);
        if (fRes?.success && fRes.data) setFollowerCount(fRes.data.count);
        if (svcRes?.success && svcRes.data) setServices(svcRes.data);
      } else {
        setSupports([]);
        setServices([]);
      }
    } catch (err: any) {
      setError(err?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volunteerId, isAuthenticated]);

  // ─── Stat / heatmap / month grouping ─────────────────────────────────────
  // Mirrors MePage but only counts ACTIVE records and skips status filtering
  // (someone else's REJECTED records are not surfaced).
  const { stats, heatmap } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthHours = 0;
    let monthCount = 0;
    let totalHours = 0;
    let totalCount = 0;

    const heatmapMap = new Map<string, number>();
    const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);

    for (const s of supports) {
      if (s.status !== 'ACTIVE') continue;
      totalCount += 1;
      const dur = s.duration || 0;
      totalHours += dur;
      const d = parseLocalDate(s.serviceDate);
      if (!d) continue;
      if (d >= monthStart) { monthHours += dur; monthCount += 1; }
      if (d >= ninetyDaysAgo && d <= now) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + dur);
      }
    }

    const heatmapArr: Array<{ key: string; hours: number }> = [];
    for (let i = 89; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      heatmapArr.push({ key, hours: heatmapMap.get(key) || 0 });
    }

    return {
      stats: { totalHours, totalCount, monthHours, monthCount },
      heatmap: heatmapArr,
    };
  }, [supports]);

  // ─── Render guards ────────────────────────────────────────────────────────

  if (isSelf) return null; // about to redirect

  if (loading && !volunteer) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }
  if (error || !volunteer) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">{error || '未找到该志愿者'}</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onBackHome}>
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-20 sm:space-y-5">
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <HeroAvatar name={volunteer.chineseName} code={volunteer.volunteerCode} size="lg" avatarUrl={volunteer.avatar} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="font-serif text-xl font-semibold text-foreground">
                    {volunteer.chineseName}
                  </h1>
                  {followerCount > 0 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {followerCount} 人关注
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <FollowHeart
                    volunteerId={volunteer.id}
                    volunteerName={volunteer.chineseName}
                    size="md"
                  />
                  <FollowListPopover
                    volunteerId={volunteer.id}
                    volunteerName={volunteer.chineseName}
                    size="md"
                  />
                </div>
              </div>
              {volunteer.englishName && (
                <p className="text-sm text-muted-foreground italic">{volunteer.englishName}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{volunteer.volunteerCode}</span>
                {volunteer.department && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {volunteer.department.name}
                  </span>
                )}
                {volunteer.region && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {volunteer.region}
                    {volunteer.province ? ` · ${volunteer.province}` : ''}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    volunteer.status === '在职'
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {volunteer.status}
                </span>
              </div>
            </div>
          </div>

          {/* Stat tiles: 本月 / 累计 — only when authed (anonymous can't fetch) */}
          {isAuthenticated && (
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 sm:gap-3">
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
            </div>
          )}

          {/* 90 天活跃热力条 */}
          {isAuthenticated && stats.totalCount > 0 && (
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

      {/* ─── 联系方式 ───────────────────────────────────────────────────── */}
      {(volunteer.email || volunteer.phone || volunteer.joinDate) && (
        <Card variant="elevated" className="overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="font-serif text-base font-semibold text-foreground">联系方式</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {volunteer.email && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">邮箱</dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground">
                      <a
                        href={`mailto:${volunteer.email}`}
                        className="hover:text-primary hover:underline"
                      >
                        {volunteer.email}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
              {volunteer.phone && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">电话</dt>
                    <dd className="mt-0.5 truncate text-sm text-foreground tabular-nums">
                      {volunteer.phone}
                    </dd>
                  </div>
                </div>
              )}
              {volunteer.joinDate && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">加入时间</dt>
                    <dd className="mt-0.5 text-sm text-foreground tabular-nums">
                      {formatLocalDate(volunteer.joinDate)}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </Card>
      )}

      {/* ─── Submit CTA (proxy mode) ─────────────────────────────────────── */}
      {canProxySubmit && (
        <Button
          type="button"
          size="lg"
          className="w-full font-serif text-base h-14 rounded-2xl shadow-md"
          onClick={() => setSubmitOpen(true)}
        >
          <PlusCircle className="h-5 w-5" />
          为 {volunteer.chineseName} 提交项目支援
        </Button>
      )}

      {/* ─── Support records → service distribution (v3 wave-3) ─────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-serif text-base font-semibold text-foreground">
            项目支援记录{' '}
            {isAuthenticated && (
              <span className="text-muted-foreground">({stats.totalCount})</span>
            )}
          </h2>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">登录后可查看该志愿者的项目支援记录</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/login')}
            >
              去登录
            </Button>
          </div>
        ) : loading ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            加载中…
          </p>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">暂无已生效的支援记录</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-[11px] font-medium text-muted-foreground">
              服务分布 · 同部门同色 · 点击柱子看条目
            </p>
            <ScrollableBarChart
              bars={services.map((s) => ({
                key: s.serviceItemId,
                label: s.serviceItemName,
                sublabel: s.departmentName,
                value: Number(s.totalHours),
                color: deptColor(s.departmentId),
                onClick: () => recordsDialog.open(
                  `${volunteer.chineseName} / ${s.serviceItemName}`,
                  { volunteerId: volunteer.id, serviceItemId: s.serviceItemId },
                ),
              }))}
              height={160}
              formatValue={(n) => `${n}h`}
            />
          </div>
        )}
      </section>

      <recordsDialog.node />

      {/* ─── Footer link to home ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBackHome}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3 w-3 rotate-180" />
        返回首页
      </button>

      {/* ─── Submit dialog (locked-proxy) ────────────────────────────────── */}
      <SubmitFormDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        groupedItems={serviceItemsGrouped}
        targetVolunteer={{ id: volunteer.id, chineseName: volunteer.chineseName }}
        onSubmitted={() => void refresh()}
      />
    </div>
  );
}

export default VolunteerDetailPage;
