# 🎨 前端项目分析报告

## 📈 项目概览

- **总文件数**: 35
- **技术栈**: React
- **构建工具**: vite
- **样式方案**: sass
- **项目特性**: HTTP客户端, 代码质量
- **文件类型分布**:
  - 其他: 2 (5.7%)
  - 配置文件: 5 (14.3%)
  - 脚本: 1 (2.9%)
  - 样式: 5 (14.3%)
  - 组件: 18 (51.4%)
  - 源代码: 4 (11.4%)

## 🗂️ 项目结构树

```
frontend/
📄 .eslintrc.cjs
🌐 index.html
📋 package-lock.json
📋 package.json
📁 public/
📁 scripts/
└── 📜 analyze-project.js
📁 src/
├── 🎨💎 App.scss
├── ⚛️📘 App.tsx
├── 📁 components/
│   ├── 📁 Footer/
│   │   ├── 🎨💎 Footer.scss
│   │   ├── ⚛️📘 Footer.tsx
│   │   └── 📘 index.ts
│   ├── 📁 Header/
│   │   ├── 🎨💎 Header.scss
│   │   ├── ⚛️📘 Header.tsx
│   │   └── 📘 index.ts
│   ├── 📘 index.ts
│   ├── 📁 LoadingSpinner/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 LoadingSpinner.scss
│   │   └── ⚛️📘 LoadingSpinner.tsx
│   ├── 📁 VolunteerCard/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerCard.scss
│   │   └── ⚛️📘 VolunteerCard.tsx
│   └── 📁 VolunteerList/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerList.scss
│   │   └── ⚛️📘 VolunteerList.tsx
├── 📘 env.d.ts
├── ⚛️📘 main.tsx
├── 📁 services/
│   ├── 📘 api.ts
│   ├── 📘 types.ts
│   └── 📘 volunteerService.ts
├── 📁 styles/
│   ├── 🎨💎 animations.scss
│   ├── 🎨💎 global.scss
│   ├── 🎨💎 mixins.scss
│   └── 🎨💎 variables.scss
└── 📁 utils/
📋 tsconfig.json
📋 tsconfig.node.json
📘 vite.config.ts
```

## 📦 依赖分析

### 基本信息
- **项目名称**: volunteer-tracker-frontend
- **版本**: 0.1.0
- **描述**: 无
- **入口文件**: 未指定

### 🚀 可用命令

```bash
npm run dev             # vite
npm run build           # vite build
npm run preview         # vite preview
npm run analyze         # node scripts/analyze-project.js
npm run analyze:quick   # node scripts/analyze-project.js --quick
npm run lint            # eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
npm run format          # prettier --write "src/**/*.{js,jsx,css,scss}"
```

### 🔧 生产依赖 (3个)

- axios: ^1.13.2
- react: ^18.2.0
- react-dom: ^18.2.0

### 🛠️  开发依赖 (15个)

- @types/node: ^25.0.3
- @types/react: ^18.3.27
- @types/react-dom: ^18.3.7
- @typescript-eslint/eslint-plugin: ^6.0.0
- @typescript-eslint/parser: ^6.0.0
- @vitejs/plugin-react: ^4.7.0
- autoprefixer: ^10.4.0
- eslint: ^8.57.1
- eslint-plugin-react-hooks: ^4.6.0
- eslint-plugin-react-refresh: ^0.4.0
... 还有 5 个依赖

## ⚙️ 配置文件分析

### Vite构建配置(TypeScript) (vite.config.ts)
📎 位置: vite.config.ts

内容过长，已省略

### TypeScript配置 (tsconfig.json)
📎 位置: tsconfig.json

```javascript
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


## 📋 文件详情

### 📁 scripts

#### 📜 analyze-project.js
- **路径**: scripts\analyze-project.js
- **大小**: 25.09 KB
- **类型**: 脚本
- **最后修改**: 2026/1/10 19:06:55

**内容预览**:

```javascript
#!/usr/bin/env node
//cd frontend
//npm run analyze

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// 支持的扩展名
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.vue',
  '.html', '.css', '.scss', '.less',
  '.json', '.md', '.txt'
]);

