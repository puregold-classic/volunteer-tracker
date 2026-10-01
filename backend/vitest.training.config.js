import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['integration/training-tags.test.js'], testTimeout: 30000, hookTimeout: 60000, fileParallelism: false } });
