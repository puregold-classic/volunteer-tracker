import { api, publicApi, ApiResponse } from './api';

const AUTH_TOKEN_KEY = 'auth_token';

export interface Account {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'b_admin' | 'a_admin' | 'admin';
  volunteerId?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  token: string;
  account: Account;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  volunteerId?: string;
}

export interface AdminCreateAccountPayload extends RegisterPayload {
  role: 'user' | 'b_admin' | 'a_admin' | 'admin';
}

export interface AdminImportVolunteerPayload {
  csvText: string;
  createAccounts?: boolean;
  defaultPassword?: string;
}

export interface AdminCreateVolunteerPayload {
  chineseName: string;
  englishName: string;
  status: '在职' | '不在职';
  region: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
  province?: string;
  subRegion?: string;
  services: string[];
  email?: string;
  username?: string;
  phone?: string;
  role?: 'user' | 'b_admin' | 'a_admin' | 'admin';
  createAccount?: boolean;
  defaultPassword?: string;
}

export interface AdminAccountItem extends Account {
  volunteer?: {
    id: string;
    chineseName: string;
    region: string;
  } | null;
}

export const authService = {
  getToken: (): string | null => localStorage.getItem(AUTH_TOKEN_KEY),

  setToken: (token: string): void => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  clearToken: (): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  register: async (payload: RegisterPayload): Promise<ApiResponse<Account>> => {
    return publicApi.post('/auth/register', payload);
  },

  login: async (email: string, password: string): Promise<ApiResponse<LoginResponse>> => {
    const response = await publicApi.post('/auth/login', { email, password });
    if (response?.success && response?.data?.token) {
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
    }
    return response;
  },

  me: async (): Promise<ApiResponse<Account>> => {
    return api.get('/auth/me');
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return response;
  },

  createAccountByAdmin: async (payload: AdminCreateAccountPayload): Promise<ApiResponse<Account>> => {
    return api.post('/auth/accounts', payload);
  },

  adminListAccounts: async (): Promise<ApiResponse<AdminAccountItem[]>> => {
    return api.get('/auth/admin/accounts');
  },

  adminUpdateAccountRole: async (
    accountId: string,
    payload: { role: 'user' | 'b_admin' | 'a_admin' | 'admin'; isActive?: boolean }
  ): Promise<ApiResponse<Account>> => {
    return api.patch(`/auth/admin/accounts/${accountId}/role`, payload);
  },

  adminUpdateAccount: async (
    accountId: string,
    payload: {
      name?: string;
      email?: string;
      role?: 'user' | 'b_admin' | 'a_admin' | 'admin';
      isActive?: boolean;
      volunteer?: {
        chineseName?: string;
        englishName?: string;
        status?: '在职' | '不在职';
        region?: '中国大陆' | '中国台湾' | '东南亚' | '美国' | '欧洲' | '其他';
        province?: string;
        services?: string[];
        phone?: string;
        email?: string;
      };
    }
  ): Promise<ApiResponse<Account>> => {
    return api.patch(`/auth/admin/accounts/${accountId}`, payload);
  },

  adminDeleteAccount: async (accountId: string): Promise<ApiResponse<any>> => {
    return api.delete(`/auth/admin/accounts/${accountId}`);
  },

  adminImportVolunteers: async (payload: AdminImportVolunteerPayload): Promise<ApiResponse<any>> => {
    return api.post('/auth/admin/import-volunteers', payload);
  },

  adminCreateVolunteer: async (payload: AdminCreateVolunteerPayload): Promise<ApiResponse<any>> => {
    return api.post('/auth/admin/volunteers', payload);
  },

  adminGenerateMissingAccounts: async (payload?: { defaultPassword?: string }): Promise<ApiResponse<any>> => {
    return api.post('/auth/admin/generate-accounts', payload || {});
  },

  adminResetSystem: async (): Promise<ApiResponse<any>> => {
    return api.post('/auth/admin/reset-system', { confirm: 'RESET' });
  }
};

export default authService;