// 特殊文件
const CONFIG_FILES = new Set([
  'package.json', 'package-lock.json',
  '.babelrc', '.eslintrc', '.prettierrc',
  'tsconfig.json', 'vite.config.js', 'vite.config.ts',
  'webpack.config.js', 'next.config.js', 'nuxt.config.js',
  'tailwind.config.js', 'postcss.config.js',
  '.env', '.env.example', '.gitignore'
]);

// 忽略模式
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.next/,
  /out/,
  /coverage/,
  /\.DS_Store/,
  /\.vscode/,
  /\.idea/
];

// 文件分类
const CATEGORIES = {
  config: '配置文件',
  source: '源代码',
  component: '组件',
  style: '样式',
  script: '脚本',
  test: '测试',
  asset: '资源文件',
  doc: '文档',
  other: '其他'
};

// 框架检测
const FRAMEWORKS = {
  react: ['react', 'react-dom'],
  vue: ['vue'],
  angular: ['@angular/core'],
  svelte: ['svelte'],
  next: ['next'],
  nuxt: ['nuxt']
};

class FrontendAnalyzer {
  constructor() {
    this.structure = {};
    this.fileCounts = {};
    this.totalFiles = 0;
    this.projectInfo = {
      framework: 'Unknown',
      buildTool: 'Unknown',
      styling: [],
      features: []
    };
  }

  shouldIgnore(filePath) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  getCategory(filename, filePath) {
    const dir = path.dirname(filePath);
    
    if (CONFIG_FILES.has(filename) || filename.endsWith('.json') && !filename.includes('package')) {
      return 'config';
    }
    if (dir.includes('components') || filename.match(/(\.jsx|\.tsx|\.vue|\.svelte)$/)) {
      return 'component';
    }
    if (filename.match(/(\.css|\.scss|\.less|\.styl)$/)) {
      return 'style';
    }
    if (dir.includes('scripts') || filename.startsWith('scripts/')) {
      return 'script';
    }
    if (dir.includes('tests') || dir.includes('__tests__') || filename.includes('test') || filename.includes('spec')) {
      return 'test';
    }
    if (dir.includes('assets') || dir.includes('public') || 
        filename.match(/(\.png|\.jpg|\.jpeg|\.gif|\.svg|\.ico|\.mp4|\.mp3)$/)) {
      return 'asset';
    }
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      return 'doc';
    }
    if (filename.match(/(\.js|\.ts)$/) && !dir.includes('node_modules')) {
      return 'source';
    }
    return 'other';
  }

  getFileInfo(filePath, stats) {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);
    const category = this.getCategory(basename, filePath);
... (内容截断)
```

---
### 📁 src

#### 🎨💎 App.scss
- **路径**: src\App.scss
- **大小**: 8.03 KB
- **类型**: 样式
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
    backgrou
... (内容截断)
```

---
#### ⚛️📘 App.tsx
- **路径**: src\App.tsx
- **大小**: 1.69 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### 📘 env.d.ts
- **路径**: src\env.d.ts
- **大小**: 481 Bytes
- **类型**: 源代码
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### ⚛️📘 main.tsx
- **路径**: src\main.tsx
- **大小**: 249 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
### 📁 src\components

#### 📘 index.ts
- **路径**: src\components\index.ts
- **大小**: 439 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
// 组件统一导出
export { default as VolunteerCard } from './VolunteerCard';
export { default as VolunteerList } from './VolunteerList';
export { default as Header } from './Header';
export { default as Footer } from './Footer';
export { default as LoadingSpinner } from './LoadingSpinner';

// 类型导出
export type { VolunteerCardProps } from './VolunteerCard';
export type { VolunteerListProps } from './VolunteerList';
```

---
### 📁 src\components\Footer

#### 🎨💎 Footer.scss
- **路径**: src\components\Footer\Footer.scss
- **大小**: 2 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### ⚛️📘 Footer.tsx
- **路径**: src\components\Footer\Footer.tsx
- **大小**: 1.61 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```tsx
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

