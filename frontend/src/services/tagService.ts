// frontend/src/services/tagService.ts — v3.2
//
// Thin client for the Tag + TagGroup endpoints. Attach/detach + batch ops
// live here too.

import { api } from './api';
import type {
  ApiResponse, Tag, TagGroup, TagSelectionMode, TagOpMode, TagOpenness,
  ProjectSupport,
} from './types';

export interface CreateTagGroupPayload {
  name: string;
  description?: string;
  boundServiceItemIds?: string[];
  selectionMode?: TagSelectionMode;
  opMode?: TagOpMode;
  openness?: TagOpenness;
  required?: boolean;
}

export interface UpdateTagGroupPayload extends Partial<CreateTagGroupPayload> {}

export interface BatchUpdatePatch {
  duration?: number;
  serviceDate?: string;
  description?: string;
}

export interface BatchUpdatePayload {
  patch: BatchUpdatePatch;
  scope?: 'all' | 'subset';
  supportIds?: string[];
  dryRun?: boolean;
}

export interface BatchDeletePayload {
  scope?: 'all' | 'subset';
  supportIds?: string[];
  dryRun?: boolean;
}

export interface BatchCreatePayload {
  names: string[];
  serviceItemId: string;
  serviceDate: string;
  duration: number;
  description?: string;
  additionalTagIds?: string[];
}

export interface BatchPreview {
  scopeCount: number;
  currentDurationRange?: { min: number; max: number; distinct: number } | null;
  willUpdate?: BatchUpdatePatch;
  sample?: Array<{ supportId: string; volunteer: string }>;
}

export const tagService = {
  // Group CRUD
  listGroups: async (): Promise<ApiResponse<TagGroup[]>> => api.get('/tag-groups'),
  getGroup: async (id: string): Promise<ApiResponse<TagGroup>> => api.get(`/tag-groups/${id}`),
  getGroupsBoundTo: async (serviceItemId: string): Promise<ApiResponse<TagGroup[]>> =>
    api.get(`/tag-groups/bound/${serviceItemId}`),
  createGroup: async (payload: CreateTagGroupPayload): Promise<ApiResponse<TagGroup>> =>
    api.post('/tag-groups', payload),
  updateGroup: async (id: string, payload: UpdateTagGroupPayload): Promise<ApiResponse<TagGroup>> =>
    api.patch(`/tag-groups/${id}`, payload),
  deleteGroup: async (id: string, cascade = false): Promise<ApiResponse<unknown>> =>
    api.delete(`/tag-groups/${id}${cascade ? '?cascadeAttachments=true' : ''}`),

  // Tag CRUD
  createTag: async (payload: { groupId: string; name: string }): Promise<ApiResponse<Tag>> =>
    api.post('/tags', payload),
  updateTag: async (id: string, payload: { name: string }): Promise<ApiResponse<Tag>> =>
    api.patch(`/tags/${id}`, payload),
  deleteTag: async (id: string): Promise<ApiResponse<unknown>> => api.delete(`/tags/${id}`),

  // Attach / detach
  attach: async (tagId: string, supportId: string): Promise<ApiResponse<unknown>> =>
    api.post(`/tags/${tagId}/attach`, { supportId }),
  detach: async (tagId: string, supportId: string): Promise<ApiResponse<unknown>> =>
    api.delete(`/tags/${tagId}/attach/${supportId}`),

  // Tag supports list
  listTagSupports: async (tagId: string): Promise<ApiResponse<Array<{
    attachedAt: string;
    attachedById: string;
    support: ProjectSupport;
  }>>> => api.get(`/tags/${tagId}/supports`),

  // Batch ops
  batchCreate: async (tagId: string, payload: BatchCreatePayload): Promise<ApiResponse<{
    total: number;
    created: Array<{ input: string; volunteer: { id: string; volunteerCode: string; chineseName: string }; supportId: string }>;
    alreadyRecorded: Array<{ input: string; volunteer: { id: string; volunteerCode: string; chineseName: string } }>;
    unmatched: string[];
    ambiguous: Array<{ input: string; candidates: Array<{ id: string; volunteerCode: string; chineseName: string }> }>;
  }>> => api.post(`/tags/${tagId}/batch/create`, payload),

  batchUpdate: async (tagId: string, payload: BatchUpdatePayload): Promise<ApiResponse<{
    dryRun?: boolean;
    preview?: BatchPreview;
    updatedCount?: number;
  }>> => api.post(`/tags/${tagId}/batch/update`, payload),

  batchDelete: async (tagId: string, payload: BatchDeletePayload): Promise<ApiResponse<{
    dryRun?: boolean;
    preview?: BatchPreview;
    deletedCount?: number;
  }>> => api.post(`/tags/${tagId}/batch/delete`, payload),

  batchAttach: async (tagId: string, supportIds: string[]): Promise<ApiResponse<{
    attached: string[];
    alreadyAttached: string[];
    rejectedByBinding: string[];
  }>> => api.post(`/tags/${tagId}/batch/attach`, { supportIds }),

  batchDetach: async (tagId: string, supportIds: string[]): Promise<ApiResponse<{
    detached: number;
  }>> => api.post(`/tags/${tagId}/batch/detach`, { supportIds }),
};

export default tagService;
