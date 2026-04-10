// frontend/src/services/ledgerService.ts — v2.1
//
// Replaces v1's reviewService entirely. v2.1 has no approval queue — admins
// see a read-only "项目支援台账" with stats and drill-down. All endpoints
// require b_admin / a_admin / admin (the supportLedger router enforces this).

import { api } from './api';
import type { ApiResponse } from './types';

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
    departmentName: string;
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
  } = {}): Promise<ApiResponse<LedgerOverview>> => {
    return api.get('/support-ledger/overview', { params });
  },

  timeSeries: async (params: {
    months?: number;
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    granularity?: 'month' | 'day';
  } = {}): Promise<ApiResponse<LedgerTimeSeriesPoint[]>> => {
    return api.get('/support-ledger/time-series', { params });
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
