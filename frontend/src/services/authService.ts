// frontend/src/services/authService.ts — v2.1
//
// Login / register / me / logout + admin account management.
//
// v2.1 changes:
// - register requires volunteerCode (claim flow), not arbitrary registration
// - createAccountByAdmin removed — admin uses adminCreateVolunteerAccount or adminCreateAdmin
// - adminGenerateMissingAccounts removed (no longer makes sense; volunteer↔account is 1:1 by construction)
// - Account.volunteerId is now a cuid; Account.volunteerCode is the human PG-XXXX
// - admin role accounts may have null volunteerId

import { api, publicApi } from './api';
import type { Account, AdminAccountItem, ApiResponse, Role } from './types';

// Re-export so existing component code that imports `Account` from this file
// keeps working without touching every consumer.
export type { Account, AdminAccountItem, Role } from './types';

const AUTH_TOKEN_KEY = 'auth_token';

export interface LoginResponse {
  token: string;
  account: Account;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  /** Pre-existing volunteerCode (PG-XXXX) — admin must have created this volunteer first */
  volunteerCode: string;
}

export interface AdminCreateVolunteerAccountPayload {
  volunteer: {
    chineseName: string;
    englishName?: string;
    status?: '在职' | '不在职';
    region: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
    province?: string;
    subRegion?: string;
    departmentId: string;
    email?: string;
    phone?: string;
  };
  account: {
    email: string;
    password: string;
    name?: string;
    role?: Exclude<Role, 'admin'>;
  };
}

export interface AdminCreateAdminPayload {
  email: string;
  password: string;
  name: string;
}

export interface AdminImportVolunteerPayload {
  csvText: string;
  defaultPassword?: string;
}

export const authService = {
  // ─── Token management ───────────────────────────────────────────────────
  getToken: (): string | null => localStorage.getItem(AUTH_TOKEN_KEY),
  setToken: (token: string): void => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },
  clearToken: (): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  // ─── Public auth ────────────────────────────────────────────────────────
  register: async (payload: RegisterPayload): Promise<ApiResponse<Account>> => {
    return publicApi.post('/auth/register', payload);
  },

  /**
   * v3.3 tri-modal login. `identifier` is email / phone / volunteerCode —
   * the backend sniffs by content (contains @ → email, contains - → code,
   * else → phone).
   */
  login: async (
    identifier: string,
    password: string,
    rememberMe: boolean = false,
  ): Promise<ApiResponse<LoginResponse>> => {
    const response = (await publicApi.post('/auth/login', {
      identifier,
      password,
      rememberMe,
    })) as ApiResponse<LoginResponse>;
    if (response?.success && response?.data?.token) {
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
    }
    return response;
  },

  me: async (): Promise<ApiResponse<Account>> => {
    return api.get('/auth/me');
  },

  logout: async (): Promise<ApiResponse> => {
    const response = (await api.post('/auth/logout')) as ApiResponse;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return response;
  },

  // ─── v3.2: account self-service ───────────────────────────────────────────
  changePassword: async (
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<unknown>> => {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },

  /** Upload avatar as data-URL (base64). Server caps at ~512KB of encoded data. */
  updateAvatar: async (avatar: string): Promise<ApiResponse<unknown>> => {
    return api.post('/auth/me/avatar', { avatar });
  },

  adminResetPassword: async (
    accountId: string,
    newPassword: string,
  ): Promise<ApiResponse<unknown>> => {
    return api.post(`/auth/admin/accounts/${accountId}/reset-password`, { newPassword });
  },

  // ─── Admin: account / volunteer management ──────────────────────────────
  adminListAccounts: async (): Promise<ApiResponse<AdminAccountItem[]>> => {
    return api.get('/auth/admin/accounts');
  },

  adminUpdateAccount: async (
    accountId: string,
    payload: {
      name?: string;
      email?: string;
      role?: Role;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<Account>> => {
    return api.patch(`/auth/admin/accounts/${accountId}`, payload);
  },

  adminDeleteAccount: async (accountId: string): Promise<ApiResponse<unknown>> => {
    return api.delete(`/auth/admin/accounts/${accountId}`);
  },

  /**
   * Create a Volunteer + Account pair atomically. Replaces v1's
   * adminCreateVolunteer + adminGenerateMissingAccounts.
   */
  adminCreateVolunteerAccount: async (
    payload: AdminCreateVolunteerAccountPayload
  ): Promise<ApiResponse<{ volunteer: unknown; account: Account }>> => {
    return api.post('/auth/admin/volunteers', payload);
  },

  /** Create a new admin (no volunteer binding). Admin role only. */
  adminCreateAdmin: async (payload: AdminCreateAdminPayload): Promise<ApiResponse<Account>> => {
    return api.post('/auth/admin/admins', payload);
  },

  adminImportVolunteers: async (payload: AdminImportVolunteerPayload): Promise<ApiResponse<unknown>> => {
    return api.post('/auth/admin/import-volunteers', payload);
  },

  adminResetSystem: async (): Promise<ApiResponse<unknown>> => {
    return api.post('/auth/admin/reset-system', { confirm: 'RESET' });
  },
};

export default authService;