---
#### 📘 index.ts
- **路径**: src\components\Footer\index.ts
- **大小**: 58 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
import Footer from './Footer.tsx';
export default Footer;
```

---
### 📁 src\components\Header

#### 🎨💎 Header.scss
- **路径**: src\components\Header\Header.scss
- **大小**: 1.67 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### ⚛️📘 Header.tsx
- **路径**: src\components\Header\Header.tsx
- **大小**: 891 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```tsx
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

---
#### 📘 index.ts
- **路径**: src\components\Header\index.ts
- **大小**: 58 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
import Header from './Header.tsx';
export default Header;
```

---
### 📁 src\components\LoadingSpinner

#### 📘 index.ts
- **路径**: src\components\LoadingSpinner\index.ts
- **大小**: 82 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
import LoadingSpinner from './LoadingSpinner.tsx';
export default LoadingSpinner;
```

---
#### 🎨💎 LoadingSpinner.scss
- **路径**: src\components\LoadingSpinner\LoadingSpinner.scss
- **大小**: 3.35 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```scss
@use "@styles/variables" as var;

.spinner {
  // 基础旋转器
  &--default {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(var.$color-primary-500, 0.2);
    border-top: 3px solid var.$color-primary-500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }
  
  // 小尺寸
  &--small {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }
  
  // 大尺寸
  &--large {
    width: 60px;
    height: 60px;
    border-width: 4px;
  }
  
  // 按钮内嵌
  &--button {
    width: 16px;
    height: 16px;
    border-width: 2px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
  }
  
  // 颜色变体
  &--white {
    border-color: rgba(255, 255, 255, 0.2);
    border-top-color: white;
  }
  
  &--success {
    border-color: rgba(var.$color-success, 0.2);
    border-top-color: var.$color-success;
  }
  
  &--danger {
    border-color: rgba(var.$color-danger, 0.2);
    border-top-color: var.$color-danger;
  }
  
  // 容器包装
  &-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    
    &--full {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      z-index: 1000;
    }
    
    &--inline {
      display: inline-flex;
      min-height: auto;
    }
  }
  
  // 文字提示
  &-text {
    margin-top: var.$spacing-3;
    color: var.$color-gray-600;
    font-size: var.$font-size-sm;
    text-align: center;
  }
}

// 点状加载器
.spinner-dots {
  display: flex;
  justify-content: center;
  gap: 4px;
  
  .dot {
    width: 8px;
    height: 8px;
    background: var.$color-primary-500;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
    
    &--white { background: white; }
    &--small { width: 6px; height: 6px; }
    &--large { width: 12px; height: 12px; }
  }
}

// 骨架屏
.skeleton-loader {
  background: linear-gradient(
    90deg,
    var.$color-gray-200 25%,
    var.$color-gray-300 50%,
    var.$color-gray-200 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  
  &--text {
    height: 16px;
    border-radius: 4px;
  }
  
  &--avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }
  
  &--card {
    height: 120px;
    border-radius: 8px;
  }
}

// 动画定义
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// 进度条
.progress-bar {
  width: 100%;
  height: 4px;
  background: var.$color
... (内容截断)
```

---
#### ⚛️📘 LoadingSpinner.tsx
- **路径**: src\components\LoadingSpinner\LoadingSpinner.tsx
- **大小**: 770 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```tsx
import React from 'react';
import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color,
  text = '加载中...'
}) => {
  const sizeMap = {
    sm: '24px',
    md: '40px',
    lg: '60px'
  };

  return (
    <div className="loading-spinner">
      <div 
        className="spinner"
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderColor: color ? `${color} transparent transparent transparent` : undefined
        }}
      />
      {text && <div className="loading-text">{text}</div>}
    </div>
  );
};

export default LoadingSpinner;
```

---
### 📁 src\components\VolunteerCard

#### 📘 index.ts
- **路径**: src\components\VolunteerCard\index.ts
- **大小**: 104 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
export { default } from './VolunteerCard';
export type { VolunteerCardProps } from './VolunteerCard';

