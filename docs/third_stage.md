# 🚀 第三阶段：前端开发

## 📋 阶段目标

完成志愿者卡片的前端展示系统，包括组件开发、API集成、响应式布局和交互实现。

## 🏗️ 第一步：项目初始化

### 1.1 创建前端项目结构

```bash
## 新创建的前端架构
# 在项目根目录下（volunteer-tracker/）
cd frontend

# 初始化Vite + React + TypeScript项目
npm create vite@latest . -- --template react-ts

## 已经配置好开发环境的前端架构
# 如果已有package.json，安装依赖
npm install
```

### 1.2 安装必要依赖

```bash
# 基础依赖
npm install axios
npm install sass

# 开发依赖（如果还未安装）
npm install -D @types/react @types/react-dom
npm install -D eslint prettier
npm install -D @vitejs/plugin-react
```

### 1.3 配置 Vite

**frontend/vite.config.ts:**

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

### 1.4 配置 TypeScript

**frontend/tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"],
      "@styles/*": ["src/styles/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**frontend/tsconfig.node.json:**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "package.json"]
}
```

### 1.5 创建基础样式文件

**frontend/src/styles/variables.scss:**

```scss
// ============================================
// 设计令牌系统 (Design Tokens)
// ============================================

// === 基础单位 ===
$base-unit: 4px;
$base-spacing: 8px;

// === 颜色系统 (Color System) ===
// 主色系
$color-primary-50: #f0f4f8;
$color-primary-100: #d9e2ec;
$color-primary-200: #bcccdc;
$color-primary-300: #9fb3c8;
$color-primary-400: #829ab1;
$color-primary-500: #627d98;
$color-primary-600: #486581;
$color-primary-700: #334e68;
$color-primary-800: #243b53;
$color-primary-900: #102a43;

// 辅助色系
$color-secondary-50: #f8fafc;
$color-secondary-100: #f1f5f9;
$color-secondary-200: #e2e8f0;
$color-secondary-300: #cbd5e1;
$color-secondary-400: #94a3b8;
$color-secondary-500: #64748b;
$color-secondary-600: #475569;
$color-secondary-700: #334155;
$color-secondary-800: #1e293b;
$color-secondary-900: #0f172a;

// 语义色 (Semantic Colors)
$color-success: #10b981;
$color-warning: #f59e0b;
$color-danger: #ef4444;
$color-info: #3b82f6;

// 中性色
$color-white: #ffffff;
$color-gray-50: #f9fafb;
$color-gray-100: #f3f4f6;
$color-gray-200: #e5e7eb;
$color-gray-300: #d1d5db;
$color-gray-400: #9ca3af;
$color-gray-500: #6b7280;
$color-gray-600: #4b5563;
$color-gray-700: #374151;
$color-gray-800: #1f2937;
$color-gray-900: #111827;
$color-black: #000000;

// 背景色
$bg-primary: $color-white;
$bg-secondary: $color-gray-50;
$bg-tertiary: $color-gray-100;

// === 间距系统 (Spacing System) ===
$spacing-0: 0;
$spacing-1: $base-unit * 1;   // 4px
$spacing-2: $base-unit * 2;   // 8px
$spacing-3: $base-unit * 3;   // 12px
$spacing-4: $base-unit * 4;   // 16px
$spacing-5: $base-unit * 5;   // 20px
$spacing-6: $base-unit * 6;   // 24px
$spacing-8: $base-unit * 8;   // 32px
$spacing-10: $base-unit * 10; // 40px
$spacing-12: $base-unit * 12; // 48px
$spacing-16: $base-unit * 16; // 64px

// === 字体系统 (Typography System) ===
$font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
                   'Helvetica Neue', Arial, sans-serif;
$font-family-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', 
                   Menlo, 'Courier New', monospace;

// 字体大小 - 使用rem作为单位（1rem = 16px）
$font-size-xs: 0.75rem;   // 12px
$font-size-sm: 0.875rem;  // 14px
$font-size-base: 1rem;    // 16px
$font-size-lg: 1.125rem;  // 18px
$font-size-xl: 1.25rem;   // 20px
$font-size-2xl: 1.5rem;   // 24px
$font-size-3xl: 1.875rem; // 30px
$font-size-4xl: 2.25rem;  // 36px

// 字体粗细
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// 行高
$line-height-tight: 1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;

// === 边框系统 (Border System) ===
$border-width-1: 1px;
$border-width-2: 2px;
$border-width-4: 4px;

$border-color-light: $color-gray-200;
$border-color: $color-gray-300;
$border-color-dark: $color-gray-400;

$border-radius-sm: 0.25rem;   // 4px
$border-radius: 0.5rem;       // 8px
$border-radius-lg: 0.75rem;   // 12px
$border-radius-xl: 1rem;      // 16px
$border-radius-2xl: 1.5rem;   // 24px
$border-radius-full: 9999px;  // 圆形

// === 阴影系统 (Shadow System) ===
$shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
$shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
$shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
$shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
$shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

// === 动画系统 (Animation System) ===
$duration-fast: 150ms;
$duration-normal: 250ms;
$duration-slow: 350ms;
$duration-very-slow: 500ms;

$timing-ease: cubic-bezier(0.4, 0, 0.2, 1);
$timing-ease-in: cubic-bezier(0.4, 0, 1, 1);
$timing-ease-out: cubic-bezier(0, 0, 0.2, 1);
$timing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

// === 响应式断点 (Responsive Breakpoints) ===
$breakpoint-sm: 640px;   // 小屏幕
$breakpoint-md: 768px;   // 中等屏幕
$breakpoint-lg: 1024px;  // 大屏幕
$breakpoint-xl: 1280px;  // 超大屏幕
$breakpoint-2xl: 1536px; // 特大屏幕

// === 层级系统 (Z-Index System) ===
$z-index-dropdown: 1000;
$z-index-sticky: 1020;
$z-index-fixed: 1030;
$z-index-modal: 1040;
$z-index-popover: 1050;
$z-index-tooltip: 1060;
$z-index-toast: 1070;

// === 组件特定变量 ===
// 卡片设计
$card-bg: $color-white;
$card-border-color: $border-color-light;
$card-border-radius: $border-radius-lg;
$card-padding: $spacing-6;
$card-shadow: $shadow;
$card-shadow-hover: $shadow-md;

// 头像尺寸
$avatar-size-sm: 3rem;    // 48px
$avatar-size-md: 4rem;    // 64px
$avatar-size-lg: 6rem;    // 96px

// 状态指示器
$status-indicator-size: 0.5rem;
$status-indicator-active: $color-success;
$status-indicator-inactive: $color-danger;

// 布局变量
$container-max-width: 80rem; // 1280px
$navbar-height: 4rem;        // 64px
$sidebar-width: 16rem;       // 256px
$footer-height: 12rem;       // 192px

// 导出为CSS变量（可选）
:root {
  --color-primary-500: #{$color-primary-500};
  --color-secondary-500: #{$color-secondary-500};
  // ... 其他需要暴露给JS的变量
}
```

**frontend/src/styles/global.scss:**

```scss
@use "@styles/variables" as var;

// ============================================
// CSS 重置和标准化
// ============================================

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var.$font-family-sans;
  font-size: var.$font-size-base;
  color: var.$color-gray-900;
  background-color: var.$bg-secondary;
  line-height: var.$line-height-normal;
  min-height: 100vh;
}

// ============================================
// 基础排版
// ============================================

h1, h2, h3, h4, h5, h6 {
  font-weight: var.$font-weight-semibold;
  line-height: var.$line-height-tight;
  margin-bottom: var.$spacing-4;
}

h1 {
  font-size: var.$font-size-4xl;
  margin-bottom: var.$spacing-6;
}

h2 {
  font-size: var.$font-size-3xl;
  margin-bottom: var.$spacing-5;
}

h3 {
  font-size: var.$font-size-2xl;
  margin-bottom: var.$spacing-4;
}

h4 {
  font-size: var.$font-size-xl;
  margin-bottom: var.$spacing-3;
}

p {
  margin-bottom: var.$spacing-3;
  
  &:last-child {
    margin-bottom: 0;
  }
}

// ============================================
// 链接样式
// ============================================

a {
  color: var.$color-primary-600;
  text-decoration: none;
  transition: color 0.2s ease;
  
  &:hover {
    color: var.$color-primary-700;
    text-decoration: underline;
  }
  
  &:focus-visible {
    outline: 2px solid var.$color-primary-500;
    outline-offset: 2px;
    border-radius: 2px;
  }
}

// ============================================
// 列表样式
// ============================================

