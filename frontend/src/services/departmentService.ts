// frontend/src/services/departmentService.ts — v2.1
import { api, publicApi } from './api';
import type { ApiResponse, Department } from './types';

export const departmentService = {
  list: async (): Promise<ApiResponse<Department[]>> => {
    return publicApi.get('/departments');
  },
  getById: async (id: string): Promise<ApiResponse<Department>> => {
    return publicApi.get(`/departments/${id}`);
  },
  create: async (payload: { id: string; name: string; displayOrder: number }): Promise<ApiResponse<Department>> => {
    return api.post('/departments', payload);
  },
  update: async (id: string, payload: Partial<Pick<Department, 'name' | 'displayOrder'>>): Promise<ApiResponse<Department>> => {
    return api.patch(`/departments/${id}`, payload);
  },
  remove: async (id: string): Promise<ApiResponse<null>> => {
    return api.delete(`/departments/${id}`);
  },
};

export default departmentService;
