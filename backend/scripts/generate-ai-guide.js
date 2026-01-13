#!/usr/bin/env node

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

class AIGuideGenerator {
  constructor() {
    // A级文件：完整显示
    this.levelAFiles = new Map([
      ['src/server.js', '主服务器文件，Express应用入口和配置'],
      ['package.json', '项目依赖和npm脚本配置']
    ]);
    
    // B级文件目录
    this.levelBDirs = new Set([
      'models',
      'controllers',
      'utils',
      'middleware'
    ]);
    
    // 动态添加所有routes文件为A级
    this.addRoutesFilesAsLevelA();
    
    // B级文件缓存
    this.levelBFilesCache = null;
  }

  async addRoutesFilesAsLevelA() {
    try {
      const routesDir = path.join(PROJECT_ROOT, 'src/routes');
      if (fsSync.existsSync(routesDir)) {
        const files = await fs.readdir(routesDir);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const filePath = `src/routes/${file}`;
            const routeName = file.replace('.js', '').replace('Routes', '').replace('routes', '');
            const description = `API路由文件：${routeName}相关接口`;
            this.levelAFiles.set(filePath, description);
          }
        });
      }
    } catch (error) {
      console.warn('⚠️  无法扫描routes目录:', error.message);
    }
  }

  // 修复：更准确的B级文件识别 - 检查是否在B级目录中
  isLevelBFile(relativePath) {
    // 必须是src/下的.js文件
    if (!relativePath.startsWith('src/') || !relativePath.endsWith('.js')) {
      return false;
    }
    
    // 排除A级文件
    if (this.levelAFiles.has(relativePath)) {
      return false;
    }
    
    // 检查是否在B级目录中
    const pathParts = relativePath.split('/');
    if (pathParts.length < 3) return false; // 至少是 src/xxx/file.js
    
    const dirName = pathParts[1]; // src/后面的目录名
    const isInLevelBDir = this.levelBDirs.has(dirName);
    
    if (!isInLevelBDir) {
      return false;
    }
    
    // 确保文件存在
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    return fsSync.existsSync(fullPath);
  }

  async generate() {
    console.log('🤖 生成AI助手项目指南...\n');
    
    // 先收集B级文件
    this.levelBFilesCache = await this.collectLevelBFiles();
    
    console.log('📊 文件分级统计:');
    console.log(`  A级: ${this.levelAFiles.size} 个文件（完整显示）`);
    console.log(`  B级: ${this.levelBFilesCache.length} 个文件（显示前50行）`);
    
    // 显示B级文件详情
    if (this.levelBFilesCache.length > 0) {
      console.log('\n📋 B级文件列表:');
      const byDir = {};
      this.levelBFilesCache.forEach(file => {
        const dir = path.dirname(file.path).replace('src/', '');
        if (!byDir[dir]) byDir[dir] = [];
        byDir[dir].push(path.basename(file.path));
      });
      
      Object.keys(byDir).sort().forEach(dir => {
        console.log(`  ${dir}/: ${byDir[dir].join(', ')}`);
      });
    }
    
    const guide = await this.buildGuide();
    const outputPath = path.join(PROJECT_ROOT, 'AI-PROJECT-GUIDE.md');
    
    await fs.writeFile(outputPath, guide, 'utf8');
    console.log(`\n✅ AI指南已生成: ${outputPath}`);
    
    console.log('\n🎯 使用说明:');
    console.log('  1. 复制整个 AI-PROJECT-GUIDE.md 内容给AI');
    console.log('  2. 或直接上传这个MD文件');
  }

  async collectLevelBFiles() {
    const levelBFiles = [];
    
    // 分别扫描每个B级目录
    for (const dirName of this.levelBDirs) {
      const dirPath = path.join(PROJECT_ROOT, 'src', dirName);
      
      if (fsSync.existsSync(dirPath)) {
        try {
          const items = await fs.readdir(dirPath);
          
          for (const item of items) {
            if (item.endsWith('.js')) {
              const filePath = `src/${dirName}/${item}`;
              const fullPath = path.join(PROJECT_ROOT, filePath);
              
              if (fsSync.existsSync(fullPath)) {
                const description = this.getFileDescription(filePath);
                levelBFiles.push({
                  path: filePath,
                  description: description,
                  dir: dirName
                });
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️  无法扫描 ${dirPath}:`, error.message);
        }
      }
    }
    
    return levelBFiles;
  }

  getFileDescription(filePath) {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath).split('/').pop();
    
    // 文件特定描述
    const fileDescriptions = {
      'Volunteer.js': '志愿者数据模型（Mongoose Schema）',
      'volunteerController.js': '志愿者业务逻辑控制器（CRUD操作）',
      'database.js': 'MongoDB数据库连接配置',
      'seedSimple.js': '数据库种子数据生成器',
      'errorHandler.js': '全局错误处理中间件'
    };
    
    if (fileDescriptions[fileName]) {
      return fileDescriptions[fileName];
    }
    
    // 目录通用描述
    const dirDescriptions = {
      'models': '数据模型文件',
      'controllers': '业务控制器',
      'utils': '工具函数',
      'middleware': '中间件'
    };
    
    return dirDescriptions[dirName] || '源代码文件';
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
    return `# 🤖 后端项目AI协作指南

## 🎯 项目信息
- **项目类型**: Node.js + Express + MongoDB 后端API
- **主要功能**: 志愿者管理系统的数据层和API接口
- **技术栈**: Express.js, Mongoose, RESTful API

## 📋 文件分级说明
- **⭐ A级文件**: 核心文件（完整显示）
  - 应用入口（src/server.js）
  - 依赖配置（package.json）
  - 所有路由文件（src/routes/*.js）
- **📋 B级文件**: 重要源码（显示前50行）
  - 数据模型（src/models/*.js）
  - 控制器（src/controllers/*.js）
  - 工具函数（src/utils/*.js）
  - 中间件（src/middleware/*.js）
- **📄 C级文件**: 其他文件（仅索引）
  - 脚本、数据、配置等文件

## ❓ 如何协作
1. 先阅读本指南了解项目结构
2. 可以请求任何文件的完整内容
3. 修改代码前请先确认理解需求

---
`;
  }

  async generateProjectStructure() {
    const tree = await this.buildFileTree(PROJECT_ROOT, 0);
    return `## 🗂️ 项目结构

\`\`\`
backend/
${tree}
\`\`\`

**图标说明**:
- ⭐ A级文件（完整显示）
- 📋 B级文件（显示前50行）
- 📄 C级文件（仅索引）

---
`;
  }

  async buildFileTree(dir, depth) {
    try {
      const items = await fs.readdir(dir);
      let tree = '';
      
      // 过滤忽略项
      const filteredItems = items.filter(item => 
        !['node_modules', '.git', '.DS_Store'].includes(item)
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
            tree += `${prefix}📁 ${item}/\n`;
            tree += await this.buildFileTree(fullPath, depth + 1);
          } else {
            const isLevelA = this.levelAFiles.has(relativePath);
            const isLevelB = this.levelBFilesCache?.some(f => f.path === relativePath) || false;
            const icon = this.getFileIcon(isLevelA, isLevelB);
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

  getFileIcon(isLevelA, isLevelB) {
    if (isLevelA) return '⭐';
    if (isLevelB) return '📋';
    return '📄';
  }

  async generateLevelAFiles() {
    let content = '## ⭐ A级文件（完整内容）\n\n';
    
    // 按路径排序显示
    const sortedFiles = Array.from(this.levelAFiles.entries()).sort((a, b) => 
      a[0].localeCompare(b[0])
    );
    
    for (const [filePath, description] of sortedFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      
      if (fsSync.existsSync(fullPath)) {
        try {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          content += await this.formatLevelAFile(filePath, description, fileContent);
        } catch (error) {
          content += `### ❌ 无法读取 ${filePath}\n\n`;
        }
      } else {
        content += `### ⚠️ 文件不存在: ${filePath}\n\n`;
      }
    }
    
    content += '---\n';
    return content;
  }

  async formatLevelAFile(filePath, description, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const lang = this.getCodeLang(ext);
    
    let formatted = `### ${fileName}\n`;
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
    
    // 按目录分组显示
    const filesByDir = {};
    this.levelBFilesCache.forEach(file => {
      if (!filesByDir[file.dir]) {
        filesByDir[file.dir] = [];
      }
      filesByDir[file.dir].push(file);
    });
    
    // 按目录排序
    const sortedDirs = Array.from(this.levelBDirs).filter(dir => filesByDir[dir]);
    
    for (const dir of sortedDirs) {
      const files = filesByDir[dir];
      content += `### src/${dir}/\n\n`;
      
      // 目录内按文件名排序
      const sortedFiles = files.sort((a, b) => 
        path.basename(a.path).localeCompare(path.basename(b.path))
      );
      
      for (const file of sortedFiles) {
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
    const categories = ['配置文件', '路由文件', '数据模型', '控制器', '中间件', '工具文件', '脚本文件', '数据文件', '文档文件', '其他文件'];
    
    for (const category of categories) {
      if (fileIndex[category] && fileIndex[category].length > 0) {
        const filesInCategory = fileIndex[category];
        content += `### ${category}\n\n`;
        
        filesInCategory.forEach(file => {
          const isLevelA = this.levelAFiles.has(file.path);
          const isLevelB = this.levelBFilesCache?.some(f => f.path === file.path) || false;
          
          let icon = '📄';
          if (isLevelA) icon = '⭐';
          else if (isLevelB) icon = '📋';
          
          content += `- ${icon} \`${file.path}\`\n`;
        });
        
        content += '\n';
      }
    }
    
    content += '---\n';
    content += `*生成时间: ${new Date().toLocaleString()}*\n`;
    
    return content;
  }

  async buildFileIndex(dir) {
    const categories = {
      '配置文件': [],
      '路由文件': [],
      '数据模型': [],
      '控制器': [],
      '中间件': [],
      '工具文件': [],
      '脚本文件': [],
      '数据文件': [],
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
        
        if (['node_modules', '.git', '.DS_Store'].some(pattern => fullPath.includes(pattern))) {
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
    
    // 路由文件
    if (dir.includes('routes') && ext === '.js') return '路由文件';
    
    // B级目录
    if (dir.includes('models')) return '数据模型';
    if (dir.includes('controllers')) return '控制器';
    if (dir.includes('middleware')) return '中间件';
    if (dir.includes('utils')) return '工具文件';
    
    // 其他分类
    if (dir.includes('scripts')) return '脚本文件';
    if (ext === '.json' && (dir.includes('data') || name.includes('data'))) return '数据文件';
    if (ext === '.md' || name.includes('README')) return '文档文件';
    if (name.match(/^\.|config|package|Dockerfile|nodemon/)) return '配置文件';
    
    return '其他文件';
  }

  getCodeLang(ext) {
    const langs = {
      '.js': 'javascript',
      '.json': 'json',
      '.md': 'markdown',
      '.ts': 'typescript'
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
const generator = new AIGuideGenerator();

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