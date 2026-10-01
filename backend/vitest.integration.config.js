import { defineConfig } from 'vitest/config';

if (!process.env.FORUM_TEST_WORKDIR || !process.env.DATABASE_URL?.match(/^postgresql:\/\/forum_test:forum_test_local@127\.0\.0\.1:\d+\/forum_test$/)) {
  throw new Error('Run npm run test:integration:forum; a disposable database is required.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['integration/forum-foundation.test.js'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});
