import { ChevronDown, Filter, Map, Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import type { Volunteer } from '@services/types';
import type { VolunteersParams } from '@services/api';
import { HOT_LOCATIONS } from '@/hooks/useHomeState';
import HomeMap from '@components/HomeMap';
import VolunteerList from '@components/VolunteerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/shared/stat-card';
import { cn } from '@/lib/utils';

type HomeStatus = 'all' | '在职' | '不在职';

interface HomePageProps {
  homeStatus: HomeStatus;
  homeServices: string[];

  homeSearch: string;
  homeStats: {
    totalVolunteers: number;
    totalActive: number;
    totalHours: number;
  };
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

const SERVICE_OPTIONS = ['翻译', '校对', '管理', '技术'] as const;
const STATUS_OPTIONS: { value: HomeStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '在职', label: '在职' },
  { value: '不在职', label: '不在职' },
];

const CHIPS_VISIBLE = 4;

function FilterSection({
  label,
  open,
  onToggle,
  count,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
      >
        {label}
        {count != null && count > 0 && (
          <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            {count}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}

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
        'rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
        active
          ? 'bg-teal-600 text-white shadow-sm'
          : 'border border-neutral-200 bg-white text-neutral-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-teal-900/30'
      )}
    >
      {children}
    </button>
  );
}