ul, ol {
  margin-bottom: var.$spacing-4;
  padding-left: var.$spacing-4;
  
  li {
    margin-bottom: var.$spacing-2;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

// ============================================
// 表单元素基础
// ============================================

input,
button,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

button {
  cursor: pointer;
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

// ============================================
// 图片和媒体
// ============================================

img {
  max-width: 100%;
  height: auto;
  display: block;
}

picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

// ============================================
// 表格基础样式
// ============================================

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var.$spacing-4;
}

th {
  text-align: left;
  font-weight: var.$font-weight-semibold;
  padding: var.$spacing-3;
  background-color: var.$color-gray-100;
  border-bottom: 2px solid var.$color-gray-300;
}

td {
  padding: var.$spacing-3;
  border-bottom: 1px solid var.$color-gray-200;
}

tr:hover {
  background-color: var.$color-gray-50;
}

// ============================================
// 代码块样式
// ============================================

code {
  font-family: var.$font-family-mono;
  font-size: var.$font-size-sm;
  background-color: var.$color-gray-100;
  padding: 2px 6px;
  border-radius: var.$border-radius-sm;
}

pre {
  background-color: var.$color-gray-900;
  color: var.$color-gray-100;
  padding: var.$spacing-4;
  border-radius: var.$border-radius;
  overflow-x: auto;
  margin-bottom: var.$spacing-4;
  
  code {
    background-color: transparent;
    padding: 0;
    color: inherit;
  }
}

// ============================================
// 容器布局类
// ============================================

.container {
  width: 100%;
  max-width: var.$container-max-width;
  margin: 0 auto;
  padding: 0 var.$spacing-4;
}

.container-fluid {
  width: 100%;
  padding: 0 var.$spacing-4;
}

// ============================================
// 工具类：间距
// ============================================

.m-0 { margin: 0 !important; }
.m-1 { margin: var.$spacing-1 !important; }
.m-2 { margin: var.$spacing-2 !important; }
.m-3 { margin: var.$spacing-3 !important; }
.m-4 { margin: var.$spacing-4 !important; }
.m-6 { margin: var.$spacing-6 !important; }

.mt-0 { margin-top: 0 !important; }
.mt-1 { margin-top: var.$spacing-1 !important; }
.mt-2 { margin-top: var.$spacing-2 !important; }
.mt-3 { margin-top: var.$spacing-3 !important; }
.mt-4 { margin-top: var.$spacing-4 !important; }
.mt-6 { margin-top: var.$spacing-6 !important; }

.mb-0 { margin-bottom: 0 !important; }
.mb-1 { margin-bottom: var.$spacing-1 !important; }
.mb-2 { margin-bottom: var.$spacing-2 !important; }
.mb-3 { margin-bottom: var.$spacing-3 !important; }
.mb-4 { margin-bottom: var.$spacing-4 !important; }
.mb-6 { margin-bottom: var.$spacing-6 !important; }

.ml-0 { margin-left: 0 !important; }
.ml-1 { margin-left: var.$spacing-1 !important; }
.ml-2 { margin-left: var.$spacing-2 !important; }
.ml-3 { margin-left: var.$spacing-3 !important; }
.ml-4 { margin-left: var.$spacing-4 !important; }

.mr-0 { margin-right: 0 !important; }
.mr-1 { margin-right: var.$spacing-1 !important; }
.mr-2 { margin-right: var.$spacing-2 !important; }
.mr-3 { margin-right: var.$spacing-3 !important; }
.mr-4 { margin-right: var.$spacing-4 !important; }

.p-0 { padding: 0 !important; }
.p-1 { padding: var.$spacing-1 !important; }
.p-2 { padding: var.$spacing-2 !important; }
.p-3 { padding: var.$spacing-3 !important; }
.p-4 { padding: var.$spacing-4 !important; }
.p-6 { padding: var.$spacing-6 !important; }

// ============================================
// 工具类：文本
// ============================================

.text-center { text-align: center !important; }
.text-left { text-align: left !important; }
.text-right { text-align: right !important; }

.text-xs { font-size: var.$font-size-xs !important; }
.text-sm { font-size: var.$font-size-sm !important; }
.text-base { font-size: var.$font-size-base !important; }
.text-lg { font-size: var.$font-size-lg !important; }
.text-xl { font-size: var.$font-size-xl !important; }

.font-light { font-weight: var.$font-weight-light !important; }
.font-normal { font-weight: var.$font-weight-normal !important; }
.font-medium { font-weight: var.$font-weight-medium !important; }
.font-semibold { font-weight: var.$font-weight-semibold !important; }
.font-bold { font-weight: var.$font-weight-bold !important; }

.text-primary { color: var.$color-primary-600 !important; }
.text-secondary { color: var.$color-gray-600 !important; }
.text-success { color: var.$color-success !important; }
.text-danger { color: var.$color-danger !important; }
.text-warning { color: var.$color-warning !important; }
.text-info { color: var.$color-primary-500 !important; }
.text-muted { color: var.$color-gray-500 !important; }

// ============================================
// 工具类：背景
// ============================================

.bg-white { background-color: white !important; }
.bg-transparent { background-color: transparent !important; }

.bg-primary { background-color: var.$color-primary-600 !important; }
.bg-secondary { background-color: var.$color-gray-600 !important; }
.bg-success { background-color: var.$color-success !important; }
.bg-danger { background-color: var.$color-danger !important; }
.bg-warning { background-color: var.$color-warning !important; }
.bg-info { background-color: var.$color-primary-500 !important; }

.bg-gray-50 { background-color: var.$color-gray-50 !important; }
.bg-gray-100 { background-color: var.$color-gray-100 !important; }
.bg-gray-200 { background-color: var.$color-gray-200 !important; }
.bg-gray-300 { background-color: var.$color-gray-300 !important; }

// ============================================
// 工具类：显示和隐藏
// ============================================

.d-none { display: none !important; }
.d-block { display: block !important; }
.d-inline { display: inline !important; }
.d-inline-block { display: inline-block !important; }
.d-flex { display: flex !important; }
.d-grid { display: grid !important; }

// ============================================
// 工具类：弹性布局
// ============================================

.flex-row { flex-direction: row !important; }
.flex-col { flex-direction: column !important; }
.flex-wrap { flex-wrap: wrap !important; }
.flex-nowrap { flex-wrap: nowrap !important; }

.justify-start { justify-content: flex-start !important; }
.justify-center { justify-content: center !important; }
.justify-end { justify-content: flex-end !important; }
.justify-between { justify-content: space-between !important; }
.justify-around { justify-content: space-around !important; }

.items-start { align-items: flex-start !important; }
.items-center { align-items: center !important; }
.items-end { align-items: flex-end !important; }
.items-stretch { align-items: stretch !important; }

.gap-1 { gap: var.$spacing-1 !important; }
.gap-2 { gap: var.$spacing-2 !important; }
.gap-3 { gap: var.$spacing-3 !important; }
.gap-4 { gap: var.$spacing-4 !important; }

// ============================================
// 工具类：边框
// ============================================

.border { border: 1px solid var.$color-gray-300 !important; }
.border-t { border-top: 1px solid var.$color-gray-300 !important; }
.border-b { border-bottom: 1px solid var.$color-gray-300 !important; }
.border-l { border-left: 1px solid var.$color-gray-300 !important; }
.border-r { border-right: 1px solid var.$color-gray-300 !important; }

.border-primary { border-color: var.$color-primary-500 !important; }
.border-success { border-color: var.$color-success !important; }
.border-danger { border-color: var.$color-danger !important; }
.border-warning { border-color: var.$color-warning !important; }

.rounded { border-radius: var.$border-radius !important; }
.rounded-sm { border-radius: var.$border-radius-sm !important; }
.rounded-lg { border-radius: var.$border-radius-lg !important; }
.rounded-full { border-radius: var.$border-radius-full !important; }

// ============================================
// 工具类：阴影
// ============================================

.shadow-sm { box-shadow: var.$shadow-sm !important; }
.shadow { box-shadow: var.$shadow !important; }
.shadow-md { box-shadow: var.$shadow-md !important; }
.shadow-lg { box-shadow: var.$shadow-lg !important; }
.shadow-none { box-shadow: none !important; }

// ============================================
// 工具类：位置
// ============================================

.relative { position: relative !important; }
.absolute { position: absolute !important; }
.fixed { position: fixed !important; }
.sticky { position: sticky !important; }

.top-0 { top: 0 !important; }
.right-0 { right: 0 !important; }
.bottom-0 { bottom: 0 !important; }
.left-0 { left: 0 !important; }

// ============================================
// 工具类：宽度和高度
// ============================================

.w-full { width: 100% !important; }
.w-auto { width: auto !important; }
.w-50 { width: 50% !important; }
.w-75 { width: 75% !important; }

.h-full { height: 100% !important; }
.h-auto { height: auto !important; }
.h-screen { height: 100vh !important; }

.min-h-screen { min-height: 100vh !important; }

// ============================================
// 全局滚动条样式
// ============================================

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var.$color-gray-100;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb {
  background: var.$color-gray-400;
  border-radius: 5px;
  
  &:hover {
    background: var.$color-gray-500;
  }
}

// 针对火狐浏览器
* {
  scrollbar-width: thin;
  scrollbar-color: var.$color-gray-400 var.$color-gray-100;
}

// ============================================
// 选中文本样式
// ============================================

::selection {
  background-color: rgba(var.$color-primary-500, 0.2);
  color: var.$color-gray-900;
}

::-moz-selection {
  background-color: rgba(var.$color-primary-500, 0.2);
  color: var.$color-gray-900;
}

// ============================================
// 焦点样式（可访问性）
// ============================================

:focus-visible {
  outline: 2px solid var.$color-primary-500;
  outline-offset: 2px;
}

// ============================================
// 禁用状态样式
// ============================================

:disabled,
.disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
}

// ============================================
// 响应式显示类（移动端优先）
// ============================================

// 移动端显示/隐藏
@media (max-width: 767px) {
  .hide-mobile {
    display: none !important;
  }
  
  .show-mobile {
    display: block !important;
  }
}

// 平板及以上显示
@media (min-width: 768px) {
  .hide-tablet-up {
    display: none !important;
  }
}

// 桌面端显示
@media (min-width: 1024px) {
  .hide-desktop {
    display: none !important;
  }
}

// ============================================
// 打印优化
// ============================================

@media print {
  .no-print {
    display: none !important;
  }
  
  body {
    font-size: 12pt;
    line-height: 1.4;
  }
  
  a {
    text-decoration: underline;
    color: #000;
  }
  
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  
  img {
    page-break-inside: avoid;
    max-width: 100% !important;
  }
}

// ============================================
// 辅助类（屏幕阅读器）
// ============================================

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:not(:focus):not(:focus-within) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**frontend/src/styles/mixins.scss:**

```scss
@use "sass:color";
@use "sass:math";
@use "@styles/variables" as var;

// ============================================
// 响应式 Mixins
// ============================================

/// 移动端优先 - 从最小屏幕开始
/// @param {String} $breakpoint - 断点名称
@mixin respond-to($breakpoint) {
  @if $breakpoint == 'sm' {
    @media (min-width: var.$breakpoint-sm) { @content; }
  } @else if $breakpoint == 'md' {
    @media (min-width: var.$breakpoint-md) { @content; }
  } @else if $breakpoint == 'lg' {
    @media (min-width: var.$breakpoint-lg) { @content; }
  } @else if $breakpoint == 'xl' {
    @media (min-width: var.$breakpoint-xl) { @content; }
  } @else if $breakpoint == '2xl' {
    @media (min-width: var.$breakpoint-2xl) { @content; }
  } @else {
    @warn "未定义的断点: #{$breakpoint}";
  }
}

/// 特定屏幕范围
@mixin only-for($breakpoint) {
  @if $breakpoint == 'sm' {
    @media (max-width: var.$breakpoint-sm - 1) { @content; }
  } @else if $breakpoint == 'md-only' {
    @media (min-width: var.$breakpoint-md) and (max-width: var.$breakpoint-lg - 1) { @content; }
  } @else if $breakpoint == 'lg-only' {
    @media (min-width: var.$breakpoint-lg) and (max-width: var.$breakpoint-xl - 1) { @content; }
  }
}

/// 高对比度模式支持
@mixin high-contrast-mode {
  @media (forced-colors: active) {
    @content;
  }
}

// ============================================
// 布局 Mixins
// ============================================

/// 弹性布局居中
@mixin flex-center($direction: row) {
  display: flex;
  flex-direction: $direction;
  justify-content: center;
  align-items: center;
}

/// 弹性布局两端对齐
@mixin flex-between($align: center) {
  display: flex;
  justify-content: space-between;
  align-items: $align;
}

/// 网格布局自动适应
@mixin grid-auto-fit($min-width, $gap: var.$spacing-4) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax($min-width, 1fr));
  gap: $gap;
}

/// 容器布局
@mixin container {
  width: 100%;
  max-width: var.$container-max-width;
  margin: 0 auto;
  padding: 0 var.$spacing-4;

  @include respond-to('lg') {
    padding: 0 var.$spacing-6;
  }
}

// ============================================
// 视觉效果 Mixins
// ============================================

/// 卡片效果
/// @param {Number} $elevation - 阴影级别 (1-3)
@mixin card($elevation: 1) {
  background-color: var.$card-bg;
  border-radius: var.$card-border-radius;
  border: 1px solid var.$card-border-color;
  
  @if $elevation == 1 {
    box-shadow: var.$shadow-sm;
  } @else if $elevation == 2 {
    box-shadow: var.$shadow;
  } @else if $elevation == 3 {
    box-shadow: var.$shadow-md;
  }
  
  transition: transform var.$duration-normal var.$timing-ease,
              box-shadow var.$duration-normal var.$timing-ease;
  
  &:hover {
    @if $elevation == 1 {
      box-shadow: var.$shadow;
    } @else if $elevation == 2 {
      box-shadow: var.$shadow-md;
    } @else if $elevation == 3 {
      box-shadow: var.$shadow-lg;
    }
    
    transform: translateY(-2px);
  }
}

/// 按钮样式
/// @param {String} $variant - 变体类型 (primary, secondary, danger)
@mixin button($variant: 'primary') {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var.$spacing-2;
  padding: var.$spacing-2 var.$spacing-4;
  border-radius: var.$border-radius;
  font-weight: var.$font-weight-medium;
  font-size: var.$font-size-sm;
  line-height: var.$line-height-normal;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all var.$duration-fast var.$timing-ease;
  user-select: none;
  text-decoration: none;
  
  @if $variant == 'primary' {
    background-color: var.$color-primary-600;
    color: var.$color-white;
    
    &:hover:not(:disabled) {
      background-color: var.$color-primary-700;
    }
    
    &:active:not(:disabled) {
      background-color: var.$color-primary-800;
    }
  } @else if $variant == 'secondary' {
    background-color: var.$color-gray-100;
    color: var.$color-gray-700;
    border-color: var.$color-gray-200;
    
    &:hover:not(:disabled) {
      background-color: var.$color-gray-200;
    }
  } @else if $variant == 'danger' {
    background-color: var.$color-danger;
    color: var.$color-white;
    
    &:hover:not(:disabled) {
      background-color: color.adjust(var.$color-danger, $lightness: -10%);
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus-visible {
    outline: 2px solid var.$color-primary-500;
    outline-offset: 2px;
  }
}

/// 标签/徽章样式
@mixin badge($color: var.$color-primary-500) {
  display: inline-flex;
  align-items: center;
  padding: var.$spacing-1 var.$spacing-2;
  border-radius: var.$border-radius-full;
  background-color: color.adjust($color, $alpha: -0.9);
  color: $color;
  font-size: var.$font-size-xs;
  font-weight: var.$font-weight-medium;
  line-height: 1;
  white-space: nowrap;
}

/// 骨架屏效果
@mixin skeleton {
  background: linear-gradient(
    90deg,
    var.$color-gray-100 25%,
    var.$color-gray-200 50%,
    var.$color-gray-100 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: var.$border-radius;
  
  @content;
}

// ============================================
// 工具类 Mixins
// ============================================

/// 文本截断
/// @param {Number} $lines - 行数 (1为单行省略，>1为多行省略)
@mixin text-truncate($lines: 1) {
  @if $lines == 1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  } @else {
    display: -webkit-box;
    -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/// 隐藏滚动条但保持滚动功能
@mixin hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

/// 自定义滚动条
@mixin custom-scrollbar(
  $width: 8px,
  $track-color: var.$color-gray-100,
  $thumb-color: var.$color-gray-400
) {
  &::-webkit-scrollbar {
    width: $width;
    height: $width;
  }
  
  &::-webkit-scrollbar-track {
    background: $track-color;
    border-radius: math.div($width, 2);
  }
  
  &::-webkit-scrollbar-thumb {
    background: $thumb-color;
    border-radius: math.div($width, 2);
    
    &:hover {
      background: color.adjust($thumb-color, $lightness: -10%);
    }
  }
}

/// 绝对居中
@mixin absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/// 视差效果
@mixin parallax($speed: 0.5) {
  transform-style: preserve-3d;
  transform: translateZ(#{$speed}px) scale(#{1 + $speed / 10});
}

// ============================================
// 表单元素 Mixins
// ============================================

/// 输入框样式
@mixin input {
  width: 100%;
  padding: var.$spacing-2 var.$spacing-3;
  font-size: var.$font-size-sm;
  line-height: var.$line-height-normal;
  color: var.$color-gray-900;
  background-color: var.$color-white;
  border: 1px solid var.$color-gray-300;
  border-radius: var.$border-radius;
  transition: border-color var.$duration-fast var.$timing-ease;
  
  &:focus {
    outline: 2px solid var.$color-primary-500;
    outline-offset: 2px;
    border-color: var.$color-primary-500;
  }
  
  &:disabled {
    background-color: var.$color-gray-100;
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: var.$color-gray-500;
  }
}

/// 表单标签样式
@mixin form-label {
  display: block;
  margin-bottom: var.$spacing-2;
  font-size: var.$font-size-sm;
  font-weight: var.$font-weight-medium;
  color: var.$color-gray-700;
}
```

**frontend/src/styles/animations.scss:**

```scss
@use "@styles/variables" as var;

// ============================================
// 关键帧动画 (Keyframes)
// ============================================

// 淡入淡出
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(var.$spacing-4);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in-down {
  from {
    opacity: 0;
    transform: translateY(-var.$spacing-4);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in-left {
  from {
    opacity: 0;
    transform: translateX(var.$spacing-4);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes fade-in-right {
  from {
    opacity: 0;
    transform: translateX(-var.$spacing-4);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// 缩放效果
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scale-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

// 旋转效果
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

// 脉动效果
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 骨架屏加载
@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

// 滑动效果
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

// 弹跳效果
@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
  }
  40%, 43% {
    transform: translateY(-30px);
    animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
  }
  70% {
    transform: translateY(-15px);
    animation-timing-function: cubic-bezier(0.755, 0.05, 0.855, 0.06);
  }
  90% {
    transform: translateY(-4px);
  }
}

// 震动效果
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

// 闪烁效果
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

// ============================================
// 预定义动画类 (Utility Classes)
// ============================================

// 淡入效果
.animate-fade-in {
  animation: fade-in var.$duration-normal var.$timing-ease-out;
}

.animate-fade-in-up {
  animation: fade-in-up var.$duration-normal var.$timing-ease-out;
}

.animate-fade-in-down {
  animation: fade-in-down var.$duration-normal var.$timing-ease-out;
}

.animate-fade-in-left {
  animation: fade-in-left var.$duration-normal var.$timing-ease-out;
}

.animate-fade-in-right {
  animation: fade-in-right var.$duration-normal var.$timing-ease-out;
}

// 缩放效果
.animate-scale-in {
  animation: scale-in var.$duration-normal var.$timing-ease-out;
}

.animate-scale-out {
  animation: scale-out var.$duration-normal var.$timing-ease-out;
}

// 加载效果
.animate-spin {
  animation: spin 1s linear infinite;
}

.animate-spin-reverse {
  animation: spin-reverse 1s linear infinite;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

// 滑动效果
.animate-slide-in-right {
  animation: slide-in-right var.$duration-normal var.$timing-ease-out;
}

.animate-slide-in-left {
  animation: slide-in-left var.$duration-normal var.$timing-ease-out;
}

// 其他效果
.animate-bounce {
  animation: bounce 1s ease infinite;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

.animate-blink {
  animation: blink 1s step-end infinite;
}

// ============================================
// 动画工具类
// ============================================

// 延迟
@for $i from 1 through 5 {
  .delay-#{$i} {
    animation-delay: #{$i * 100}ms !important;
  }
}

// 持续时间
.duration-fast {
  animation-duration: var.$duration-fast !important;
}

.duration-normal {
  animation-duration: var.$duration-normal !important;
}

.duration-slow {
  animation-duration: var.$duration-slow !important;
}

// 动画填充模式
.animate-fill-both {
  animation-fill-mode: both;
}

.animate-fill-forwards {
  animation-fill-mode: forwards;
}

.animate-fill-backwards {
  animation-fill-mode: backwards;
}

// 动画次数
.animate-once {
  animation-iteration-count: 1;
}

.animate-infinite {
  animation-iteration-count: infinite;
}
```

## 🎨 第二步：核心组件开发

### 2.1 API服务层

**frontend/src/services/api.ts:**

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

**frontend/src/services/types.ts:**

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

**frontend/src/services/volunteerService.ts:**

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

### 2.2 VolunteerCard组件

**frontend/src/components/VolunteerCard/VolunteerCard.tsx:**

```typescript
import React from 'react';
import './VolunteerCard.scss';
import { Volunteer } from '@services/types';

export interface VolunteerCardProps {
  volunteer: Volunteer;
  onClick?: (id: string) => void;
  compact?: boolean;
}

const VolunteerCard: React.FC<VolunteerCardProps> = ({ 
  volunteer, 
  onClick,
  compact = false 
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(volunteer.id);
    }
  };

  if (compact) {
    return (
      <div className="volunteer-card compact" onClick={handleClick}>
        <div className="card-header">
          <img src={volunteer.avatar} alt={volunteer.chineseName} className="avatar" />
          <div className="name-section">
            <h3 className="chinese-name">{volunteer.chineseName}</h3>
            <p className="english-name">{volunteer.englishName}</p>
          </div>
        </div>
        
        <div className="card-body">
          <div className="info-row">
            <span className="label">ID:</span>
            <span className="value">{volunteer.id}</span>
          </div>
          
          <div className="info-row">
            <span className="label">服务方向:</span>
            <div className="services">
              {volunteer.services.map((service, index) => (
                <span key={index} className="service-tag">{service}</span>
              ))}
            </div>
          </div>
          
          <div className="info-row">
            <span className="label">非项目服务:</span>
            <span className="value">
              {volunteer.nonProjectHours}小时 ({volunteer.nonProjectCount}次)
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">状态:</span>
            <span className={`status ${volunteer.status === '在职' ? 'active' : 'inactive'}`}>
              {volunteer.status === '在职' ? '● 在职' : '○ 不在职'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-card full" onClick={handleClick}>
      <div className="card-header">
        <img src={volunteer.avatar} alt={volunteer.chineseName} className="avatar" />
        <div className="name-section">
          <h2 className="chinese-name">{volunteer.chineseName}</h2>
          <h3 className="english-name">{volunteer.englishName}</h3>
          <div className="id-badge">{volunteer.id}</div>
        </div>
      </div>
      
      <div className="card-divider"></div>
      
      <div className="card-body">
        <div className="section">
          <h4 className="section-title">服务方向</h4>
          <div className="services-grid">
            {volunteer.services.map((service, index) => (
              <span key={index} className="service-pill">{service}</span>
            ))}
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">非项目服务统计</h4>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-value">{volunteer.nonProjectHours}</span>
              <span className="stat-label">小时</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{volunteer.nonProjectCount}</span>
              <span className="stat-label">次</span>
            </div>
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">状态</h4>
          <div className={`status-badge ${volunteer.status === '在职' ? 'active' : 'inactive'}`}>
            {volunteer.status === '在职' ? '● 在职' : '○ 不在职'}
          </div>
        </div>
        
        <div className="section">
          <h4 className="section-title">地区</h4>
          <p className="region">{volunteer.region}</p>
        </div>
      </div>
    </div>
  );
};

export default VolunteerCard;
```

**frontend/src/components/VolunteerCard/VolunteerCard.scss:**

```scss
@use "@styles/variables" as var;
@use "@styles/mixins" as mix;

// ============================================
// 基础卡片样式
// ============================================

.volunteer-card {
  // 使用容器组件样式
  @include mix.card(1);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: var.$bg-primary;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all var.$duration-normal var.$timing-ease;
  
  // 交互状态
  &:hover {
    @include mix.card(3);
    transform: translateY(-4px);
    
    // 悬停时显示操作按钮
    .card-actions {
      opacity: 1;
      transform: translateY(0);
    }
    
    // 头像放大效果
    .avatar-container {
      transform: scale(1.05);
    }
    
    // 服务标签悬浮效果
    .service-tag {
      transform: translateY(-2px);
      box-shadow: var.$shadow-md;
    }
  }
  
  &:active {
    transform: translateY(-1px);
  }
  
  &:focus-visible {
    outline: 3px solid var.$color-primary-500;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(var.$color-primary-500, 0.1);
  }
  
  // 禁用状态
  &[disabled],
  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    
    &:hover {
      transform: none;
      box-shadow: var.$shadow-sm;
    }
  }
}

// ============================================
// 紧凑版样式
// ============================================

.volunteer-card--compact {
  padding: var.$spacing-4;
  
  .card-header {
    display: flex;
    align-items: center;
    gap: var.$spacing-3;
    margin-bottom: var.$spacing-4;
    
    .avatar-container {
      position: relative;
      flex-shrink: 0;
      
      .avatar {
        width: 3.5rem;
        height: 3.5rem;
        border-radius: var.$border-radius-xl;
        object-fit: cover;
        border: 3px solid var.$color-white;
        box-shadow: var.$shadow-sm;
        transition: transform var.$duration-normal var.$timing-ease;
      }
      
      .status-indicator {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        border: 2px solid var.$color-white;
        z-index: 1;
        
        &--active {
          background-color: var.$status-indicator-active;
          box-shadow: 0 0 0 2px rgba(var.$status-indicator-active, 0.2);
        }
        
        &--inactive {
          background-color: var.$status-indicator-inactive;
          box-shadow: 0 0 0 2px rgba(var.$status-indicator-inactive, 0.2);
        }
      }
    }
    
    .name-section {
      flex: 1;
      min-width: 0; // 防止文本溢出容器
      
      .chinese-name {
        font-size: var.$font-size-lg;
        font-weight: var.$font-weight-semibold;
        color: var.$color-gray-900;
        margin: 0 0 var.$spacing-1 0;
        @include mix.text-truncate(1);
        
        &::before {
          content: '';
          display: inline-block;
          width: 0.25rem;
          height: 0.25rem;
          border-radius: 50%;
          background: var.$color-primary-500;
          margin-right: var.$spacing-2;
          vertical-align: middle;
        }
      }
      
      .english-name {
        font-size: var.$font-size-sm;
        color: var.$color-gray-600;
        margin: 0;
        @include mix.text-truncate(1);
        font-weight: var.$font-weight-normal;
      }
      
      .id-badge {
        display: inline-block;
        background: var.$color-primary-50;
        color: var.$color-primary-700;
        padding: 0.125rem var.$spacing-2;
        border-radius: var.$border-radius-full;
        font-size: var.$font-size-xs;
        font-weight: var.$font-weight-medium;
        margin-top: var.$spacing-1;
      }
    }
  }
  
  .card-body {
    .info-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: var.$spacing-3;
      font-size: var.$font-size-sm;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .info-label {
        flex: 0 0 6rem;
        color: var.$color-gray-500;
        font-weight: var.$font-weight-medium;
        display: flex;
        align-items: center;
        gap: var.$spacing-1;
        
        &::before {
          content: '';
          display: inline-block;
          width: 0.5rem;
          height: 0.5rem;
          background: currentColor;
          border-radius: 2px;
          opacity: 0.5;
        }
      }
      
      .info-value {
        flex: 1;
        color: var.$color-gray-900;
        text-align: right;
        font-weight: var.$font-weight-medium;
        
        &.highlight {
          color: var.$color-primary-700;
          font-weight: var.$font-weight-semibold;
        }
      }
      
      &.services-row {
        align-items: flex-start;
        
        .services-container {
          display: flex;
          flex-wrap: wrap;
          gap: var.$spacing-1;
          justify-content: flex-end;
          
          .service-tag {
            @include mix.badge(var.$color-primary-500);
            font-size: var.$font-size-xs;
            padding: 0.125rem var.$spacing-2;
            transition: all var.$duration-fast var.$timing-ease;
            position: relative;
            overflow: hidden;
            
            &::after {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(
                90deg,
                transparent,
                rgba(255, 255, 255, 0.2),
                transparent
              );
              transition: left 0.5s ease;
            }
            
            &:hover::after {
              left: 100%;
            }
          }
        }
      }
      
      &.status-row {
        .info-value {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var.$spacing-1;
          
          .status-badge {
            padding: 0.25rem var.$spacing-2;
            border-radius: var.$border-radius-full;
            font-weight: var.$font-weight-semibold;
            font-size: var.$font-size-xs;
            
            &--active {
              background-color: rgba(var.$status-indicator-active, 0.1);
              color: var.$status-indicator-active;
              
              &::before {
                content: '●';
                animation: blink 2s infinite;
              }
            }
            
            &--inactive {
              background-color: rgba(var.$status-indicator-inactive, 0.1);
              color: var.$status-indicator-inactive;
              
              &::before {
                content: '○';
              }
            }
          }
        }
      }
    }
    
    .stats-preview {
      display: flex;
      justify-content: space-between;
      background: var.$color-gray-50;
      border-radius: var.$border-radius;
      padding: var.$spacing-2;
      margin-top: var.$spacing-3;
      
      .stat-item {
        text-align: center;
        flex: 1;
        
        &:not(:last-child) {
          border-right: 1px solid var.$color-gray-200;
        }
        
        .stat-value {
          display: block;
          font-size: var.$font-size-lg;
          font-weight: var.$font-weight-bold;
          color: var.$color-primary-700;
          line-height: 1.2;
        }
        
        .stat-label {
          display: block;
          font-size: var.$font-size-xs;
          color: var.$color-gray-500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      }
    }
  }
}

// ============================================
// 完整版样式
// ============================================

.volunteer-card--full {
  padding: 0;
  
  .card-header {
    background: linear-gradient(
      135deg,
      var.$color-primary-600 0%,
      var.$color-primary-800 100%
    );
    color: var.$color-white;
    padding: var.$spacing-6;
    text-align: center;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.1),
        transparent
      );
    }
    
    .avatar-container {
      position: relative;
      width: 8rem;
      height: 8rem;
      margin: 0 auto var.$spacing-4;
      
      .avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid var.$color-white;
        box-shadow: var.$shadow-lg;
        transition: all var.$duration-normal var.$timing-ease;
        position: relative;
        z-index: 1;
      }
      
      .avatar-frame {
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        animation: spin 20s linear infinite;
        
        &::before,
        &::after {
          content: '';
          position: absolute;
          width: 1rem;
          height: 1rem;
          background: var.$color-white;
          border-radius: 50%;
        }
        
        &::before {
          top: -0.5rem;
          left: calc(50% - 0.5rem);
        }
        
        &::after {
          bottom: -0.5rem;
          left: calc(50% - 0.5rem);
        }
      }
      
      .status-indicator {
        position: absolute;
        bottom: 0.5rem;
        right: 0.5rem;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        border: 3px solid var.$color-white;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        
        &--active {
          background-color: var.$status-indicator-active;
          box-shadow: 0 0 0 4px rgba(var.$status-indicator-active, 0.3);
          color: var.$color-white;
        }
        
        &--inactive {
          background-color: var.$status-indicator-inactive;
          box-shadow: 0 0 0 4px rgba(var.$status-indicator-inactive, 0.3);
          color: var.$color-white;
        }
      }
    }
    
    .name-section {
      .chinese-name {
        font-size: var.$font-size-3xl;
        font-weight: var.$font-weight-bold;
        margin: 0 0 var.$spacing-1 0;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        letter-spacing: -0.025em;
      }
      
      .english-name {
        font-size: var.$font-size-lg;
        opacity: 0.9;
        margin: 0 0 var.$spacing-4 0;
        font-weight: var.$font-weight-normal;
      }
      
      .id-display {
        display: inline-flex;
        align-items: center;
        gap: var.$spacing-2;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: var.$spacing-2 var.$spacing-4;
        border-radius: var.$border-radius-full;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: var.$font-size-sm;
        font-weight: var.$font-weight-medium;
        
        .id-label {
          opacity: 0.8;
        }
        
        .id-value {
          font-family: var.$font-family-mono;
          letter-spacing: 0.05em;
        }
      }
    }
  }
  
  .card-body {
    padding: var.$spacing-6;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var.$spacing-4;
    
    .section {
      &:not(:last-child) {
        padding-bottom: var.$spacing-4;
        border-bottom: 1px solid var.$color-gray-100;
      }
      
      .section-title {
        font-size: var.$font-size-sm;
        font-weight: var.$font-weight-semibold;
        color: var.$color-gray-600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var.$spacing-3;
        display: flex;
        align-items: center;
        gap: var.$spacing-2;
        
        &::before {
          content: '';
          width: 0.25rem;
          height: 1rem;
          background: linear-gradient(
            to bottom,
            var.$color-primary-500,
            var.$color-primary-700
          );
          border-radius: var.$border-radius-full;
        }
      }
      
      &.services-section {
        .services-grid {
          display: flex;
          flex-wrap: wrap;
          gap: var.$spacing-2;
          
          .service-chip {
            display: inline-flex;
            align-items: center;
            gap: var.$spacing-1;
            background: linear-gradient(
              135deg,
              var.$color-primary-500,
              var.$color-primary-600
            );
            color: var.$color-white;
            padding: var.$spacing-2 var.$spacing-3;
            border-radius: var.$border-radius-full;
            font-size: var.$font-size-sm;
            font-weight: var.$font-weight-medium;
            transition: all var.$duration-fast var.$timing-ease;
            position: relative;
            overflow: hidden;
            
            &::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(
                to right,
                transparent,
                rgba(255, 255, 255, 0.1),
                transparent
              );
              transform: translateX(-100%);
            }
            
            &:hover {
              transform: translateY(-2px);
              box-shadow: var.$shadow-md;
              
              &::before {
                animation: shine 1s ease;
              }
            }
            
            .service-icon {
              font-size: 0.875em;
            }
          }
        }
      }
      
      &.stats-section {
        .stats-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var.$spacing-3;
          
          .stat-card {
            background: linear-gradient(
              135deg,
              var.$color-gray-50,
              var.$color-gray-100
            );
            border-radius: var.$border-radius;
            padding: var.$spacing-3;
            text-align: center;
            transition: all var.$duration-fast var.$timing-ease;
            
            &:hover {
              transform: translateY(-2px);
              background: linear-gradient(
                135deg,
                var.$color-primary-50,
                var.$color-primary-100
              );
            }
            
            .stat-value {
              display: block;
              font-size: var.$font-size-2xl;
              font-weight: var.$font-weight-bold;
              color: var.$color-primary-700;
              line-height: 1;
              margin-bottom: var.$spacing-1;
            }
            
            .stat-label {
              display: block;
              font-size: var.$font-size-xs;
              color: var.$color-gray-600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: var.$font-weight-medium;
            }
            
            .stat-trend {
              display: block;
              font-size: var.$font-size-xs;
              margin-top: var.$spacing-1;
              
              &.positive {
                color: var.$color-success;
              }
              
              &.negative {
                color: var.$color-danger;
              }
            }
          }
        }
      }
      
      &.info-section {
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var.$spacing-3;
          
          .info-item {
            .info-label {
              display: block;
              font-size: var.$font-size-xs;
              color: var.$color-gray-500;
              margin-bottom: var.$spacing-1;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .info-value {
              display: block;
              font-size: var.$font-size-sm;
              color: var.$color-gray-900;
              font-weight: var.$font-weight-medium;
              
              &.region-value {
                display: flex;
                align-items: center;
                gap: var.$spacing-1;
                color: var.$color-primary-700;
                
                &::before {
                  content: '📍';
                }
              }
            }
          }
        }
      }
    }
  }
  
  .card-footer {
    padding: var.$spacing-4 var.$spacing-6;
    background: var.$color-gray-50;
    border-top: 1px solid var.$color-gray-100;
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .last-updated {
      font-size: var.$font-size-xs;
      color: var.$color-gray-500;
    }
    
    .action-buttons {
      display: flex;
      gap: var.$spacing-2;
      
      .action-button {
        @include mix.button('secondary');
        font-size: var.$font-size-xs;
        padding: var.$spacing-1 var.$spacing-2;
        
        &:hover {
          @include mix.button('primary');
        }
      }
    }
  }
}

// ============================================
// 操作按钮区域
// ============================================

.card-actions {
  position: absolute;
  top: var.$spacing-2;
  right: var.$spacing-2;
  display: flex;
  gap: var.$spacing-1;
  opacity: 0;
  transform: translateY(-10px);
  transition: all var.$duration-normal var.$timing-ease;
  z-index: 10;
  
  .action-button {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var.$color-white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var.$shadow-sm;
    transition: all var.$duration-fast var.$timing-ease;
    
    &:hover {
      transform: scale(1.1);
      box-shadow: var.$shadow-md;
      
      &.edit-button {
        background: var.$color-primary-50;
        color: var.$color-primary-600;
      }
      
      &.delete-button {
        background: var.$color-danger;
        color: var.$color-white;
      }
      
      &.favorite-button {
        background: var.$color-warning;
        color: var.$color-white;
      }
    }
    
    .action-icon {
      font-size: 0.875rem;
    }
  }
}

// ============================================
// 特殊效果动画
// ============================================

@keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.floating-element {
  animation: float 3s ease-in-out infinite;
}

// ============================================
// 响应式设计
// ============================================

@include mix.respond-to('sm') {
  .volunteer-card--compact {
    padding: var.$spacing-5;
    
    .card-header {
      .avatar {
        width: 4rem;
        height: 4rem;
      }
      
      .name-section {
        .chinese-name {
          font-size: var.$font-size-xl;
        }
      }
    }
    
    .card-body {
      .info-row {
        font-size: var.$font-size-base;
      }
    }
  }
}

@include mix.only-for('sm') {
  .volunteer-card--full {
    .card-header {
      .avatar-container {
        width: 6rem;
        height: 6rem;
      }
      
      .chinese-name {
        font-size: var.$font-size-2xl;
      }
    }
    
    .card-body {
      padding: var.$spacing-4;
      
      .section {
        &.stats-section {
          .stats-cards {
            grid-template-columns: 1fr;
          }
        }
        
        &.info-section {
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      }
    }
  }
}

// ============================================
// 暗黑模式支持
// ============================================

@include mix.high-contrast-mode {
  .volunteer-card {
    border: 2px solid CanvasText;
    
    .card-header {
      background: Canvas;
      color: CanvasText;
    }
  }
}

// ============================================
// 打印样式
// ============================================

@media print {
  .volunteer-card {
    box-shadow: none !important;
    border: 1px solid var.$color-gray-300;
    break-inside: avoid;
    
    &:hover {
      transform: none !important;
    }
    
    .card-actions {
      display: none;
    }
  }
}
```

**frontend/src/components/VolunteerCard/index.ts:**

```typescript
export { default } from './VolunteerCard';
export type { VolunteerCardProps } from './VolunteerCard';
```

### 2.3 VolunteerList组件

**frontend/src/components/VolunteerList/VolunteerList.tsx:**

```typescript
import React, { useState, useEffect } from 'react';
import './VolunteerList.scss';
import VolunteerCard from '@components/VolunteerCard';
import { Volunteer } from '@services/types';
import { volunteerService } from '@services/volunteerService';

export interface VolunteerListProps {
  compact?: boolean;
  onVolunteerClick?: (id: string) => void;
}

const VolunteerList: React.FC<VolunteerListProps> = ({
  compact = false,
  onVolunteerClick
}) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalHours: 0
  });

  useEffect(() => {
    fetchVolunteers();
    fetchStats();
  }, []);

  const fetchVolunteers = async () => {
    try {
      setLoading(true);
      const response = await volunteerService.getAllVolunteers();
      if (response.success && response.data) {
        setVolunteers(response.data);
      }
    } catch (err: any) {
      setError(err.message || '获取志愿者数据失败');
      console.error('Error fetching volunteers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await volunteerService.getStats();
      if (response.success && response.data.summary) {
        const { summary } = response.data;
        setStats({
          total: summary.totalVolunteers,
          active: summary.totalActive,
          totalHours: summary.totalHours
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleVolunteerClick = (id: string) => {
    if (onVolunteerClick) {
      onVolunteerClick(id);
    } else {
      // 默认行为：显示详情
      window.open(`/volunteer/${id}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>正在加载志愿者数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>{error}</p>
        <button onClick={fetchVolunteers} className="retry-button">
          重试
        </button>
      </div>
    );
  }

  if (volunteers.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-icon">📋</div>
        <h3>暂无志愿者数据</h3>
        <p>目前还没有志愿者记录</p>
      </div>
    );
  }

  return (
    <div className="volunteer-list">
      {/* 统计信息 */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">总志愿者</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">在职志愿者</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalHours}</div>
          <div className="stat-label">总服务小时</div>
        </div>
      </div>

      {/* 志愿者网格 */}
      <div className={`volunteers-grid ${compact ? 'compact' : 'full'}`}>
        {volunteers.map((volunteer) => (
          <VolunteerCard
            key={volunteer.id}
            volunteer={volunteer}
            compact={compact}
            onClick={handleVolunteerClick}
          />
        ))}
      </div>

      {/* 分页信息 */}
      <div className="pagination-info">
        <span>显示 {volunteers.length} 位志愿者</span>
        <span>共 {stats.total} 位志愿者</span>
      </div>
    </div>
  );
};

