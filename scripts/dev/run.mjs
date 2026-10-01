import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
const frontend = path.join(root, 'frontend');
const url = 'http://localhost:3000';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();
const lock = path.join(root, '.local-notes/dev-runner.pid');
const prepareName = `volunteer-dev-prepare-${process.pid}`;
// Pin the development compose file; never pick up a deployment COMPOSE_FILE.
const composeArgs = ['compose', '--ansi', 'never', '--progress', 'plain', '-f', path.join(root, 'docker-compose.yml')];
let stopping = false;
let ownsLock = false;
let dockerStarted = false;
let cleanupPromise;

function launch(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit'], detached: process.platform !== 'win32', ...options,
  });
  children.add(child);
  child.done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  child.done.catch(() => {}).finally(() => children.delete(child));
  return child;
}
async function run(command, args, options) {
  if (stopping) throw new Error('启动已取消');
  const result = await launch(command, args, options).done;
  if (stopping) throw new Error('启动已取消');
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')} 执行失败（${result.code ?? result.signal}）`);
}
const compose = (...args) => run('docker', [...composeArgs, ...args]);
function stopChild(child, signal = 'SIGTERM') {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
}
function cleanup() {
  return cleanupPromise ??= (async () => {
    stopping = true;
    if (ownsLock) console.log('\n[退出] 停止前端和启动任务…');
    const active = [...children];
    active.forEach((child) => stopChild(child));
    await Promise.race([Promise.allSettled(active.map((child) => child.done)), delay(5000, undefined, { ref: false })]);
    active.forEach((child) => stopChild(child, 'SIGKILL'));
    try {
      if (dockerStarted) {
        // A cancelled `compose run` can leave its one-off container behind.
        await launch('docker', ['rm', '-f', prepareName], { stdio: 'ignore' }).done.catch(() => {});
        console.log('[退出] 停止后端和 PostgreSQL，保留数据库及依赖数据卷…');
        const result = await launch('docker', [...composeArgs, 'stop', '-t', '10', 'backend', 'postgres']).done;
        if (result.code !== 0) throw new Error('容器停止失败，请运行：docker compose -f docker-compose.yml stop backend postgres');
      }
    } finally {
      if (ownsLock) unlinkSync(lock);
    }
    if (ownsLock && !process.exitCode) console.log('[退出] 开发环境已关闭，数据已保留。');
  })();
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    console.log(`\n收到 ${signal}，正在关闭开发环境…`);
    cleanup().then(() => process.exit(process.exitCode || 0)).catch((error) => {
      console.error(error.message); process.exit(1);
    });
  });
}
function acquireLock() {
  mkdirSync(path.dirname(lock), { recursive: true });
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`启动锁异常，请检查 ${lock}`);
    try { process.kill(pid, 0); throw new Error('已有开发启动脚本正在运行，请先在原终端按 Ctrl+C。'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(lock);
  }
  writeFileSync(lock, String(process.pid), { flag: 'wx' });
  ownsLock = true;
}
async function checkFrontendPort() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('端口 3000 不可用，请先停止已有前端服务，再运行 npm run dev。')));
    server.listen(3000, () => server.close(resolve));
  });
}
async function waitFor(label, target, healthy, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (stopping) throw new Error('启动已取消');
    if (child && (child.exitCode !== null || child.signalCode)) throw new Error(`${label}进程提前退出`);
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(2000) });
      if (response.ok && await healthy(response)) return;
    } catch { /* Retry until the service is ready. */ }
    if (attempt % 5 === 0) console.log(`  → 等待${label}就绪…`);
    await delay(1000);
  }
  throw new Error(`${label}在等待时间内未就绪：${target}`);
}
async function prepareFrontend() {
  const fingerprint = createHash('sha256').update(readFileSync(path.join(frontend, 'package-lock.json')))
    .update(readFileSync(path.join(frontend, 'package.json')))
    .update(`${process.version}:${process.platform}:${process.arch}`).digest('hex');
  const marker = path.join(frontend, 'node_modules/.dev-dependencies');
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== fingerprint || !existsSync(path.join(frontend, 'node_modules/vite/bin/vite.js'))) {
    await run(npm, ['ci', '--no-audit', '--no-fund'], { cwd: frontend });
    writeFileSync(marker, fingerprint);
  } else console.log('  → 前端依赖未变化，复用已有依赖');
}
async function openBrowser() {
  if (process.env.BROWSER === 'none') {
    console.log(`  → BROWSER=none，跳过自动打开；请访问 ${url}`);
    return;
  }
  const isWsl = process.platform === 'linux' && /microsoft/i.test(readFileSync('/proc/sys/kernel/osrelease', 'utf8'));
  const candidates = process.platform === 'darwin' ? [['open', [url]]]
    : process.platform === 'win32' ? [['cmd.exe', ['/c', 'start', '', url]]]
    : isWsl ? [['wslview', [url]], ['cmd.exe', ['/c', 'start', '', url]], ['xdg-open', [url]]]
    : [['xdg-open', [url]]];
  for (const [command, args] of candidates) {
    const child = launch(command, args, { stdio: 'ignore' });
    const result = await Promise.race([child.done.catch(() => ({ code: 1 })), delay(3000, { code: 0 }, { ref: false })]);
    if (result.code === 0) {
      // The browser belongs to the user and should survive shutting down dev.
      children.delete(child);
      child.unref();
      console.log('  → 已请求系统浏览器打开网页'); return;
    }
  }
  console.log(`  → 无法自动打开浏览器，请手动访问 ${url}`);
}

