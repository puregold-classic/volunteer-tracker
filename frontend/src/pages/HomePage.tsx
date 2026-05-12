// frontend/src/pages/HomePage.tsx — chunk 6 phase C.5
//
// IA v3 (after user feedback round 1):
//
//   ┌──────────────────────────────────┬──────────────────────────┐
//   │                                  │  Card 1: 筛选条件         │
//   │                                  │  · 状态 chips             │
//   │                                  │  · 部门 dropdown ← NEW    │
//   │                                  │  · 热门省份 chips         │
//   │                                  │  · active chips + reset   │
//   │                                  ├──────────────────────────┤
//   │           Map (左侧主区)          │  Card 2: 志愿者结果       │
//   │                                  │  · 1 行 stat strip        │
//   │                                  │  · 搜索 input ← MOVED     │
//   │                                  │  ─────────────            │
//   │                                  │  · 单列 volunteer cards   │
//   │                                  │    (内部 scroll)          │
//   └──────────────────────────────────┴──────────────────────────┘
//
// 决策（基于 user 反馈）：
// - 搜索框移到 list card 顶部（"和列表放一块更直觉"）
// - 新增 部门 dropdown（10 项），filter card 唯一新增内容
// - SummaryPanel 简化为 1 行 stat strip 内嵌 list card；mini bar chart 砍掉
//   （信息密度上 mini chart 跟 dept dropdown 重复，list card 也腾出空间）
// - Volunteer cards 改成单列 + 完整宽度（不再 2x2 截断名字）
// - List card 内部 max-height + scroll（保证整个 page 不外滚）
// - 整体 fit viewport ~900px 不需要 page-level scroll

import { lazy, Suspense, useState } from 'react';
import { Filter, Map, Search, Users, X } from 'lucide-react';
import type { Volunteer, VolunteersParams } from '@services/types';
import type { ProvinceCount } from '@components/HomeMap/HomeMap';
import { HOT_LOCATIONS } from '@/hooks/useHomeState';
// HomeMap pulls in leaflet (~150kB). Defer it past first paint so the
// list + filter chrome shows immediately while leaflet hydrates in the
// background.
const HomeMap = lazy(() => import('@components/HomeMap'));
import VolunteerList from '@components/VolunteerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type HomeStatus = 'all' | '在职' | '不在职';

interface HomePageStats {
  totalVolunteers: number;
  totalActive: number;
  totalHours: number;
}

