// frontend/src/services/volunteerListService.ts — v3.4 multi-list
//
// 全套 list / member CRUD。仅 a_admin / b_admin 可调（后端 gate）。
// follow / unfollow 是默认 list 的快捷端点，行为不变。

import { api } from './api';
import type { ApiResponse, VolunteerList, VolunteerListMember } from './types';

export interface FollowResult {
  list: { id: string; name: string; isDefault: boolean };
  member: { id: string; listId: string; volunteerId: string; note: string | null };
  alreadyMember: boolean;
}

export const volunteerListService = {
  // ── reads ────────────────────────────────────────────────────────────────

  listMine: async (): Promise<ApiResponse<VolunteerList[]>> => {
    return api.get('/lists/mine');
  },

  followerCount: async (volunteerId: string): Promise<ApiResponse<{ count: number }>> => {
    return api.get(`/lists/volunteers/${volunteerId}/follower-count`);
  },

  // ── default-list shortcuts (follow heart) ────────────────────────────────

  follow: async (volunteerId: string, note?: string): Promise<ApiResponse<FollowResult>> => {
    return api.post(`/lists/follow/${volunteerId}`, note ? { note } : {});
  },

  unfollow: async (volunteerId: string): Promise<ApiResponse<{ removed: boolean }>> => {
    return api.delete(`/lists/follow/${volunteerId}`);
  },

  // ── list CRUD ────────────────────────────────────────────────────────────

  createList: async (name: string): Promise<ApiResponse<{ list: VolunteerList }>> => {
    return api.post('/lists', { name });
  },

  renameList: async (listId: string, name: string): Promise<ApiResponse<{ list: VolunteerList }>> => {
    return api.patch(`/lists/${listId}`, { name });
  },

  deleteList: async (listId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    return api.delete(`/lists/${listId}`);
  },

  // ── member CRUD（任意 list，包括默认 list） ───────────────────────────────

  addMember: async (
    listId: string,
    volunteerId: string,
    note?: string,
  ): Promise<ApiResponse<{ member: VolunteerListMember; alreadyMember: boolean }>> => {
    return api.post(`/lists/${listId}/members/${volunteerId}`, note ? { note } : {});
  },

  removeMember: async (
    listId: string,
    volunteerId: string,
  ): Promise<ApiResponse<{ removed: boolean }>> => {
    return api.delete(`/lists/${listId}/members/${volunteerId}`);
  },

  updateMemberNote: async (
    listId: string,
    volunteerId: string,
    note: string,
  ): Promise<ApiResponse<{ member: VolunteerListMember }>> => {
    return api.patch(`/lists/${listId}/members/${volunteerId}`, { note });
  },
};

export default volunteerListService;
