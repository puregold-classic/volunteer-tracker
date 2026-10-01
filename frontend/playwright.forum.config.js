import { defineConfig } from 'playwright/test';
if (!process.env.FORUM_E2E_URL || process.env.FORUM_E2E !== '1') {
  throw new Error('Run npm run test:e2e:forum from backend to create an isolated database.');
}
export default defineConfig({
  testDir: './e2e', testMatch: 'forum.spec.js', workers: 1, retries: 0, timeout: 45_000,
  grep: process.env.FORUM_E2E_GREP ? new RegExp(process.env.FORUM_E2E_GREP) : undefined,
  outputDir: process.env.FORUM_E2E_OUTPUT || '/tmp/volunteer-forum-e2e-results',
  use: { baseURL: process.env.FORUM_E2E_URL, headless: true, viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
