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
          additionalData: `
            @use "sass:color";
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
// 颜色系统
// ============================================

// 主色系
$primary-color: #2c3e50;
$primary-light: color.adjust($primary-color, $lightness: 10%);
$primary-dark: color.adjust($primary-color, $lightness: -10%);

$secondary-color: #3498db;
$secondary-light: color.adjust($secondary-color, $lightness: 10%);
$secondary-dark: color.adjust($secondary-color, $lightness: -10%);

// 状态色
$success-color: #27ae60;
$success-light: color.adjust($success-color, $lightness: 10%);
$success-dark: color.adjust($success-color, $lightness: -10%);

$warning-color: #f39c12;
$warning-light: color.adjust($warning-color, $lightness: 10%);
$warning-dark: color.adjust($warning-color, $lightness: -10%);

$danger-color: #e74c3c;
$danger-light: color.adjust($danger-color, $lightness: 10%);
$danger-dark: color.adjust($danger-color, $lightness: -10%);
$info-color: #3498db;
$info-light: color.adjust($info-color, $lightness: 10%);
$info-dark: color.adjust($info-color, $lightness: -10%);

// 中性色
$light-color: #ecf0f1;
$light-gray: #bdc3c7;
$gray: #95a5a6;
$dark-gray: #7f8c8d;
$dark-color: #2c3e50;
$black: #000000;
$white: #ffffff;

// 背景色
$bg-primary: #ffffff;
$bg-secondary: #f8f9fa;
$bg-tertiary: #e9ecef;

// ============================================
// 间距系统
// ============================================

// 基础间距单位
$spacing-unit: 4px;

// 间距尺度
$spacing-xs: $spacing-unit;      // 4px
$spacing-sm: $spacing-unit * 2;  // 8px
$spacing-md: $spacing-unit * 4;  // 16px
$spacing-lg: $spacing-unit * 6;  // 24px
$spacing-xl: $spacing-unit * 8;  // 32px
$spacing-xxl: $spacing-unit * 12; // 48px

// ============================================
// 字体系统
// ============================================

// 字体族
$font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
$font-family-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;

// 字体大小
$font-size-xs: 12px;
$font-size-sm: 14px;
$font-size-base: 16px;
$font-size-lg: 18px;
$font-size-xl: 20px;
$font-size-xxl: 24px;
$font-size-xxxl: 32px;

// 字体粗细
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// 行高
$line-height-tight: 1.2;
$line-height-normal: 1.5;
$line-height-loose: 1.8;

// ============================================
// 边框和圆角
// ============================================

// 边框宽度
$border-width: 1px;
$border-width-thick: 2px;

// 边框颜色
$border-color: #dee2e6;
$border-color-light: color.adjust($border-color, $lightness: 5%);
$border-color-dark: color.adjust($border-color, $lightness: -10%);

// 圆角
$border-radius-sm: 4px;
$border-radius: 8px;
$border-radius-lg: 12px;
$border-radius-xl: 16px;
$border-radius-round: 50%;

// ============================================
// 阴影系统
// ============================================

$shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
$shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
$shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.2);
$shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.25);

// 卡片阴影（单独定义以便复用）
$card-shadow: $shadow;
$card-shadow-hover: $shadow-lg;

// ============================================
// 响应式断点
// ============================================

$breakpoint-mobile: 480px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-wide: 1280px;
$breakpoint-extra-wide: 1440px;

// ============================================
// 过渡和动画
// ============================================

$transition-fast: 150ms ease;
$transition-normal: 250ms ease;
$transition-slow: 350ms ease;

// ============================================
// Z-index 层级
// ============================================

$z-index-dropdown: 1000;
$z-index-sticky: 1020;
$z-index-fixed: 1030;
$z-index-modal-backdrop: 1040;
$z-index-modal: 1050;
$z-index-popover: 1060;
$z-index-tooltip: 1070;

// ============================================
// 志愿者卡片特定变量
// ============================================

// 卡片设计
$card-bg: $bg-primary;
$card-border-radius: $border-radius-lg;
$card-padding: $spacing-lg;
$card-min-height: 200px;

// 头像尺寸
$avatar-size-sm: 50px;
$avatar-size-md: 80px;
$avatar-size-lg: 120px;

// 服务标签
$service-tag-bg: $secondary-light;
$service-tag-color: $white;
$service-tag-radius: $border-radius-sm;
$service-tag-padding: 4px 8px;

// 状态指示器
$status-indicator-size: 8px;
$status-active-color: $success-color;
$status-inactive-color: $danger-color;

// ============================================
// 布局变量
// ============================================

// 容器最大宽度
$container-max-width: 1200px;
$container-padding: $spacing-md;

// 导航栏
$navbar-height: 64px;
$sidebar-width: 250px;

// 页脚
$footer-height: 200px;
```