try {
  console.log('\n[1/7] 检查 Node.js、Docker 和端口');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!(major === 20 && minor >= 19 || major === 22 && minor >= 12 || major > 22)) throw new Error('请使用 Node.js 20.19+ 或 22.12+（建议 Node.js 22 LTS）。');
  acquireLock();
  await checkFrontendPort();
  await compose('version');
  await run('docker', ['info'], { stdio: 'ignore' }).catch(() => { throw new Error('Docker 引擎未运行或当前账号无访问权限，请启动 Docker Desktop / Docker 服务后重试。'); });

  console.log('\n[2/7] 检查并安装前端依赖');
  await prepareFrontend();
  console.log('\n[3/7] 构建后端 Docker 镜像（复用构建缓存）');
  await compose('build', 'backend');
  dockerStarted = true;
  console.log('\n[4/7] 启动 PostgreSQL，准备后端依赖与数据库');
  await compose('up', '-d', '--wait', '--wait-timeout', '90', 'postgres');
  // Stop an older backend before changing its shared dependencies or schema.
  await compose('stop', 'backend');
  await compose('run', '-T', '--rm', '--no-deps', '--user', 'root', '--name', prepareName, 'backend', 'node', 'scripts/prepare-dev.mjs');

  console.log('\n[5/7] 启动后端并检查数据库连接');
  await compose('up', '-d', '--no-deps', 'backend');
  await waitFor('后端', 'http://127.0.0.1:5000/api/health', async (response) => {
    const health = await response.json(); return health.status === 'ok' && health.postgresql === 'connected';
  });
  console.log('\n[6/7] 启动前端（端口 3000）');
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '3000', '--strictPort', '--clearScreen', 'false'], {
    cwd: frontend, env: { ...process.env, BROWSER: 'none' },
  });
  await waitFor('前端', 'http://127.0.0.1:3000', async () => true, vite);
  console.log('\n[7/7] 打开网页');
  await openBrowser();
  console.log(`\n开发环境已就绪：${url}\n后端：http://localhost:5000\n未运行 seed。按 Ctrl+C 关闭整套开发环境，保留数据。\n`);
  const result = await vite.done;
  if (!stopping) throw new Error(`前端已退出（${result.code ?? result.signal}），正在关闭开发环境。`);
} catch (error) {
  if (!stopping) { console.error(`\n启动失败：${error.message}`); process.exitCode = 1; }
} finally {
  await cleanup();
}
