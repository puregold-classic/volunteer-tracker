import { Filter, Search, X } from 'lucide-react';
import type { VolunteersParams } from '@services/api';
import HomeMap from '@components/HomeMap';
import VolunteerList from '@components/VolunteerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SectionHeader } from '@/components/shared/section-header';
import { StatCard } from '@/components/shared/stat-card';

type HomeStatus = 'all' | '在职' | '不在职';
type HomeRegionMode = 'single' | 'multiple';
type HotProvinceFilter = 'all' | '北京' | '上海' | '深圳';

interface HomePageProps {
  homeStatus: HomeStatus;
  homeService: string;
  homeHotProvince: HotProvinceFilter;
  homeRegionMode: HomeRegionMode;
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
  onServiceChange: (value: string) => void;
  onHotProvinceChange: (value: HotProvinceFilter) => void;
  onRegionModeChange: (mode: HomeRegionMode) => void;
  onResetFilters: () => void;
  onProvinceSelect: (province: string) => void;
  onResetProvinceSelections: () => void;
  onQuickFocusSelect: (value: string) => void;
  onRefreshMap: () => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onVolunteerClick: (id: string) => Promise<void> | void;
}

function HomePage({
  homeStatus,
  homeService,
  homeHotProvince,
  homeRegionMode,
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
  onServiceChange,
  onHotProvinceChange,
  onRegionModeChange,
  onResetFilters,
  onProvinceSelect,
  onResetProvinceSelections,
  onQuickFocusSelect,
  onRefreshMap,
  onSearchChange,
  onClearSearch,
  onVolunteerClick,
}: HomePageProps) {
  const activeFilterCount = selectedRegions.length + selectedProvinces.length + Number(homeStatus !== 'all') + Number(homeService !== 'all') + Number(Boolean(debouncedSearch));
  const activeRatio = homeStats.totalVolunteers > 0 ? `${Math.round((homeStats.totalActive / homeStats.totalVolunteers) * 100)}%` : '0%';

  return (
    <div className="grid gap-6 xl:grid-cols-[1.85fr_1fr]">
      <div className="space-y-6">
        <Card variant="elevated" className="p-5 md:p-6">
          <SectionHeader
            eyebrow="filters"
            title="筛选与地图"
            description="左侧保留高频筛选和大地图视图，保证浏览效率。"
            actions={<Badge variant="info">已启用 {activeFilterCount} 个筛选</Badge>}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">状态</label>
              <Select value={homeStatus} onChange={(e) => onStatusChange(e.target.value as HomeStatus)}>
                <option value="all">全部</option>
                <option value="在职">在职</option>
                <option value="不在职">不在职</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">方向</label>
              <Select value={homeService} onChange={(e) => onServiceChange(e.target.value)}>
                <option value="all">全部</option>
                <option value="翻译">翻译</option>
                <option value="校对">校对</option>
                <option value="管理">管理</option>
                <option value="技术">技术</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">热门省份</label>
              <Select value={homeHotProvince} onChange={(e) => onHotProvinceChange(e.target.value as HotProvinceFilter)}>
                <option value="all">全部</option>
                <option value="北京">北京</option>
                <option value="上海">上海</option>
                <option value="深圳">深圳</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">地区/省份模式</label>
              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                <button type="button" className={`rounded-xl px-3 py-2 text-sm ${homeRegionMode === 'single' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => onRegionModeChange('single')}>单选</button>
                <button type="button" className={`rounded-xl px-3 py-2 text-sm ${homeRegionMode === 'multiple' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => onRegionModeChange('multiple')}>多选</button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">状态：{homeStatus === 'all' ? '全部' : homeStatus}</Badge>
            <Badge variant="outline">方向：{homeService === 'all' ? '全部' : homeService}</Badge>
            {selectedRegions.map((region) => <Badge key={`region-${region}`} variant="info">地区：{region}</Badge>)}
            {selectedProvinces.map((province) => <Badge key={`province-${province}`} variant="info">省份：{province}</Badge>)}
            {debouncedSearch && <Badge variant="warning">搜索：{debouncedSearch}</Badge>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {quickFocusOptions.map((item) => (
              <Button key={item} type="button" size="sm" variant={selectedRegions.includes(item) ? 'default' : 'outline'} onClick={() => onQuickFocusSelect(item)}>
                {item}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={onResetFilters}>重置全部筛选</Button>
            <Button variant="ghost" size="sm" onClick={onRefreshMap}>重置地图</Button>
          </div>
        </Card>

        <Card variant="elevated" className="overflow-hidden p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">分布地图</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">当前主焦点：{primaryFocusRegion || '未设置'}</p>
            </div>
            <Badge variant="outline">地区 {selectedRegions.length} / 省份 {selectedProvinces.length}</Badge>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 dark:border-slate-800">
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

      <div className="space-y-6">
        <Card variant="elevated" className="p-5 md:p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={homeSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索姓名 / 英文名 / ID / 省份..." className="pl-10 pr-10" />
            {homeSearch && (
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={onClearSearch}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <StatCard label="匹配志愿者" value={homeStatsLoading ? '...' : homeStats.totalVolunteers} hint="随筛选条件实时同步" />
            <StatCard label="在职占比" value={homeStatsLoading ? '...' : activeRatio} hint="在职 / 当前匹配" icon={<Filter className="h-5 w-5" />} />
            <StatCard label="总服务时长" value={homeStatsLoading ? '...' : `${homeStats.totalHours}h`} hint="非项目服务累计" />
          </div>
        </Card>

        <Card variant="elevated" className="p-5 md:p-6">
          <SectionHeader eyebrow="list" title="志愿者结果列表" description="搜索、筛选与点击进详情逻辑保持不变。" />
          <div className="mt-5">
            <VolunteerList compact onVolunteerClick={onVolunteerClick} showStats={false} showPagination={false} filterParams={homeFilterParams} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export type { HomeStatus, HomeRegionMode, HotProvinceFilter };
export default HomePage;