**frontend/src/styles/global.scss:**

```scss
// ============================================
// 基础导入
// ============================================
@import 'variables';
@import 'mixins';
@import 'animations';

// ============================================
// 重置和基础样式
// ============================================
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: $font-family-base;
  font-size: $font-size-base;
  line-height: $line-height-normal;
  color: $dark-color;
  background-color: $bg-secondary;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
}

// ============================================
// 基础排版
// ============================================
h1, h2, h3, h4, h5, h6 {
  font-weight: $font-weight-semibold;
  line-height: $line-height-tight;
  margin-bottom: $spacing-md;
}

h1 {
  font-size: $font-size-xxxl;
  @include mobile-only {
    font-size: $font-size-xxl;
  }
}

h2 {
  font-size: $font-size-xxl;
  @include mobile-only {
    font-size: $font-size-xl;
  }
}

h3 {
  font-size: $font-size-xl;
  @include mobile-only {
    font-size: $font-size-lg;
  }
}

h4 {
  font-size: $font-size-lg;
}

p {
  margin-bottom: $spacing-md;
  
  &:last-child {
    margin-bottom: 0;
  }
}

a {
  color: $secondary-color;
  text-decoration: none;
  transition: color $transition-fast;
  
  &:hover {
    color: $secondary-dark;
    text-decoration: underline;
  }
}

// ============================================
// 表单基础
// ============================================
input,
button,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
}

button {
  cursor: pointer;
  border: none;
  background: none;
}

// ============================================
// 图片
// ============================================
img {
  max-width: 100%;
  height: auto;
  display: block;
}

// ============================================
// 列表
// ============================================
ul, ol {
  list-style-position: inside;
  margin-bottom: $spacing-md;
}

// ============================================
// 代码
// ============================================
code {
  font-family: $font-family-mono;
  background-color: $light-color;
  padding: 2px 6px;
  border-radius: $border-radius-sm;
}

pre {
  background-color: $dark-color;
  color: $light-color;
  padding: $spacing-md;
  border-radius: $border-radius;
  overflow-x: auto;
  @include custom-scrollbar(6px, $dark-color, $gray);
}

// ============================================
// 容器和布局
// ============================================
.container {
  width: 100%;
  max-width: $container-max-width;
  margin: 0 auto;
  padding: 0 $container-padding;
  
  &-fluid {
    width: 100%;
    padding: 0 $container-padding;
  }
}

// ============================================
// 实用工具类
// ============================================

// 文本对齐
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }

// 文本颜色
.text-primary { color: $primary-color; }
.text-secondary { color: $secondary-color; }
.text-success { color: $success-color; }
.text-warning { color: $warning-color; }
.text-danger { color: $danger-color; }
.text-muted { color: $gray; }

// 背景颜色
.bg-primary { background-color: $primary-color; }
.bg-secondary { background-color: $secondary-color; }
.bg-success { background-color: $success-color; }
.bg-warning { background-color: $warning-color; }
.bg-danger { background-color: $danger-color; }
.bg-light { background-color: $light-color; }
.bg-dark { background-color: $dark-color; }

// 边距工具类
@for $i from 0 through 5 {
  $spacing: $spacing-unit * $i;
  
  .m-#{$i} { margin: $spacing; }
  .mx-#{$i} { margin-left: $spacing; margin-right: $spacing; }
  .my-#{$i} { margin-top: $spacing; margin-bottom: $spacing; }
  .mt-#{$i} { margin-top: $spacing; }
  .mr-#{$i} { margin-right: $spacing; }
  .mb-#{$i} { margin-bottom: $spacing; }
  .ml-#{$i} { margin-left: $spacing; }
  
  .p-#{$i} { padding: $spacing; }
  .px-#{$i} { padding-left: $spacing; padding-right: $spacing; }
  .py-#{$i} { padding-top: $spacing; padding-bottom: $spacing; }
  .pt-#{$i} { padding-top: $spacing; }
  .pr-#{$i} { padding-right: $spacing; }
  .pb-#{$i} { padding-bottom: $spacing; }
  .pl-#{$i} { padding-left: $spacing; }
}

// 显示工具类
.d-none { display: none; }
.d-block { display: block; }
.d-inline { display: inline; }
.d-inline-block { display: inline-block; }
.d-flex { display: flex; }
.d-grid { display: grid; }

// 弹性布局工具类
.flex-wrap { flex-wrap: wrap; }
.flex-nowrap { flex-wrap: nowrap; }
.flex-column { flex-direction: column; }
.justify-start { justify-content: flex-start; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }
.align-start { align-items: flex-start; }
.align-center { align-items: center; }
.align-end { align-items: flex-end; }
.align-stretch { align-items: stretch; }

// 网格布局工具类
.grid {
  display: grid;
  gap: $spacing-md;
  
  &-cols-1 { grid-template-columns: repeat(1, 1fr); }
  &-cols-2 { grid-template-columns: repeat(2, 1fr); }
  &-cols-3 { grid-template-columns: repeat(3, 1fr); }
  &-cols-4 { grid-template-columns: repeat(4, 1fr); }
}

// 状态类
.status-active {
  color: $status-active-color;
  font-weight: $font-weight-semibold;
}

.status-inactive {
  color: $status-inactive-color;
  font-weight: $font-weight-semibold;
}

// ============================================
// 响应式工具类
// ============================================

// 移动端隐藏
@include mobile-only {
  .hide-mobile {
    display: none !important;
  }
}

// 平板端隐藏
@include tablet-only {
  .hide-tablet {
    display: none !important;
  }
}

// 桌面端隐藏
@include desktop-up {
  .hide-desktop {
    display: none !important;
  }
}

// ============================================
// 全局滚动条
// ============================================
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: $bg-secondary;
}

::-webkit-scrollbar-thumb {
  background: $light-gray;
  border-radius: 5px;
  
  &:hover {
    background: $gray;
  }
}

// ============================================
// 选择器样式
// ============================================
::selection {
  background-color: rgba($secondary-color, 0.3);
  color: $dark-color;
}
```

