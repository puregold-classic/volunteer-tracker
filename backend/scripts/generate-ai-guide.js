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
    // 需要完整显示的文件
    this.fullContentFiles = new Map([
      ['src/server.js', '主服务器文件，Express应用入口和配置'],
      ['package.json', '项目依赖和npm脚本配置']
    ]);
  }

  async generate() {
    console.log('🤖 生成项目结构指南...\n');
    
    // 添加所有routes文件到完整显示列表
    await this.addRoutesFiles();
    
    const guide = await this.buildGuide();
    const outputPath = path.join(PROJECT_ROOT, 'PROJECT-GUIDE.md');
    
    await fs.writeFile(outputPath, guide, 'utf8');
    console.log(`\n✅ 项目指南已生成: ${outputPath}`);
  }

  async addRoutesFiles() {
    try {
      const routesDir = path.join(PROJECT_ROOT, 'src/routes');
      if (fsSync.existsSync(routesDir)) {
        const files = await fs.readdir(routesDir);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const filePath = `src/routes/${file}`;
            const routeName = file.replace('.js', '').replace('Routes', '').replace('routes', '');
            const description = `API路由文件：${routeName}相关接口`;
            this.fullContentFiles.set(filePath, description);
          }
        });
      }
    } catch (error) {
      console.warn('⚠️  无法扫描routes目录:', error.message);
    }
  }

  async buildGuide() {
    let content = '';
    
    content += await this.generateProjectStructure();
    content += await this.generateFullContentFiles();
    
    return content;
  }

  async generateProjectStructure() {
    const tree = await this.buildFileTree(PROJECT_ROOT, 0);
    return `# 项目结构指南

## 项目结构
\`\`\`
backend/
${tree}
\`\`\`

**说明**：
- 📁 目录
- 📄 普通文件
- 📋 routes/ 路由文件（完整显示）
- ⭐ 核心文件（完整显示）

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
            const isFullContent = this.fullContentFiles.has(relativePath);
            const icon = isFullContent ? '⭐' : '📄';
            
            // 如果是routes目录下的文件，使用特殊图标
            if (relativePath.startsWith('src/routes/') && relativePath.endsWith('.js')) {
              tree += `${prefix}📋 ${item}\n`;
            } else {
              tree += `${prefix}${icon} ${item}\n`;
            }
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

  async generateFullContentFiles() {
    let content = '## 完整文件内容\n\n';
    
    // 按路径排序显示
    const sortedFiles = Array.from(this.fullContentFiles.entries()).sort((a, b) => 
      a[0].localeCompare(b[0])
    );
    
    for (const [filePath, description] of sortedFiles) {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      
      if (fsSync.existsSync(fullPath)) {
        try {
          const fileContent = await fs.readFile(fullPath, 'utf8');
          content += await this.formatFileContent(filePath, description, fileContent);
        } catch (error) {
          content += `### ❌ 无法读取 ${filePath}\n\n`;
        }
      } else {
        content += `### ⚠️ 文件不存在: ${filePath}\n\n`;
      }
    }
    
    content += `*生成时间: ${new Date().toLocaleString()}*\n`;
    return content;
  }

  async formatFileContent(filePath, description, content) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const lang = this.getCodeLang(ext);
    
    let formatted = `### ${fileName}\n`;
    formatted += `**路径**: \`${filePath}\`\n`;
    formatted += `**说明**: ${description}\n\n`;
    formatted += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
    
    return formatted;
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