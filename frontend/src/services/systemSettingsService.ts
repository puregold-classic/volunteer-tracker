// frontend/src/services/systemSettingsService.ts — v2.1
//
// Singleton settings (currently just lockedBefore for monthly seal).

import { api, publicApi } from './api';
import type { ApiResponse, SystemSettings } from './types';

export const systemSettingsService = {
  get: async (): Promise<ApiResponse<SystemSettings>> => {
    return publicApi.get('/system-settings');
  },

  /**
   * Set the seal-before date. Admin / a_admin only (backend enforces).
   * Pass `lockedBefore: null, allowUnlock: true` to remove the seal entirely.
   */
  setLockedBefore: async (
    lockedBefore: string | null,
    options: { allowUnlock?: boolean } = {}
  ): Promise<ApiResponse<SystemSettings>> => {
    return api.post('/system-settings/lock', { lockedBefore, ...options });
  },
};

export default systemSettingsService;
