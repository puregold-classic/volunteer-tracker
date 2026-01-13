# 🎨 前端项目AI协作指南

## 🎯 项目信息
- **项目类型**: React 18 + TypeScript + Vite 单页应用
- **主要功能**: 志愿者管理系统的前端界面
- **技术栈**: React, TypeScript, Vite, SCSS

## 📋 文件分级说明
- **⭐ A级文件**: 核心文件（完整显示）
  - 构建配置（vite.config.ts）
  - 入口文件（index.html, main.tsx, App.tsx）
  - 服务层（src/services/*.ts）
  - 依赖配置（package.json）
- **📋 B级文件**: 主要组件（显示前50行）
  - 业务组件（VolunteerCard, VolunteerList等）
  - 排除 Footer、Header、LoadingSpinner
- **📄 C级文件**: 其他文件（仅索引）
  - 样式文件（单独生成STYLE-GUIDE.md）
  - 工具函数、配置文件等

## 🎨 样式系统
所有SCSS/CSS样式文件已单独生成到 `STYLE-GUIDE.md` 中。

## ❓ 如何协作
1. 先阅读本指南和STYLE-GUIDE.md了解项目结构
2. 可以请求任何文件的完整内容
3. 修改代码前请先确认理解需求

---
## 🗂️ 项目结构

```
frontend/
🌐 public/
📜 scripts/
└── 📄 generate-ai-guide.js
📦 src/
├── 🧩 components/
│   ├── 📁 Footer/
│   │   ├── 🎨💎 Footer.scss
│   │   ├── ⚛️📘 Footer.tsx
│   │   └── 📘 index.ts
│   ├── 📁 Header/
│   │   ├── 🎨💎 Header.scss
│   │   ├── ⚛️📘 Header.tsx
│   │   └── 📘 index.ts
│   ├── 📁 LoadingSpinner/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 LoadingSpinner.scss
│   │   └── ⚛️📘 LoadingSpinner.tsx
│   ├── 📁 VolunteerCard/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerCard.scss
│   │   └── ⚛️📘 VolunteerCard.tsx
│   ├── 📁 VolunteerList/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerList.scss
│   │   └── ⚛️📘 VolunteerList.tsx
│   └── 📘 index.ts
├── 🔌 services/
│   ├── 📘 api.ts
│   ├── 📘 types.ts
│   └── 📘 volunteerService.ts
├── 🎨 styles/
│   ├── 🎨💎 animations.scss
│   ├── 🎨💎 global.scss
│   ├── 🎨💎 mixins.scss
│   └── 🎨💎 variables.scss
├── 🎨💎 App.scss
├── ⚛️📘 App.tsx
├── 📘 env.d.ts
└── ⚛️📘 main.tsx
⚙️ .eslintrc.cjs
📄 frontend-analysis-2026-01-11T00-07-20-470Z.md
⭐🌐 index.html
📋 package-lock.json
⭐📋 package.json
📋 tsconfig.json
📋 tsconfig.node.json
⭐📘 vite.config.ts

```

**图标说明**:
- ⭐ A级文件（完整显示）
- 📋 B级文件（显示前50行）  
- 📄 C级文件（仅索引）
- 🎨💎 SCSS样式文件
- ⚛️📘 React + TypeScript组件
- 📘 TypeScript文件
- 📋 配置文件
- 🌐 HTML文件

---
## ⭐ A级文件（完整内容）

### 配置: package.json
**路径**: `package.json`
**说明**: 项目依赖和脚本配置

```json
{
  "name": "volunteer-tracker-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "docs": "node scripts/generate-ai-guide.js",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{js,jsx,css,scss}\""
  },
  "dependencies": {
    "axios": "^1.13.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^25.0.3",
    "@types/react": "^18.3.27",
    "@types/react-dom": "^18.3.7",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.1",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "postcss": "^8.4.0",
    "prettier": "^3.7.4",
    "sass": "^1.97.1",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}

```

### 配置: vite.config.ts
**路径**: `vite.config.ts`
**说明**: Vite构建配置文件

```typescript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    server: {
      port: 3000,
      host: true, // 监听所有地址
      open: true, // 自动打开浏览器
      
      // 开发环境代理配置
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            // 如果前端请求 /api/v1/xxx，保持原样
            // 如果前端请求 /v1/xxx，加上 /api
            if (path.startsWith('/v1/')) {
              return `/api${path}`;
            }
            return path;
          },
          ws: true, // 支持WebSocket
          
          // 代理事件监听，便于调试
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              console.log(`[DEV PROXY] ${req.method} ${req.url} → ${options.target}`);
            });
            
            proxy.on('error', (err, req, res) => {
              console.error('[DEV PROXY ERROR]', err);
            });
          }
        }
      }
    },
    
    // 构建配置
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios'],
            ui: ['@components']
          }
        }
      }
    },
    
    // 路径别名
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@styles': path.resolve(__dirname, './src/styles')
      }
    },
    
    // CSS预处理器配置
    css: {
      preprocessorOptions: {
        scss: {
          // 关键配置：强制使用新版 API
          api: 'modern',
          additionalData: `
            
          `
        }
      }
    }
  };
});
```

### 入口: index.html
**路径**: `index.html`
**说明**: 应用主HTML文件

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Volunteer Tracker Demo</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### 入口: App.tsx
**路径**: `src/App.tsx`
**说明**: 根组件文件

```tsx
import React, { useState } from 'react';
import './App.scss';
import VolunteerList from '@components/VolunteerList';
import Header from '@components/Header';
import Footer from '@components/Footer';



function App() {
  const [viewMode, setViewMode] = useState<'compact' | 'full'>('compact');

  const handleVolunteerClick = (id: string) => {
    console.log('Clicked volunteer:', id);
    // 可以在这里实现详情页导航
    alert(`点击了志愿者 ${id}，详情功能开发中...`);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'compact' ? 'full' : 'compact');
  };

  return (
    <div className="app">
      <Header 
        title="志愿者管理系统" 
        subtitle="全球志愿者可视化平台"
      />
      
      <main className="main-content">
        <div className="controls-bar">
          <div className="view-controls">
            <button 
              className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
              onClick={() => setViewMode('compact')}
            >
              📋 紧凑视图
            </button>
            <button 
              className={`view-btn ${viewMode === 'full' ? 'active' : ''}`}
              onClick={() => setViewMode('full')}
            >
              👁️ 完整视图
            </button>
          </div>
          
          <div className="info-text">
            点击卡片查看志愿者详情
          </div>
        </div>

        <VolunteerList 
          compact={viewMode === 'compact'}
          onVolunteerClick={handleVolunteerClick}
        />
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
```

### 入口: main.tsx
**路径**: `src/main.tsx`
**说明**: React应用入口文件

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### 服务层: api.ts
**路径**: `src/services/api.ts`
**说明**: API客户端配置和基础请求

```typescript
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
```

### 服务层: types.ts
**路径**: `src/services/types.ts`
**说明**: TypeScript类型定义

```typescript
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
```

### 服务层: volunteerService.ts
**路径**: `src/services/volunteerService.ts`
**说明**: 志愿者相关API服务

```typescript
import { api, ApiResponse, VolunteersParams } from './api';
import type { Volunteer } from './types';

// 扩展的志愿者类型
export interface VolunteerStats {
  summary: {
    totalVolunteers: number;
    totalActive: number;
    totalInactive: number;
    totalHours: number;
    avgHours: number;
  };
  regionDistribution: Array<{
    region: string;
    count: number;
    totalHours: number;
  }>;
  serviceDistribution: Array<{
    service: string;
    count: number;
  }>;
}

export const volunteerService = {
  // 获取志愿者列表
  getAllVolunteers: async (params?: VolunteersParams): Promise<ApiResponse> => {
    const queryParams = new URLSearchParams();
    
    // 添加筛选参数
    if (params?.status) queryParams.append('status', params.status);
    if (params?.region) queryParams.append('region', params.region);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.services?.length) {
      queryParams.append('services', params.services.join(','));
    }
    
    // 添加分页参数
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.order) queryParams.append('order', params.order);
    
    const queryString = queryParams.toString();
    const url = `/volunteers${queryString ? `?${queryString}` : ''}`;
    
    return api.get(url);
  },

  // 获取单个志愿者
  getVolunteerById: async (id: string): Promise<ApiResponse<Volunteer>> => {
    return api.get(`/volunteers/${id}`);
  },

  // 获取统计信息
  getStats: async (): Promise<ApiResponse<VolunteerStats>> => {
    return api.get('/volunteers/stats');
  },

  // 创建志愿者
  createVolunteer: async (data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.post('/volunteers', data);
  },

  // 更新志愿者
  updateVolunteer: async (id: string, data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.put(`/volunteers/${id}`, data);
  },

  // 删除志愿者
  deleteVolunteer: async (id: string): Promise<ApiResponse> => {
    return api.delete(`/volunteers/${id}`);
  },

  // 批量操作
  batchUpdate: async (ids: string[], data: Partial<Volunteer>): Promise<ApiResponse> => {
    return api.patch('/volunteers/batch', { ids, data });
  },

  // 导出数据
  exportVolunteers: async (params?: VolunteersParams): Promise<Blob> => {
    const response = await api.get('/volunteers/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};

// Mock数据服务（开发环境使用）
export const mockVolunteerService = {
  getAllVolunteers: async (): Promise<ApiResponse> => {
    // 这里可以返回本地Mock数据
    return {
      success: true,
      data: {
        data: [],
        count: 0,
        total: 0,
        totalPages: 0,
        currentPage: 1
      }
    };
  }
};

// 根据环境选择服务
export const getVolunteerService = () => {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return mockVolunteerService;
  }
  return volunteerService;
};

export default getVolunteerService();
```

---
## 📋 B级文件

未找到B级文件。

---
## 📑 文件索引

### 配置文件

- 📄 `.eslintrc.cjs`
- 📄 `package-lock.json`
- ⭐ `package.json`
- 📄 `tsconfig.json`
- 📄 `tsconfig.node.json`
- ⭐ `vite.config.ts`

### HTML文件

- ⭐ `index.html`

### 组件文件

- 📄 `src\components\Footer\Footer.tsx`
- 📄 `src\components\Footer\index.ts`
- 📄 `src\components\Header\Header.tsx`
- 📄 `src\components\Header\index.ts`
- 📄 `src\components\index.ts`
- 📄 `src\components\LoadingSpinner\index.ts`
- 📄 `src\components\LoadingSpinner\LoadingSpinner.tsx`
- 📄 `src\components\VolunteerCard\index.ts`
- 📄 `src\components\VolunteerCard\VolunteerCard.tsx`
- 📄 `src\components\VolunteerList\index.ts`
- 📄 `src\components\VolunteerList\VolunteerList.tsx`

### 服务文件

- 📄 `src\services\api.ts`
- 📄 `src\services\types.ts`
- 📄 `src\services\volunteerService.ts`

### 样式文件

- 🎨 `src\App.scss`
- 🎨 `src\components\Footer\Footer.scss`
- 🎨 `src\components\Header\Header.scss`
- 🎨 `src\components\LoadingSpinner\LoadingSpinner.scss`
- 🎨 `src\components\VolunteerCard\VolunteerCard.scss`
- 🎨 `src\components\VolunteerList\VolunteerList.scss`
- 🎨 `src\styles\animations.scss`
- 🎨 `src\styles\global.scss`
- 🎨 `src\styles\mixins.scss`
- 🎨 `src\styles\variables.scss`

### 文档文件

- 📄 `frontend-analysis-2026-01-11T00-07-20-470Z.md`

### 其他文件

- 📄 `scripts\generate-ai-guide.js`
- 📄 `src\App.tsx`
- 📄 `src\env.d.ts`
- 📄 `src\main.tsx`

---
*生成时间: 2026/1/12 19:13:21*
*样式文件详见: STYLE-GUIDE.md*