```

---
#### 🎨💎 VolunteerCard.scss
- **路径**: src\components\VolunteerCard\VolunteerCard.scss
- **大小**: 21.04 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
          width: 0.2
... (内容截断)
```

---
#### ⚛️📘 VolunteerCard.tsx
- **路径**: src\components\VolunteerCard\VolunteerCard.tsx
- **大小**: 3.99 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```tsx
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

... (内容截断)
```

---
### 📁 src\components\VolunteerList

#### 📘 index.ts
- **路径**: src\components\VolunteerList\index.ts
- **大小**: 206 Bytes
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```typescript
// 导出文件夹内的VolunteerList组件（默认导出）
import VolunteerList from './VolunteerList.tsx';
export default VolunteerList;

export type { VolunteerListProps } from './VolunteerList';

```

---
#### 🎨💎 VolunteerList.scss
- **路径**: src\components\VolunteerList\VolunteerList.scss
- **大小**: 6.62 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

// ==============
... (内容截断)
```

---
#### ⚛️📘 VolunteerList.tsx
- **路径**: src\components\VolunteerList\VolunteerList.tsx
- **大小**: 3.87 KB
- **类型**: 组件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```tsx
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
          <div className="stat-label"
... (内容截断)
```

---
### 📁 src\services

#### 📘 api.ts
- **路径**: src\services\api.ts
- **大小**: 4.45 KB
- **类型**: 源代码
- **最后修改**: 2026/1/10 19:04:40

**内容预览**:

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
      
      // 可以在这里显示全局错误提
... (内容截断)
```

---
#### 📘 types.ts
- **路径**: src\services\types.ts
- **大小**: 957 Bytes
- **类型**: 源代码
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### 📘 volunteerService.ts
- **路径**: src\services\volunteerService.ts
- **大小**: 3.27 KB
- **类型**: 源代码
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
export const getVolunteerService = () =
... (内容截断)
```

---
### 📁 src\styles

#### 🎨💎 animations.scss
- **路径**: src\styles\animations.scss
- **大小**: 5.12 KB
- **类型**: 样式
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
  animation: fade-in var.$duration-nor
... (内容截断)
```

---
#### 🎨💎 global.scss
- **路径**: src\styles\global.scss
- **大小**: 14.35 KB
- **类型**: 样式
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
  border-bottom: 2px solid var.$color-g
... (内容截断)
```

---
#### 🎨💎 mixins.scss
- **路径**: src\styles\mixins.scss
- **大小**: 7.81 KB
- **类型**: 样式
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
    
... (内容截断)
```

