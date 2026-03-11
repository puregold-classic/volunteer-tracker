import type { VolunteersParams } from '@services/api';
import type { Volunteer } from '@services/types';
import HomeMap from '@components/HomeMap';
import VolunteerList from '@components/VolunteerList';

type HomeStatus = 'all' | '在职' | '不在职';
type HomeRegionMode = 'single' | 'multiple';
type HomeSelection = { type: 'region' | 'province'; value: string };
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
  onVolunteerClick
}: HomePageProps) {
  return (
    <div className="home-shell">
      <section className="home-left">
        <div className="controls-bar">
          <div className="filter-tools">
            <div className="filter-field">
              <span>状态</span>
              <select value={homeStatus} onChange={(e) => onStatusChange(e.target.value as HomeStatus)}>
                <option value="all">全部</option>
                <option value="在职">在职</option>
                <option value="不在职">不在职</option>
              </select>
            </div>
            <div className="filter-field">
              <span>方向</span>
              <select value={homeService} onChange={(e) => onServiceChange(e.target.value)}>
                <option value="all">全部</option>
                <option value="翻译">翻译</option>
                <option value="校对">校对</option>
                <option value="管理">管理</option>
                <option value="技术">技术</option>
              </select>
            </div>
            <div className="filter-field">
              <span>热门省份</span>
              <select value={homeHotProvince} onChange={(e) => onHotProvinceChange(e.target.value as HotProvinceFilter)}>
                <option value="all">全部</option>
                <option value="北京">北京</option>
                <option value="上海">上海</option>
                <option value="深圳">深圳</option>
              </select>
            </div>
            <div className="filter-field">
              <span>地区/省份</span>
              <div className="filter-mode-switch">
                <button
                  type="button"
                  className={homeRegionMode === 'single' ? 'is-active' : ''}
                  onClick={() => onRegionModeChange('single')}
                >
                  单选
                </button>
                <button
                  type="button"
                  className={homeRegionMode === 'multiple' ? 'is-active' : ''}
                  onClick={() => onRegionModeChange('multiple')}
                >
                  多选
                </button>
              </div>
            </div>
            <button type="button" className="filter-reset" onClick={onResetFilters}>
              重置
            </button>
          </div>
        </div>

        <div className="map-stage">
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
      </section>

      <aside className="home-right">
        <div className="home-summary">
          <div className="home-summary__head">
            <h3>筛选摘要</h3>
            <span>{homeStatsLoading ? '同步中...' : `${homeStats.totalVolunteers} 条`}</span>
          </div>
          <div className="home-summary__metrics">
            <div>
              <strong>{homeStatsLoading ? '...' : homeStats.totalVolunteers}</strong>
              <span>匹配志愿者</span>
            </div>
            <div>
              <strong>
                {homeStatsLoading || homeStats.totalVolunteers === 0
                  ? '...'
                  : `${Math.round((homeStats.totalActive / homeStats.totalVolunteers) * 100)}%`}
              </strong>
              <span>在职占比</span>
            </div>
            <div>
              <strong>{homeStatsLoading ? '...' : `${homeStats.totalHours}h`}</strong>
              <span>总服务时长</span>
            </div>
          </div>
          <div className="home-summary__filters">
            <span className="summary-tag">{homeStatus === 'all' ? '状态: 全部' : `状态: ${homeStatus}`}</span>
            <span className="summary-tag">{homeService === 'all' ? '方向: 全部' : `方向: ${homeService}`}</span>
            {selectedRegions.map((region) => (
              <span key={`region-${region}`} className="summary-tag">
                地区: {region}
              </span>
            ))}
            {selectedProvinces.map((province) => (
              <span key={`province-${province}`} className="summary-tag">
                省份: {province}
              </span>
            ))}
            {debouncedSearch && <span className="summary-tag">搜索: {debouncedSearch}</span>}
          </div>
        </div>

        <div className="home-search">
          <input
            type="text"
            value={homeSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索姓名 / 英文名 / ID / 省份..."
          />
          {homeSearch && (
            <button type="button" onClick={onClearSearch}>
              清空
            </button>
          )}
        </div>

        <div className="home-volunteer-list">
          <VolunteerList
            compact
            onVolunteerClick={onVolunteerClick}
            showStats={false}
            showPagination={false}
            filterParams={homeFilterParams}
          />
        </div>
      </aside>
    </div>
  );
}

export type { HomeSelection, HomeStatus, HomeRegionMode, HotProvinceFilter };
export default HomePage;
