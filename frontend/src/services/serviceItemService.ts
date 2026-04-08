// frontend/src/services/serviceItemService.ts — v2.1
import { api, publicApi } from './api';
import type { ApiResponse, ServiceItem, ServiceItemsByDepartment } from './types';

export const serviceItemService = {
  list: async (params: { departmentId?: string; includeInactive?: boolean } = {}): Promise<ApiResponse<ServiceItem[]>> => {
    return publicApi.get('/service-items', { params });
  },

  /** All items grouped by department — useful for the support submission form. */
  listGrouped: async (): Promise<ApiResponse<ServiceItemsByDepartment[]>> => {
    return publicApi.get('/service-items/grouped');
  },

  getById: async (id: string): Promise<ApiResponse<ServiceItem>> => {
    return publicApi.get(`/service-items/${id}`);
  },

  create: async (payload: { departmentId: string; name: string; displayOrder: number }): Promise<ApiResponse<ServiceItem>> => {
    return api.post('/service-items', payload);
  },

  update: async (id: string, payload: Partial<Pick<ServiceItem, 'name' | 'displayOrder' | 'isActive'>>): Promise<ApiResponse<ServiceItem>> => {
    return api.patch(`/service-items/${id}`, payload);
  },

  remove: async (id: string): Promise<ApiResponse<null | ServiceItem>> => {
    return api.delete(`/service-items/${id}`);
  },
};

export default serviceItemService;
