# 前后端联动思路

## 📡 API调用架构概览

### 1. **架构分层设计**

```text
前端组件层 (Components)
        ↓
服务层 (Services)
        ↓
API客户端层 (API Client)
        ↓
HTTP请求层 (Axios)
        ↓
后端API服务
```

#### 1.2 **实际请求示例**

**组件发起请求：**

```Typescript
await volunteerService.getAllVolunteers();
```

**请求路径转换：**

```text
前端: http://localhost:3000/v1/volunteers
  ↓ 被Vite代理
Vite代理: http://localhost:5000/v1/volunteers
  ↓ 到达后端
后端API: GET /v1/volunteers
```

#### 1.3 **完整请求-响应时序图**

```text
前端组件                服务层                  API客户端                后端API
   |                     |                       |                       |
   | volunteerService    |                       |                       |
   | .getAllVolunteers() |                       |                       |
   |-------------------->|                       |                       |
   |                     | api.get('/v1/volunteers')                     |
   |                     |---------------------->|                       |
   |                     |                       | GET /v1/volunteers    |
   |                     |                       |---------------------->|
   |                     |                       |                       |
   |                     |                       |     { success, data } |
   |                     |                       |<----------------------|
   |                     | { success, data }     |                       |
   |                     |<----------------------|                       |
   | { success, data }   |                       |                       |
   |<--------------------|                       |                       |
   | setVolunteers(data) |                       |                       |
   |                     |                       |                       |
```

### 2. **核心文件解析**

#### 2.1 **开发环境代理配置** (`vite.config.ts`)

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5000',  // 后端地址
    changeOrigin: true,
    rewrite: (path) => {
      // 转换规则：
      // 前端请求：http://localhost:3000/api/v1/volunteers
      // 代理到：http://localhost:5000/v1/volunteers
      return path.replace(/^\/api/, '');
    }
  }
}
```

#### 2.2 **API客户端** (`frontend/src/services/api.ts`)

```typescript
// 创建基础axios实例
export const api = createApiInstance();

// 请求拦截器 - 处理请求前逻辑
instance.interceptors.request.use((config) => {
  // 1. 添加API版本前缀 /v1
  if (!config.url?.startsWith('/v1')) {
    config.url = `/v1${config.url}`;
  }
  
  // 2. 添加认证Token
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// 响应拦截器 - 处理后端返回数据
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 统一处理响应格式
    if (response.data && typeof response.data === 'object') {
      // 返回 { success, data, message } 格式
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
    return Promise.reject(errorResponse);
  }
);
```

#### 2.3 **服务层** (`frontend/src/services/volunteerService.ts`)

```typescript
// 封装具体的API调用
export const volunteerService = {
  // 获取志愿者列表
  getAllVolunteers: async (params?: VolunteersParams): Promise<ApiResponse> => {
    const queryParams = new URLSearchParams();
    
    // 构建查询参数
    if (params?.status) queryParams.append('status', params.status);
    if (params?.region) queryParams.append('region', params.region);
    // ...
    
    const queryString = queryParams.toString();
    const url = `/volunteers${queryString ? `?${queryString}` : ''}`;
    
    // 调用API客户端
    return api.get(url);  // 返回: { success, data, message }
  },

  // 获取单个志愿者
  getVolunteerById: async (id: string): Promise<ApiResponse<Volunteer>> => {
    return api.get(`/volunteers/${id}`);
  },
  
  // 创建志愿者
  createVolunteer: async (data: Partial<Volunteer>): Promise<ApiResponse<Volunteer>> => {
    return api.post('/volunteers', data);
  }
};
```

#### 2.4 **组件层调用** (`frontend/src/components/VolunteerList/VolunteerList.tsx`)

```typescript
const VolunteerList: React.FC = () => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const fetchVolunteers = async () => {
    try {
      setLoading(true);
      // 1. 调用服务层方法
      const response = await volunteerService.getAllVolunteers();
      
      // 2. 处理返回结果（已通过拦截器格式化为统一格式）
      if (response.success && response.data) {
        setVolunteers(response.data);  // response.data 包含实际数据
      }
    } catch (err: any) {
      // 3. 错误处理（已通过拦截器统一格式）
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };
};
```

### 3. **关键特性说明**

#### 3.1 **自动前缀处理**

```typescript
// 请求拦截器会自动添加 /v1 前缀
// 组件中调用：volunteerService.getAllVolunteers()
// 实际请求：GET /v1/volunteers
```

#### 3.2 **统一的响应格式**

```typescript
// 所有API返回统一格式：
{
  success: boolean;     // 请求是否成功
  data: any;           // 实际数据
  message?: string;    // 提示信息
  code?: number;       // 状态码
  pagination?: {...}   // 分页信息（如果有）
}
```

#### 3.3 **错误处理机制**

```typescript
// 1. 网络错误
{
  success: false,
  message: '网络不可用，请检查网络连接',
  error: 'Network Error'
}

// 2. HTTP状态码错误
{
  success: false,
  message: '未授权，请重新登录',
  code: 401
}

// 3. 业务逻辑错误
{
  success: false,
  message: '志愿者不存在',
  code: 404
}
```

#### 3.4 **类型安全**

```typescript
// 1. 请求参数类型
interface VolunteersParams {
  page?: number;
  limit?: number;
  status?: string;
  region?: string;
}

// 2. 响应数据类型
interface ApiResponse<T = any> {
  success: boolean;
  data: T;  // 泛型T指定具体的数据类型
}

// 3. 调用时自动类型推断
const response = await volunteerService.getVolunteerById('123');
// response.data 的类型会自动推断为 Volunteer 类型
```

### 4. **开发环境与生产环境**

#### 4.1 **开发环境**

```bash
# 前端运行在: http://localhost:3000
# 后端运行在: http://localhost:5000
# 通过Vite代理解决跨域
```

#### 4.2 **生产环境**

```env
# .env.production
VITE_API_BASE_URL=https://api.yourdomain.com
```

```typescript
// 生产环境直接请求真实API地址
// 前端: https://yourdomain.com
// API: https://api.yourdomain.com/v1/volunteers
```

### 5. **实际使用示例**

#### 5.1 **获取数据**

```typescript
// 在React组件中
useEffect(() => {
  const loadData = async () => {
    const response = await volunteerService.getAllVolunteers({
      page: 1,
      limit: 20,
      status: '在职'
    });
    
    if (response.success) {
      setVolunteers(response.data);
      setPagination(response.pagination);
    } else {
      toast.error(response.message);
    }
  };
  loadData();
}, []);
```

#### 5.2 **提交数据**

```typescript
const handleSubmit = async (formData) => {
  try {
    const response = await volunteerService.createVolunteer(formData);
    if (response.success) {
      toast.success('创建成功！');
      navigate('/volunteers');
    }
  } catch (error) {
    toast.error(error.message);
  }
};
```

### 6. **最佳实践总结**

1. **分层架构**：组件 → 服务 → API客户端，职责清晰
2. **统一拦截**：请求/响应拦截器处理通用逻辑
3. **错误处理**：统一错误格式，便于全局处理
4. **类型安全**：TypeScript确保类型正确性
5. **环境隔离**：开发/生产环境不同配置
6. **代理配置**：开发时解决跨域问题

这种设计模式的好处是：

- ✅ **可维护性**：API调用逻辑集中管理
- ✅ **可复用性**：服务方法可在多个组件中使用
- ✅ **可测试性**：易于Mock和单元测试
- ✅ **可扩展性**：添加新的API调用很方便
- ✅ **一致性**：所有请求/响应格式统一
