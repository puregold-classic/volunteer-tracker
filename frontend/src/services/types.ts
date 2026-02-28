// 志愿者类型
export interface Volunteer {
  id: string;
  chineseName: string;
  englishName: string;
  avatar: string;
  status: '在职' | '不在职';
  region: string;
  services: string[];
  nonProjectHours: number;
  nonProjectCount: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
  pagination?: PaginationInfo;
}

// 分页信息
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 筛选参数
export interface FilterParams {
  status?: string;
  region?: string;
  province?: string;
  services?: string[];
  search?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}
