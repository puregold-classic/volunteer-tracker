import { api, ApiResponse, VolunteersParams } from './api';
import type { Volunteer } from './types';

// 扩展的志愿者类型
export interface VolunteerStats {
  summary: {
    totalVolunteers: number;
    totalActive: number;
    totalInactive: number;
    totalHours: number;
    avgHours: number;
  };
  regionDistribution: Array<{
    region: string;
    count: number;
    totalHours: number;
  }>;
  serviceDistribution: Array<{
    service: string;
    count: number;
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
  if (params?.search) queryParams.append('search', params.search);
  if (params?.services?.length) {
    queryParams.append('services', params.services.join(','));
  }

  if (includePagination) {
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.order) queryParams.append('order', params.order);
  }

  return queryParams.toString();
};

export const volunteerService = {
  // 获取志愿者列表
  getAllVolunteers: async (params?: VolunteersParams): Promise<ApiResponse> => {
    const queryString = buildVolunteerQueryString(params, true);
    const url = `/volunteers${queryString ? `?${queryString}` : ''}`;
    
    return api.get(url);
  },

  // 获取单个志愿者
  getVolunteerById: async (id: string): Promise<ApiResponse<Volunteer>> => {
    return api.get(`/volunteers/${id}`);
  },

  // 获取统计信息
  getStats: async (params?: VolunteersParams): Promise<ApiResponse<VolunteerStats>> => {
    const queryString = buildVolunteerQueryString(params, false);
    const url = `/volunteers/stats${queryString ? `?${queryString}` : ''}`;
    return api.get(url);
  },

  // 创建志愿者
  createVolunteer: async (data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.post('/volunteers', data);
  },

  // 更新志愿者
  updateVolunteer: async (id: string, data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.put(`/volunteers/${id}`, data);
  },

  // 删除志愿者
  deleteVolunteer: async (id: string): Promise<ApiResponse> => {
    return api.delete(`/volunteers/${id}`);
  },

  // 批量操作
  batchUpdate: async (ids: string[], data: Partial<Volunteer>): Promise<ApiResponse> => {
    return api.patch('/volunteers/batch', { ids, data });
  },

  // 导出数据
  exportVolunteers: async (params?: VolunteersParams): Promise<Blob> => {
    const response = await api.get('/volunteers/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};

// Mock数据服务（开发环境使用）
export const mockVolunteerService = {
  getAllVolunteers: async (): Promise<ApiResponse> => {
    // 这里可以返回本地Mock数据
    return {
      success: true,
      data: {
        data: [],
        count: 0,
        total: 0,
        totalPages: 0,
        currentPage: 1
      }
    };
  }
};

// 根据环境选择服务
export const getVolunteerService = () => {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return mockVolunteerService;
  }
  return volunteerService;
};

export default getVolunteerService();
