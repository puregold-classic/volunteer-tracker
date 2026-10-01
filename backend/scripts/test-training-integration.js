// Runs ONLY against a new disposable PostgreSQL container. No application .env
// or external DATABASE_URL is used. Clients are generated into a temporary dir
// so host/container ownership of node_modules/.prisma does not affect this run.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import prismaPlatform from '@prisma/get-platform';
import prismaEngines from '@prisma/engines';

const { getBinaryTargetForCurrentPlatform, getNodeAPIName } = prismaPlatform;
const { getEnginesPath } = prismaEngines;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workdir = mkdtempSync(path.join(tmpdir(), 'vt-training-integration-'));
symlinkSync(path.join(root, 'node_modules'), path.join(workdir, 'node_modules'), 'dir');
const container = `vt-training-test-${randomUUID().slice(0, 8)}`;
const migration = '20260922010000_training_sessions';
const platform = await getBinaryTargetForCurrentPlatform();
const env = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: 'forum-isolated-test-only-secret',
  TRAINING_E2E: process.argv.includes('--e2e') ? '1' : '0',
  BCRYPT_SALT_ROUNDS: '4',
  ADMIN_EMAIL: 'reset-admin@example.test',
  ADMIN_NAME: '测试管理员',
  ADMIN_PASSWORD: 'TestOnly@123',
  PRISMA_QUERY_ENGINE_LIBRARY: path.join(getEnginesPath(), getNodeAPIName(platform, 'fs')),
  PRISMA_SCHEMA_ENGINE_BINARY: path.join(getEnginesPath(), `schema-engine-${platform}`),
  PRISMA_GENERATE_SKIP_AUTOINSTALL: '1',
  TRAINING_TEST_WORKDIR: workdir,
};
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
const cli = (...args) => execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...args], { cwd: root, env, stdio: 'pipe', timeout: 60_000 });
let started = false;
try {
  docker('run', '--detach', '--rm', '--name', container, '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=forum_test', '--env', 'POSTGRES_PASSWORD=forum_test_local',
    '--env', 'POSTGRES_DB=forum_test', '--tmpfs', '/var/lib/postgresql/data', 'postgres:16-alpine');
  started = true;
  env.TRAINING_TEST_CONTAINER = container;
  const port = docker('port', container, '5432/tcp').trim().split(':').at(-1);
  env.DATABASE_URL = `postgresql://forum_test:forum_test_local@127.0.0.1:${port}/forum_test`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'forum_test', '-d', 'forum_test');
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!ready) throw new Error('Temporary PostgreSQL did not become ready');

  const oldDir = path.join(workdir, 'before');
  mkdirSync(path.join(oldDir, 'migrations'), { recursive: true });
  for (const entry of readdirSync(path.join(root, 'prisma/migrations'))) {
    if (entry === 'migration_lock.toml' || entry < migration) {
      cpSync(path.join(root, 'prisma/migrations', entry), path.join(oldDir, 'migrations', entry), { recursive: true });
    }
  }
  const oldSchema = path.join(oldDir, 'schema.prisma');
  // Start from the mapped schema so introspection preserves Chinese enum mappings.
  writeFileSync(oldSchema, readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
    .replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../old-client"'));
  console.log('Applying pre-training migrations to an empty temporary database…');
  cli('migrate', 'deploy', '--schema', oldSchema);
  cli('db', 'pull', '--schema', oldSchema);
  cli('generate', '--schema', oldSchema);

  const nextDir = path.join(workdir, 'after');
  mkdirSync(nextDir);
  cpSync(path.join(root, 'prisma/migrations'), path.join(nextDir, 'migrations'), { recursive: true });
  const schema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
    .replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output = "../new-client"');
  writeFileSync(path.join(nextDir, 'schema.prisma'), schema);
  cli('generate', '--schema', path.join(nextDir, 'schema.prisma'));
  execFileSync(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.training.config.js'], { cwd: root, env, stdio: 'inherit', timeout: 180_000 });
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    try { docker('stop', container); } catch (error) { console.error('Could not stop test container:', error.message); process.exitCode = 1; }
  }
  rmSync(workdir, { recursive: true, force: true });
}