**frontend/src/styles/mixins.scss:**

```scss
// ============================================
// 响应式 Mixins
// ============================================

// 移动端优先的响应式设计
@mixin mobile-only {
  @media (max-width: #{$breakpoint-mobile - 1}) {
    @content;
  }
}

@mixin tablet-up {
  @media (min-width: #{$breakpoint-mobile}) {
    @content;
  }
}

@mixin tablet-only {
  @media (min-width: #{$breakpoint-mobile}) and (max-width: #{$breakpoint-tablet - 1}) {
    @content;
  }
}

@mixin desktop-up {
  @media (min-width: #{$breakpoint-tablet}) {
    @content;
  }
}

@mixin desktop-only {
  @media (min-width: #{$breakpoint-tablet}) and (max-width: #{$breakpoint-desktop - 1}) {
    @content;
  }
}

@mixin wide-desktop-up {
  @media (min-width: #{$breakpoint-desktop}) {
    @content;
  }
}

// ============================================
// 布局 Mixins
// ============================================

// 弹性布局快捷方式
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

@mixin flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@mixin flex-column {
  display: flex;
  flex-direction: column;
}

@mixin flex-column-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

// 网格布局快捷方式
@mixin grid-center {
  display: grid;
  place-items: center;
}

@mixin grid-columns($columns, $gap: $spacing-md) {
  display: grid;
  grid-template-columns: repeat($columns, 1fr);
  gap: $gap;
}

// ============================================
// 视觉效果 Mixins
// ============================================

// 卡片效果
@mixin card-effect($elevation: 1) {
  background: $card-bg;
  border-radius: $card-border-radius;
  
  @if $elevation == 1 {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  } @else if $elevation == 2 {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  } @else if $elevation == 3 {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
  
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    @if $elevation == 1 {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    } @else if $elevation == 2 {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    } @else if $elevation == 3 {
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    }
    transform: translateY(-2px);
  }
}

// 按钮样式
@mixin button-style($bg-color: $secondary-color, $text-color: white) {
  background-color: $bg-color;
  color: $text-color;
  border: none;
  padding: $spacing-sm $spacing-lg;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  
  &:hover:not(:disabled) {
    background-color: color.adjust($bg-color, $lightness: -10%);
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

// 标签样式
@mixin tag-style($bg-color: $light-color, $text-color: $dark-color) {
  display: inline-block;
  background: $bg-color;
  color: $text-color;
  padding: 4px $spacing-sm;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

// ============================================
// 工具类 Mixins
// ============================================

// 文本截断
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

// 隐藏滚动条但保持滚动功能
@mixin hide-scrollbar {
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
}

// 自定义滚动条
@mixin custom-scrollbar($width: 6px, $track-color: #f1f1f1, $thumb-color: #c1c1c1) {
  &::-webkit-scrollbar {
    width: $width;
  }
  
  &::-webkit-scrollbar-track {
    background: $track-color;
    border-radius: $width;
  }
  
  &::-webkit-scrollbar-thumb {
    background: $thumb-color;
    border-radius: $width;
    
    &:hover {
      background: color.adjust($thumb-color, $lightness: 10%);
    }
  }
}

// ============================================
// 动画 Mixins
// ============================================

// 淡入动画
@mixin fade-in($duration: 0.3s) {
  animation: fadeIn $duration ease-in-out;
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}

// 滑入动画
@mixin slide-in($direction: 'up', $distance: 20px, $duration: 0.3s) {
  animation: slideIn $duration ease-out;
  
  @if $direction == 'up' {
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY($distance);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  } @else if $direction == 'down' {
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-$distance);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  } @else if $direction == 'left' {
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX($distance);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  } @else if $direction == 'right' {
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-$distance);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  }
}

// ============================================
// 表单元素 Mixins
// ============================================

// 输入框样式
@mixin input-style {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: $secondary-color;
    box-shadow: 0 0 0 2px rgba($secondary-color, 0.2);
  }
  
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
}

// 复选框/单选框样式
@mixin checkbox-style($size: 18px) {
  width: $size;
  height: $size;
  border: 2px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:checked {
    background-color: $secondary-color;
    border-color: $secondary-color;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba($secondary-color, 0.2);
  }
}

// ============================================
// 辅助类 Mixins
// ============================================

// 清除浮动
@mixin clearfix {
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

// 屏幕阅读器专用文本
@mixin sr-only {
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

// 高宽比容器
@mixin aspect-ratio($width, $height) {
  position: relative;
  
  &::before {
    display: block;
    content: '';
    width: 100%;
    padding-top: ($height / $width) * 100%;
  }
  
  > * {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
```

