import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 环境配置
const ENV = import.meta.env.VITE_APP_ENV || 'development';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// API版本
const API_VERSION = 'v1';

// 请求配置
const DEFAULT_CONFIG: AxiosRequestConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  withCredentials: true // 如果需要跨域带cookie
};

// 创建axios实例
const createApiInstance = (config: AxiosRequestConfig = {}): AxiosInstance => {
  const instance = axios.create({
    ...DEFAULT_CONFIG,
    ...config
  });

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      if (!config.url?.startsWith('/v1') && !config.url?.startsWith('http')) {
        config.url = `/v1${config.url}`;  // 添加 /v1
      }

      // 添加API版本前缀
      if (!config.url?.startsWith(`/${API_VERSION}`) && !config.url?.startsWith('http')) {
        config.url = `/${API_VERSION}${config.url}`;
      }

      // 添加认证token（如果需要）
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 开发环境日志
      if (ENV === 'development') {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
      }

      return config;
    },
    (error) => {
      console.error('[API Request Error]', error);
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 开发环境日志
      if (ENV === 'development') {
        console.log(`[API Response] ${response.config.url}`, response.data);
      }

      // 统一处理响应格式
      if (response.data && typeof response.data === 'object') {
        // 如果后端返回的是我们约定的格式 { success, data, message }
        return response.data;
      }

      return response;
    },
    (error) => {
      // 统一错误处理
      const errorResponse = {
        success: false,
        message: '网络错误',
        error: error.message,
        code: error.response?.status || 500
      };

      // 根据不同状态码处理
      if (error.response) {
        switch (error.response.status) {
          case 401:
            errorResponse.message = '未授权，请重新登录';
            // 可以在这里触发登出逻辑
            break;
          case 403:
            errorResponse.message = '拒绝访问';
            break;
          case 404:
            errorResponse.message = '请求的资源不存在';
            break;
          case 500:
            errorResponse.message = '服务器内部错误';
            break;
          default:
            errorResponse.message = error.response.data?.message || '请求失败';
        }
      } else if (error.request) {
        errorResponse.message = '网络不可用，请检查网络连接';
      }

      console.error('[API Response Error]', errorResponse);
      
      // 可以在这里显示全局错误提示
      if (typeof window !== 'undefined') {
        // 例如：showToast(errorResponse.message);
      }

      return Promise.reject(errorResponse);
    }
  );

  return instance;
};

// 创建不同类型的API实例
export const api = createApiInstance();

// 创建不带认证的API实例（用于公开接口）
export const publicApi = createApiInstance({
  withCredentials: false
});

// 创建文件上传API实例
export const uploadApi = createApiInstance({
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 分页参数类型
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

// 筛选参数类型
export interface FilterParams {
  status?: string;
  region?: string;
  services?: string[];
  search?: string;
}

// 组合参数类型
export type VolunteersParams = PaginationParams & FilterParams;

export default api;