function ActiveFilterChip({
  label,
  onRemove,
  variant = 'default',
}: {
  label: string;
  onRemove: () => void;
  variant?: 'default' | 'location' | 'service' | 'search';
}) {
  const colorMap = {
    default: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
    location: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-700/50',
    service: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700/50',
    search: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700/50',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', colorMap[variant])}>
      {label}
      <button
        type="button"
        aria-label={`移除筛选 ${label}`}
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function HomePage(props: HomePageProps) {
  const {
    homeStatus,
    homeServices,

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
    onServiceToggle,
    onResetFilters,
    onProvinceSelect,
    onResetProvinceSelections,
    onQuickFocusSelect,
    onRefreshMap,
    onSearchChange,
    onClearSearch,
    onLocationRemove,
    onServiceRemove,
    isLocationActive,
    onVolunteerClick,
  } = props;

  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [statusOpen, setStatusOpen] = useState(true);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [provinceOpen, setProvinceOpen] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const activeRatio = homeStats.totalVolunteers > 0
    ? `${Math.round((homeStats.totalActive / homeStats.totalVolunteers) * 100)}%`
    : '0%';

  // Build ordered active filter chips for display
  type ActiveChip =
    | { kind: 'status' }
    | { kind: 'service'; value: string }
    | { kind: 'region'; value: string }
    | { kind: 'province'; value: string }
    | { kind: 'search' };

  const allChips: ActiveChip[] = [
    ...(homeStatus !== 'all' ? [{ kind: 'status' as const }] : []),
    ...homeServices.map(s => ({ kind: 'service' as const, value: s })),
    ...selectedRegions.map(r => ({ kind: 'region' as const, value: r })),
    ...selectedProvinces.map(p => ({ kind: 'province' as const, value: p })),
    ...(debouncedSearch ? [{ kind: 'search' as const }] : []),
  ];
  const visibleChips = filtersExpanded ? allChips : allChips.slice(0, CHIPS_VISIBLE);
  const hiddenCount = allChips.length - CHIPS_VISIBLE;

  const renderChip = (chip: ActiveChip, _idx: number) => {
    switch (chip.kind) {
      case 'status':
        return (
          <ActiveFilterChip key="status" label={homeStatus} onRemove={() => onStatusChange('all')} />
        );
      case 'service':
        return (
          <ActiveFilterChip key={`svc-${chip.value}`} label={chip.value} variant="service" onRemove={() => onServiceRemove(chip.value)} />
        );
      case 'region':
        return (
          <ActiveFilterChip key={`region-${chip.value}`} label={chip.value} variant="location" onRemove={() => onLocationRemove('region', chip.value)} />
        );
      case 'province':
        return (
          <ActiveFilterChip key={`province-${chip.value}`} label={chip.value} variant="location" onRemove={() => onLocationRemove('province', chip.value)} />
        );
      case 'search':
        return (
          <ActiveFilterChip key="search" label={`搜索: ${debouncedSearch}`} variant="search" onRemove={onClearSearch} />
        );
      default:
        return null;
    }
  };

  const filterPanel = (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      <FilterSection label="状态" open={statusOpen} onToggle={() => setStatusOpen(v => !v)} count={homeStatus !== 'all' ? 1 : 0}>
        {STATUS_OPTIONS.map((o) => (
          <Chip key={o.value} active={homeStatus === o.value} onClick={() => onStatusChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </FilterSection>

      <FilterSection label="方向" open={serviceOpen} onToggle={() => setServiceOpen(v => !v)} count={homeServices.length}>
        {SERVICE_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onServiceToggle(s)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
              homeServices.includes(s)
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-neutral-200 bg-white text-neutral-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-emerald-900/30'
            )}
          >
            {homeServices.includes(s) && <span className="h-1.5 w-1.5 rounded-full bg-white/80" />}
            {s}
          </button>
        ))}
      </FilterSection>

      <FilterSection label="热门省份" open={provinceOpen} onToggle={() => setProvinceOpen(v => !v)} count={HOT_LOCATIONS.filter(h => isLocationActive(h.type, h.value)).length}>
        {HOT_LOCATIONS.map((h) => (
          <Chip key={h.label} active={isLocationActive(h.type, h.value)} onClick={() => {
            if (h.type === 'province') onProvinceSelect(h.value);
            else onQuickFocusSelect(h.value);
          }}>
            {h.label}
          </Chip>
        ))}
      </FilterSection>

      <div className="ml-auto flex items-center self-start pt-0.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onResetFilters}>重置</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mobile layout */}
      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input value={homeSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索姓名 / 英文名 / ID / 省份..." className="pl-10 pr-10" />
            {homeSearch && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" onClick={onClearSearch}><X className="h-4 w-4" /></button>}
          </div>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setFilterOpen(true)} aria-label="打开筛选">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="匹配" value={homeStatsLoading ? '...' : homeStats.totalVolunteers} />
          <StatCard label="在职占比" value={homeStatsLoading ? '...' : activeRatio} />
          <StatCard label="总时长" value={homeStatsLoading ? '...' : `${homeStats.totalHours}h`} />
        </div>

        <div className="grid grid-cols-2 rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800">
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${mobileTab === 'map' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'}`} onClick={() => setMobileTab('map')}><Map className="mr-1 inline h-4 w-4" />地图</button>
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${mobileTab === 'list' ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'}`} onClick={() => setMobileTab('list')}><Users className="mr-1 inline h-4 w-4" />列表</button>
        </div>

        {mobileTab === 'map' ? (
          <Card variant="elevated" className="overflow-hidden p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{primaryFocusRegion || '全部区域'}</span>
              <Badge variant="outline">{allChips.length} 个筛选</Badge>
            </div>
            <div className="h-[300px] min-[375px]:h-[320px] overflow-hidden rounded-[1.25rem] border border-neutral-200/80 dark:border-neutral-800">
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
            </div>
          </Card>
        ) : (
          <VolunteerList compact onVolunteerClick={onVolunteerClick} onVolunteerSelect={setSelectedVolunteer} showStats={false} showPagination={false} filterParams={homeFilterParams} />
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          {/* Filter panel */}
          <Card variant="elevated" className="p-3 md:p-4">
            {filterPanel}
          </Card>

          {/* Map */}
          <Card variant="elevated" className="overflow-hidden p-3 md:p-4">
            <div className="min-h-[620px] overflow-hidden rounded-[1.5rem] border border-neutral-200/80 dark:border-neutral-800">
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
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Active filters + stats + search */}
          <Card variant="elevated" className="p-4 md:p-5">
            {/* Active filters bar */}
            {allChips.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                {visibleChips.map((chip, idx) => renderChip(chip, idx))}
                {!filtersExpanded && hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltersExpanded(true)}
                    className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-500 hover:border-teal-200 hover:text-teal-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
                  >
                    +{hiddenCount} 更多
                  </button>
                )}
                {filtersExpanded && allChips.length > CHIPS_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => setFiltersExpanded(false)}
                    className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
                  >
                    收起
                  </button>
                )}
              </div>
            ) : (
              <div className="mb-4 text-xs text-neutral-400">无筛选条件</div>
            )}

            {/* Stats */}
            <div className="grid gap-3 grid-cols-3">
              <StatCard label="匹配" value={homeStatsLoading ? '...' : homeStats.totalVolunteers} />
              <StatCard label="在职占比" value={homeStatsLoading ? '...' : activeRatio} />
              <StatCard label="总时长" value={homeStatsLoading ? '...' : `${homeStats.totalHours}h`} />
            </div>

            {/* Search */}
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input value={homeSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索姓名 / 英文名 / ID / 省份..." className="pl-10 pr-10" />
              {homeSearch && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" onClick={onClearSearch}><X className="h-4 w-4" /></button>}
            </div>
          </Card>

          {/* Volunteer list */}
          <Card variant="elevated" className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">志愿者列表</h3>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">点击查看详情</span>
            </div>
            <VolunteerList compact onVolunteerClick={onVolunteerClick} showStats={false} showPagination={false} filterParams={homeFilterParams} />
          </Card>
        </div>
      </div>

      {/* Mobile filter dialog */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen} title="筛选条件" description="移动端使用全屏筛选面板，应用后切回地图或列表浏览。" className="max-w-none h-[100dvh] rounded-none border-0 sm:hidden">
        <div className="space-y-5">{filterPanel}<Button type="button" className="w-full" onClick={() => setFilterOpen(false)}>完成</Button></div>
      </Dialog>

      {/* Mobile volunteer bottom sheet */}
      {selectedVolunteer && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[2rem] border border-neutral-200 bg-white p-5 shadow-2xl sm:hidden dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{selectedVolunteer.chineseName}</h3>
                <Badge variant={selectedVolunteer.status === '在职' ? 'success' : 'outline'}>{selectedVolunteer.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{selectedVolunteer.region || '未设置地区'} · {selectedVolunteer.department?.name || '暂无部门'}</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{selectedVolunteer.volunteerCode}</p>
            </div>
            <button type="button" className="text-neutral-400" onClick={() => setSelectedVolunteer(null)}><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedVolunteer(null)}>关闭</Button>
            <Button type="button" className="flex-1" onClick={() => onVolunteerClick(selectedVolunteer.id)}>查看详情</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { HomeStatus };
export default HomePage;