interface HomePageProps {
  homeStatus: HomeStatus;
  homeServices: string[];
  homeDepartmentId: string;
  homeSearch: string;
  homeStats: HomePageStats;
  homeStatsLoading: boolean;
  selectedRegions: string[];
  selectedProvinces: string[];
  debouncedSearch: string;
  primaryFocusRegion: string;
  quickFocusOptions: readonly string[];
  homeFilterParams: VolunteersParams;
  provinceCounts?: ProvinceCount[];
  onStatusChange: (value: HomeStatus) => void;
  onDepartmentChange: (value: string) => void;
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

// 部门 — 跟 backend seed 保持一致，按 displayOrder 排。v3 增 READING_CLUB / VIDEO
const DEPARTMENTS: { id: string; name: string }[] = [
  { id: 'BY_PROJECT', name: '笔译项目部' },
  { id: 'KY_PROJECT', name: '口译项目部' },
  { id: 'XZT', name: 'XZT' },
  { id: 'BY_TRAINING', name: '笔译培训部' },
  { id: 'KY_TRAINING', name: '口译培训部' },
  { id: 'DOCS', name: '文档部' },
  { id: 'PROMO', name: '推广部' },
  { id: 'TECH', name: '技术部' },
  { id: 'CARE', name: '人文部' },
  { id: 'MGMT', name: '管理部' },
  { id: 'READING_CLUB', name: '共读会' },
  { id: 'VIDEO', name: '视频部' },
];

// ─── Atoms ──────────────────────────────────────────────────────────────────

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
        'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground shadow-sm border border-primary'
          : 'border border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-foreground/70">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/20">
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

// ─── Stat strip — single line, replaces SummaryPanel ────────────────────────

function StatStrip({ stats, loading }: { stats: HomePageStats; loading: boolean }) {
  const activeRatio =
    stats.totalVolunteers > 0
      ? `${Math.round((stats.totalActive / stats.totalVolunteers) * 100)}%`
      : '—';
  return (
    <div className="font-serif text-sm leading-7 text-foreground">
      {loading ? (
        <span className="text-muted-foreground">加载统计中…</span>
      ) : (
        <>
          <span className="font-semibold text-primary tabular-nums">{stats.totalVolunteers}</span>
          <span className="text-muted-foreground"> 名 · </span>
          <span className="font-semibold text-foreground tabular-nums">{stats.totalHours}h</span>
          <span className="text-muted-foreground"> 累计 · </span>
          <span className="font-semibold text-foreground tabular-nums">{activeRatio}</span>
          <span className="text-muted-foreground"> 在职</span>
        </>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

function HomePage(props: HomePageProps) {
  const {
    homeStatus,
    homeDepartmentId,
    homeSearch,
    homeStats,
    homeStatsLoading,
    selectedRegions,
    selectedProvinces,
    debouncedSearch,
    primaryFocusRegion,
    quickFocusOptions,
    homeFilterParams,
    provinceCounts,
    onStatusChange,
    onDepartmentChange,
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
  const [activeChipsExpanded, setActiveChipsExpanded] = useState(false);

  const departmentName = homeDepartmentId
    ? DEPARTMENTS.find((d) => d.id === homeDepartmentId)?.name || homeDepartmentId
    : '';

  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(homeStatus !== 'all'
      ? [{ key: 'status', label: homeStatus, onRemove: () => onStatusChange('all') }]
      : []),
    ...(homeDepartmentId
      ? [{ key: 'dept', label: departmentName, onRemove: () => onDepartmentChange('') }]
      : []),
    ...selectedRegions.map((r) => ({
      key: `r-${r}`,
      label: r,
      onRemove: () => onLocationRemove('region', r),
    })),
    // 中国大陆已包含所有大陆省份，不重复显示省份 chips
    ...(selectedRegions.includes('中国大陆')
      ? []
      : selectedProvinces.map((p) => ({
          key: `p-${p}`,
          label: p,
          onRemove: () => onLocationRemove('province', p),
        }))),
    ...(debouncedSearch
      ? [{ key: 'search', label: `搜索: ${debouncedSearch}`, onRemove: onClearSearch }]
      : []),
  ];

  // Filter card content — compact horizontal layout, geographic filters
  // moved to map toolbar (see phase C.6 user feedback).
  //
  // Active chips overflow strategy: when many provinces are selected they
  // would otherwise stack vertically and push everything else down. Cap
  // visible chips to 3, show "+N" badge for the rest. The overflow expands
  // into a popover (or just toggle to show all) on click.
  const ACTIVE_CHIPS_VISIBLE = 3;
  const visibleChips = activeChipsExpanded ? activeChips : activeChips.slice(0, ACTIVE_CHIPS_VISIBLE);
  const hiddenChipCount = activeChips.length - ACTIVE_CHIPS_VISIBLE;

  const filterPanel = (
    <div className="space-y-3">
      {/* Active chips bar — capped at 3 visible, "+N" expander for the rest */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {visibleChips.map((c) => (
            <ActiveFilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
          ))}
          {!activeChipsExpanded && hiddenChipCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveChipsExpanded(true)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              +{hiddenChipCount}
            </button>
          )}
          {activeChipsExpanded && activeChips.length > ACTIVE_CHIPS_VISIBLE && (
            <button
              type="button"
              onClick={() => setActiveChipsExpanded(false)}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              收起
            </button>
          )}
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            重置全部
          </button>
        </div>
      )}

      {/* Left-right layout: 状态 chips + 部门 dropdown */}
      <div className="flex items-center gap-4">
        <FilterRow label="状态">
          {STATUS_OPTIONS.map((o) => (
            <Chip key={o.value} active={homeStatus === o.value} onClick={() => onStatusChange(o.value)}>
              {o.label}
            </Chip>
          ))}
        </FilterRow>

        <div className="ml-6">
          <FilterRow label="部门">
            <Select value={homeDepartmentId} onChange={(e) => onDepartmentChange(e.target.value)}>
              <option value="">全部</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FilterRow>
        </div>
      </div>
    </div>
  );

  // List card content: stat strip + search + scrollable list
  const listPanel = (
    <div className="flex h-full flex-col">
      {/* Stat strip */}
      <StatStrip stats={homeStats} loading={homeStatsLoading} />

      {/* Search */}
      <div className="relative mt-3">
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

      {/* Divider */}
      <div className="my-3 border-t border-border" />

      {/* Scrollable list */}
      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
        <VolunteerList
          compact
          onVolunteerClick={onVolunteerClick}
          onVolunteerSelect={setSelectedVolunteer}
          showStats={false}
          showPagination={false}
          filterParams={homeFilterParams}
        />
      </div>
    </div>
  );

  const mapElement = (
    <Suspense
      fallback={
        <div className="flex h-[24rem] min-h-[24rem] items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground md:h-full">
          地图加载中…
        </div>
      }
    >
      <HomeMap
        activeProvince={selectedProvinces}
        activeRegions={selectedRegions}
        quickFocusOptions={[...quickFocusOptions]}
        hotLocations={HOT_LOCATIONS}
        focusRegion={primaryFocusRegion}
        onProvinceSelect={onProvinceSelect}
        onReset={onResetProvinceSelections}
        onQuickFocusSelect={onQuickFocusSelect}
        onRefresh={onRefreshMap}
        isLocationActive={isLocationActive}
        provinceCounts={provinceCounts}
      />
    </Suspense>
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
          <StatStrip stats={homeStats} loading={homeStatsLoading} />
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

      {/* ─── Desktop layout — fits viewport, no page scroll ──────────────
        phase C.8: 热门省份 strip 删除（搬到地图左侧 collapsible），
        height calc(100vh - 10rem) → calc(100vh - 8rem) 多 32px 给地图。
      */}
      <div
        className="hidden sm:grid gap-4 xl:grid-cols-[1.7fr_1fr]"
        style={{ height: 'calc(100vh - 8rem)', minHeight: '32rem' }}
      >
        {/* Map column (left, full height) */}
        <Card variant="elevated" className="overflow-hidden p-3 md:p-4">
          <div className="h-full overflow-hidden rounded-2xl border border-border">
            {mapElement}
          </div>
        </Card>

        {/* Right rail: 2 cards split top/bottom */}
        <div className="grid grid-rows-[auto_1fr] gap-4 min-h-0">
          {/* Card 1: filters (auto-height, content-driven) */}
          <Card variant="elevated" className="p-4 md:p-5">
            {filterPanel}
          </Card>

          {/* Card 2: stats + search + scrollable volunteer list (fills remaining space) */}
          <Card variant="elevated" className="flex flex-col p-4 md:p-5 min-h-0 overflow-hidden">
            {listPanel}
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