**frontend/src/styles/animations.scss:**

```scss
// ============================================
// 基础动画
// ============================================

// 淡入淡出
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 卡片动画
// ============================================

// 卡片出现动画
@keyframes cardAppear {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 卡片悬浮动画
@keyframes cardHover {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-4px);
  }
}

// ============================================
// 加载动画
// ============================================

// 旋转加载
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

// 脉动效果
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 骨架屏加载
@keyframes skeleton-loading {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

// ============================================
// 按钮动画
// ============================================

// 按钮点击效果
@keyframes buttonClick {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
}

// 波纹效果
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

// ============================================
// 页面过渡动画
// ============================================

// 页面进入
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// 页面退出
@keyframes pageExit {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(20px);
  }
}

// ============================================
// 工具类动画
// ============================================

// 闪烁提示
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

// 震动效果
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

// 弹跳效果
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
}

// ============================================
// 预定义的动画类
// ============================================

// 淡入效果
.fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

.fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}

.fade-in-down {
  animation: fadeInDown 0.5s ease-out;
}

// 卡片出现
.card-appear {
  animation: cardAppear 0.3s ease-out;
}

// 加载效果
.spin {
  animation: spin 1s linear infinite;
}

.pulse {
  animation: pulse 2s ease-in-out infinite;
}

// 骨架屏
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
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
@import "@styles/variables.scss";
@import "@styles/mixins.scss";

.volunteer-card {
  @include card-effect(1);
  transition: all $transition-normal;
  overflow: hidden;
  cursor: pointer;
  background: $card-bg;
  
  &:hover {
    @include card-effect(2);
    transform: translateY(-4px);
  }
  
  &:focus-visible {
    outline: 2px solid $secondary-color;
    outline-offset: 2px;
  }

  // 紧凑版样式
  &.compact {
    padding: $spacing-lg;
    
    .card-header {
      @include flex-between;
      margin-bottom: $spacing-md;
      
      .avatar {
        width: $avatar-size-sm;
        height: $avatar-size-sm;
        border-radius: $border-radius-round;
        object-fit: cover;
      }
      
      .name-section {
        flex: 1;
        margin-left: $spacing-md;
        
        .chinese-name {
          font-size: $font-size-lg;
          font-weight: $font-weight-semibold;
          margin-bottom: $spacing-xs;
          color: $dark-color;
        }
        
        .english-name {
          font-size: $font-size-sm;
          color: $gray;
        }
      }
    }
    
    .card-body {
      .info-row {
        @include flex-between;
        margin-bottom: $spacing-sm;
        align-items: flex-start;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .label {
          font-weight: $font-weight-medium;
          color: $gray;
          min-width: 80px;
          flex-shrink: 0;
        }
        
        .value {
          flex: 1;
          color: $dark-color;
          text-align: right;
        }
        
        .services {
          display: flex;
          flex-wrap: wrap;
          gap: $spacing-xs;
          justify-content: flex-end;
          
          .service-tag {
            @include tag-style($secondary-light, $white);
            font-size: $font-size-xs;
          }
        }
        
        .status {
          font-weight: $font-weight-semibold;
          
          &.active {
            color: $success-color;
          }
          
          &.inactive {
            color: $danger-color;
          }
        }
      }
    }
  }

  // 完整版样式
  &.full {
    .card-header {
      padding: $spacing-xl;
      @include flex-center;
      flex-direction: column;
      text-align: center;
      background: linear-gradient(135deg, $secondary-light 0%, $secondary-color 100%);
      color: $white;
      
      .avatar {
        width: $avatar-size-lg;
        height: $avatar-size-lg;
        border-radius: $border-radius-round;
        object-fit: cover;
        border: 4px solid $white;
        box-shadow: $shadow;
        margin-bottom: $spacing-md;
      }
      
      .name-section {
        .chinese-name {
          font-size: $font-size-xxl;
          font-weight: $font-weight-bold;
          margin-bottom: $spacing-xs;
        }
        
        .english-name {
          font-size: $font-size-lg;
          opacity: 0.9;
          margin-bottom: $spacing-md;
        }
        
        .id-badge {
          display: inline-block;
          background: rgba($white, 0.2);
          backdrop-filter: blur(10px);
          color: $white;
          padding: $spacing-xs $spacing-lg;
          border-radius: $border-radius-round;
          font-size: $font-size-sm;
          font-weight: $font-weight-medium;
          border: 1px solid rgba($white, 0.3);
        }
      }
    }
    
    .card-divider {
      height: 1px;
      background: rgba($dark-color, 0.1);
      margin: 0 $spacing-xl;
    }
    
    .card-body {
      padding: $spacing-xl;
      
      .section {
        margin-bottom: $spacing-xl;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .section-title {
          font-size: $font-size-sm;
          font-weight: $font-weight-semibold;
          color: $gray;
          margin-bottom: $spacing-md;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: $spacing-sm;
          
          &::before {
            content: '';
            width: 4px;
            height: 16px;
            background: $secondary-color;
            border-radius: $border-radius-sm;
          }
        }
        
        .services-grid {
          display: flex;
          flex-wrap: wrap;
          gap: $spacing-sm;
          
          .service-pill {
            background: $secondary-color;
            color: $white;
            padding: $spacing-xs $spacing-md;
            border-radius: $border-radius-round;
            font-size: $font-size-sm;
            font-weight: $font-weight-medium;
            transition: all $transition-fast;
            
            &:hover {
              background: $secondary-dark;
              transform: translateY(-1px);
            }
          }
        }
        
        .stats {
          display: flex;
          gap: $spacing-xl;
          
          .stat-item {
            text-align: center;
            flex: 1;
            
            .stat-value {
              display: block;
              font-size: $font-size-xxxl;
              font-weight: $font-weight-bold;
              color: $primary-color;
              line-height: 1;
            }
            
            .stat-label {
              display: block;
              font-size: $font-size-xs;
              color: $gray;
              margin-top: $spacing-xs;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
          }
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: $spacing-xs;
          padding: $spacing-sm $spacing-lg;
          border-radius: $border-radius-round;
          font-weight: $font-weight-semibold;
          
          &::before {
            content: '';
            width: $status-indicator-size;
            height: $status-indicator-size;
            border-radius: $border-radius-round;
          }
          
          &.active {
            background: rgba($success-color, 0.1);
            color: $success-dark;
            
            &::before {
              background: $success-color;
            }
          }
          
          &.inactive {
            background: rgba($danger-color, 0.1);
            color: $danger-dark;
            
            &::before {
              background: $danger-color;
            }
          }
        }
        
        .region {
          font-size: $font-size-lg;
          color: $dark-color;
          font-weight: $font-weight-medium;
          @include flex-center;
          gap: $spacing-sm;
          
          &::before {
            content: '📍';
          }
        }
      }
    }
  }
}

// 响应式设计
@include mobile-only {
  .volunteer-card {
    &.full {
      .card-header {
        padding: $spacing-lg;
        
        .avatar {
          width: $avatar-size-md;
          height: $avatar-size-md;
        }
        
        .chinese-name {
          font-size: $font-size-xl;
        }
      }
      
      .card-body {
        padding: $spacing-lg;
        
        .stats {
          flex-direction: column;
          gap: $spacing-lg;
        }
      }
    }
  }
}

// 打印样式
@media print {
  .volunteer-card {
    box-shadow: none !important;
    border: 1px solid $border-color;
    
    &:hover {
      transform: none !important;
    }
  }
}
```

