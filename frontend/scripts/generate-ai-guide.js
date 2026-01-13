#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

class FrontendAIGuideGenerator {
  constructor() {
    // A级文件：完整显示
    this.levelAFiles = new Map([
      ['vite.config.ts', 'Vite构建配置文件'],
      ['index.html', '应用主HTML文件'],
      ['package.json', '项目依赖和脚本配置'],
      ['src/main.tsx', 'React应用入口文件'],
      ['src/App.tsx', '根组件文件']
    ]);
    
    // 添加services目录下所有文件为A级
    this.addServicesFilesAsLevelA();
    
    // B级组件目录（除了Footer、Header、LoadingSpinner）
    this.levelBComponentDirs = new Set([
      'VolunteerCard',
      'VolunteerList'
      // 可以添加更多组件目录
    ]);
    
    // 样式文件集合（单独生成）
    this.styleFiles = [];
  }

  async addServicesFilesAsLevelA() {
    try {
      const servicesDir = path.join(PROJECT_ROOT, 'src/services');
      if (fsSync.existsSync(servicesDir)) {
        const files = await fs.readdir(servicesDir);
        files.forEach(file => {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const filePath = `src/services/${file}`;
            const fileName = file.replace(/\.(ts|tsx)$/, '');
            const description = this.getServiceFileDescription(fileName);
            this.levelAFiles.set(filePath, description);
          }
        });
      }
    } catch (error) {
      console.warn('⚠️  无法扫描services目录:', error.message);
    }
  }

  getServiceFileDescription(fileName) {
    const descriptions = {
      'api': 'API客户端配置和基础请求',
      'volunteerService': '志愿者相关API服务',
      'types': 'TypeScript类型定义'
    };
    return descriptions[fileName] || '服务层文件';
  }

  // B级文件：指定组件目录中的.tsx文件
  isLevelBFile(relativePath) {
    // 必须是src/components/下的.tsx文件
    if (!relativePath.startsWith('src/components/') || !relativePath.endsWith('.tsx')) {
      return false;
    }
    
    // 排除Footer、Header、LoadingSpinner
    const excludedDirs = ['Footer', 'Header', 'LoadingSpinner'];
    const dirName = relativePath.split('/')[2]; // src/components/ComponentName/
    
    if (excludedDirs.includes(dirName)) {
      return false;
    }
    
    // 检查是否在B级组件目录中
    if (!this.levelBComponentDirs.has(dirName)) {
      return false;
    }
    
    // 确保文件存在
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    return fsSync.existsSync(fullPath);
  }

  // 样式文件识别
  isStyleFile(relativePath) {
    return relativePath.endsWith('.scss') || relativePath.endsWith('.css');
  }

  async generate() {
    console.log('🎨 生成前端项目AI指南...\n');
    
    // 收集B级文件
    this.levelBFilesCache = await this.collectLevelBFiles();
    
    // 收集样式文件
    this.styleFiles = await this.collectStyleFiles();
    
    console.log('📊 文件分级统计:');
    console.log(`  A级: ${this.levelAFiles.size} 个文件（完整显示）`);
    console.log(`  B级: ${this.levelBFilesCache.length} 个文件（显示前50行）`);
    console.log(`  样式: ${this.styleFiles.length} 个文件（单独生成）`);
    
    // 显示B级文件详情
    if (this.levelBFilesCache.length > 0) {
      console.log('\n📋 B级组件列表:');
      this.levelBComponentDirs.forEach(dir => {
        const files = this.levelBFilesCache.filter(f => f.path.includes(`/components/${dir}/`));
        if (files.length > 0) {
          console.log(`  ${dir}/: ${files.map(f => path.basename(f.path)).join(', ')}`);
        }
      });
    }
    
    // 生成主指南
    const guide = await this.buildGuide();
    const guidePath = path.join(PROJECT_ROOT, 'AI-PROJECT-GUIDE.md');
    await fs.writeFile(guidePath, guide, 'utf8');
    
    // 生成样式文件汇总
    const styleGuide = await this.buildStyleGuide();
    const stylePath = path.join(PROJECT_ROOT, 'STYLE-GUIDE.md');
    await fs.writeFile(stylePath, styleGuide, 'utf8');
    
    console.log(`\n✅ AI指南已生成: ${guidePath}`);
    console.log(`✅ 样式指南已生成: ${stylePath}`);
    
    console.log('\n🎯 使用说明:');
    console.log('  1. 将两个MD文件内容都复制给AI');
    console.log('  2. 或直接上传这两个文件');
  }

  async collectLevelBFiles() {
    const levelBFiles = [];
    
    // 扫描components目录
    const componentsDir = path.join(PROJECT_ROOT, 'src/components');
    if (fsSync.existsSync(componentsDir)) {
      await this.traverseComponents(componentsDir, levelBFiles);
    }
    
    return levelBFiles;
  }

  async traverseComponents(dir, levelBFiles, baseDir = PROJECT_ROOT) {
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        try {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (stats.isDirectory()) {
            // 递归扫描组件目录
            await this.traverseComponents(fullPath, levelBFiles, baseDir);
          } else if (relativePath.endsWith('.tsx') && this.isLevelBFile(relativePath)) {
            const description = this.getComponentDescription(relativePath);
            levelBFiles.push({
              path: relativePath,
              description: description
            });
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      return;
    }
  }

  async collectStyleFiles() {
    const styleFiles = [];
    
    async function collectStyles(dir, baseDir = PROJECT_ROOT) {
      try {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          
          try {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(baseDir, fullPath);
            
            if (stats.isDirectory()) {
              await collectStyles(fullPath, baseDir);
            } else if (relativePath.endsWith('.scss') || relativePath.endsWith('.css')) {
              styleFiles.push({
                path: relativePath,
                name: item
              });
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        return;
      }
    }
    
    await collectStyles(PROJECT_ROOT);
    return styleFiles;
  }

  getComponentDescription(filePath) {
    const fileName = path.basename(filePath, '.tsx');
    const dirName = path.dirname(filePath).split('/').pop();
    
    const descriptions = {
      'VolunteerCard': '志愿者卡片展示组件',
      'VolunteerList': '志愿者列表组件',
      'Footer': '页脚组件',
      'Header': '头部导航组件',
      'LoadingSpinner': '加载动画组件'
    };
    
    return descriptions[fileName] || `${fileName} 组件`;
  }

  async buildGuide() {
    let content = '';
    
    content += await this.generateAIInstructions();
    content += await this.generateProjectStructure();
    content += await this.generateLevelAFiles();
    content += await this.generateLevelBFiles();
    content += await this.generateFileIndex();
    
    return content;
  }

  async generateAIInstructions() {
    return `# 🎨 前端项目AI协作指南

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
所有SCSS/CSS样式文件已单独生成到 \`STYLE-GUIDE.md\` 中。

## ❓ 如何协作
1. 先阅读本指南和STYLE-GUIDE.md了解项目结构
2. 可以请求任何文件的完整内容
3. 修改代码前请先确认理解需求

---
`;
  }

  async generateProjectStructure() {
    const tree = await this.buildFileTree(PROJECT_ROOT, 0);
    return `## 🗂️ 项目结构

\`\`\`
frontend/
${tree}
\`\`\`

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
`;
  }

  async buildFileTree(dir, depth) {
    try {
      const items = await fs.readdir(dir);
      let tree = '';
      
      // 过滤忽略项
      const filteredItems = items.filter(item => 
        !['node_modules', '.git', '.DS_Store', 'dist', 'build'].includes(item)
      ).sort((a, b) => {
        const aPath = path.join(dir, a);
        const bPath = path.join(dir, b);
        const aIsDir = fsSync.existsSync(aPath) && fsSync.statSync(aPath).isDirectory();
        const bIsDir = fsSync.existsSync(bPath) && fsSync.statSync(bPath).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });
      
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const fullPath = path.join(dir, item);
        
        try {
          const stats = await fs.stat(fullPath);
          const isLast = i === filteredItems.length - 1;
          const prefix = depth === 0 ? '' : '│   '.repeat(depth - 1) + (isLast ? '└── ' : '├── ');
          const relativePath = path.relative(PROJECT_ROOT, fullPath);
          
          if (stats.isDirectory()) {
            const icon = this.getDirectoryIcon(item);
            tree += `${prefix}${icon} ${item}/\n`;
            tree += await this.buildFileTree(fullPath, depth + 1);
          } else {
            const isLevelA = this.levelAFiles.has(relativePath);
            const isLevelB = this.levelBFilesCache?.some(f => f.path === relativePath) || false;
            const isStyle = this.isStyleFile(relativePath);
            const icon = this.getFileIcon(item, relativePath, isLevelA, isLevelB, isStyle);
            tree += `${prefix}${icon} ${item}\n`;
          }
        } catch (error) {
          continue;
        }
      }
      
      return tree;
    } catch (error) {
      return '';
    }
  }

  getDirectoryIcon(dirName) {
    const icons = {
      'src': '📦',
      'components': '🧩',
      'services': '🔌',
      'styles': '🎨',
      'utils': '🔧',
      'public': '🌐',
      'scripts': '📜',
      'node_modules': '📦'
    };
    return icons[dirName] || '📁';
  }

  getFileIcon(fileName, relativePath, isLevelA, isLevelB, isStyle) {
    const ext = path.extname(fileName);
    
    // 基础图标
    let icon = '📄';
    if (ext === '.tsx') icon = '⚛️📘';
    else if (ext === '.ts') icon = '📘';
    else if (ext === '.scss') icon = '🎨💎';
    else if (ext === '.css') icon = '🎨';
    else if (ext === '.html') icon = '🌐';
    else if (ext === '.json') icon = '📋';
    else if (ext === '.cjs') icon = '⚙️';
    else if (fileName === 'vite.config.ts') icon = '⚡';
    
    // 分级标记
    if (isLevelA) return `⭐${icon}`;
    if (isLevelB) return `📋${icon}`;
    return icon;
  }

  async generateLevelAFiles() {
    let content = '## ⭐ A级文件（完整内容）\n\n';
    
    // 按路径分组排序显示
    const groups = {
      '配置': [],
      '入口': [],
      '服务层': [],
      '其他': []
    };
    
    for (const [filePath, description] of this.levelAFiles) {
      if (filePath.includes('vite.config') || filePath.includes('package')) {
        groups['配置'].push([filePath, description]);
      } else if (filePath.includes('index.html') || filePath.includes('main.tsx') || filePath.includes('App.tsx')) {
        groups['入口'].push([filePath, description]);
      } else if (filePath.includes('services')) {
        groups['服务层'].push([filePath, description]);
      } else {
        groups['其他'].push([filePath, description]);
      }
    }
    
    // 显示各组文件
    for (const [groupName, files] of Object.entries(groups)) {
      if (files.length > 0) {
        files.sort((a, b) => a[0].localeCompare(b[0]));
        
        for (const [filePath, description] of files) {
          const fullPath = path.join(PROJECT_ROOT, filePath);
          
          if (fsSync.existsSync(fullPath)) {
            try {
              const fileContent = await fs.readFile(fullPath, 'utf8');
              content += await this.formatLevelAFile(filePath, description, fileContent, groupName);
            } catch (error) {
              content += `### ❌ 无法读取 ${filePath}\n\n`;
            }
          } else {
            content += `### ⚠️ 文件不存在: ${filePath}\n\n`;
          }
        }
      }
    }
    
    content += '---\n';
    return content;
  }

  async formatLevelAFile(filePath, description, content, groupName = '') {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const lang = this.getCodeLang(ext);
    
    let formatted = '';
    if (groupName) {
      formatted += `### ${groupName}: ${fileName}\n`;
    } else {
      formatted += `### ${fileName}\n`;
    }
    
    formatted += `**路径**: \`${filePath}\`\n`;
    formatted += `**说明**: ${description}\n\n`;
    formatted += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
    
    return formatted;
  }

  async generateLevelBFiles() {
    if (!this.levelBFilesCache || this.levelBFilesCache.length === 0) {
      return '## 📋 B级文件\n\n未找到B级文件。\n\n---\n';
    }
    
    let content = '## 📋 B级文件（前50行预览）\n\n';
    
    // 按组件目录分组
    const filesByComponent = {};
    this.levelBFilesCache.forEach(file => {
      const dirParts = file.path.split('/');
      const componentName = dirParts[2]; // src/components/ComponentName/
      
      if (!filesByComponent[componentName]) {
        filesByComponent[componentName] = [];
      }
      filesByComponent[componentName].push(file);
    });
    
    // 按组件名排序
    const sortedComponents = Object.keys(filesByComponent).sort();
    
    for (const componentName of sortedComponents) {
      const files = filesByComponent[componentName];
      content += `### ${componentName} 组件\n\n`;
      
      for (const file of files) {
        const fullPath = path.join(PROJECT_ROOT, file.path);
        
        try {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          content += await this.formatLevelBFile(file.path, file.description, fileContent);
        } catch (error) {
          content += `#### ❌ 无法读取 ${path.basename(file.path)}\n\n`;
        }
      }
    }
    
    content += '---\n';
    return content;
  }

  async formatLevelBFile(filePath, description, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const lang = this.getCodeLang(ext);
    const lines = content.split('\n');
    const totalLines = lines.length;
    
    let formatted = `#### ${fileName}\n`;
    formatted += `**路径**: \`${filePath}\`\n`;
    formatted += `**说明**: ${description}\n\n`;
    
    // 显示前50行或全部（如果少于50行）
    const previewLines = Math.min(50, totalLines);
    const preview = lines.slice(0, previewLines).join('\n');
    
    formatted += `**预览（前${previewLines}行）**:\n\n`;
    formatted += `\`\`\`${lang}\n${preview}`;
    
    if (totalLines > 50) {
      formatted += `\n...（还有 ${totalLines - 50} 行）`;
    }
    
    formatted += `\n\`\`\`\n\n`;
    
    return formatted;
  }

  async generateFileIndex() {
    const fileIndex = await this.buildFileIndex(PROJECT_ROOT);
    
    let content = '## 📑 文件索引\n\n';
    
    // 按类别显示
    const categories = [
      '配置文件', 'HTML文件', 'TypeScript配置', '组件文件', 
      '服务文件', '样式文件', '工具文件', '文档文件', '其他文件'
    ];
    
    for (const category of categories) {
      if (fileIndex[category] && fileIndex[category].length > 0) {
        const filesInCategory = fileIndex[category];
        content += `### ${category}\n\n`;
        
        filesInCategory.forEach(file => {
          const isLevelA = this.levelAFiles.has(file.path);
          const isLevelB = this.levelBFilesCache?.some(f => f.path === file.path) || false;
          const isStyle = this.isStyleFile(file.path);
          
          let icon = '📄';
          if (isStyle) icon = '🎨';
          else if (isLevelA) icon = '⭐';
          else if (isLevelB) icon = '📋';
          
          content += `- ${icon} \`${file.path}\`\n`;
        });
        
        content += '\n';
      }
    }
    
    content += '---\n';
    content += `*生成时间: ${new Date().toLocaleString()}*\n`;
    content += `*样式文件详见: STYLE-GUIDE.md*\n`;
    
    return content;
  }

  async buildStyleGuide() {
    if (this.styleFiles.length === 0) {
      return '# 🎨 项目样式文件\n\n未找到样式文件。\n';
    }
    
    let content = '# 🎨 项目样式文件汇总\n\n';
    content += '以下是项目中所有的SCSS/CSS样式文件：\n\n';
    
    // 按目录分组
    const filesByDir = {};
    this.styleFiles.forEach(file => {
      const dir = path.dirname(file.path);
      if (!filesByDir[dir]) {
        filesByDir[dir] = [];
      }
      filesByDir[dir].push(file);
    });
    
    // 按目录排序
    const sortedDirs = Object.keys(filesByDir).sort();
    
    for (const dir of sortedDirs) {
      const files = filesByDir[dir];
      content += `## 📁 ${dir || '根目录'}\n\n`;
      
      for (const file of files) {
        const fullPath = path.join(PROJECT_ROOT, file.path);
        
        try {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          content += await this.formatStyleFile(file.path, fileContent);
        } catch (error) {
          content += `### ❌ 无法读取 ${file.name}\n\n`;
        }
      }
    }
    
    content += '---\n';
    content += `*生成时间: ${new Date().toLocaleString()}*\n`;
    content += `*总文件数: ${this.styleFiles.length} 个样式文件*\n`;
    
    return content;
  }

  async formatStyleFile(filePath, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const lang = ext === '.scss' ? 'scss' : 'css';
    const lines = content.split('\n').length;
    
    let formatted = `### ${fileName}\n`;
    formatted += `**路径**: \`${filePath}\`\n`;
    formatted += `**大小**: ${lines} 行\n\n`;
    
    if (content.length > 5000) {
      // 显示前100行和后20行
      const allLines = content.split('\n');
      const first100 = allLines.slice(0, 100).join('\n');
      const last20 = allLines.slice(-20).join('\n');
      
      formatted += `**内容（截断显示）**:\n\n`;
      formatted += `\`\`\`${lang}\n${first100}\n...\n${last20}\n\`\`\`\n\n`;
      formatted += `*完整文件共 ${lines} 行*\n\n`;
    } else {
      formatted += `**内容**:\n\n`;
      formatted += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
    }
    
    return formatted;
  }

  async buildFileIndex(dir) {
    const categories = {
      '配置文件': [],
      'HTML文件': [],
      'TypeScript配置': [],
      '组件文件': [],
      '服务文件': [],
      '样式文件': [],
      '工具文件': [],
      '文档文件': [],
      '其他文件': []
    };
    
    await this.traverseForIndex(dir, categories);
    
    return categories;
  }

  async traverseForIndex(dir, categories, baseDir = PROJECT_ROOT) {
    try {
      const items = await fs.readdir(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        if (['node_modules', '.git', '.DS_Store', 'dist', 'build'].some(pattern => fullPath.includes(pattern))) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (stats.isDirectory()) {
            await this.traverseForIndex(fullPath, categories, baseDir);
          } else {
            const category = this.categorizeFile(fullPath, relativePath);
            categories[category].push({
              path: relativePath,
              size: this.formatBytes(stats.size)
            });
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      return;
    }
  }

  categorizeFile(fullPath, relativePath) {
    const ext = path.extname(fullPath);
    const dir = path.dirname(fullPath);
    const name = path.basename(fullPath);
    
    // 配置文件
    if (name.match(/^\.|config|package|vite|tsconfig/)) {
      return '配置文件';
    }
    
    // HTML文件
    if (ext === '.html') {
      return 'HTML文件';
    }
    
    // TypeScript配置
    if (name.includes('tsconfig')) {
      return 'TypeScript配置';
    }
    
    // 组件文件
    if (dir.includes('components') && (ext === '.tsx' || ext === '.ts')) {
      return '组件文件';
    }
    
    // 服务文件
    if (dir.includes('services')) {
      return '服务文件';
    }
    
    // 样式文件
    if (ext === '.scss' || ext === '.css') {
      return '样式文件';
    }
    
    // 工具文件
    if (dir.includes('utils')) {
      return '工具文件';
    }
    
    // 文档文件
    if (ext === '.md') {
      return '文档文件';
    }
    
    return '其他文件';
  }

  getCodeLang(ext) {
    const langs = {
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.json': 'json',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss'
    };
    return langs[ext] || 'text';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.min(2, Math.floor(Math.log(bytes) / Math.log(k)));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 运行生成器
const generator = new FrontendAIGuideGenerator();

// 错误处理
process.on('unhandledRejection', (reason) => {
  console.error('❌ 错误:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获异常:', error.message);
  process.exit(1);
});

// 执行
generator.generate().catch(error => {
  console.error('❌ 生成失败:', error.message);
  process.exit(1);
});