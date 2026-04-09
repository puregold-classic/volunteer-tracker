// frontend/src/pages/HomePage.tsx — chunk 6 phase C (Warm Editorial rewrite)
//
// Information architecture:
//
//   ┌──────────────────────────────────┬────────────────────────┐
//   │                                  │  搜索栏 + 筛选         │
//   │                                  ├────────────────────────┤
//   │           Map (大)               │  统计概览              │
//   │                                  │  · 文本摘要            │
//   │                                  │  · 部门分布 mini chart │
//   │                                  ├────────────────────────┤
//   │                                  │  志愿者列表            │
//   └──────────────────────────────────┴────────────────────────┘
//
// 决策：
// - 顶部 filter 横条删除，整合到右侧 rail（节省垂直空间）
// - "方向" filter 删除（v2.1 没有 services 字段，是 dead UI）
// - 统计从"3 个大数字 card"改成 1 行编辑式摘要 + 部门分布 mini bar
// - mobile 仍 tab 切换 map / list，但 layout 全部 retokenize 成 Warm Editorial
//
// Map 容器尺寸：desktop 60%-65% 宽，min-height 620px。

import { useState } from 'react';
import { Filter, Map, Search, Users, X } from 'lucide-react';
import type { Volunteer } from '@services/types';
import type { VolunteersParams } from '@services/types';
import { HOT_LOCATIONS, type DistributionEntry } from '@/hooks/useHomeState';
import HomeMap from '@components/HomeMap';
import VolunteerList from '@components/VolunteerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type HomeStatus = 'all' | '在职' | '不在职';

interface HomePageStats {
  totalVolunteers: number;
  totalActive: number;
  totalHours: number;
  departmentDistribution: DistributionEntry[];
  regionDistribution: DistributionEntry[];
}

interface HomePageProps {
  homeStatus: HomeStatus;
  homeServices: string[];
  homeSearch: string;
  homeStats: HomePageStats;
  homeStatsLoading: boolean;
  selectedRegions: string[];
  selectedProvinces: string[];
  debouncedSearch: string;
  primaryFocusRegion: string;
  quickFocusOptions: readonly string[];
  homeFilterParams: VolunteersParams;
  onStatusChange: (value: HomeStatus) => void;
  onServiceToggle: (service: string) => void;
  onResetFilters: () => void;
  onProvinceSelect: (province: string) => void;
  onResetProvinceSelections: () => void;
  onQuickFocusSelect: (value: string) => void;
  onRefreshMap: () => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onLocationRemove: (type: 'province' | 'region', value: string) => void;
  onServiceRemove: (service: string) => void;
  isLocationActive: (type: 'province' | 'region', value: string) => boolean;
  onVolunteerClick: (id: string) => Promise<void> | void;
}

const STATUS_OPTIONS: { value: HomeStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '在职', label: '在职' },
  { value: '不在职', label: '不在职' },
];

// v2.1 部门 code → 中文名 lookup table. 跟 backend seed 保持一致。
const DEPARTMENT_NAMES: Record<string, string> = {
  BY_PROJECT: '笔译项目部',
  KY_PROJECT: '口译项目部',
  XZT: 'XZT',
  BY_TRAINING: '笔译培训部',
  KY_TRAINING: '口译培训部',
  DOCS: '文档部',
  PROMO: '推广部',
  TECH: '技术部',
  CARE: '人文部',
  MGMT: '管理部',
};

const REGION_DISPLAY: Record<string, string> = {
  MAINLAND: '中国大陆',
  TAIWAN: '中国台湾',
  SOUTHEAST: '东南亚',
  USA: '美国',
  EUROPE: '欧洲',
  OTHER: '其他',
};

// ─── Inline atoms ────────────────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'border border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {count != null && count > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
      {label}
      <button
        type="button"
        aria-label={`移除筛选 ${label}`}
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── SummaryPanel — editorial-style stats + dept distribution ───────────────

