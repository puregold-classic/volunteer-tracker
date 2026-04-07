import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/services/VolunteerService.js',
        'src/services/AuthService.js',
        'src/services/ApplicationService.js',
      ],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
