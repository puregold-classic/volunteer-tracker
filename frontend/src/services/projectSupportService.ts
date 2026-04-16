// frontend/src/services/projectSupportService.ts — v2.1
//
// Replaces v1's serviceRecordService + applicationService. Talks to the
// new /project-supports endpoints. The state machine + dedup + lock check
// all live on the backend; this is a thin client.

import { api } from './api';
import type {
  ApiResponse,
  ProjectSupport,
  PaginationParams,
  PaginationInfo,
} from './types';

export interface ProjectSupportListFilters extends PaginationParams {
  volunteerId?: string;
  submittedById?: string;
  serviceItemId?: string;
  departmentId?: string;
  status?: string;
  serviceDateFrom?: string;
  serviceDateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  search?: string;
}

export interface ProjectSupportListResult {
  records: ProjectSupport[];
  pagination: PaginationInfo;
}

export interface CreateProjectSupportPayload {
  // omit volunteerId for self-submit (backend defaults to operator's own)
  volunteerId?: string;
  serviceItemId: string;
  serviceDate: string;
  duration: number;
  description: string;
  // admin-only escape hatch: force ACTIVE even when proxying
  forceActive?: boolean;
}

export interface UpdateProjectSupportPayload {
  serviceItemId?: string;
  serviceDate?: string;
  duration?: number;
  description?: string;
  // v3 wave-2 step 3: link / unlink a ProjectSupport to a Project (tagging).
  // Pass null to unlink, a Project.id to link.
  projectId?: string | null;
}

export const projectSupportService = {
  list: async (
    filters: ProjectSupportListFilters = {}
  ): Promise<ApiResponse<ProjectSupportListResult>> => {
    return api.get('/project-supports', { params: filters });
  },

  /** Records owned by the current user, all statuses. */
  listMine: async (
    volunteerId: string,
    filters: ProjectSupportListFilters = {}
  ): Promise<ApiResponse<ProjectSupportListResult>> => {
    return api.get('/project-supports', { params: { ...filters, volunteerId } });
  },

  /** Pending proxy submissions waiting for the current user to confirm/reject. */
  listPendingForMe: async (): Promise<ApiResponse<ProjectSupport[]>> => {
    return api.get('/project-supports/me/pending');
  },

  getBySupportId: async (supportId: string): Promise<ApiResponse<ProjectSupport>> => {
    return api.get(`/project-supports/${supportId}`);
  },

  create: async (payload: CreateProjectSupportPayload): Promise<ApiResponse<ProjectSupport>> => {
    return api.post('/project-supports', payload);
  },

  update: async (
    supportId: string,
    payload: UpdateProjectSupportPayload
  ): Promise<ApiResponse<ProjectSupport>> => {
    return api.patch(`/project-supports/${supportId}`, payload);
  },

  /** Soft delete: status → DELETED. Owner or admin only. */
  remove: async (supportId: string): Promise<ApiResponse<ProjectSupport>> => {
    return api.delete(`/project-supports/${supportId}`);
  },

  /** Owner confirms a proxy submission → ACTIVE. */
  confirm: async (supportId: string): Promise<ApiResponse<ProjectSupport>> => {
    return api.post(`/project-supports/${supportId}/confirm`);
  },

  /** Owner rejects a proxy submission → REJECTED_BY_OWNER (preserved for audit). */
  reject: async (supportId: string, reason?: string): Promise<ApiResponse<ProjectSupport>> => {
    return api.post(`/project-supports/${supportId}/reject`, reason ? { reason } : {});
  },
};

export default projectSupportService;
