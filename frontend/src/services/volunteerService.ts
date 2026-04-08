// frontend/src/services/volunteerService.ts — v2.1
//
// Read + update only. Volunteer CREATION goes through authService.adminCreateVolunteer
// (which delegates to the unified AccountService.createVolunteerAccount on the
// backend). DELETION cascades through account deletion. There is no direct
// /volunteers POST or DELETE in v2.1.

import { api, publicApi } from './api';
import type { ApiResponse, Volunteer, VolunteersParams } from './types';

export interface VolunteerStats {
  summary: {
    totalVolunteers: number;
    totalActive: number;
    totalInactive: number;
    totalHours: number;
    avgHours: number;
  };
  regionDistribution: Array<{ region: string; count: number }>;
  departmentDistribution: Array<{ departmentId: string; count: number }>;
}

export interface VolunteerDerivedStats {
  totalHours: number;
  totalCount: number;
  activityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  byItem: Array<{
    serviceItemId: string;
    _count: { id: number };
    _sum: { duration: number | null };
  }>;
}

const buildVolunteerQueryString = (params?: VolunteersParams, includePagination = true): string => {
  const queryParams = new URLSearchParams();
  const appendMulti = (key: string, value?: string | string[]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      const list = value.map((v) => String(v).trim()).filter(Boolean);
      if (list.length > 0) queryParams.append(key, list.join(','));
      return;
    }
    const text = String(value).trim();
    if (text) queryParams.append(key, text);
  };

  if (params?.status) queryParams.append('status', params.status);
  appendMulti('region', params?.region);
  appendMulti('province', params?.province);
  appendMulti('departmentId', params?.departmentId);
  if (params?.search) queryParams.append('search', params.search);

  if (includePagination) {
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.order) queryParams.append('order', params.order);
  }

  return queryParams.toString();
};

export const volunteerService = {
  /**
   * Paginated volunteer list. The response wraps the array in a non-standard
   * shape (count/total/totalPages/currentPage/data) — preserved from v1
   * for component compatibility.
   */
  getAllVolunteers: async (params?: VolunteersParams): Promise<{
    success: boolean;
    count?: number;
    total?: number;
    totalPages?: number;
    currentPage?: number;
    data?: Volunteer[];
  }> => {
    const queryString = buildVolunteerQueryString(params, true);
    const url = `/volunteers${queryString ? `?${queryString}` : ''}`;
    return publicApi.get(url);
  },

  /**
   * Look up by either cuid or volunteerCode (PG-XXXX). Backend auto-detects.
   */
  getVolunteerById: async (idOrCode: string): Promise<ApiResponse<Volunteer>> => {
    return publicApi.get(`/volunteers/${idOrCode}`);
  },

  getStats: async (params?: VolunteersParams): Promise<ApiResponse<VolunteerStats>> => {
    const queryString = buildVolunteerQueryString(params, false);
    const url = `/volunteers/stats${queryString ? `?${queryString}` : ''}`;
    return publicApi.get(url);
  },

  /**
   * Aggregate stats for one volunteer (replaces v1's denormalized
   * nonProjectHours / nonProjectCount fields, now computed on-demand).
   */
  getDerivedStats: async (idOrCode: string): Promise<ApiResponse<VolunteerDerivedStats>> => {
    return publicApi.get(`/volunteers/${idOrCode}/derived-stats`);
  },

  updateVolunteer: async (idOrCode: string, data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.put(`/volunteers/${idOrCode}`, data);
  },
};

export default volunteerService;
