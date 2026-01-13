# 🎨 项目样式文件汇总

以下是项目中所有的SCSS/CSS样式文件：

## 📁 src

### App.scss
**路径**: `src\App.scss`
**大小**: 399 行

**内容（截断显示）**:

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
...
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

*完整文件共 399 行*

## 📁 src\components\Footer

### Footer.scss
**路径**: `src\components\Footer\Footer.scss`
**大小**: 97 行

**内容**:

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

## 📁 src\components\Header

### Header.scss
**路径**: `src\components\Header\Header.scss`
**大小**: 90 行

**内容**:

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

## 📁 src\components\LoadingSpinner

### LoadingSpinner.scss
**路径**: `src\components\LoadingSpinner\LoadingSpinner.scss`
**大小**: 173 行

**内容**:

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
  background: var.$color-gray-200;
  border-radius: 2px;
  overflow: hidden;
  
  .progress-fill {
    height: 100%;
    background: var.$color-primary-500;
    border-radius: 2px;
    animation: progress-animation 2s ease-in-out infinite;
  }
}

@keyframes progress-animation {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
```

## 📁 src\components\VolunteerCard

### VolunteerCard.scss
**路径**: `src\components\VolunteerCard\VolunteerCard.scss`
**大小**: 853 行

**内容（截断显示）**:

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
...

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

*完整文件共 853 行*

## 📁 src\components\VolunteerList

### VolunteerList.scss
**路径**: `src\components\VolunteerList\VolunteerList.scss`
**大小**: 324 行

**内容（截断显示）**:

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
...
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

*完整文件共 324 行*

## 📁 src\styles

### animations.scss
**路径**: `src\styles\animations.scss`
**大小**: 280 行

**内容（截断显示）**:

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
...
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

*完整文件共 280 行*

### global.scss
**路径**: `src\styles\global.scss`
**大小**: 551 行

**内容（截断显示）**:

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
...
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

*完整文件共 551 行*

### mixins.scss
**路径**: `src\styles\mixins.scss`
**大小**: 312 行

**内容（截断显示）**:

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
...
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

*完整文件共 312 行*

### variables.scss
**路径**: `src\styles\variables.scss`
**大小**: 180 行

**内容（截断显示）**:

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
...
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

*完整文件共 180 行*

---
*生成时间: 2026/1/12 19:13:21*
*总文件数: 10 个样式文件*
