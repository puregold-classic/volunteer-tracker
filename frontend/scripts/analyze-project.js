#!/usr/bin/env node

// cd frontend
// npm run analyze
// npm run analyze:quick

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
    
    return {
      path: filePath,
      name: basename,
      relativePath: path.relative(PROJECT_ROOT, filePath),
      size: stats.size,
      extension: ext,
      category,
      isDirectory: stats.isDirectory(),
      lastModified: stats.mtime
    };
  }

  async readFileContent(filePath) {
    try {
      // 只读取文本文件
      const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.html', '.css', '.scss', '.less'];
      const ext = path.extname(filePath);
      
      if (!textExtensions.includes(ext) || this.shouldIgnore(filePath)) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      
      // 限制文件大小
      if (content.length > 50000) { // 50KB
        return `⚠️ 文件过大，仅显示前5000字符\n${content.substring(0, 5000)}...`;
      }
      
      return content;
    } catch (error) {
      return `❌ 读取失败: ${error.message}`;
    }
  }

  async buildTree(dir, indent = 0) {
    try {
      const items = await fs.readdir(dir);
      let treeString = '';
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const fullPath = path.join(dir, item);
        
        if (this.shouldIgnore(fullPath)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          const isLast = i === items.length - 1;
          const prefix = indent === 0 ? '' : '│   '.repeat(indent - 1) + (isLast ? '└── ' : '├── ');
          
          if (stats.isDirectory()) {
            treeString += `${prefix}📁 ${item}/\n`;
            treeString += await this.buildTree(fullPath, indent + 1);
          } else {
            const ext = path.extname(item);
            const icon = this.getFileIcon(item, ext);
            treeString += `${prefix}${icon} ${item}\n`;
          }
        } catch (error) {
          // 跳过无法访问的文件
          continue;
        }
      }
      
      return treeString;
    } catch (error) {
      return '';
    }
  }

  getFileIcon(filename, ext) {
    const icons = {
      '.js': '📜',
      '.jsx': '⚛️',
      '.ts': '📘',
      '.tsx': '⚛️📘',
      '.vue': '🟢',
      '.html': '🌐',
      '.css': '🎨',
      '.scss': '🎨💎',
      '.less': '🎨✨',
      '.json': '📋',
      '.md': '📝',
      '.png': '🖼️',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.svg': '📐',
      '.ico': '🎯',
      '.gitignore': '👁️',
      '.env': '🔐',
      '.lock': '🔒'
    };
    
    if (icons[ext]) return icons[ext];
    if (filename.includes('package')) return '📦';
    if (filename.includes('config')) return '⚙️';
    if (filename.includes('test')) return '🧪';
    
    return '📄';
  }

  async analyzeProjectInfo() {
    try {
      // 读取 package.json
      const packagePath = path.join(PROJECT_ROOT, 'package.json');
      if (fsSync.existsSync(packagePath)) {
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
        
        // 检测框架
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        for (const [framework, packages] of Object.entries(FRAMEWORKS)) {
          if (packages.some(pkg => deps[pkg])) {
            this.projectInfo.framework = framework.charAt(0).toUpperCase() + framework.slice(1);
            break;
          }
        }
        
        // 检测构建工具
        const buildTools = ['vite', 'webpack', 'rollup', 'parcel', 'next', 'nuxt'];
        for (const tool of buildTools) {
          if (deps[tool] || fsSync.existsSync(path.join(PROJECT_ROOT, `${tool}.config.js`))) {
            this.projectInfo.buildTool = tool;
            break;
          }
        }
        
        // 检测样式方案
        const styleLibraries = ['tailwindcss', 'bootstrap', 'antd', 'material-ui', 'styled-components', 'emotion', 'sass', 'less'];
        this.projectInfo.styling = styleLibraries.filter(lib => deps[lib]);
        
        // 检测特性
        if (deps['react-router-dom'] || deps['vue-router']) this.projectInfo.features.push('路由');
        if (deps['axios'] || deps['fetch']) this.projectInfo.features.push('HTTP客户端');
        if (deps['redux'] || deps['vuex'] || deps['mobx']) this.projectInfo.features.push('状态管理');
        if (deps['jest'] || deps['vitest'] || deps['cypress']) this.projectInfo.features.push('测试');
        if (deps['eslint'] || deps['prettier']) this.projectInfo.features.push('代码质量');
        
        this.projectInfo.packageInfo = packageJson;
      }
    } catch (error) {
      console.warn('⚠️  无法分析项目信息:', error.message);
    }
  }

  async analyzeDirectory(dir, relativePath = '') {
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const itemRelativePath = path.join(relativePath, item);
        
        if (this.shouldIgnore(fullPath)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          
          if (stats.isDirectory()) {
            // 递归分析目录
            await this.analyzeDirectory(fullPath, itemRelativePath);
          } else {
            // 记录文件信息
            const dirKey = relativePath || '根目录';
            if (!this.structure[dirKey]) {
              this.structure[dirKey] = [];
            }
            
            const fileInfo = this.getFileInfo(fullPath, stats);
            const content = await this.readFileContent(fullPath);
            fileInfo.content = content;
            this.structure[dirKey].push(fileInfo);
            
            // 统计
            this.totalFiles++;
            this.fileCounts[fileInfo.category] = (this.fileCounts[fileInfo.category] || 0) + 1;
          }
        } catch (error) {
          // 跳过无法访问的文件
          continue;
        }
      }
    } catch (error) {
      // 跳过无法访问的目录
      return;
    }
  }

  generateSummary() {
    let summary = '# 🎨 前端项目分析报告\n\n';
    
    summary += '## 📈 项目概览\n\n';
    summary += `- **总文件数**: ${this.totalFiles}\n`;
    summary += `- **技术栈**: ${this.projectInfo.framework}\n`;
    summary += `- **构建工具**: ${this.projectInfo.buildTool}\n`;
    
    if (this.projectInfo.styling.length > 0) {
      summary += `- **样式方案**: ${this.projectInfo.styling.join(', ')}\n`;
    }
    
    if (this.projectInfo.features.length > 0) {
      summary += `- **项目特性**: ${this.projectInfo.features.join(', ')}\n`;
    }
    
    summary += '- **文件类型分布**:\n';
    
    Object.entries(this.fileCounts).forEach(([category, count]) => {
      const percentage = this.totalFiles > 0 ? ((count / this.totalFiles) * 100).toFixed(1) : '0.0';
      summary += `  - ${CATEGORIES[category]}: ${count} (${percentage}%)\n`;
    });
    
    summary += '\n## 🗂️ 项目结构树\n\n```\n';
    summary += 'frontend/\n';
    return summary;
  }

  generateFileDetails() {
    let details = '\n## 📋 文件详情\n\n';
    
    // 按目录排序
    const sortedDirs = Object.keys(this.structure).sort();
    
    sortedDirs.forEach(dirPath => {
      const files = this.structure[dirPath];
      if (files && files.length > 0) {
        const dirName = dirPath === '根目录' ? '/' : dirPath;
        details += `### 📁 ${dirName}\n\n`;
        
        files.forEach(file => {
          details += `#### ${this.getFileIcon(file.name, file.extension)} ${file.name}\n`;
          details += `- **路径**: ${file.relativePath}\n`;
          details += `- **大小**: ${this.formatBytes(file.size)}\n`;
          details += `- **类型**: ${CATEGORIES[file.category]}\n`;
          details += `- **最后修改**: ${file.lastModified.toLocaleString()}\n`;
          
          if (file.content) {
            details += `\n**内容预览**:\n\n\`\`\`${this.getCodeBlockLang(file.extension)}\n`;
            const preview = file.content.length > 3000 ? 
              file.content.substring(0, 3000) + '\n... (内容截断)' : 
              file.content;
            details += preview;
            details += '\n```\n';
          } else if (file.content === null) {
            details += '\n**内容**: 二进制文件或无法读取\n';
          }
          
          details += '\n---\n';
        });
      }
    });
    
    return details;
  }

  getCodeBlockLang(ext) {
    const langs = {
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.vue': 'vue',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.md': 'markdown',
      '.txt': 'text'
    };
    
    return langs[ext] || 'text';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generatePackageAnalysis() {
    let analysis = '\n## 📦 依赖分析\n\n';
    
    if (this.projectInfo.packageInfo) {
      const pkg = this.projectInfo.packageInfo;
      
      analysis += `### 基本信息\n`;
      analysis += `- **项目名称**: ${pkg.name || '未指定'}\n`;
      analysis += `- **版本**: ${pkg.version || '未指定'}\n`;
      analysis += `- **描述**: ${pkg.description || '无'}\n`;
      analysis += `- **入口文件**: ${pkg.main || '未指定'}\n`;
      
      if (pkg.scripts) {
        analysis += `\n### 🚀 可用命令\n\n`;
        analysis += '```bash\n';
        Object.entries(pkg.scripts).forEach(([cmd, script]) => {
          analysis += `npm run ${cmd.padEnd(15)} # ${script}\n`;
        });
        analysis += '```\n';
      }
      
      if (pkg.dependencies) {
        analysis += `\n### 🔧 生产依赖 (${Object.keys(pkg.dependencies).length}个)\n\n`;
        const deps = Object.entries(pkg.dependencies).slice(0, 10); // 只显示前10个
        deps.forEach(([dep, version]) => {
          analysis += `- ${dep}: ${version}\n`;
        });
        if (Object.keys(pkg.dependencies).length > 10) {
          analysis += `... 还有 ${Object.keys(pkg.dependencies).length - 10} 个依赖\n`;
        }
      }
      
      if (pkg.devDependencies) {
        analysis += `\n### 🛠️  开发依赖 (${Object.keys(pkg.devDependencies).length}个)\n\n`;
        const devDeps = Object.entries(pkg.devDependencies).slice(0, 10);
        devDeps.forEach(([dep, version]) => {
          analysis += `- ${dep}: ${version}\n`;
        });
        if (Object.keys(pkg.devDependencies).length > 10) {
          analysis += `... 还有 ${Object.keys(pkg.devDependencies).length - 10} 个依赖\n`;
        }
      }
    } else {
      analysis += '❌ 无法获取 package.json 信息\n';
    }
    
    return analysis;
  }

  generateConfigAnalysis() {
    let analysis = '\n## ⚙️ 配置文件分析\n\n';
    
    // 检查常见配置文件
    const configFiles = [
      { name: 'vite.config.js', desc: 'Vite构建配置' },
      { name: 'vite.config.ts', desc: 'Vite构建配置(TypeScript)' },
      { name: 'webpack.config.js', desc: 'Webpack构建配置' },
      { name: 'next.config.js', desc: 'Next.js配置' },
      { name: 'nuxt.config.js', desc: 'Nuxt.js配置' },
      { name: 'tailwind.config.js', desc: 'Tailwind CSS配置' },
      { name: 'postcss.config.js', desc: 'PostCSS配置' },
      { name: '.babelrc', desc: 'Babel配置' },
      { name: '.eslintrc.js', desc: 'ESLint配置' },
      { name: '.prettierrc', desc: 'Prettier配置' },
      { name: 'tsconfig.json', desc: 'TypeScript配置' }
    ];
    
    configFiles.forEach(config => {
      const configPath = path.join(PROJECT_ROOT, config.name);
      if (fsSync.existsSync(configPath)) {
        analysis += `### ${config.desc} (${config.name})\n`;
        analysis += `📎 位置: ${config.name}\n\n`;
        
        try {
          const content = fsSync.readFileSync(configPath, 'utf8');
          if (content.length < 1000) {
            analysis += '```javascript\n';
            analysis += content;
            analysis += '\n```\n\n';
          } else {
            analysis += '内容过长，已省略\n\n';
          }
        } catch (error) {
          analysis += '无法读取文件内容\n\n';
        }
      }
    });
    
    return analysis;
  }

  async generateReadme() {
    const tree = await this.buildTree(PROJECT_ROOT);
    
    let output = this.generateSummary();
    output += tree;
    output += '```\n';
    
    output += this.generatePackageAnalysis();
    output += this.generateConfigAnalysis();
    output += this.generateFileDetails();
    
    output += '\n## 🚀 开发指南\n\n';
    
    output += '### 环境要求\n';
    output += '- Node.js 16+ 或最新 LTS 版本\n';
    output += '- npm 或 yarn 或 pnpm\n\n';
    
    output += '### 快速开始\n\n';
    output += '```bash\n';
    output += '# 安装依赖\n';
    output += 'npm install\n\n';
    output += '# 启动开发服务器\n';
    output += 'npm run dev\n\n';
    output += '# 构建生产版本\n';
    output += 'npm run build\n\n';
    output += '# 预览生产构建\n';
    output += 'npm run preview\n';
    output += '```\n\n';
    
    output += '### 项目结构说明\n\n';
    output += '```text\n';
    output += 'frontend/\n';
    output += '├── public/                 # 静态资源\n';
    output += '├── src/                    # 源代码\n';
    output += '│   ├── assets/            # 图片、字体等资源\n';
    output += '│   ├── components/        # 可复用组件\n';
    output += '│   ├── pages/             # 页面组件\n';
    output += '│   ├── layouts/           # 布局组件\n';
    output += '│   ├── stores/            # 状态管理\n';
    output += '│   ├── services/          # API服务\n';
    output += '│   ├── utils/             # 工具函数\n';
    output += '│   ├── styles/            # 全局样式\n';
    output += '│   ├── App.jsx            # 根组件\n';
    output += '│   └── main.js            # 入口文件\n';
    output += '├── package.json           # 依赖配置\n';
    output += '├── vite.config.js         # 构建配置\n';
    output += '└── README.md              # 项目说明\n';
    output += '```\n\n';
    
    output += '### 📡 后端API集成\n\n';
    output += '前端通常与以下后端API交互：\n\n';
    output += '```text\n';
    output += 'GET    /api/v1/volunteers          # 获取所有志愿者\n';
    output += 'GET    /api/v1/volunteers/:id      # 获取单个志愿者\n';
    output += 'POST   /api/v1/volunteers          # 创建志愿者\n';
    output += 'PUT    /api/v1/volunteers/:id      # 更新志愿者\n';
    output += 'DELETE /api/v1/volunteers/:id      # 删除志愿者\n';
    output += 'GET    /api/v1/volunteers/stats    # 获取统计信息\n';
    output += 'GET    /api/health                 # 健康检查\n';
    output += '```\n\n';
    
    output += '### 🎯 最佳实践\n\n';
    output += '1. **组件化开发**：保持组件小而专注，单一职责\n';
    output += '2. **状态管理**：合理使用状态管理工具，避免过度使用\n';
    output += '3. **代码分割**：利用路由懒加载提升性能\n';
    output += '4. **类型安全**：使用TypeScript提高代码质量\n';
    output += '5. **响应式设计**：确保应用在不同设备上表现良好\n';
    
    output += '\n---\n';
    output += `*生成时间: ${new Date().toLocaleString()}*\n`;
    output += `*分析工具: frontend/scripts/analyze-project.js*\n`;
    
    return output;
  }

  async saveReport(output) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(PROJECT_ROOT, `frontend-analysis-${timestamp}.md`);
    
    await fs.writeFile(outputPath, output, 'utf8');
    console.log(`✅ 分析报告已保存: ${outputPath}`);
    return outputPath;
  }

  async run() {
    console.log('🎨 开始分析前端项目结构...\n');
    
    try {
      // 分析项目信息
      await this.analyzeProjectInfo();
      
      // 分析项目目录
      await this.analyzeDirectory(PROJECT_ROOT);
      
      // 生成报告
      const report = await this.generateReadme();
      
      // 保存报告
      const outputPath = await this.saveReport(report);
      
      console.log('\n📊 分析完成！');
      console.log(`📁 总分析文件数: ${this.totalFiles}`);
      console.log(`🏗️  技术栈: ${this.projectInfo.framework} + ${this.projectInfo.buildTool}`);
      console.log(`📝 报告已生成: ${path.relative(process.cwd(), outputPath)}`);
      console.log('\n🎯 你可以将此文件发送给AI助手，它会完全理解你的前端项目！');
      
    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// 创建快捷分析脚本
async function createQuickScript() {
  const quickScript = `#!/usr/bin/env node

// 前端快速分析脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

async function quickAnalyze() {
  console.log('⚡ 前端项目快速分析\\n');
  
  // 1. 检查关键文件
  const keyFiles = [
    'package.json',
    'vite.config.js',
    'vite.config.ts',
    'webpack.config.js',
    'src/main.js',
    'src/main.jsx',
    'src/main.ts',
    'src/main.tsx',
    'src/App.jsx',
    'src/App.vue',
    'public/index.html'
  ];
  
  console.log('📋 关键文件检查:');
  keyFiles.forEach(file => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filePath)) {
      console.log(\`  ✅ \${file}\`);
    } else {
      console.log(\`  🔍 \${file} (未找到)\`);
    }
  });
  
  // 2. 分析 package.json
  try {
    const packagePath = path.join(PROJECT_ROOT, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    console.log(\`\\n📦 项目信息:\`);
    console.log(\`  名称: \${packageData.name}\`);
    console.log(\`  版本: \${packageData.version}\`);
    console.log(\`  描述: \${packageData.description || '无'}\`);
    
    // 检测框架
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
    let framework = 'Unknown';
    
    if (deps.react) framework = 'React';
    else if (deps.vue) framework = 'Vue';
    else if (deps.angular) framework = 'Angular';
    else if (deps.svelte) framework = 'Svelte';
    else if (deps.next) framework = 'Next.js';
    else if (deps.nuxt) framework = 'Nuxt.js';
    
    console.log(\`  框架: \${framework}\`);
    
    // 构建工具
    let buildTool = 'Unknown';
    if (deps.vite || fs.existsSync(path.join(PROJECT_ROOT, 'vite.config.js'))) buildTool = 'Vite';
    else if (deps.webpack || fs.existsSync(path.join(PROJECT_ROOT, 'webpack.config.js'))) buildTool = 'Webpack';
    else if (deps.next) buildTool = 'Next.js';
    else if (deps.nuxt) buildTool = 'Nuxt.js';
    
    console.log(\`  构建工具: \${buildTool}\`);
    
    if (packageData.scripts) {
      console.log(\`\\n🚀 可用命令:\`);
      Object.entries(packageData.scripts).forEach(([cmd, script]) => {
        console.log(\`  npm run \${cmd.padEnd(15)} → \${script}\`);
      });
    }
  } catch (error) {
    console.log('❌ 无法读取package.json');
  }
  
  // 3. 检查目录结构
  console.log(\`\\n🗂️ 项目结构概览:\`);
  checkDir('src/');
  checkDir('public/');
  checkDir('components/');
  checkDir('pages/');
  checkDir('assets/');
  
  function checkDir(dirName) {
    const dirPath = path.join(PROJECT_ROOT, dirName);
    if (fs.existsSync(dirPath)) {
      const items = fs.readdirSync(dirPath).slice(0, 5); // 只显示前5个
      console.log(\`  \${dirName.padEnd(15)} → \${items.length}个项目\`);
      if (items.length > 0) {
        console.log(\`                   (\${items.join(', ')}\${items.length > 5 ? '...' : ''})\`);
      }
    }
  }
  
  // 4. 生成技术栈总结
  console.log(\`\\n🔧 技术栈总结:\`);
  console.log(\`  - 前端框架: \${framework}\`);
  console.log(\`  - 构建工具: \${buildTool}\`);
  console.log(\`  - 包管理器: npm\`);
  console.log(\`  - 开发服务器: \${buildTool === 'Vite' ? 'Vite Dev Server' : buildTool + ' Dev Server'}\`);
  
  console.log(\`\\n🎯 快速启动:\`);
  console.log(\`  1. npm install              # 安装依赖\`);
  console.log(\`  2. npm run dev              # 启动开发服务器\`);
  console.log(\`  3. 访问 http://localhost:5173 (或查看package.json中的端口配置)\`);
  console.log(\`  4. npm run build            # 构建生产版本\`);
  
  console.log(\`\\n📡 开发服务器通常运行在: http://localhost:5173 或 http://localhost:3000\`);
}

quickAnalyze().catch(console.error);
`;

  const quickScriptPath = path.join(PROJECT_ROOT, 'scripts', 'quick-analyze.js');
  await fs.writeFile(quickScriptPath, quickScript, 'utf8');
  await fs.chmod(quickScriptPath, '755');
  console.log(`⚡ 快速分析脚本已创建: scripts/quick-analyze.js`);
  console.log(`👉 使用: node scripts/quick-analyze.js`);
}

// 运行主分析
const analyzer = new FrontendAnalyzer();

// 检查是否有快速分析参数
if (process.argv.includes('--quick') || process.argv.includes('-q')) {
  createQuickScript();
} else {
  analyzer.run();
}