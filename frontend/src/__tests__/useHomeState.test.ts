import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHomeState, HOT_LOCATIONS } from '../hooks/useHomeState';

// Mock volunteerService to avoid real HTTP calls
vi.mock('../services/volunteerService', () => ({
  volunteerService: {
    getStats: vi.fn().mockResolvedValue({
      success: true,
      data: { summary: { totalVolunteers: 42, totalActive: 30, totalHours: 500 } },
    }),
  },
}));

import { volunteerService } from '../services/volunteerService';

describe('useHomeState — initial state', () => {
  it('starts with default values', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.homeStatus).toBe('all');
    expect(result.current.homeServices).toEqual([]);
    expect(result.current.homeSearch).toBe('');
    expect(result.current.debouncedSearch).toBe('');
    expect(result.current.homeSelections).toEqual([]);
    expect(result.current.selectedRegions).toEqual([]);
    expect(result.current.selectedProvinces).toEqual([]);
  });
});

describe('useHomeState — toggleRegion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a region selection', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleRegion('中国大陆'));

    expect(result.current.selectedRegions).toContain('中国大陆');
  });

  it('removes a region selection on second toggle', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleRegion('中国大陆'));
    act(() => result.current.toggleRegion('中国大陆'));

    expect(result.current.selectedRegions).not.toContain('中国大陆');
  });

  it('accumulates multiple regions', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleRegion('中国大陆'));
    act(() => result.current.toggleRegion('美国'));

    expect(result.current.selectedRegions).toContain('中国大陆');
    expect(result.current.selectedRegions).toContain('美国');
  });
});

describe('useHomeState — toggleProvince', () => {
  it('adds a province selection', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince('北京市'));

    expect(result.current.selectedProvinces).toContain('北京市');
  });

  it('normalizes 台湾 to 台湾省', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince('台湾'));

    expect(result.current.selectedProvinces).toContain('台湾省');
  });

  it('ignores non-province region values (e.g. 中国大陆)', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince('中国大陆'));

    expect(result.current.selectedProvinces).not.toContain('中国大陆');
    expect(result.current.selectedRegions).not.toContain('中国大陆');
  });

  it('ignores empty string', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince(''));

    expect(result.current.selectedProvinces).toEqual([]);
  });
});

describe('useHomeState — toggleService', () => {
  it('adds a service', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleService('翻译'));

    expect(result.current.homeServices).toContain('翻译');
  });

  it('removes a service on second toggle', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleService('翻译'));
    act(() => result.current.toggleService('翻译'));

    expect(result.current.homeServices).not.toContain('翻译');
  });

  it('supports multi-select', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleService('翻译'));
    act(() => result.current.toggleService('校对'));

    expect(result.current.homeServices).toContain('翻译');
    expect(result.current.homeServices).toContain('校对');
  });
});

describe('useHomeState — isLocationActive', () => {
  it('returns true for active province', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince('北京市'));

    expect(result.current.isLocationActive('province', '北京市')).toBe(true);
  });

  it('returns false for inactive location', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.isLocationActive('province', '北京市')).toBe(false);
  });

  it('returns true for active region', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleRegion('美国'));

    expect(result.current.isLocationActive('region', '美国')).toBe(true);
  });
});

describe('useHomeState — HOT_LOCATIONS', () => {
  it('contains the correct hot locations', () => {
    const labels = HOT_LOCATIONS.map(h => h.label);
    expect(labels).toContain('北京');
    expect(labels).toContain('上海');
    expect(labels).toContain('广东');
    expect(labels).toContain('香港');
    expect(labels).toContain('澳门');
    expect(labels).not.toContain('深圳');
  });

  it('广东 maps to province 广东省', () => {
    const gd = HOT_LOCATIONS.find(h => h.label === '广东');
    expect(gd?.type).toBe('province');
    expect(gd?.value).toBe('广东省');
  });

  it('香港 / 澳门 map to their full SAR province names (match GeoJSON + volunteer.province)', () => {
    const hk = HOT_LOCATIONS.find(h => h.label === '香港');
    expect(hk?.type).toBe('province');
    expect(hk?.value).toBe('香港特别行政区');
    const mo = HOT_LOCATIONS.find(h => h.label === '澳门');
    expect(mo?.type).toBe('province');
    expect(mo?.value).toBe('澳门特别行政区');
  });
});

