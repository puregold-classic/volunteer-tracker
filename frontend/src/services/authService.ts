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
  }
};

export default authService;