export default VolunteerList;
```

**frontend/src/components/VolunteerList/VolunteerList.scss:**

```scss
@use "@styles/variables" as var;

// ============================================
// 列表容器
// ============================================

.volunteer-list {
  padding: var.$spacing-4;
}

// ============================================
// 统计栏
// ============================================

.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var.$spacing-3;
  margin-bottom: var.$spacing-6;
  
  .stat-card {
    background: white;
    padding: var.$spacing-4;
    border-radius: var.$border-radius;
    box-shadow: var.$shadow;
    text-align: center;
    
    .stat-value {
      font-size: 28px;
      font-weight: var.$font-weight-bold;
      color: var.$color-primary-700;
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 14px;
      color: var.$color-gray-600;
    }
  }
}

// ============================================
// 网格布局
// ============================================

.volunteers-grid {
  &.compact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var.$spacing-4;
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: var.$spacing-3;
    }
  }
  
  &.full {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var.$spacing-6;
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: var.$spacing-4;
    }
  }
}

// ============================================
// 分页信息
// ============================================

.pagination-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var.$spacing-6;
  padding-top: var.$spacing-4;
  border-top: 1px solid var.$color-gray-200;
  color: var.$color-gray-600;
  font-size: 14px;
  
  .pagination-controls {
    display: flex;
    gap: var.$spacing-2;
    
    button {
      padding: 6px 12px;
      border: 1px solid var.$color-gray-300;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      
      &:hover:not(:disabled) {
        background: var.$color-gray-100;
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      &.active {
        background: var.$color-primary-500;
        color: white;
        border-color: var.$color-primary-500;
      }
    }
  }
}