function SummaryPanel({ stats, loading }: { stats: HomePageStats; loading: boolean }) {
  const activeRatio =
    stats.totalVolunteers > 0
      ? `${Math.round((stats.totalActive / stats.totalVolunteers) * 100)}%`
      : '—';
  const maxDeptCount = Math.max(1, ...stats.departmentDistribution.map((d) => d.count));

  return (
    <div className="space-y-4">
      {/* Editorial summary line */}
      <div className="font-serif text-sm leading-7 text-foreground">
        {loading ? (
          <span className="text-muted-foreground">加载统计中…</span>
        ) : (
          <>
            <span className="font-semibold text-primary tabular-nums">{stats.totalVolunteers}</span>
            <span className="text-muted-foreground"> 名志愿者 · </span>
            <span className="font-semibold text-foreground tabular-nums">{stats.totalHours}h</span>
            <span className="text-muted-foreground"> 累计支援 · </span>
            <span className="font-semibold text-foreground tabular-nums">{activeRatio}</span>
            <span className="text-muted-foreground"> 在职</span>
          </>
        )}
      </div>

      {/* Department distribution mini bar */}
      {stats.departmentDistribution.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            部门分布
          </p>
          <div className="space-y-1.5">
            {stats.departmentDistribution.map((d) => {
              const widthPct = Math.round((d.count / maxDeptCount) * 100);
              return (
                <div key={d.key} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 truncate text-muted-foreground">
                    {DEPARTMENT_NAMES[d.key] || d.key}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/80 transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums text-foreground">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Region distribution */}
      {stats.regionDistribution.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            地区分布
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stats.regionDistribution.map((r) => (
              <Badge key={r.key} variant="department">
                {REGION_DISPLAY[r.key] || r.key} <span className="ml-1 tabular-nums opacity-75">{r.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

function HomePage(props: HomePageProps) {
  const {
    homeStatus,
    homeSearch,
    homeStats,
    homeStatsLoading,
    selectedRegions,
    selectedProvinces,
    debouncedSearch,
    primaryFocusRegion,
    quickFocusOptions,
    homeFilterParams,
    onStatusChange,
    onResetFilters,
    onProvinceSelect,
    onResetProvinceSelections,
    onQuickFocusSelect,
    onRefreshMap,
    onSearchChange,
    onClearSearch,
    onLocationRemove,
    isLocationActive,
    onVolunteerClick,
  } = props;

  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(homeStatus !== 'all'
      ? [{ key: 'status', label: homeStatus, onRemove: () => onStatusChange('all') }]
      : []),
    ...selectedRegions.map((r) => ({
      key: `r-${r}`,
      label: r,
      onRemove: () => onLocationRemove('region', r),
    })),
    ...selectedProvinces.map((p) => ({
      key: `p-${p}`,
      label: p,
      onRemove: () => onLocationRemove('province', p),
    })),
    ...(debouncedSearch
      ? [{ key: 'search', label: `搜索: ${debouncedSearch}`, onRemove: onClearSearch }]
      : []),
  ];

  // Right-rail filter panel: search → active chips → status / 热门省份
  const filterPanel = (
    <div className="space-y-4">
      {/* Search box */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={homeSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索姓名 / 英文名 / Code / 省份…"
          className="pl-10 pr-10"
        />
        {homeSearch && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={onClearSearch}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c) => (
            <ActiveFilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
          ))}
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            重置
          </button>
        </div>
      )}

      {/* Status filter */}
      <FilterSection label="状态" count={homeStatus !== 'all' ? 1 : 0}>
        {STATUS_OPTIONS.map((o) => (
          <Chip key={o.value} active={homeStatus === o.value} onClick={() => onStatusChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </FilterSection>

      {/* Hot provinces */}
      <FilterSection
        label="热门省份"
        count={HOT_LOCATIONS.filter((h) => isLocationActive(h.type, h.value)).length}
      >
        {HOT_LOCATIONS.map((h) => (
          <Chip
            key={h.label}
            active={isLocationActive(h.type, h.value)}
            onClick={() => {
              if (h.type === 'province') onProvinceSelect(h.value);
              else onQuickFocusSelect(h.value);
            }}
          >
            {h.label}
          </Chip>
        ))}
      </FilterSection>
    </div>
  );

  const mapElement = (
    <HomeMap
      activeProvince={selectedProvinces}
      activeRegions={selectedRegions}
      quickFocusOptions={[...quickFocusOptions]}
      focusRegion={primaryFocusRegion}
      onProvinceSelect={onProvinceSelect}
      onReset={onResetProvinceSelections}
      onQuickFocusSelect={onQuickFocusSelect}
      onRefresh={onRefreshMap}
    />
  );

  return (
    <div className="space-y-4">
      {/* ─── Mobile layout ─────────────────────────────────────────────── */}
      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={homeSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索姓名 / 英文名 / Code…"
              className="pl-10 pr-10"
            />
            {homeSearch && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={onClearSearch}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setFilterOpen(true)}
            aria-label="打开筛选"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <Card variant="elevated" className="p-4">
          <SummaryPanel stats={homeStats} loading={homeStatsLoading} />
        </Card>

        <div className="grid grid-cols-2 rounded-2xl bg-muted p-1">
          <button
            type="button"
            className={cn(
              'rounded-xl px-3 py-2 text-sm transition-colors',
              mobileTab === 'map'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMobileTab('map')}
          >
            <Map className="mr-1 inline h-4 w-4" />
            地图
          </button>
          <button
            type="button"
            className={cn(
              'rounded-xl px-3 py-2 text-sm transition-colors',
              mobileTab === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMobileTab('list')}
          >
            <Users className="mr-1 inline h-4 w-4" />
            列表
          </button>
        </div>

        {mobileTab === 'map' ? (
          <Card variant="elevated" className="overflow-hidden p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-serif text-sm font-medium text-foreground">
                {primaryFocusRegion || '全部区域'}
              </span>
              <Badge variant="outline">{activeChips.length} 个筛选</Badge>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border">{mapElement}</div>
          </Card>
        ) : (
          <Card variant="elevated" className="p-4">
            <VolunteerList
              compact
              onVolunteerClick={onVolunteerClick}
              onVolunteerSelect={setSelectedVolunteer}
              showStats={false}
              showPagination={false}
              filterParams={homeFilterParams}
            />
          </Card>
        )}
      </div>

      {/* ─── Desktop layout ────────────────────────────────────────────── */}
      <div className="hidden sm:grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        {/* Map column (left) */}
        <Card variant="elevated" className="overflow-hidden p-3 md:p-4">
          <div className="overflow-hidden rounded-2xl border border-border" style={{ minHeight: '640px' }}>
            {mapElement}
          </div>
        </Card>

        {/* Right rail: filters → stats → volunteer list, 3 separate cards */}
        <div className="space-y-4">
          <Card variant="elevated" className="p-5">
            {filterPanel}
          </Card>

          <Card variant="elevated" className="p-5">
            <SummaryPanel stats={homeStats} loading={homeStatsLoading} />
          </Card>

          <Card variant="elevated" className="p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-foreground">志愿者列表</h3>
              <span className="text-xs text-muted-foreground">点击查看详情</span>
            </div>
            <VolunteerList
              compact
              onVolunteerClick={onVolunteerClick}
              showStats={false}
              showPagination={false}
              filterParams={homeFilterParams}
            />
          </Card>
        </div>
      </div>

      {/* Mobile filter dialog */}
      <Dialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="筛选条件"
        description="移动端使用全屏筛选面板，应用后切回地图或列表浏览。"
        className="max-w-none h-[100dvh] rounded-none border-0 sm:hidden"
      >
        <div className="space-y-5">
          {filterPanel}
          <Button type="button" className="w-full" onClick={() => setFilterOpen(false)}>
            完成
          </Button>
        </div>
      </Dialog>

      {/* Mobile volunteer bottom sheet */}
      {selectedVolunteer && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[2rem] border border-border bg-card p-5 shadow-2xl sm:hidden">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-semibold text-foreground">{selectedVolunteer.chineseName}</h3>
                <Badge variant={selectedVolunteer.status === '在职' ? 'success' : 'outline'}>
                  {selectedVolunteer.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedVolunteer.region || '未设置地区'} · {selectedVolunteer.department?.name || '暂无部门'}
              </p>
              <p className="mt-2 text-sm text-foreground">{selectedVolunteer.volunteerCode}</p>
            </div>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedVolunteer(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedVolunteer(null)}>
              关闭
            </Button>
            <Button type="button" className="flex-1" onClick={() => onVolunteerClick(selectedVolunteer.id)}>
              查看详情
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { HomeStatus };
export default HomePage;
