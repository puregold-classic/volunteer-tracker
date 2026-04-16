// frontend/src/services/projectService.ts — v3 wave 2
//
// Client wrapper for Project CRUD. MVP surface — batch attendance entry
// (POST /:id/attendance) lands in wave-2 step 2.

import { api } from './api';
import type {
  ApiResponse,
  PaginatedList,
  Project,
  ProjectAttributes,
  ServiceCategory,
  VolunteerSummary,
} from './types';

// ─── Batch-attendance entry ─────────────────────────────────────────────────

export interface BatchAttendancePayload {
  names: string[];
  serviceItemId: string;
  description?: string;
}

export interface BatchAttendanceMatch {
  input: string;
  volunteer: VolunteerSummary;
  supportId?: string;
}

export interface BatchAttendanceAmbiguous {
  input: string;
  candidates: VolunteerSummary[];
}

export interface BatchAttendanceResult {
  total: number;
  created: BatchAttendanceMatch[];
  alreadyRecorded: BatchAttendanceMatch[];
  unmatched: string[];
  ambiguous: BatchAttendanceAmbiguous[];
}

export interface ProjectListParams {
  category?: ServiceCategory;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'sessionDate' | 'createdAt' | 'updatedAt' | 'name';
  order?: 'asc' | 'desc';
}

export interface CreateProjectPayload {
  name: string;
  category: ServiceCategory;
  departmentId: string;
  sessionDate: string;
  sessionDuration?: number;
  attributes?: ProjectAttributes;
}

export interface UpdateProjectPayload {
  name?: string;
  sessionDate?: string;
  sessionDuration?: number;
  attributes?: ProjectAttributes;
}

const buildQuery = (params?: ProjectListParams): string => {
  if (!params) return '';
  const qp = new URLSearchParams();
  if (params.category) qp.append('category', params.category);
  if (params.departmentId) qp.append('departmentId', params.departmentId);
  if (params.dateFrom) qp.append('dateFrom', params.dateFrom);
  if (params.dateTo) qp.append('dateTo', params.dateTo);
  if (params.search) qp.append('search', params.search);
  if (params.page) qp.append('page', String(params.page));
  if (params.limit) qp.append('limit', String(params.limit));
  if (params.sortBy) qp.append('sortBy', params.sortBy);
  if (params.order) qp.append('order', params.order);
  const qs = qp.toString();
  return qs ? `?${qs}` : '';
};

export const projectService = {
  list: async (params?: ProjectListParams): Promise<ApiResponse<Project[]> & { pagination?: PaginatedList<Project>['pagination'] }> => {
    return api.get(`/projects${buildQuery(params)}`);
  },

  getById: async (idOrCode: string): Promise<ApiResponse<Project>> => {
    return api.get(`/projects/${idOrCode}`);
  },

  create: async (payload: CreateProjectPayload): Promise<ApiResponse<Project>> => {
    return api.post('/projects', payload);
  },

  update: async (id: string, payload: UpdateProjectPayload): Promise<ApiResponse<Project>> => {
    return api.patch(`/projects/${id}`, payload);
  },

  remove: async (id: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    return api.delete(`/projects/${id}`);
  },

  batchAttendance: async (
    id: string,
    payload: BatchAttendancePayload,
  ): Promise<ApiResponse<BatchAttendanceResult>> => {
    return api.post(`/projects/${id}/attendance`, payload);
  },
};

export default projectService;
