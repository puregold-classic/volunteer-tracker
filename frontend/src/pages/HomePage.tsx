import { Filter, Map, Search, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Volunteer } from '@services/types';
import type { VolunteersParams } from '@services/api';
import HomeMap from '@components/HomeMap';
import VolunteerList from '@components/VolunteerList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

function HomePage(props: HomePageProps) {
  const {
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
  } = props;

  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);

  const activeFilterCount = selectedRegions.length + selectedProvinces.length + Number(homeStatus !== 'all') + Number(homeService !== 'all') + Number(Boolean(debouncedSearch));
  const activeRatio = homeStats.totalVolunteers > 0 ? `${Math.round((homeStats.totalActive / homeStats.totalVolunteers) * 100)}%` : '0%';

  const filterPanel = useMemo(() => (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select value={homeStatus} onChange={(e) => onStatusChange(e.target.value as HomeStatus)}>
          <option value="all">状态：全部</option>
          <option value="在职">状态：在职</option>
          <option value="不在职">状态：不在职</option>
        </Select>
        <Select value={homeService} onChange={(e) => onServiceChange(e.target.value)}>
          <option value="all">方向：全部</option>
          <option value="翻译">方向：翻译</option>
          <option value="校对">方向：校对</option>
          <option value="管理">方向：管理</option>
          <option value="技术">方向：技术</option>
        </Select>
        <Select value={homeHotProvince} onChange={(e) => onHotProvinceChange(e.target.value as HotProvinceFilter)}>
          <option value="all">热门省份：全部</option>
          <option value="北京">热门省份：北京</option>
          <option value="上海">热门省份：上海</option>
          <option value="深圳">热门省份：深圳</option>
        </Select>
        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${homeRegionMode === 'single' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => onRegionModeChange('single')}>单选</button>
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${homeRegionMode === 'multiple' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => onRegionModeChange('multiple')}>多选</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickFocusOptions.map((item) => (
          <Button key={item} type="button" size="sm" variant={selectedRegions.includes(item) ? 'default' : 'outline'} onClick={() => onQuickFocusSelect(item)}>
            {item}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={onResetFilters}>重置</Button>
      </div>
    </div>
  ), [homeStatus, homeService, homeHotProvince, homeRegionMode, selectedRegions, quickFocusOptions, onStatusChange, onServiceChange, onHotProvinceChange, onRegionModeChange, onQuickFocusSelect, onResetFilters]);

  return (
    <div className="space-y-4">
      <div className="space-y-4 sm:hidden">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={homeSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索姓名 / 英文名 / ID / 省份..." className="pl-10 pr-10" />
            {homeSearch && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={onClearSearch}><X className="h-4 w-4" /></button>}
          </div>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => setFilterOpen(true)} aria-label="打开筛选"><Filter className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="匹配" value={homeStatsLoading ? '...' : homeStats.totalVolunteers} />
          <StatCard label="在职占比" value={homeStatsLoading ? '...' : activeRatio} />
          <StatCard label="总时长" value={homeStatsLoading ? '...' : `${homeStats.totalHours}h`} />
        </div>

        <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${mobileTab === 'map' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => setMobileTab('map')}><Map className="mr-1 inline h-4 w-4" />地图</button>
          <button type="button" className={`rounded-xl px-3 py-2 text-sm ${mobileTab === 'list' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`} onClick={() => setMobileTab('list')}><Users className="mr-1 inline h-4 w-4" />列表</button>
        </div>

        {mobileTab === 'map' ? (
          <Card variant="elevated" className="overflow-hidden p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{primaryFocusRegion || '全部区域'}</span>
              <Badge variant="outline">{activeFilterCount} 个筛选</Badge>
            </div>
            <div className="h-[300px] min-[375px]:h-[320px] overflow-hidden rounded-[1.25rem] border border-slate-200/80 dark:border-slate-800">
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

      <div className="hidden sm:grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <Card variant="elevated" className="p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">{filterPanel}</div>
              <div className="hidden xl:flex shrink-0 items-center gap-2">
                <Badge variant="outline">{activeFilterCount} 个筛选</Badge>
                <Button variant="ghost" size="sm" onClick={onRefreshMap}>重置地图</Button>
              </div>
            </div>
          </Card>

          <Card variant="elevated" className="overflow-hidden p-3 md:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">当前主焦点：{primaryFocusRegion || '未设置'}</span>
              <Badge variant="outline">地区 {selectedRegions.length} / 省份 {selectedProvinces.length}</Badge>
            </div>
            <div className="min-h-[620px] overflow-hidden rounded-[1.5rem] border border-slate-200/80 dark:border-slate-800">
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
          <Card variant="elevated" className="p-4 md:p-5">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">纯金经典翻译计划</h2>
              <p className="text-xs text-slate-400 mt-0.5">志愿者管理网站</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">状态：{homeStatus === 'all' ? '全部' : homeStatus}</Badge>
              <Badge variant="outline">方向：{homeService === 'all' ? '全部' : homeService}</Badge>
              {selectedRegions.slice(0, 2).map((region) => <Badge key={`region-${region}`} variant="info">{region}</Badge>)}
              {selectedProvinces.slice(0, 2).map((province) => <Badge key={`province-${province}`} variant="info">{province}</Badge>)}
              {debouncedSearch && <Badge variant="warning">搜索：{debouncedSearch}</Badge>}
            </div>

            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-1 xl:grid-cols-3">
              <StatCard label="匹配志愿者" value={homeStatsLoading ? '...' : homeStats.totalVolunteers} />
              <StatCard label="在职占比" value={homeStatsLoading ? '...' : activeRatio} />
              <StatCard label="总服务时长" value={homeStatsLoading ? '...' : `${homeStats.totalHours}h`} />
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={homeSearch} onChange={(e) => onSearchChange(e.target.value)} placeholder="搜索姓名 / 英文名 / ID / 省份..." className="pl-10 pr-10" />
              {homeSearch && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={onClearSearch}><X className="h-4 w-4" /></button>}
            </div>
          </Card>

          <Card variant="elevated" className="p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">志愿者列表</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">点击查看详情</span>
            </div>
            <VolunteerList compact onVolunteerClick={onVolunteerClick} showStats={false} showPagination={false} filterParams={homeFilterParams} />
          </Card>
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen} title="筛选条件" description="移动端使用全屏筛选面板，应用后切回地图或列表浏览。" className="max-w-none h-[100dvh] rounded-none border-0 sm:hidden">
        <div className="space-y-5">{filterPanel}<Button type="button" className="w-full" onClick={() => setFilterOpen(false)}>完成</Button></div>
      </Dialog>

      {selectedVolunteer && (
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{selectedVolunteer.chineseName}</h3>
                <Badge variant={selectedVolunteer.status === '在职' ? 'success' : 'outline'}>{selectedVolunteer.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedVolunteer.region || '未设置地区'} · {selectedVolunteer.services[0] || '暂无标签'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">最近活跃 {selectedVolunteer.nonProjectHours}h · 服务 {selectedVolunteer.nonProjectCount} 次</p>
            </div>
            <button type="button" className="text-slate-400" onClick={() => setSelectedVolunteer(null)}><X className="h-5 w-5" /></button>
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

export type { HomeStatus, HomeRegionMode, HotProvinceFilter };
export default HomePage;