**frontend/src/components/VolunteerCard/index.ts:**

```typescript
export { default } from './VolunteerCard';
export type { VolunteerCardProps } from './VolunteerCard';
```

### 2.3 志愿者列表组件

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
@import '@styles/variables.scss';

.volunteer-list {
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: $spacing-md;
    margin-bottom: $spacing-xl;
    
    .stat-card {
      background: white;
      padding: $spacing-lg;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      text-align: center;
      transition: transform 0.3s ease;
      
      &:hover {
        transform: translateY(-2px);
      }
      
      .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: $primary-color;
        margin-bottom: $spacing-xs;
      }
      
      .stat-label {
        font-size: 14px;
        color: #666;
      }
    }
  }
  
  .volunteers-grid {
    &.compact {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: $spacing-lg;
      
      @media (max-width: $breakpoint-tablet) {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: $spacing-md;
      }
      
      @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
      }
    }
    
    &.full {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: $spacing-xl;
      
      @media (max-width: $breakpoint-tablet) {
        grid-template-columns: 1fr;
        gap: $spacing-lg;
      }
    }
  }
  
  .pagination-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: $spacing-xl;
    padding-top: $spacing-lg;
    border-top: 1px solid #eee;
    color: #666;
    font-size: 14px;
  }
}

// 加载状态
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 3px solid $light-color;
    border-top: 3px solid $secondary-color;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: $spacing-lg;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
}

