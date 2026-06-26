import { useEffect, useMemo, useState } from 'react';
import { VolunteersParams } from '@services/api';
import { volunteerService } from '@services/volunteerService';

export type HomeSelection = { type: 'region' | 'province'; value: string };

export const HOT_LOCATIONS = [
  { label: '北京', type: 'province' as const, value: '北京市' },
  { label: '上海', type: 'province' as const, value: '上海市' },
  // 地图是省级 GeoJSON，没有市级多边形：广州落到所属的 广东省（点击高亮整省 + 筛全省志愿者）
  { label: '广州', type: 'province' as const, value: '广东省' },
  { label: '香港', type: 'province' as const, value: '香港特别行政区' },
  { label: '澳门', type: 'province' as const, value: '澳门特别行政区' },
] as const;

export const QUICK_FOCUS_OPTIONS = ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲'] as const;

const NON_PROVINCE_REGION_VALUES = new Set(['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']);

export interface DistributionEntry {
  key: string;
  count: number;
}

export function useHomeState() {
  const [homeStatus, setHomeStatus] = useState<'all' | '在职' | '不在职'>('all');
  const [homeServices, setHomeServices] = useState<string[]>([]);
  const [homeDepartmentId, setHomeDepartmentId] = useState<string>('');
  const [homeSelections, setHomeSelections] = useState<HomeSelection[]>([]);
  const [homeSearch, setHomeSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [homeStats, setHomeStats] = useState<{
    totalVolunteers: number;
    totalActive: number;
    totalHours: number;
    departmentDistribution: DistributionEntry[];
    regionDistribution: DistributionEntry[];
  }>({
    totalVolunteers: 0,
    totalActive: 0,
    totalHours: 0,
    departmentDistribution: [],
    regionDistribution: [],
  });
  const [homeStatsLoading, setHomeStatsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(homeSearch.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [homeSearch]);

  const selectedRegions = useMemo(
    () => homeSelections.filter((item) => item.type === 'region').map((item) => item.value),
    [homeSelections]
  );
  const selectedProvinces = useMemo(
    () => homeSelections.filter((item) => item.type === 'province').map((item) => item.value),
    [homeSelections]
  );

  const homeFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = { limit: 20, order: 'desc', sortBy: 'createdAt' };
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeDepartmentId) params.departmentId = homeDepartmentId;
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeDepartmentId, selectedRegions, selectedProvinces, debouncedSearch]);

  const homeStatsFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {};
    if (homeStatus !== 'all') params.status = homeStatus;
    if (homeDepartmentId) params.departmentId = homeDepartmentId;
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, homeDepartmentId, selectedRegions, selectedProvinces, debouncedSearch]);

  // Track whether we've ever successfully loaded stats. Subsequent fetches
  // skip the loading flag so the StatStrip doesn't flash "加载中…" on every
  // filter change. Stale data stays visible until new data arrives.
  const hasLoadedStatsRef = useMemo(() => ({ value: false }), []);
  useEffect(() => {
    let cancelled = false;
    const fetchHomeStats = async () => {
      if (!hasLoadedStatsRef.value) setHomeStatsLoading(true);
      try {
        const result = await volunteerService.getStats(homeStatsFilterParams);
        if (cancelled) return;
        if (result?.success && result?.data?.summary) {
          setHomeStats({
            totalVolunteers: result.data.summary.totalVolunteers || 0,
            totalActive: result.data.summary.totalActive || 0,
            totalHours: result.data.summary.totalHours || 0,
            departmentDistribution: (result.data.departmentDistribution || []).map((d) => ({
              key: d.departmentId,
              count: d.count,
            })),
            regionDistribution: (result.data.regionDistribution || []).map((r) => ({
              key: r.region,
              count: r.count,
            })),
          });
          hasLoadedStatsRef.value = true;
        }
      } catch {
        if (!cancelled && !hasLoadedStatsRef.value) {
          setHomeStats({ totalVolunteers: 0, totalActive: 0, totalHours: 0, departmentDistribution: [], regionDistribution: [] });
        }
      } finally {
        if (!cancelled) setHomeStatsLoading(false);
      }
    };
    void fetchHomeStats();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeStatsFilterParams]);

  const primaryFocusRegion = selectedRegions.length > 0 ? selectedRegions[selectedRegions.length - 1] : '';

  const toggleLocationSelection = (selection: HomeSelection) => {
    setHomeSelections((prev) => {
      const exists = prev.some((item) => item.type === selection.type && item.value === selection.value);
      if (exists) return prev.filter((item) => !(item.type === selection.type && item.value === selection.value));
      return [...prev, selection];
    });
  };

  const toggleRegion = (region: string) =>
    toggleLocationSelection({ type: 'region', value: region });

  const toggleProvince = (province: string) => {
    const normalized = (province === '台湾' ? '台湾省' : province).trim();
    if (!normalized || NON_PROVINCE_REGION_VALUES.has(normalized)) return;
    toggleLocationSelection({ type: 'province', value: normalized });
  };

  const toggleService = (service: string) => {
    setHomeServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const isLocationActive = (type: 'province' | 'region', value: string) =>
    homeSelections.some((s) => s.type === type && s.value === value);

  const removeLocation = (type: 'province' | 'region', value: string) => {
    setHomeSelections((prev) => prev.filter((s) => !(s.type === type && s.value === value)));
  };

  const removeService = (service: string) => {
    setHomeServices((prev) => prev.filter((s) => s !== service));
  };

  const resetFilters = () => {
    setHomeStatus('all');
    setHomeServices([]);
    setHomeDepartmentId('');
    setHomeSelections([]);
    setHomeSearch('');
  };

  return {
    homeStatus,
    homeServices,
    homeDepartmentId,
    homeSelections,
    homeSearch,
    homeStats,
    homeStatsLoading,
    selectedRegions,
    selectedProvinces,
    debouncedSearch,
    primaryFocusRegion,
    homeFilterParams,
    setHomeStatus,
    setHomeDepartmentId,
    toggleService,
    setHomeSearch,
    toggleRegion,
    toggleProvince,
    isLocationActive,
    removeLocation,
    removeService,
    resetFilters,
    resetProvinceSelections: () => setHomeSelections((prev) => prev.filter((item) => item.type !== 'province')),
    resetMap: () => setHomeSelections([]),
  };
}
