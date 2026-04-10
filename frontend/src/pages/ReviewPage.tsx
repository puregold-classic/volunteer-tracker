// frontend/src/pages/ReviewPage.tsx — chunk 6 phase E (台账重做 MVP)
//
// Replaces the chunk-3 placeholder (4 stacked nps-panel sections) with:
//   • KPI strip (5 tiles)
//   • 12-month time-series sparkline (hand-rolled SVG bars)
//   • 3-tab dimension switcher
//       - 按部门 — horizontal bar ranking
//       - 按志愿者 — sortable table with rank, top-50
//       - 按服务项 — collapsed by department
//
// Filters (date range, department), drill-down sheets, and the side panels
// for proxy contributions / recent activity are deferred to Phase C.2 —
// the backend overview() raw queries don't currently honor dateFrom/dateTo/
// departmentId for the dimension lists, only for the aggregate summary, so
// adding filter UI now would mislead users.

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock3, FileText, Layers3, TrendingUp } from 'lucide-react';
import ledgerService, {
  type LedgerOverview,
  type LedgerTimeSeriesPoint,
  type ProxyContribution,
  type RecentActivityEntry,
} from '@services/ledgerService';
import projectSupportService from '@services/projectSupportService';
import departmentService from '@services/departmentService';
import volunteerService from '@services/volunteerService';
import serviceItemService from '@services/serviceItemService';
import type { Department, ProjectSupport, ServiceItemsByDepartment } from '@services/types';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatLocalDate, rangeToBounds, type DateRangeKey } from '@/lib/date-utils';
import { SupportRecordCard } from '@/components/shared/support-record-card';

interface ReviewPageProps {
  isReviewer: boolean;
}

type ExploreTab = 'department' | 'volunteer';

const DATE_RANGE_OPTIONS: Array<{ key: DateRangeKey; label: string }> = [
  { key: 'all', label: '全部时间' },
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: '90d', label: '近 90 天' },
  { key: 'thisMonth', label: '本月' },
  { key: 'thisYear', label: '本年' },
];

