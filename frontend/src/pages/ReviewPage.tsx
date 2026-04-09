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
import ledgerService, { LedgerOverview, LedgerTimeSeriesPoint } from '@services/ledgerService';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatLocalDate, parseLocalDate } from '@/lib/date-utils';

interface ReviewPageProps {
  isReviewer: boolean;
}

type DimensionTab = 'department' | 'volunteer' | 'service';

type VolunteerSortKey = 'rank' | 'count' | 'totalHours' | 'lastDate';
interface VolunteerSort {
  key: VolunteerSortKey;
  dir: 'asc' | 'desc';
}

function ReviewPage({ isReviewer }: ReviewPageProps) {
  const { isAuthenticated } = useAuth();
  const [overview, setOverview] = useState<LedgerOverview | null>(null);
  const [series, setSeries] = useState<LedgerTimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DimensionTab>('department');
  const [volunteerSort, setVolunteerSort] = useState<VolunteerSort>({ key: 'totalHours', dir: 'desc' });

  useEffect(() => {
    if (!isAuthenticated || !isReviewer) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([ledgerService.overview(), ledgerService.timeSeries(12)])
      .then(([oRes, tRes]) => {
        if (cancelled) return;
        if (oRes?.success && oRes.data) setOverview(oRes.data);
        else setError((oRes as any)?.error || '加载台账失败');
        if (tRes?.success && tRes.data) setSeries(tRes.data);
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
  }, [isAuthenticated, isReviewer]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  // Build 12-month bucket array. Backend only returns months that have data,
  // so we fill the gaps with zeros to render a continuous chart.
  const sparklineBuckets = useMemo(() => {
    const map = new Map<string, { count: number; totalHours: number }>();
    for (const p of series) {
      map.set(p.period, { count: p.count, totalHours: Number(p.totalHours) || 0 });
    }
    const now = new Date();
    const buckets: Array<{ period: string; label: string; count: number; totalHours: number }> = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getFullYear()}/${d.getMonth() + 1}`;
      const v = map.get(period) || { count: 0, totalHours: 0 };
      buckets.push({ period, label, count: v.count, totalHours: v.totalHours });
    }
    return buckets;
  }, [series]);

  const sparklineMax = useMemo(
    () => Math.max(1, ...sparklineBuckets.map((b) => b.totalHours)),
    [sparklineBuckets]
  );

  // Department bars: derive percentages off the max so the longest bar fills.
  const departmentBars = useMemo(() => {
    if (!overview) return [];
    const max = Math.max(1, ...overview.byDepartment.map((d) => Number(d.totalHours) || 0));
    return overview.byDepartment
      .map((d) => ({
        ...d,
        totalHours: Number(d.totalHours) || 0,
        pct: ((Number(d.totalHours) || 0) / max) * 100,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [overview]);

  const sortedVolunteers = useMemo(() => {
    if (!overview) return [];
    const arr = overview.byVolunteer.map((v, i) => ({
      ...v,
      totalHours: Number(v.totalHours) || 0,
      originalRank: i + 1,
    }));
    const dir = volunteerSort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (volunteerSort.key) {
        case 'rank':
          return (a.originalRank - b.originalRank) * dir;
        case 'count':
          return (a.count - b.count) * dir;
        case 'totalHours':
          return (a.totalHours - b.totalHours) * dir;
        case 'lastDate': {
          const ad = a.lastDate ? parseLocalDate(a.lastDate)?.getTime() ?? 0 : 0;
          const bd = b.lastDate ? parseLocalDate(b.lastDate)?.getTime() ?? 0 : 0;
          return (ad - bd) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [overview, volunteerSort]);

  // Group service items by department for the third tab.
  const serviceItemGroups = useMemo(() => {
    if (!overview) return [];
    const byDept = new Map<string, { departmentName: string; items: Array<{ id: string; name: string; count: number; totalHours: number }> }>();
    for (const s of overview.byServiceItem) {
      const g = byDept.get(s.departmentName) || { departmentName: s.departmentName, items: [] };
      g.items.push({
        id: s.serviceItemId,
        name: s.serviceItemName,
        count: s.count,
        totalHours: Number(s.totalHours) || 0,
      });
      byDept.set(s.departmentName, g);
    }
    return Array.from(byDept.values());
  }, [overview]);

  const toggleVolunteerSort = (key: VolunteerSortKey) => {
    setVolunteerSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      return { key, dir: key === 'rank' ? 'asc' : 'desc' };
    });
  };

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
          <h2 className="font-serif text-base font-semibold text-foreground">近 12 月时长趋势</h2>
          <p className="text-[11px] text-muted-foreground">单位：小时</p>
        </div>
        <div className="mt-4">
          {/*
            Bars are direct children of an `h-32 flex items-end` row so the
            child `style={{height:'X%'}}` resolves against the row height.
            The earlier wrapper-div approach gave wrappers no height, which
            collapsed every bar to 0. items-end aligns them to the bottom.
          */}
          <div className="flex h-32 items-end gap-1.5 sm:gap-2">
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
          {/* X-axis labels */}
          <div className="mt-2 flex gap-1.5 sm:gap-2">
            {sparklineBuckets.map((b) => (
              <div
                key={`l-${b.period}`}
                className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground sm:text-[10px]"
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Dimension tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1">
        {(
          [
            { key: 'department' as const, label: '按部门' },
            { key: 'volunteer' as const, label: '按志愿者' },
            { key: 'service' as const, label: '按服务项' },
          ]
        ).map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'department' && (
        <Card variant="elevated" className="p-5 sm:p-6">
          {departmentBars.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <ul className="space-y-3">
              {departmentBars.map((d, i) => (
                <li key={d.departmentId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-baseline gap-2 truncate">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-medium text-foreground truncate">{d.departmentName}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">{d.totalHours}</span>h ·{' '}
                      {d.count} 条
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        i === 0 ? 'bg-primary' : 'bg-primary/60',
                      )}
                      style={{ width: `${Math.max(d.pct, 2)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {activeTab === 'volunteer' && (
        <Card variant="elevated" className="overflow-hidden">
          {sortedVolunteers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <>
            {/* Mobile: card list (table is unwieldy on narrow screens) */}
            <ul className="divide-y divide-border/60 sm:hidden">
              {sortedVolunteers.map((v) => (
                <li key={`m-${v.volunteerCode}`} className="flex items-center gap-3 px-4 py-3">
                  {v.originalRank <= 3 ? (
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                        v.originalRank === 1 && 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
                        v.originalRank === 2 && 'bg-zinc-400/20 text-zinc-600 dark:text-zinc-300',
                        v.originalRank === 3 && 'bg-orange-400/20 text-orange-700 dark:text-orange-300',
                      )}
                    >
                      {v.originalRank}
                    </span>
                  ) : (
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums text-muted-foreground">
                      {v.originalRank}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {v.chineseName}
                      <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {v.volunteerCode}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {v.departmentId}
                      {v.lastDate && (
                        <span className="ml-1.5 tabular-nums">· 最近 {formatLocalDate(v.lastDate)}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-base font-semibold tabular-nums text-foreground">
                      {v.totalHours}
                      <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">h</span>
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">{v.count} 条</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop / tablet: full sortable table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <SortableTh
                      sortKey="rank"
                      currentSort={volunteerSort}
                      onClick={toggleVolunteerSort}
                      className="w-12"
                    >
                      #
                    </SortableTh>
                    <th className="px-3 py-2.5 text-left font-medium">姓名</th>
                    <th className="px-3 py-2.5 text-left font-medium">部门</th>
                    <SortableTh
                      sortKey="count"
                      currentSort={volunteerSort}
                      onClick={toggleVolunteerSort}
                      className="text-right"
                    >
                      条数
                    </SortableTh>
                    <SortableTh
                      sortKey="totalHours"
                      currentSort={volunteerSort}
                      onClick={toggleVolunteerSort}
                      className="text-right"
                    >
                      时长
                    </SortableTh>
                    <SortableTh
                      sortKey="lastDate"
                      currentSort={volunteerSort}
                      onClick={toggleVolunteerSort}
                      className="text-right"
                    >
                      最近
                    </SortableTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedVolunteers.map((v) => (
                    <tr
                      key={v.volunteerCode}
                      className="border-b border-border/60 last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5">
                        {v.originalRank <= 3 ? (
                          <span
                            className={cn(
                              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                              v.originalRank === 1 && 'bg-amber-400/20 text-amber-700 dark:text-amber-300',
                              v.originalRank === 2 && 'bg-zinc-400/20 text-zinc-600 dark:text-zinc-300',
                              v.originalRank === 3 && 'bg-orange-400/20 text-orange-700 dark:text-orange-300',
                            )}
                          >
                            {v.originalRank}
                          </span>
                        ) : (
                          <span className="text-xs tabular-nums text-muted-foreground">{v.originalRank}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {v.chineseName}
                        <span className="ml-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {v.volunteerCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.departmentId}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{v.count}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {v.totalHours}
                        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">h</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                        {v.lastDate ? formatLocalDate(v.lastDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
              显示前 {sortedVolunteers.length} 名（按总时长降序）
            </p>
            </>
          )}
        </Card>
      )}

      {activeTab === 'service' && (
        <div className="space-y-3">
          {serviceItemGroups.length === 0 ? (
            <Card variant="elevated" className="p-6 text-center text-sm text-muted-foreground">
              暂无数据
            </Card>
          ) : (
            serviceItemGroups.map((g) => (
              <Card key={g.departmentName} variant="elevated" className="overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                  <h3 className="font-serif text-sm font-semibold text-foreground">
                    {g.departmentName}{' '}
                    <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
                      ({g.items.length} 个服务项)
                    </span>
                  </h3>
                </div>
                <ul className="divide-y divide-border/60">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="truncate font-medium text-foreground">{it.name}</span>
                      <span className="ml-3 shrink-0 text-xs text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{it.totalHours}</span>h ·{' '}
                        {it.count} 条
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SortableTh: React.FC<{
  sortKey: VolunteerSortKey;
  currentSort: VolunteerSort;
  onClick: (key: VolunteerSortKey) => void;
  className?: string;
  children: React.ReactNode;
}> = ({ sortKey, currentSort, onClick, className, children }) => {
  const isActive = currentSort.key === sortKey;
  const arrow = isActive ? (currentSort.dir === 'asc' ? '↑' : '↓') : '';
  return (
    <th className={cn('px-3 py-2.5 font-medium', className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          isActive ? 'text-foreground' : 'hover:text-foreground',
        )}
      >
        {children}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  );
};

export default ReviewPage;