// ============================================
// 加载状态
// ============================================

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var.$color-gray-200;
    border-top: 3px solid var.$color-primary-500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var.$spacing-3;
  }
}

// ============================================
// 错误状态
// ============================================

.error-container {
  text-align: center;
  padding: var.$spacing-8;
  background: rgba(var.$color-danger, 0.05);
  border-radius: var.$border-radius;
  margin: var.$spacing-4;
  
  .error-icon {
    font-size: 32px;
    margin-bottom: var.$spacing-3;
  }
  
  h3 {
    color: var.$color-danger;
    margin-bottom: var.$spacing-2;
  }
  
  p {
    color: var.$color-gray-700;
    margin-bottom: var.$spacing-4;
  }
  
  .retry-button {
    background: var.$color-primary-500;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    
    &:hover {
      background: var.$color-primary-600;
    }
  }
}

// ============================================
// 空状态
// ============================================

.empty-container {
  text-align: center;
  padding: var.$spacing-8;
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: var.$spacing-3;
  }
  
  h3 {
    color: var.$color-gray-700;
    margin-bottom: var.$spacing-2;
  }
  
  p {
    color: var.$color-gray-500;
  }
}

// ============================================
// 筛选工具栏
// ============================================

.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var.$spacing-3;
  margin-bottom: var.$spacing-4;
  padding: var.$spacing-3;
  background: white;
  border-radius: var.$border-radius;
  box-shadow: var.$shadow-sm;
  
  .filter-group {
    display: flex;
    align-items: center;
    gap: var.$spacing-2;
    
    label {
      font-size: 14px;
      color: var.$color-gray-600;
      font-weight: 500;
    }
    
    select,
    input {
      padding: 6px 12px;
      border: 1px solid var.$color-gray-300;
      border-radius: 4px;
      font-size: 14px;
      
      &:focus {
        outline: 2px solid var.$color-primary-500;
        outline-offset: 2px;
      }
    }
  }
  
  .search-box {
    flex: 1;
    min-width: 200px;
    
    input {
      width: 100%;
    }
  }
}