function ReviewPage({ isReviewer }: ReviewPageProps) {
  const { isAuthenticated } = useAuth();
  // Filtered data (follows filter bar)
  const [overview, setOverview] = useState<LedgerOverview | null>(null);
  const [series, setSeries] = useState<LedgerTimeSeriesPoint[]>([]);
  const [proxies, setProxies] = useState<ProxyContribution[]>([]);
  const [activity, setActivity] = useState<RecentActivityEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Filter state
  const [dateRange, setDateRange] = useState<DateRangeKey>('all');
  const [filterDeptId, setFilterDeptId] = useState<string>('');

  // Independent exploration area (own date filter, separate from top filter bar)
  const [globalOverview, setGlobalOverview] = useState<LedgerOverview | null>(null);
  const [exploreTab, setExploreTab] = useState<ExploreTab>('department');
  const [exploreRange, setExploreRange] = useState<'all' | '30d'>('all');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  // Records drill-down dialog
  const [recordsDialogTitle, setRecordsDialogTitle] = useState('');
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [recordsList, setRecordsList] = useState<ProjectSupport[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsFilters, setRecordsFilters] = useState<Record<string, string>>({});
  const RECORDS_PAGE_SIZE = 10;

  // Department list — fetched once for the filter select.
  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    departmentService.list().then((res) => {
      if (res?.success && res.data) setDepartments(res.data);
    });
  }, [isAuthenticated, isReviewer]);

  // All volunteers — for 0-value display in explore charts.
  const [allVolunteers, setAllVolunteers] = useState<Array<{ id: string; volunteerCode: string; chineseName: string; departmentId: string }>>([]);

  // All service items grouped by department — for full list display in drill-down.
  const [allServiceItems, setAllServiceItems] = useState<ServiceItemsByDepartment[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    serviceItemService.listGrouped().then((res) => {
      if (res?.success && res.data) setAllServiceItems(res.data);
    });
  }, [isAuthenticated, isReviewer]);

  // All volunteers — fetched once.
  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    volunteerService.getAllVolunteers({ limit: 200 }).then((res) => {
      if (res?.success && res.data) {
        setAllVolunteers(res.data.map((v) => ({
          id: v.id,
          volunteerCode: v.volunteerCode,
          chineseName: v.chineseName,
          departmentId: v.departmentId || v.department?.id || '',
        })));
      }
    });
  }, [isAuthenticated, isReviewer]);

  // Exploration overview — refetches when exploreRange changes.
  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    const bounds = rangeToBounds(exploreRange);
    ledgerService.overview(bounds).then((res) => {
      if (res?.success && res.data) setGlobalOverview(res.data);
    });
  }, [isAuthenticated, isReviewer, exploreRange]);

  // All 4 data sources share the same filter params (date + department).
  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const bounds = rangeToBounds(dateRange);
    const sharedParams = {
      ...bounds,
      ...(filterDeptId ? { departmentId: filterDeptId } : {}),
    };
    // Short ranges use daily granularity; wider ranges use monthly
    const isDailyRange = ['7d', '30d', 'thisMonth'].includes(dateRange);
    const granularity = isDailyRange ? 'day' as const : 'month' as const;

    Promise.all([
      ledgerService.overview(sharedParams),
      ledgerService.timeSeries({ months: 12, ...sharedParams, granularity }),
      ledgerService.proxyContributions(sharedParams),
      ledgerService.recentActivity({ limit: 12, ...bounds }),
    ])
      .then(([oRes, tRes, pRes, aRes]) => {
        if (cancelled) return;
        if (oRes?.success && oRes.data) setOverview(oRes.data);
        else setError((oRes as any)?.error || '加载台账失败');
        if (tRes?.success && tRes.data) setSeries(tRes.data);
        if (pRes?.success && pRes.data) setProxies(pRes.data);
        if (aRes?.success && aRes.data) setActivity(aRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isReviewer, dateRange, filterDeptId]);

  const hasActiveFilters = dateRange !== 'all' || !!filterDeptId;
  const resetFilters = () => {
    setDateRange('all');
    setFilterDeptId('');
  };

  // ─── Records dialog helpers ────────────────────────────────────────────────
  const fetchRecordsPage = async (filters: Record<string, string>, page: number) => {
    setRecordsLoading(true);
    try {
      const res = await projectSupportService.list({ ...filters, status: 'ACTIVE', limit: RECORDS_PAGE_SIZE, page });
      if (res?.success && res.data) {
        setRecordsList(res.data.records);
        setRecordsTotalPages(res.data.pagination?.totalPages || 1);
      }
    } finally {
      setRecordsLoading(false);
    }
  };

  const openRecordsDialog = async (title: string, filters: Record<string, string>) => {
    setRecordsDialogTitle(title);
    setRecordsDialogOpen(true);
    setRecordsList([]);
    setRecordsPage(1);
    setRecordsTotalPages(1);
    setRecordsFilters(filters);
    await fetchRecordsPage(filters, 1);
  };

  const handleRecordsPageChange = (newPage: number) => {
    setRecordsPage(newPage);
    void fetchRecordsPage(recordsFilters, newPage);
  };

  // ─── Derived data ─────────────────────────────────────────────────────────

  // Build bucket array based on current granularity. Backend only returns
  // periods that have data, so we fill the gaps with zeros.
  const isDailyRange = ['7d', '30d', 'thisMonth'].includes(dateRange);

  const sparklineBuckets = useMemo(() => {
    const map = new Map<string, { count: number; totalHours: number }>();
    for (const p of series) {
      map.set(p.period, { count: p.count, totalHours: Number(p.totalHours) || 0 });
    }
    const now = new Date();
    const buckets: Array<{ period: string; label: string; count: number; totalHours: number }> = [];

    if (isDailyRange) {
      // Daily buckets: fill the range with individual days
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : now.getDate();
      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = `${d.getMonth() + 1}/${d.getDate()}`;
        const v = map.get(period) || { count: 0, totalHours: 0 };
        buckets.push({ period, label, count: v.count, totalHours: v.totalHours });
      }
    } else {
      // Monthly buckets: rolling 12 months (or less if filtered)
      const monthCount = dateRange === 'thisYear' ? now.getMonth() + 1 : 12;
      for (let i = monthCount - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getFullYear()}/${d.getMonth() + 1}`;
        const v = map.get(period) || { count: 0, totalHours: 0 };
        buckets.push({ period, label, count: v.count, totalHours: v.totalHours });
      }
    }
    return buckets;
  }, [series, isDailyRange, dateRange]);

  const sparklineMax = useMemo(
    () => Math.max(1, ...sparklineBuckets.map((b) => b.totalHours)),
    [sparklineBuckets]
  );

  // ─── Global (unfiltered) derived data for exploration area ──────────────

  // Merge departments with overview data — include 0-value departments
  const globalDeptBars = useMemo(() => {
    if (!departments.length) return [];
    const dataMap = new Map(
      (globalOverview?.byDepartment || []).map((d) => [d.departmentId, d])
    );
    const merged = departments.map((d) => {
      const data = dataMap.get(d.id);
      return {
        departmentId: d.id,
        departmentName: d.name,
        totalHours: Number(data?.totalHours) || 0,
        count: data?.count || 0,
      };
    });
    const max = Math.max(1, ...merged.map((d) => d.totalHours));
    return merged.map((d) => ({ ...d, pct: (d.totalHours / max) * 100 }));
  }, [globalOverview, departments]);

  // Service items for the expanded department — all items including 0 values
  const expandedDeptItems = useMemo(() => {
    if (!expandedDept || !allServiceItems.length) return [];
    // Find the department group from the full service items list
    const deptGroup = allServiceItems.find((g) => g.department.name === expandedDept);
    if (!deptGroup) return [];
    // Build a lookup from overview data
    const dataMap = new Map(
      (globalOverview?.byServiceItem || [])
        .filter((s) => s.departmentName === expandedDept)
        .map((s) => [s.serviceItemId, { totalHours: Number(s.totalHours) || 0, count: s.count }])
    );
    return deptGroup.items.map((it) => {
      const data = dataMap.get(it.id);
      return {
        serviceItemId: it.id,
        serviceItemName: it.name,
        totalHours: data?.totalHours || 0,
        count: data?.count || 0,
      };
    });
  }, [expandedDept, allServiceItems, globalOverview]);

  // Merge all volunteers with overview data — include 0-value volunteers
  const globalVolunteers = useMemo(() => {
    const dataMap = new Map(
      (globalOverview?.byVolunteer || []).map((v) => [v.volunteerId, v])
    );
    const merged = allVolunteers.map((v) => {
      const data = dataMap.get(v.id);
      return {
        volunteerId: v.id,
        volunteerCode: v.volunteerCode,
        chineseName: v.chineseName,
        departmentId: v.departmentId,
        totalHours: Number(data?.totalHours) || 0,
        count: data?.count || 0,
        lastDate: data?.lastDate || null,
      };
    });
    // Sort by totalHours desc, then assign ranks
    merged.sort((a, b) => b.totalHours - a.totalHours);
    return merged.map((v, i) => ({ ...v, originalRank: i + 1 }));
  }, [globalOverview, allVolunteers]);


  // ─── Render guards ────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return <p className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">请先登录</p>;
  }
  if (!isReviewer) {
    return <p className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">需要 b_admin / a_admin / admin 权限</p>;
  }
  if (loading && !overview) {
    return <p className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">加载台账中…</p>;
  }
  if (error) {
    return <p className="mx-auto max-w-md py-16 text-center text-sm text-destructive">{error}</p>;
  }
  if (!overview) {
    return <p className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">暂无数据</p>;
  }

  const { summary } = overview;
  const span =
    summary.earliestDate && summary.latestDate
      ? `${formatLocalDate(summary.earliestDate)} → ${formatLocalDate(summary.latestDate)}`
      : '—';

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">项目支援台账</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            管理员只读视图 · 数据生成于{' '}
            <span className="tabular-nums">
              {new Date(overview.generatedAt).toLocaleString('zh-CN', { hour12: false })}
            </span>
          </p>
        </div>
      </div>

      {/* ─── Filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {/* Date range chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_RANGE_OPTIONS.map((opt) => {
            const active = dateRange === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDateRange(opt.key)}
                className={cn(
                  'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {/* Department select */}
        <div className="flex items-center gap-1.5">
          <select
            value={filterDeptId}
            onChange={(e) => setFilterDeptId(e.target.value)}
            className="h-7 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            清除筛选
          </button>
        )}
        {loading && overview && (
          <span className="text-[11px] text-muted-foreground">刷新中…</span>
        )}
      </div>

      {/* ─── KPI strip ────────────────────────────────────────────────────── */}
      {/*
        Layout: mobile 2-col / sm 4-col / lg 4-col with the 时间跨度 tile
        always spanning the full row at the bottom (the date range value
        was getting truncated in a 5-col flat layout on tablet).
      */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            {
              icon: FileText,
              label: '总记录',
              value: summary.totalRecords.toLocaleString(),
              suffix: '条',
              emphasized: true,
            },
            {
              icon: Clock3,
              label: '累计时长',
              value: summary.totalHours.toLocaleString(),
              suffix: 'h',
            },
            {
              icon: TrendingUp,
              label: '平均时长',
              value: summary.avgDuration,
              suffix: 'h/条',
            },
            {
              icon: Layers3,
              label: '覆盖部门',
              value: overview.byDepartment.length,
              suffix: '个',
            },
          ].map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.label}
                className={cn(
                  'bg-card px-4 py-4 sm:px-5 sm:py-5',
                  tile.emphasized && 'border-l-4 border-l-primary',
                )}
              >
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {tile.label}
                </div>
                <p className="mt-2 font-serif text-xl font-semibold tabular-nums leading-none text-foreground sm:text-2xl">
                  {tile.value}
                  {tile.suffix && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {tile.suffix}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
          {/* 时间跨度 — full row, label inline with value */}
          <div className="col-span-2 flex items-center justify-between gap-3 bg-card px-4 py-3 sm:col-span-4 sm:px-5">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" />
              时间跨度
            </div>
            <p className="truncate font-serif text-sm font-medium tabular-nums text-foreground sm:text-base">
              {span}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Time-series sparkline ───────────────────────────────────────── */}
      <Card variant="elevated" className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-base font-semibold text-foreground">
            {isDailyRange
              ? `${dateRange === '7d' ? '近 7 天' : dateRange === '30d' ? '近 30 天' : '本月'}时长趋势`
              : `${dateRange === 'thisYear' ? '本年' : dateRange === '90d' ? '近 3 月' : '近 12 月'}时长趋势`}
          </h2>
          <p className="text-[11px] text-muted-foreground">单位：小时</p>
        </div>
        <div className="mt-4">
          {/*
            Bars are direct children of an `h-32 flex items-end` row so the
            child `style={{height:'X%'}}` resolves against the row height.
            The earlier wrapper-div approach gave wrappers no height, which
            collapsed every bar to 0. items-end aligns them to the bottom.
          */}
          <div className={cn('flex h-32 items-end', sparklineBuckets.length > 15 ? 'gap-0.5 sm:gap-1' : 'gap-1.5 sm:gap-2')}>
            {sparklineBuckets.map((b) => {
              const h = (b.totalHours / sparklineMax) * 100;
              return (
                <div
                  key={b.period}
                  className={cn(
                    'flex-1 rounded-t-md transition-colors',
                    b.totalHours > 0
                      ? 'bg-primary/70 hover:bg-primary'
                      : 'bg-muted',
                  )}
                  style={{ height: `${Math.max(h, b.totalHours > 0 ? 6 : 4)}%` }}
                  title={`${b.period} · ${b.totalHours}h · ${b.count} 条`}
                />
              );
            })}
          </div>
          {/* X-axis labels — sparse when bucket count is high */}
          <div className={cn('mt-2 flex', sparklineBuckets.length > 15 ? 'gap-0.5 sm:gap-1' : 'gap-1.5 sm:gap-2')}>
            {sparklineBuckets.map((b, i) => {
              // Show every Nth label to avoid crowding
              const total = sparklineBuckets.length;
              const step = total <= 12 ? 1 : total <= 15 ? 2 : total <= 20 ? 3 : 5;
              const showLabel = i % step === 0 || i === total - 1;
              return (
                <div
                  key={`l-${b.period}`}
                  className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground sm:text-[10px]"
                >
                  {showLabel ? b.label : ''}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ─── Side panels: 最近活动 + 代提交贡献榜 (left-right) ────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent activity (left) */}
        <Card variant="elevated" className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5">
            <h3 className="font-serif text-sm font-semibold text-foreground">最近活动</h3>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无活动</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {activity.map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{actionLabel(a.action)}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatRelative(a.timestamp)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {a.operator?.name || '系统'}
                    {a.submitter?.name && a.submitter.name !== a.operator?.name && (
                      <span> · 原提交 {a.submitter.name}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Proxy contributions leaderboard (right) */}
        <Card variant="elevated" className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5">
            <h3 className="font-serif text-sm font-semibold text-foreground">
              代提交贡献榜
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">(帮他人录入次数)</span>
            </h3>
          </div>
          {proxies.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无代提交记录</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {proxies.slice(0, 8).map((p, i) => (
                <li key={p.volunteerCode} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                    i === 0 && 'bg-amber-400/20 text-amber-700',
                    i === 1 && 'bg-zinc-400/20 text-zinc-600',
                    i === 2 && 'bg-orange-400/20 text-orange-700',
                    i > 2 && 'bg-muted text-muted-foreground',
                  )}>{i + 1}</span>
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-foreground">{p.chineseName}</span>
                    <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">{p.volunteerCode}</span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums">
                    <span className="font-semibold text-foreground">{Number(p.proxyCount) || 0}</span>{' '}
                    <span className="text-muted-foreground">次</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ─── Exploration area (independent, unfiltered) ───────────────────── */}
      <div className="border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-2 px-1 mb-4">
          <h2 className="font-serif text-lg font-semibold text-foreground mr-3">数据探索</h2>
          {([
            { key: 'department' as const, label: '按部门' },
            { key: 'volunteer' as const, label: '按志愿者' },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setExploreTab(t.key); setExpandedDept(null); }}
              className={cn(
                'inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors',
                exploreTab === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >{t.label}</button>
          ))}
          <span className="mx-1 text-border">|</span>
          {([
            { key: 'all' as const, label: '累计' },
            { key: '30d' as const, label: '近 30 天' },
          ]).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setExploreRange(r.key)}
              className={cn(
                'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                exploreRange === r.key
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >{r.label}</button>
          ))}
        </div>

        {/* ─── Department bar chart + click-to-expand service items ──────── */}
        {exploreTab === 'department' && (
          <div className="space-y-4">
            <Card variant="elevated" className="p-5 sm:p-6">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">部门服务时长</h3>
                <p className="text-[11px] text-muted-foreground">点击柱子查看服务项</p>
              </div>
              {globalDeptBars.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">暂无数据</p>
              ) : (
                <div>
                  <div className="flex h-40 items-end gap-2 sm:gap-3">
                    {globalDeptBars.map((d) => {
                      const deptMax = Math.max(1, ...globalDeptBars.map((x) => x.totalHours));
                      const h = (d.totalHours / deptMax) * 100;
                      const isExpanded = expandedDept === d.departmentName;
                      return (
                        <div key={d.departmentId} className="flex-1" style={{ height: `${Math.max(h, d.totalHours > 0 ? 6 : 4)}%` }}>
                          <button
                            type="button"
                            onClick={() => setExpandedDept(isExpanded ? null : d.departmentName)}
                            className={cn(
                              'h-full w-full rounded-t-md transition-all',
                              isExpanded ? 'bg-primary' : d.totalHours > 0 ? 'bg-primary/60 hover:bg-primary/80' : 'bg-muted hover:bg-muted-foreground/20',
                            )}
                            title={`${d.departmentName} · ${d.totalHours}h · ${d.count} 条`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-2 sm:gap-3">
                    {globalDeptBars.map((d) => (
                      <div key={`l-${d.departmentId}`} className="flex-1 text-center">
                        <p className="text-[8px] leading-tight text-muted-foreground truncate sm:text-[9px]">{d.departmentName.replace(/部$/, '')}</p>
                        <p className="text-[9px] tabular-nums text-foreground font-medium">{d.totalHours}h</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Expanded: all service items for the selected department */}
            {expandedDept && (
              <Card variant="elevated" className="p-5 sm:p-6">
                <div className="flex items-baseline justify-between mb-4">
                  <h4 className="font-serif text-sm font-semibold text-foreground">
                    {expandedDept}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">服务项分布</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">点击柱子查看记录</p>
                </div>
                {expandedDeptItems.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">暂无服务项</p>
                ) : (
                  <div className={cn(expandedDeptItems.length > 10 && 'overflow-x-auto')}>
                    <div
                      className="flex h-28 items-end gap-1.5 sm:h-36"
                      style={expandedDeptItems.length > 10 ? { minWidth: `${expandedDeptItems.length * 3}rem` } : undefined}
                    >
                      {expandedDeptItems.map((it) => {
                        const itemMax = Math.max(1, ...expandedDeptItems.map((x) => x.totalHours));
                        const h = (it.totalHours / itemMax) * 100;
                        return (
                          <div key={it.serviceItemId} className="flex-1" style={{ height: `${Math.max(h, it.totalHours > 0 ? 6 : 4)}%` }}>
                            <button
                              type="button"
                              onClick={() => openRecordsDialog(`${expandedDept} / ${it.serviceItemName}`, { serviceItemId: it.serviceItemId })}
                              className={cn(
                                'h-full w-full rounded-t-md transition-colors',
                                it.totalHours > 0 ? 'bg-accent/60 hover:bg-accent' : 'bg-muted hover:bg-muted-foreground/20',
                              )}
                              title={`${it.serviceItemName} · ${it.totalHours}h · ${it.count} 条`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="mt-2 flex gap-1.5"
                      style={expandedDeptItems.length > 10 ? { minWidth: `${expandedDeptItems.length * 3}rem` } : undefined}
                    >
                      {expandedDeptItems.map((it) => (
                        <div key={`l-${it.serviceItemId}`} className="flex-1 text-center">
                          <p className="text-[8px] leading-tight text-muted-foreground truncate sm:text-[9px]">{it.serviceItemName}</p>
                          <p className="text-[9px] tabular-nums text-foreground font-medium">{it.totalHours}h</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ─── Volunteer bar chart ───────────────────────────────────────── */}
        {exploreTab === 'volunteer' && (
          <Card variant="elevated" className="p-5 sm:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                志愿者服务时长 <span className="normal-case">({globalVolunteers.length} 人)</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">点击柱子查看记录</p>
            </div>
            {globalVolunteers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <div className={cn(globalVolunteers.length > 10 && 'overflow-x-auto')}>
                <div
                  className="flex h-32 items-end gap-1.5 sm:h-40"
                  style={globalVolunteers.length > 10 ? { minWidth: `${globalVolunteers.length * 3}rem` } : undefined}
                >
                  {globalVolunteers.map((v) => {
                    const volMax = Math.max(1, ...globalVolunteers.map((x) => x.totalHours));
                    const h = (v.totalHours / volMax) * 100;
                    return (
                      <div key={v.volunteerId} className="flex-1" style={{ height: `${Math.max(h, v.totalHours > 0 ? 6 : 4)}%` }}>
                        <button
                          type="button"
                          onClick={() => openRecordsDialog(v.chineseName, { volunteerId: v.volunteerId })}
                          className={cn(
                            'h-full w-full rounded-t-md transition-colors',
                            v.totalHours > 0 ? 'bg-primary/60 hover:bg-primary' : 'bg-muted hover:bg-muted-foreground/20',
                          )}
                          title={`${v.chineseName} (${v.volunteerCode}) · ${v.totalHours}h · ${v.count} 条`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-2 flex gap-1.5"
                  style={globalVolunteers.length > 10 ? { minWidth: `${globalVolunteers.length * 3}rem` } : undefined}
                >
                  {globalVolunteers.map((v) => (
                    <div key={`l-${v.volunteerId}`} className="flex-1 text-center">
                      <p className="text-[8px] leading-tight text-muted-foreground truncate sm:text-[9px]">{v.chineseName}</p>
                      <p className="text-[9px] tabular-nums text-foreground font-medium">{v.totalHours}h</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ─── Records list dialog ──────────────────────────────────────────── */}
      <Dialog
        open={recordsDialogOpen}
        onOpenChange={setRecordsDialogOpen}
        title={recordsDialogTitle}
        description="项目支援记录"
        className="sm:max-w-xl"
      >
        {recordsLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
        ) : recordsList.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">暂无记录</p>
        ) : (
          <>
            <div className="max-h-[28rem] overflow-y-auto space-y-2.5 pr-1">
              {recordsList.map((r) => (
                <SupportRecordCard key={r.id} support={r} showDelete={false} showId={false} />
              ))}
            </div>
            {recordsTotalPages > 1 && (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <button
                  type="button"
                  disabled={recordsPage <= 1}
                  onClick={() => handleRecordsPageChange(recordsPage - 1)}
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none hover:bg-muted"
                >
                  上一页
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  第 {recordsPage}/{recordsTotalPages} 页
                </span>
                <button
                  type="button"
                  disabled={recordsPage >= recordsTotalPages}
                  onClick={() => handleRecordsPageChange(recordsPage + 1)}
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none hover:bg-muted"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  support_create: '提交支援',
  support_update: '修改支援',
  support_delete: '删除支援',
  support_confirm: '确认代提交',
  support_reject: '拒绝代提交',
  volunteer_create: '创建志愿者',
  volunteer_update: '修改志愿者',
  volunteer_deactivate: '停用志愿者',
  account_create: '创建账号',
  account_update: '修改账号',
  month_lock: '月结锁定',
  system_cleanup: '系统清理',
  seed_import: '初始化导入',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return formatLocalDate(iso);
}

export default ReviewPage;
