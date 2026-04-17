// frontend/src/services/volunteerListService.ts — v3 wave 3
//
// Thin client for per-volunteer tracking lists. MVP exposes only the
// default-list shortcuts (follow / unfollow / listMine). Multi-list CRUD
// is backend-ready but UI-deferred.

import { api } from './api';
import type { ApiResponse, VolunteerList } from './types';

export interface FollowResult {
  list: { id: string; name: string; isDefault: boolean };
  member: { id: string; listId: string; volunteerId: string; note: string | null };
  alreadyMember: boolean;
}

export const volunteerListService = {
  /** Fetch caller's own lists with expanded members. */
  listMine: async (): Promise<ApiResponse<VolunteerList[]>> => {
    return api.get('/lists/mine');
  },

  /** Add a volunteer to the default "我的关注" list (lazy-creates). */
  follow: async (volunteerId: string, note?: string): Promise<ApiResponse<FollowResult>> => {
    return api.post(`/lists/follow/${volunteerId}`, note ? { note } : {});
  },

  /** Remove from the default list. Idempotent — ok if not a member. */
  unfollow: async (volunteerId: string): Promise<ApiResponse<{ removed: boolean }>> => {
    return api.delete(`/lists/follow/${volunteerId}`);
  },

  /** Follower count (distinct followers) for the detail-page badge. */
  followerCount: async (volunteerId: string): Promise<ApiResponse<{ count: number }>> => {
    return api.get(`/lists/volunteers/${volunteerId}/follower-count`);
  },
};

export default volunteerListService;