// ============================================
// 视图切换
// ============================================

.view-toggle {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var.$spacing-4;
  
  .view-buttons {
    display: flex;
    border: 1px solid var.$color-gray-300;
    border-radius: 6px;
    overflow: hidden;
    
    button {
      padding: 8px 16px;
      border: none;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      
      &:hover:not(.active) {
        background: var.$color-gray-100;
      }
      
      &.active {
        background: var.$color-primary-500;
        color: white;
      }
      
      &:first-child {
        border-right: 1px solid var.$color-gray-300;
      }
    }
  }
}

// ============================================
// 动画定义
// ============================================

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

// ============================================
// 响应式调整
// ============================================

@media (max-width: 768px) {
  .stats-bar {
    grid-template-columns: 1fr;
  }
  
  .filter-toolbar {
    flex-direction: column;
    
    .search-box {
      min-width: 100%;
    }
  }
  
  .view-toggle {
    justify-content: center;
  }
  
  .pagination-info {
    flex-direction: column;
    gap: var.$spacing-3;
    text-align: center;
  }
}
```

**frontend/src/components/VolunteerList/index.ts:**

```typescript
// 导出文件夹内的VolunteerList组件（默认导出）
import VolunteerList from './VolunteerList.tsx';
export default VolunteerList;

export type { VolunteerListProps } from './VolunteerList';

