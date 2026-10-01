import { defineConfig } from 'playwright/test';
if (!process.env.TRAINING_E2E_URL || process.env.TRAINING_E2E !== '1') throw new Error('Run backend/scripts/test-training-integration.js --e2e for an isolated database.');
export default defineConfig({
  testDir: './e2e', testMatch: 'training-tags.spec.js', workers: 1, retries: 0, timeout: 60000,
  outputDir: '/tmp/volunteer-training-e2e-results',
  use: { baseURL: process.env.TRAINING_E2E_URL, headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