describe('useHomeState — removeLocation', () => {
  it('removes a specific province', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleProvince('北京市'));
    act(() => result.current.toggleProvince('上海市'));
    act(() => result.current.removeLocation('province', '北京市'));

    expect(result.current.selectedProvinces).not.toContain('北京市');
    expect(result.current.selectedProvinces).toContain('上海市');
  });
});

describe('useHomeState — removeService', () => {
  it('removes a specific service', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleService('翻译'));
    act(() => result.current.toggleService('校对'));
    act(() => result.current.removeService('翻译'));

    expect(result.current.homeServices).not.toContain('翻译');
    expect(result.current.homeServices).toContain('校对');
  });
});

describe('useHomeState — resetFilters', () => {
  it('clears all state back to defaults', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => {
      result.current.setHomeStatus('在职');
      result.current.toggleService('翻译');
      result.current.toggleRegion('中国大陆');
      result.current.setHomeSearch('test');
    });

    act(() => result.current.resetFilters());

    expect(result.current.homeStatus).toBe('all');
    expect(result.current.homeServices).toEqual([]);
    expect(result.current.selectedRegions).toEqual([]);
    expect(result.current.selectedProvinces).toEqual([]);
    expect(result.current.homeSearch).toBe('');
  });
});

describe('useHomeState — resetMap', () => {
  it('clears all location selections', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => {
      result.current.toggleRegion('中国大陆');
      result.current.toggleProvince('北京市');
    });

    act(() => result.current.resetMap());

    expect(result.current.selectedRegions).toEqual([]);
    expect(result.current.selectedProvinces).toEqual([]);
  });
});

describe('useHomeState — resetProvinceSelections', () => {
  it('removes only province selections, keeps regions', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => {
      result.current.toggleRegion('中国大陆');
      result.current.toggleProvince('北京市');
    });

    act(() => result.current.resetProvinceSelections());

    expect(result.current.selectedProvinces).toEqual([]);
    expect(result.current.selectedRegions).toContain('中国大陆');
  });
});

describe('useHomeState — homeFilterParams', () => {
  it('returns base params when no filters active', () => {
    const { result } = renderHook(() => useHomeState());

    const params = result.current.homeFilterParams;
    expect(params.limit).toBe(20);
    expect(params.status).toBeUndefined();
    expect(params.region).toBeUndefined();
  });

  it('includes status when not all', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.setHomeStatus('在职'));

    expect(result.current.homeFilterParams.status).toBe('在职');
  });

  it('includes selected regions', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.toggleRegion('美国'));

    expect(result.current.homeFilterParams.region).toContain('美国');
  });

  // services field 已在 v2.1 移除（替换为 departmentId）。homeServices 状态
  // 还在但目前是 no-op，phase C 会改成 department picker。这两个测试因此被
  // 删除——它们测的是 v1 的 ServiceType filter 行为。
});

describe('useHomeState — debouncedSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not update debouncedSearch immediately', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.setHomeSearch('hello'));

    expect(result.current.debouncedSearch).toBe('');
  });

  it('updates debouncedSearch after 250ms', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.setHomeSearch('hello'));
    act(() => vi.advanceTimersByTime(250));

    expect(result.current.debouncedSearch).toBe('hello');
  });

  it('trims whitespace in debouncedSearch', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => result.current.setHomeSearch('  test  '));
    act(() => vi.advanceTimersByTime(250));

    expect(result.current.debouncedSearch).toBe('test');
  });
});

describe('useHomeState — stats fetching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches stats on mount', async () => {
    renderHook(() => useHomeState());

    await act(async () => {});

    expect(volunteerService.getStats).toHaveBeenCalled();
  });

  it('populates homeStats from API response', async () => {
    const { result } = renderHook(() => useHomeState());

    await act(async () => {});

    expect(result.current.homeStats.totalVolunteers).toBe(42);
    expect(result.current.homeStats.totalActive).toBe(30);
    expect(result.current.homeStats.totalHours).toBe(500);
  });

  it('resets stats to zero on API error', async () => {
    vi.mocked(volunteerService.getStats).mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => useHomeState());

    await act(async () => {});

    expect(result.current.homeStats.totalVolunteers).toBe(0);
  });
});