```

### 2.5 Header组件

**frontend/src/components/Header/Header.tsx:**

```typescript
import React from 'react';
import './Header.scss';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🤝</span>
          <h1 className="title">{title}</h1>
        </div>
        
        {subtitle && (
          <p className="subtitle">{subtitle}</p>
        )}
        
        <nav className="nav">
          <a href="#home" className="nav-link active">首页</a>
          <a href="#volunteers" className="nav-link">志愿者</a>
          <a href="#stats" className="nav-link">统计</a>
          <a href="#about" className="nav-link">关于</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
```

**frontend/src/components/Header/Header.scss:**

```scss
@use "@styles/variables" as var;

.header {
  background: var.$color-primary-700;
  color: white;
  padding: var.$spacing-4 0;
  box-shadow: var.$shadow-md;
  position: sticky;
  top: 0;
  z-index: 100;
  
  .container {
    max-width: var.$container-max-width;
    margin: 0 auto;
    padding: 0 var.$spacing-4;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: var.$spacing-3;
    text-decoration: none;
    
    .logo-icon {
      font-size: 32px;
    }
    
    .title {
      font-size: var.$font-size-xl;
      font-weight: var.$font-weight-bold;
      margin: 0;
      color: white;
    }
    
    .subtitle {
      font-size: var.$font-size-sm;
      opacity: 0.8;
      margin: 0;
    }
  }
  
  .nav {
    display: flex;
    gap: var.$spacing-4;
    
    .nav-link {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      padding: 8px 12px;
      border-radius: 4px;
      transition: all 0.2s ease;
      
      &:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
      }
      
      &.active {
        color: white;
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .header {
    .container {
      flex-direction: column;
      gap: var.$spacing-3;
      text-align: center;
    }
    
    .nav {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
      gap: var.$spacing-2;
      
      .nav-link {
        padding: 6px 10px;
        font-size: var.$font-size-sm;
      }
    }
  }
}
```

**frontend/src/components/Header/index.ts:**

```typescript
import Header from './Header.tsx';
export default Header;
```

### 2.5 Footer组件

**frontend/src/components/Footer/Footer.tsx:**

```typescript
import React from 'react';
import './Footer.scss';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-title">志愿者管理系统</h3>
          <p className="footer-description">
            一个全球志愿者可视化管理系统，展示志愿者分布和支持多维筛选。
          </p>
        </div>
        
        <div className="footer-section">
          <h4 className="footer-subtitle">功能模块</h4>
          <ul className="footer-links">
            <li><a href="#map">地图可视化</a></li>
            <li><a href="#volunteers">志愿者管理</a></li>
            <li><a href="#stats">数据统计</a></li>
            <li><a href="#reports">报告生成</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h4 className="footer-subtitle">技术支持</h4>
          <ul className="footer-links">
            <li><a href="#api">API文档</a></li>
            <li><a href="#github">GitHub仓库</a></li>
            <li><a href="#issues">问题反馈</a></li>
            <li><a href="#contact">联系我们</a></li>
          </ul>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p className="copyright">
          © {currentYear} Volunteer Tracker Demo. All rights reserved.
        </p>
        <p className="version">版本: v1.0.0-demo</p>
      </div>
    </footer>
  );
};