// 错误状态
.error-container {
  text-align: center;
  padding: $spacing-xl;
  
  .error-icon {
    font-size: 48px;
    margin-bottom: $spacing-md;
  }
  
  h3 {
    color: $danger-color;
    margin-bottom: $spacing-sm;
  }
  
  p {
    color: #666;
    margin-bottom: $spacing-lg;
  }
  
  .retry-button {
    background: $secondary-color;
    color: white;
    border: none;
    padding: $spacing-sm $spacing-lg;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.3s ease;
    
    &:hover {
      background: color.adjust($secondary-color, $lightness: -10%);
    }
  }
}

// 空状态
.empty-container {
  text-align: center;
  padding: $spacing-xl;
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: $spacing-md;
  }
  
  h3 {
    color: #666;
    margin-bottom: $spacing-sm;
  }
  
  p {
    color: #999;
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

### 2.4 主应用组件和入口文件

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
// ============================================
// App组件专用样式
// ============================================
@import "@styles/global.scss";

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg-secondary;
  
  // 主要内容区域
  .main-content {
    flex: 1;
    padding: $spacing-xl 0;
    
    .container {
      @extend .container;
    }
  }
  
  // 控制栏
  .controls-bar {
    background: $bg-primary;
    padding: $spacing-lg;
    margin-bottom: $spacing-xl;
    border-radius: $border-radius-lg;
    @include card-effect(1);
    @include flex-between;
    
    .view-controls {
      display: flex;
      gap: $spacing-sm;
      
      .view-btn {
        @include button-style($light-color, $dark-color);
        border: 2px solid transparent;
        
        &.active {
          @include button-style($secondary-color, $white);
        }
        
        &:hover:not(.active) {
          border-color: $secondary-color;
          color: $secondary-color;
          background: transparent;
        }
      }
    }
    
    .info-text {
      color: $gray;
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
    }
  }
  
  // 响应式调整
  @include mobile-only {
    .main-content {
      padding: $spacing-lg 0;
    }
    
    .controls-bar {
      flex-direction: column;
      gap: $spacing-md;
      text-align: center;
      
      .view-controls {
        justify-content: center;
      }
    }
  }
}

