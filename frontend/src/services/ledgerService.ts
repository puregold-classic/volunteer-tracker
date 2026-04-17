// frontend/src/services/ledgerService.ts — v2.1
//
// Replaces v1's reviewService entirely. v2.1 has no approval queue — admins
// see a read-only "项目支援台账" with stats and drill-down. All endpoints
// require b_admin / a_admin / admin (the supportLedger router enforces this).

import { api } from './api';
import type { ApiResponse, ServiceCategory } from './types';

export interface LedgerOverview {
  summary: {
    totalRecords: number;
    totalHours: number;
    avgDuration: number;
    earliestDate: string | null;
    latestDate: string | null;
  };
  byVolunteer: Array<{
    volunteerId: string;
    volunteerCode: string;
    chineseName: string;
    departmentId: string;
    count: number;
    totalHours: number;
    lastDate: string | null;
  }>;
  byDepartment: Array<{
    departmentId: string;
    departmentName: string;
    count: number;
    totalHours: number;
  }>;
  byServiceItem: Array<{
    serviceItemId: string;
    serviceItemName: string;
    departmentId: string;
    departmentName: string;
    category: ServiceCategory;
    count: number;
    totalHours: number;
  }>;
  generatedAt: string;
}

export interface LedgerTimeSeriesPoint {
  period: string;
  count: number;
  totalHours: number;
}

// v3 wave-3: time-series with groupBy=category returns 4-series buckets.
// Each period row carries hours per category + the total across all.
export type CategoryTotals = Record<ServiceCategory, number>;

export interface LedgerTimeSeriesByCategoryPoint {
  period: string;
  byCategory: CategoryTotals;
  total: number;
}

export interface LedgerCategoryBreakdown {
  departmentId: string;
  departmentName: string;
  displayOrder: number;
  byCategory: CategoryTotals;
  total: number;
}

export interface LedgerVolunteerService {
  serviceItemId: string;
  serviceItemName: string;
  category: ServiceCategory;
  departmentId: string;
  departmentName: string;
  deptDisplayOrder: number;
  count: number;
  totalHours: number;
  lastDate: string | null;
}

export interface LedgerServiceVolunteer {
  volunteerId: string;
  volunteerCode: string;
  chineseName: string;
  departmentId: string;
  count: number;
  totalHours: number;
  lastDate: string | null;
}

export interface ProxyContribution {
  volunteerCode: string;
  chineseName: string;
  proxyCount: number;
}

export interface RecentActivityEntry {
  id: string;
  auditId: string;
  targetType: string;
  targetId: string;
  action: string;
  actionDetails: Record<string, unknown> | null;
  operator: { id?: string; name?: string; role?: string } | null;
  submitter: { id?: string; name?: string } | null;
  timestamp: string;
}

export interface VolunteerLedgerDetail {
  volunteer: {
    id: string;
    volunteerCode: string;
    chineseName: string;
    department: { id: string; name: string } | null;
  };
  summary: {
    totalRecords: number;
    totalHours: number;
    avgDuration: number;
    earliestDate: string | null;
    latestDate: string | null;
    proxyContributions: number;
  };
  byServiceItem: Array<{
    serviceItemName: string;
    departmentName: string;
    count: number;
    totalHours: number;
  }>;
  byMonth: Array<{
    period: string;
    count: number;
    totalHours: number;
  }>;
  recentRecords: unknown[];
}

export const ledgerService = {
  overview: async (params: {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    category?: ServiceCategory;
  } = {}): Promise<ApiResponse<LedgerOverview>> => {
    return api.get('/support-ledger/overview', { params });
  },

  timeSeries: async (params: {
    months?: number;
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    category?: ServiceCategory;
    granularity?: 'month' | 'day';
  } = {}): Promise<ApiResponse<LedgerTimeSeriesPoint[]>> => {
    return api.get('/support-ledger/time-series', { params });
  },

  /** Phase C: time-series broken out by category — 4 series per period. */
  timeSeriesByCategory: async (params: {
    months?: number;
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    granularity?: 'month' | 'day';
  } = {}): Promise<ApiResponse<LedgerTimeSeriesByCategoryPoint[]>> => {
    return api.get('/support-ledger/time-series', { params: { ...params, groupBy: 'category' } });
  },

  /** Phase D: per-department stacked category rollup. */
  categoryBreakdown: async (params: {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    category?: ServiceCategory;
  } = {}): Promise<ApiResponse<LedgerCategoryBreakdown[]>> => {
    return api.get('/support-ledger/category-breakdown', { params });
  },

  /** Phase E: services for a single volunteer, for drill-down. */
  volunteerServices: async (
    volunteerId: string,
    params: { dateFrom?: string; dateTo?: string } = {},
  ): Promise<ApiResponse<LedgerVolunteerService[]>> => {
    return api.get(`/support-ledger/volunteers/${volunteerId}/services`, { params });
  },

  /** Phase D: volunteers who produced hours for a given service item. */
  serviceVolunteers: async (
    serviceItemId: string,
    params: { dateFrom?: string; dateTo?: string } = {},
  ): Promise<ApiResponse<LedgerServiceVolunteer[]>> => {
    return api.get(`/support-ledger/service-items/${serviceItemId}/volunteers`, { params });
  },

  proxyContributions: async (params: {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
  } = {}): Promise<ApiResponse<ProxyContribution[]>> => {
    return api.get('/support-ledger/proxy-contributions', { params });
  },

  recentActivity: async (params: {
    limit?: number;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<ApiResponse<RecentActivityEntry[]>> => {
    return api.get('/support-ledger/recent-activity', { params });
  },

  volunteerDetail: async (volunteerId: string): Promise<ApiResponse<VolunteerLedgerDetail>> => {
    return api.get(`/support-ledger/volunteers/${volunteerId}`);
  },
};

export default ledgerService;
