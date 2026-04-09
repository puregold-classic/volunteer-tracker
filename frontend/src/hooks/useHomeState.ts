import { useEffect, useMemo, useState } from 'react';
import { VolunteersParams } from '@services/api';
import { volunteerService } from '@services/volunteerService';

export type HomeSelection = { type: 'region' | 'province'; value: string };

export const HOT_LOCATIONS = [
  { label: '北京', type: 'province' as const, value: '北京市' },
  { label: '上海', type: 'province' as const, value: '上海市' },
  { label: '广东', type: 'province' as const, value: '广东省' },
  { label: '浙江', type: 'province' as const, value: '浙江省' },
  { label: '台湾省', type: 'region' as const, value: '中国台湾' },
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

  // homeServices is currently a no-op filter — v2.1 doesn't have a "services"
  // field on Volunteer (replaced by departmentId). Kept for backward compat
  // with the chip UI; will be redesigned as a department picker in phase C.
  const homeFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = { limit: 20, order: 'desc', sortBy: 'createdAt' };
    if (homeStatus !== 'all') params.status = homeStatus;
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, selectedRegions, selectedProvinces, debouncedSearch]);

  const homeStatsFilterParams = useMemo<VolunteersParams>(() => {
    const params: VolunteersParams = {};
    if (homeStatus !== 'all') params.status = homeStatus;
    if (selectedRegions.length > 0) params.region = selectedRegions;
    if (selectedProvinces.length > 0) params.province = selectedProvinces;
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [homeStatus, selectedRegions, selectedProvinces, debouncedSearch]);

  useEffect(() => {
    const fetchHomeStats = async () => {
      setHomeStatsLoading(true);
      try {
        const result = await volunteerService.getStats(homeStatsFilterParams);
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
        } else {
          setHomeStats({ totalVolunteers: 0, totalActive: 0, totalHours: 0, departmentDistribution: [], regionDistribution: [] });
        }
      } catch {
        setHomeStats({ totalVolunteers: 0, totalActive: 0, totalHours: 0, departmentDistribution: [], regionDistribution: [] });
      } finally {
        setHomeStatsLoading(false);
      }
    };
    void fetchHomeStats();
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
    setHomeSelections([]);
    setHomeSearch('');
  };

  return {
    homeStatus,
    homeServices,
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