---
#### 🎨💎 variables.scss
- **路径**: src\styles\variables.scss
- **大小**: 5.26 KB
- **类型**: 样式
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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
$border-radius: 0.
... (内容截断)
```

---
### 📁 /

#### 📄 .eslintrc.cjs
- **路径**: .eslintrc.cjs
- **大小**: 505 Bytes
- **类型**: 其他
- **最后修改**: 2026/1/9 21:49:11

**内容**: 二进制文件或无法读取

---
#### 🌐 index.html
- **路径**: index.html
- **大小**: 301 Bytes
- **类型**: 其他
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### 📋 package-lock.json
- **路径**: package-lock.json
- **大小**: 145.48 KB
- **类型**: 配置文件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

```json
⚠️ 文件过大，仅显示前5000字符
{
  "name": "volunteer-tracker-frontend",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "volunteer-tracker-frontend",
      "version": "0.1.0",
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
    },
    "node_modules/@babel/code-frame": {
      "version": "7.27.1",
      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.27.1.tgz",
      "integrity": "sha512-cjQ7ZlQ0Mv3b47hABuTevyTuYN4i+loJKGeV9flcCgIK37cCXRh+L1bd3iBHlynerhQ7BhCkn2BPbQUL+rGqFg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@babel/helper-validator-identifier": "^7.27.1",
        "js-tokens": "^4.0.0",
        "picocolors": "^1.1.1"
      },
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/compat-data": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.28.5.tgz",
      "integrity": "sha512-6uFXyCayocRbqhZOB+6XcuZbkMNimwfVGFji8CTZnCzOHVGvDqzvitu1re2AU5LROliz7eQPhB8CpAMvnx9EjA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6.9.0"
      }
    },
    "node_modules/@babel/core": {
      "version": "7.28.5",
      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.28.5.tgz",
      "integrity": "sha512-e7jT4DxYvIDLk1ZHmU/m/mB19rex9sv0c2ftBtjSBv+kVM/902eh0fINUzD7UwLLNR+jU585GxUJ8/EBfAM5fw==",
      "dev": true,
      "license": "MIT",
      "peer": true,
      "dependencies": {
        "@babel/code-frame": "^7.27.1",
        "@babel/generator": "^7.28.5",
        "@babel/helper-compilation-targets": "^7.27.2",
        "@babel/helper-module-transforms": "^7.28.3",
        "@babel/helpers": "^7.28.4",
        "@babel/parser": "^7.28.5",
        "@babel/template": "^7.27.2",
        "@babel/traverse": "^7.28.5",
        "@babel/types": "^7.28.5",
        "@jridgewell/remapping": "^2.3.5",
        "convert-source-map": "^2.0.0",
        "debug": "^4.1.0",
        "gensync": "^1.0.0-beta.2",
        "json5": "^2.2.3",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">=6.9.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://openco
... (内容截断)
```

---
#### 📋 package.json
- **路径**: package.json
- **大小**: 1.1 KB
- **类型**: 配置文件
- **最后修改**: 2026/1/10 19:06:06

**内容预览**:

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
    "analyze": "node scripts/analyze-project.js",
    "analyze:quick": "node scripts/analyze-project.js --quick",
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

---
#### 📋 tsconfig.json
- **路径**: tsconfig.json
- **大小**: 812 Bytes
- **类型**: 配置文件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### 📋 tsconfig.node.json
- **路径**: tsconfig.node.json
- **大小**: 282 Bytes
- **类型**: 配置文件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---
#### 📘 vite.config.ts
- **路径**: vite.config.ts
- **大小**: 2.31 KB
- **类型**: 配置文件
- **最后修改**: 2026/1/9 21:49:11

**内容预览**:

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

---

## 🚀 开发指南

### 环境要求
- Node.js 16+ 或最新 LTS 版本
- npm 或 yarn 或 pnpm

### 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 项目结构说明

```text
frontend/
├── public/                 # 静态资源
├── src/                    # 源代码
│   ├── assets/            # 图片、字体等资源
│   ├── components/        # 可复用组件
│   ├── pages/             # 页面组件
│   ├── layouts/           # 布局组件
│   ├── stores/            # 状态管理
│   ├── services/          # API服务
│   ├── utils/             # 工具函数
│   ├── styles/            # 全局样式
│   ├── App.jsx            # 根组件
│   └── main.js            # 入口文件
├── package.json           # 依赖配置
├── vite.config.js         # 构建配置
└── README.md              # 项目说明
```

### 📡 后端API集成

前端通常与以下后端API交互：

```text
GET    /api/v1/volunteers          # 获取所有志愿者
GET    /api/v1/volunteers/:id      # 获取单个志愿者
POST   /api/v1/volunteers          # 创建志愿者
PUT    /api/v1/volunteers/:id      # 更新志愿者
DELETE /api/v1/volunteers/:id      # 删除志愿者
GET    /api/v1/volunteers/stats    # 获取统计信息
GET    /api/health                 # 健康检查
```

### 🎯 最佳实践

1. **组件化开发**：保持组件小而专注，单一职责
2. **状态管理**：合理使用状态管理工具，避免过度使用
3. **代码分割**：利用路由懒加载提升性能
4. **类型安全**：使用TypeScript提高代码质量
5. **响应式设计**：确保应用在不同设备上表现良好

---
*生成时间: 2026/1/10 19:07:20*
*分析工具: frontend/scripts/analyze-project.js*
