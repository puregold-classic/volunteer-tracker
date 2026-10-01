import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The application uses the same real, disposable DB as the integration tests.
// Playwright signs in through the normal UI; no tokens or API responses mocked.
export async function runForumBrowser(app) {
  const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend');
  const server = await new Promise((resolve) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const env = { ...process.env, BROWSER: 'none', VITE_APP_ENV: 'test', VITE_API_BASE_URL: `http://127.0.0.1:${server.address().port}/api`, FORUM_E2E_URL: `http://127.0.0.1:${port}` };
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: frontend, env, stdio: 'pipe' });
  let logs = '';
  vite.stdout.on('data', (data) => { logs = (logs + data).slice(-4000); });
  vite.stderr.on('data', (data) => { logs = (logs + data).slice(-4000); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (vite.exitCode !== null) throw new Error(`Vite stopped: ${logs}`);
      try { if ((await fetch(env.FORUM_E2E_URL)).ok) { ready = true; break; } } catch { /* starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error(`Vite did not start: ${logs}`);
    await new Promise((resolve, reject) => {
      const test = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', '--config', 'playwright.forum.config.js'], { cwd: frontend, env, stdio: 'inherit' });
      test.on('error', reject);
      test.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Forum browser tests failed (${code})`)));
    });
  } finally {
    vite.kill('SIGTERM');
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
}