// ============================================
// 全局加载状态
// ============================================
.loading-overlay {
  @include flex-center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba($white, 0.9);
  z-index: $z-index-modal;
  backdrop-filter: blur(4px);
  
  .loading-content {
    text-align: center;
    
    .spinner {
      width: 60px;
      height: 60px;
      border: 3px solid $light-color;
      border-top: 3px solid $secondary-color;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: $spacing-lg;
    }
    
    .loading-text {
      color: $dark-color;
      font-size: $font-size-lg;
      font-weight: $font-weight-medium;
    }
  }
}

// ============================================
// 全局错误提示
// ============================================
.error-toast {
  position: fixed;
  top: $spacing-lg;
  right: $spacing-lg;
  background: $danger-color;
  color: $white;
  padding: $spacing-md $spacing-lg;
  border-radius: $border-radius;
  box-shadow: $shadow-lg;
  z-index: $z-index-tooltip;
  @include flex-between;
  gap: $spacing-md;
  max-width: 400px;
  animation: slideIn 0.3s ease-out;
  
  .error-message {
    flex: 1;
  }
  
  .close-btn {
    background: none;
    color: $white;
    border: none;
    cursor: pointer;
    font-size: $font-size-lg;
    opacity: 0.8;
    
    &:hover {
      opacity: 1;
    }
  }
  
  @include mobile-only {
    left: $spacing-md;
    right: $spacing-md;
    max-width: none;
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

### 2.5 头部组件

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
@import "@styles/variables.scss";
@import "@styles/mixins.scss";

.header {
  background: $primary-color;
  color: $white;
  box-shadow: $shadow;
  position: sticky;
  top: 0;
  z-index: $z-index-sticky;
  
  .header-content {
    @extend .container !optional;
    @include flex-between;
    padding: $spacing-lg 0;
    
    .logo {
      @include flex-center;
      gap: $spacing-md;
      
      .logo-icon {
        font-size: $font-size-xxl;
      }
      
      .title {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        margin: 0;
        color: $white;
      }
    }
    
    .subtitle {
      color: rgba($white, 0.8);
      font-size: $font-size-sm;
      margin: 0;
    }
    
    .nav {
      display: flex;
      gap: $spacing-xl;
      
      .nav-link {
        color: rgba($white, 0.8);
        text-decoration: none;
        font-weight: $font-weight-medium;
        padding: $spacing-xs $spacing-sm;
        border-radius: $border-radius-sm;
        transition: all $transition-fast;
        
        &:hover, &.active {
          color: $white;
          background: rgba($white, 0.1);
        }
      }
    }
  }
  
  // 移动端适配
  @include mobile-only {
    .header-content {
      flex-direction: column;
      gap: $spacing-md;
      text-align: center;
      
      .nav {
        width: 100%;
        justify-content: center;
        gap: $spacing-md;
        
        .nav-link {
          font-size: $font-size-sm;
          padding: $spacing-xs;
        }
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

### 2.6 底部组件

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

```

**frontend/src/components/Footer/index.ts:**

```typescript
import Footer from './Footer.tsx';
export default Footer;
```

## 🎯 第三步：环境与交互

### 3.1 html文件

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

### 3.2 环境变量配置

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
