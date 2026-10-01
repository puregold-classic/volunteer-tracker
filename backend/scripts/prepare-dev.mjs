import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, PRISMA_SKIP_POSTINSTALL_GENERATE: 'true' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
const fingerprint = createHash('sha256')
  .update(readFileSync('package-lock.json')).update(readFileSync('package.json'))
  .update(`${process.version}:${process.platform}:${process.arch}`).digest('hex');
const marker = 'node_modules/.dev-dependencies';
if (!existsSync('node_modules/.bin/prisma') || !existsSync('node_modules/.bin/nodemon') ||
    !existsSync(marker) || readFileSync(marker, 'utf8') !== fingerprint) {
  console.log('  → 安装后端依赖到 Docker 数据卷（依赖未变时会跳过）');
  run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund']);
  writeFileSync(marker, fingerprint);
} else {
  console.log('  → 后端依赖未变化，复用已有依赖');
}
console.log('  → 生成 Prisma Client');
run('node', ['node_modules/prisma/build/index.js', 'generate']);
console.log('  → 应用尚未执行的数据库迁移（不运行 seed）');
run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