export default Footer;
```

**frontend/src/components/Footer/Footer.scss:**

```scss
@use "@styles/variables" as var;

.footer {
  background: var.$color-gray-900;
  color: white;
  padding: var.$spacing-6 0;
  margin-top: auto;
  
  .footer-content {
    max-width: var.$container-max-width;
    margin: 0 auto;
    padding: 0 var.$spacing-4;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var.$spacing-6;
  }
  
  .footer-section {
    h3 {
      font-size: var.$font-size-lg;
      font-weight: var.$font-weight-bold;
      margin: 0 0 var.$spacing-3 0;
      color: white;
    }
    
    p {
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.6;
      margin: 0 0 var.$spacing-3 0;
    }
    
    .footer-links {
      list-style: none;
      padding: 0;
      margin: 0;
      
      li {
        margin-bottom: 8px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        a {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          transition: color 0.2s ease;
          
          &:hover {
            color: white;
            text-decoration: underline;
          }
        }
      }
    }
  }
  
  .footer-bottom {
    max-width: var.$container-max-width;
    margin: var.$spacing-6 auto 0;
    padding: var.$spacing-4 var.$spacing-4 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .copyright {
      color: rgba(255, 255, 255, 0.5);
      font-size: var.$font-size-sm;
      margin: 0;
    }
    
    .version {
      color: rgba(255, 255, 255, 0.5);
      font-size: var.$font-size-xs;
      margin: 0;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .footer {
    padding: var.$spacing-4 0;
    
    .footer-content {
      grid-template-columns: 1fr;
      gap: var.$spacing-4;
    }
    
    .footer-bottom {
      flex-direction: column;
      gap: var.$spacing-2;
      text-align: center;
    }
  }
}
```

**frontend/src/components/Footer/index.ts:**

```typescript
import Footer from './Footer.tsx';
export default Footer;
```

## 🎯 第三步：环境与交互

### 3.1 主应用组件和入口文件

**frontend/src/App.tsx:**

```typescript
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

**frontend/src/App.scss:**

```scss
@use "@styles/global.scss";
@use "@styles/variables" as var;

// ============================================
// App 容器布局
// ============================================

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var.$bg-secondary;
  
  // 主要内容区域
  .main-content {
    flex: 1;
    padding: var.$spacing-6 0;
    
    .container {
      max-width: var.$container-max-width;
      margin: 0 auto;
      padding: 0 var.$spacing-4;
    }
  }
}

// ============================================
// 视图控制栏
// ============================================

.controls-bar {
  background: white;
  padding: var.$spacing-4;
  margin-bottom: var.$spacing-6;
  border-radius: var.$border-radius;
  box-shadow: var.$shadow-sm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var.$spacing-3;
  
  .view-controls {
    display: flex;
    gap: var.$spacing-2;
    
    .view-btn {
      padding: 8px 16px;
      border: 1px solid var.$color-gray-300;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: var.$font-size-sm;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: var.$color-primary-500;
        color: var.$color-primary-500;
      }
      
      &.active {
        background: var.$color-primary-500;
        color: white;
        border-color: var.$color-primary-500;
      }
    }
  }
  
  .info-text {
    color: var.$color-gray-600;
    font-size: var.$font-size-sm;
    font-weight: 500;
  }
}

// ============================================
// 全局加载遮罩
// ============================================

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  
  .loading-content {
    text-align: center;
    background: white;
    padding: var.$spacing-6;
    border-radius: var.$border-radius-lg;
    box-shadow: var.$shadow-lg;
    
    .loading-text {
      margin-top: var.$spacing-3;
      color: var.$color-gray-700;
      font-weight: 500;
    }
  }
}

// ============================================
// 全局提示消息
// ============================================

.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  max-width: 400px;
}

.toast {
  padding: var.$spacing-3 var.$spacing-4;
  margin-bottom: var.$spacing-2;
  border-radius: var.$border-radius;
  display: flex;
  align-items: center;
  gap: var.$spacing-3;
  animation: slide-in-right 0.3s ease;
  box-shadow: var.$shadow-md;
  
  &--success {
    background: var.$color-success;
    color: white;
  }
  
  &--error {
    background: var.$color-danger;
    color: white;
  }
  
  &--warning {
    background: var.$color-warning;
    color: white;
  }
  
  &--info {
    background: var.$color-primary-500;
    color: white;
  }
  
  .toast-icon {
    font-size: 20px;
  }
  
  .toast-message {
    flex: 1;
    font-size: var.$font-size-sm;
  }
  
  .toast-close {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    opacity: 0.7;
    padding: 4px;
    
    &:hover {
      opacity: 1;
    }
  }
}

// ============================================
// 模态框基础样式
// ============================================

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1002;
  animation: fade-in 0.3s ease;
}

.modal {
  background: white;
  border-radius: var.$border-radius-lg;
  box-shadow: var.$shadow-xl;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: auto;
  animation: scale-in 0.3s ease;
  
  .modal-header {
    padding: var.$spacing-4;
    border-bottom: 1px solid var.$color-gray-200;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .modal-title {
      margin: 0;
      font-size: var.$font-size-lg;
      font-weight: 600;
    }
    
    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var.$color-gray-500;
      
      &:hover {
        color: var.$color-gray-700;
      }
    }
  }
  
  .modal-body {
    padding: var.$spacing-4;
  }
  
  .modal-footer {
    padding: var.$spacing-4;
    border-top: 1px solid var.$color-gray-200;
    display: flex;
    justify-content: flex-end;
    gap: var.$spacing-2;
  }
}

// ============================================
// 响应式调整
// ============================================

@media (max-width: 768px) {
  .app {
    .main-content {
      padding: var.$spacing-4 0;
    }
  }
  
  .controls-bar {
    flex-direction: column;
    align-items: stretch;
    gap: var.$spacing-3;
    
    .view-controls {
      justify-content: center;
    }
    
    .info-text {
      text-align: center;
    }
  }
  
  .toast-container {
    left: 20px;
    right: 20px;
    max-width: none;
  }
  
  .modal {
    width: 95%;
    margin: 20px;
  }
}

// ============================================
// 工具类（可全局使用）
// ============================================

.text-center { text-align: center; }
.text-left { text-align: left; }
.text-right { text-align: right; }

.mt-1 { margin-top: var.$spacing-1; }
.mt-2 { margin-top: var.$spacing-2; }
.mt-3 { margin-top: var.$spacing-3; }
.mt-4 { margin-top: var.$spacing-4; }
.mt-6 { margin-top: var.$spacing-6; }

.mb-1 { margin-bottom: var.$spacing-1; }
.mb-2 { margin-bottom: var.$spacing-2; }
.mb-3 { margin-bottom: var.$spacing-3; }
.mb-4 { margin-bottom: var.$spacing-4; }
.mb-6 { margin-bottom: var.$spacing-6; }

.p-2 { padding: var.$spacing-2; }
.p-3 { padding: var.$spacing-3; }
.p-4 { padding: var.$spacing-4; }
.p-6 { padding: var.$spacing-6; }

.d-none { display: none !important; }
.d-block { display: block !important; }
.d-flex { display: flex !important; }

.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.align-center { align-items: center; }
.flex-column { flex-direction: column; }

// ============================================
// 动画定义
// ============================================

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 暗色模式支持（基础）
// ============================================

@media (prefers-color-scheme: dark) {
  .app {
    background: var.$color-gray-900;
    color: var.$color-gray-100;
  }
  
  .controls-bar {
    background: var.$color-gray-800;
    color: var.$color-gray-100;
  }
  
  .modal {
    background: var.$color-gray-800;
    color: var.$color-gray-100;
  }
  
  .loading-content {
    background: var.$color-gray-800;
    color: var.$color-gray-100;
  }
}

// ============================================
// 打印样式优化
// ============================================

@media print {
  .controls-bar,
  .loading-overlay,
  .toast-container,
  .modal-overlay {
    display: none !important;
  }
  
  .app {
    background: white !important;
    color: black !important;
  }
}
```

**frontend/src/main.tsx:**

```typescript
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

**frontend/src/env.d.ts:**

```typescript
/// <reference types="vite/client" />

// 声明Vite环境变量的类型
interface ImportMetaEnv {
  // 声明你的API基础地址变量（和代码里的VITE_API_BASE_URL对应）
  readonly VITE_API_BASE_URL: string;
  // 可添加其他Vite环境变量（比如VITE_APP_TITLE），格式：readonly 变量名: 类型;
  // readonly VITE_APP_TITLE: string;
}

// 扩展ImportMeta类型，让TS识别env属性
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 3.2 html文件

**frontend/index.html:**

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

### 3.3 环境变量配置

**frontend/.env.development:**

```env
# 开发环境 - 使用相对路径，由Vite代理
VITE_API_BASE_URL=/api
VITE_APP_ENV=development
VITE_APP_NAME=Volunteer Tracker (Dev)
VITE_APP_VERSION=1.0.0
```

## 🚀 第四步：运行与测试

### 4.1 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 4.2 测试流程

1. **启动后端服务**（如果还没启动）：

   ```bash
   cd backend
   npm run dev
   ```

2. **访问前端应用**：
   - 打开浏览器访问：`http://localhost:3000`
   - 应该能看到志愿者卡片列表

3. **功能测试**：
   - ✅ 卡片显示志愿者信息
   - ✅ 点击卡片有响应
   - ✅ 切换紧凑/完整视图
   - ✅ 响应式布局
   - ✅ 加载状态和错误处理

## 📝 第三阶段完成检查清单

- [ ] 前端项目初始化完成
- [ ] TypeScript和Vite配置完成
- [ ] API服务层实现
- [ ] VolunteerCard组件实现
- [ ] VolunteerList组件实现
- [ ] 响应式样式设计
- [ ] 加载和错误状态处理
- [ ] 前后端联调成功
- [ ] 卡片点击交互实现
