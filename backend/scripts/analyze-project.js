#!/usr/bin/env node
// cd backend
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
  '.js', '.jsx', '.ts', '.tsx', '.json', 
  '.html', '.css', '.scss', '.md', '.txt'
]);

const CONFIG_FILES = new Set([
  'package.json', 'package-lock.json', 
  'nodemon.json', '.env', '.env.example',
  'Dockerfile', 'Dockerfile.dev'
]);

const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.DS_Store/
];

// 文件分类
const CATEGORIES = {
  config: '配置文件',
  source: '源代码',
  script: '脚本',
  test: '测试',
  docker: 'Docker配置',
  data: '数据文件',
  doc: '文档',
  other: '其他'
};

class ProjectAnalyzer {
  constructor() {
    this.structure = {};
    this.fileCounts = {};
    this.totalFiles = 0;
  }

  shouldIgnore(filePath) {
    return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
  }

  getCategory(filename) {
    if (CONFIG_FILES.has(filename) || filename.endsWith('.json')) {
      return 'config';
    }
    if (filename.includes('Dockerfile')) {
      return 'docker';
    }
    if (filename.includes('test') || filename.includes('spec')) {
      return 'test';
    }
    if (filename.startsWith('scripts') || path.dirname(filename).includes('scripts')) {
      return 'script';
    }
    if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.ts') || filename.endsWith('.tsx')) {
      return 'source';
    }
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      return 'doc';
    }
    if (filename.endsWith('.json')) {
      return 'data';
    }
    return 'other';
  }

  getFileInfo(filePath, stats) {
    const ext = path.extname(filePath);
    const category = this.getCategory(path.basename(filePath));
    
    return {
      path: filePath,
      name: path.basename(filePath),
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
      const textExtensions = ['.js', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml'];
      const ext = path.extname(filePath);
      
      if (!textExtensions.includes(ext) || this.shouldIgnore(filePath)) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      
      // 限制文件大小，避免内存问题
      if (content.length > 100000) { // 100KB
        return `⚠️ 文件过大，仅显示前10000字符\n${content.substring(0, 10000)}...`;
      }
      
      return content;
    } catch (error) {
      return `❌ 读取失败: ${error.message}`;
    }
  }

  async buildTree(dir, indent = 0) {
    const items = await fs.readdir(dir);
    let treeString = '';
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const fullPath = path.join(dir, item);
      
      if (this.shouldIgnore(fullPath)) {
        continue;
      }
      
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
    }
    
    return treeString;
  }

  getFileIcon(filename, ext) {
    const icons = {
      '.js': '📜',
      '.json': '📋',
      '.md': '📝',
      '.html': '🌐',
      '.css': '🎨',
      '.jsx': '⚛️',
      '.ts': '📘',
      '.tsx': '⚛️📘',
      '.yml': '⚙️',
      '.yaml': '⚙️',
      '.lock': '🔒',
      '.gitignore': '👁️',
      '.env': '🔐',
      'Dockerfile': '🐳',
      'nodemon': '🔄'
    };
    
    if (icons[ext]) return icons[ext];
    if (filename.includes('Dockerfile')) return '🐳';
    if (filename.includes('nodemon')) return '🔄';
    if (filename.includes('package')) return '📦';
    
    return '📄';
  }

  async analyzeDirectory(dir, relativePath = '') {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const itemRelativePath = path.join(relativePath, item);
      
      if (this.shouldIgnore(fullPath)) {
        continue;
      }
      
      const stats = await fs.stat(fullPath);
      const fileInfo = this.getFileInfo(fullPath, stats);
      
      if (stats.isDirectory()) {
        // 递归分析目录
        await this.analyzeDirectory(fullPath, itemRelativePath);
      } else {
        // 记录文件信息
        if (!this.structure[relativePath]) {
          this.structure[relativePath] = [];
        }
        
        const content = await this.readFileContent(fullPath);
        fileInfo.content = content;
        this.structure[relativePath].push(fileInfo);
        
        // 统计
        this.totalFiles++;
        this.fileCounts[fileInfo.category] = (this.fileCounts[fileInfo.category] || 0) + 1;
      }
    }
  }

  generateSummary() {
    let summary = '# 📊 项目分析报告\n\n';
    
    summary += '## 📈 项目概览\n\n';
    summary += `- **总文件数**: ${this.totalFiles}\n`;
    summary += '- **文件类型分布**:\n';
    
    Object.entries(this.fileCounts).forEach(([category, count]) => {
      const percentage = ((count / this.totalFiles) * 100).toFixed(1);
      summary += `  - ${CATEGORIES[category]}: ${count} (${percentage}%)\n`;
    });
    
    summary += '\n## 🗂️ 项目结构树\n\n```\n';
    summary += 'backend/\n';
    return summary;
  }

  generateFileDetails() {
    let details = '\n## 📋 文件详情\n\n';
    
    Object.entries(this.structure).forEach(([dirPath, files]) => {
      if (files.length > 0) {
        const dirName = dirPath || '根目录';
        details += `### 📁 ${dirName || '/'}\n\n`;
        
        files.forEach(file => {
          details += `#### 📄 ${file.name}\n`;
          details += `- **路径**: ${file.relativePath}\n`;
          details += `- **大小**: ${this.formatBytes(file.size)}\n`;
          details += `- **类型**: ${CATEGORIES[file.category]}\n`;
          details += `- **最后修改**: ${file.lastModified.toLocaleString()}\n`;
          
          if (file.content) {
            details += `\n**内容预览**:\n\n\`\`\`${this.getCodeBlockLang(file.extension)}\n`;
            details += file.content.substring(0, 5000);
            if (file.content.length > 5000) {
              details += '\n... (内容截断，完整内容见文件)';
            }
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
      '.json': 'json',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.yml': 'yaml',
      '.yaml': 'yaml',
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

  async generateReadme() {
    const tree = await this.buildTree(PROJECT_ROOT);
    
    let output = this.generateSummary();
    output += tree;
    output += '```\n';
    output += this.generateFileDetails();
    
    // 添加关键文件分析
    output += '\n## 🔑 关键文件分析\n\n';
    
    // 分析 package.json
    try {
      const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
      if (fsSync.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        output += '### 📦 package.json\n\n';
        output += `- **项目名称**: ${packageJson.name || '未指定'}\n`;
        output += `- **版本**: ${packageJson.version || '未指定'}\n`;
        output += `- **主要依赖**:\n`;
        
        const deps = packageJson.dependencies || {};
        Object.entries(deps).forEach(([dep, version]) => {
          output += `  - ${dep}: ${version}\n`;
        });
        
        if (packageJson.scripts) {
          output += `\n- **可用脚本**:\n`;
          Object.entries(packageJson.scripts).forEach(([script, command]) => {
            output += `  - \`npm run ${script}\`: ${command}\n`;
          });
        }
      }
    } catch (error) {
      output += '❌ 无法分析 package.json\n';
    }
    
    // Docker配置
    const dockerFiles = ['Dockerfile', 'Dockerfile.dev'];
    dockerFiles.forEach(dockerFile => {
      const dockerPath = path.join(PROJECT_ROOT, dockerFile);
      if (fsSync.existsSync(dockerPath)) {
        output += `\n### 🐳 ${dockerFile}\n`;
        output += `📎 位置: ${path.relative(PROJECT_ROOT, dockerPath)}\n`;
      }
    });
    
    // 环境配置
    const envFiles = ['.env', '.env.example'];
    envFiles.forEach(envFile => {
      const envPath = path.join(PROJECT_ROOT, envFile);
      if (fsSync.existsSync(envPath)) {
        output += `\n### 🔧 ${envFile}\n`;
        output += `📎 位置: ${path.relative(PROJECT_ROOT, envPath)}\n`;
      }
    });
    
    output += '\n## 🚀 如何运行\n\n';
    output += '```bash\n';
    output += '# 安装依赖\n';
    output += 'npm install\n\n';
    output += '# 启动开发服务器\n';
    output += 'npm run dev\n\n';
    output += '# 初始化数据库\n';
    output += 'npm run seed\n\n';
    output += '# 运行测试\n';
    output += 'npm run test\n';
    output += '```\n';
    
    output += '\n## 📡 API端点\n\n';
    output += '```text\n';
    output += 'GET    /api/v1/volunteers          # 获取所有志愿者\n';
    output += 'GET    /api/v1/volunteers/:id      # 获取单个志愿者\n';
    output += 'POST   /api/v1/volunteers          # 创建志愿者\n';
    output += 'PUT    /api/v1/volunteers/:id      # 更新志愿者\n';
    output += 'DELETE /api/v1/volunteers/:id      # 删除志愿者\n';
    output += 'GET    /api/v1/volunteers/stats    # 获取统计信息\n';
    output += 'GET    /api/health                 # 健康检查\n';
    output += '```\n';
    
    output += '\n---\n';
    output += `*生成时间: ${new Date().toLocaleString()}*\n`;
    output += `*分析工具: backend/scripts/analyze-project.js*\n`;
    
    return output;
  }

  async saveReport(output) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(PROJECT_ROOT, `project-analysis-${timestamp}.md`);
    
    await fs.writeFile(outputPath, output, 'utf8');
    console.log(`✅ 分析报告已保存: ${outputPath}`);
    return outputPath;
  }

  async run() {
    console.log('🔍 开始分析项目结构...\n');
    
    try {
      // 分析项目目录
      await this.analyzeDirectory(PROJECT_ROOT);
      
      // 生成报告
      const report = await this.generateReadme();
      
      // 保存报告
      const outputPath = await this.saveReport(report);
      
      console.log('\n📊 分析完成！');
      console.log(`📁 总分析文件数: ${this.totalFiles}`);
      console.log(`📝 报告已生成: ${path.relative(process.cwd(), outputPath)}`);
      console.log('\n🎯 你可以将此文件发送给AI助手，它会完全理解你的项目结构！');
      
    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      process.exit(1);
    }
  }
}

// 创建快捷脚本
async function createQuickScript() {
  const quickScript = `#!/usr/bin/env node

// 快速分析脚本 - 生成精简版报告
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

async function quickAnalyze() {
  console.log('⚡ 快速项目分析...\\n');
  
  // 1. 检查关键文件
  const keyFiles = [
    'package.json',
    'Dockerfile',
    'Dockerfile.dev',
    'nodemon.json',
    'src/server.js',
    'src/models/Volunteer.js',
    'src/routes/volunteerRoutes.js',
    'src/controllers/volunteerController.js'
  ];
  
  console.log('📋 关键文件检查:');
  keyFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(\`  ✅ \${file}\`);
    } else {
      console.log(\`  ❌ \${file} (未找到)\`);
    }
  });
  
  // 2. 读取package.json信息
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    console.log(\`\\n📦 项目信息:\`);
    console.log(\`  名称: \${packageData.name}\`);
    console.log(\`  版本: \${packageData.version}\`);
    console.log(\`  描述: \${packageData.description || '无'}\`);
    
    if (packageData.scripts) {
      console.log(\`\\n🚀 可用命令:\`);
      Object.entries(packageData.scripts).forEach(([cmd, script]) => {
        console.log(\`  npm run \${cmd.padEnd(15)} → \${script}\`);
      });
    }
  } catch (error) {
    console.log('❌ 无法读取package.json');
  }
  
  // 3. 生成简单结构
  console.log(\`\\n🗂️ 项目结构概览:\`);
  console.log(\`backend/\`);
  console.log(\`├── src/\`);
  console.log(\`│   ├── models/        # 数据模型\`);
  console.log(\`│   ├── controllers/   # 控制器\`);
  console.log(\`│   ├── routes/        # 路由\`);
  console.log(\`│   ├── utils/         # 工具函数\`);
  console.log(\`│   └── middleware/    # 中间件\`);
  console.log(\`├── scripts/           # 脚本\`);
  console.log(\`├── data/              # 数据文件\`);
  console.log(\`├── package.json       # 依赖配置\`);
  console.log(\`├── Dockerfile         # 生产环境镜像\`);
  console.log(\`└── Dockerfile.dev     # 开发环境镜像\`);
  
  console.log(\`\\n🔧 技术栈:\`);
  console.log(\`  - 后端: Node.js + Express\`);
  console.log(\`  - 数据库: MongoDB + Mongoose\`);
  console.log(\`  - 容器化: Docker\`);
  console.log(\`  - 开发工具: Nodemon\`);
  
  console.log(\`\\n🎯 快速启动:\`);
  console.log(\`  1. npm install              # 安装依赖\`);
  console.log(\`  2. 启动MongoDB服务\`);
  console.log(\`  3. npm run seed             # 初始化数据\`);
  console.log(\`  4. npm run dev              # 启动开发服务器\`);
  console.log(\`\\n📡 API运行在: http://localhost:5000\`);
}

quickAnalyze().catch(console.error);
`;

  const quickScriptPath = path.join(PROJECT_ROOT, 'scripts', 'quick-analyze.js');
  await fs.writeFile(quickScriptPath, quickScript, 'utf8');
  console.log(`⚡ 快速分析脚本已创建: scripts/quick-analyze.js`);
  console.log(`👉 使用: node scripts/quick-analyze.js`);
}

// 运行主分析
const analyzer = new ProjectAnalyzer();

// 检查是否有快速分析参数
if (process.argv.includes('--quick') || process.argv.includes('-q')) {
  createQuickScript();
} else {
  analyzer.run();
}