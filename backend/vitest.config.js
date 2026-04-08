import { defineConfig } from 'vitest/config';

// v2.1 — coverage focused on services that contain v2.1-specific logic
// (state machines, validation, atomic creation). Reference-data services
// (Department, ServiceItem) are mostly thin Prisma wrappers and are
// spot-checked instead of fully covered.

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/services/ProjectSupportService.js',
        'src/services/AccountService.js',
        'src/services/SystemSettingsService.js',
        'src/services/AuthService.js',
        'src/services/VolunteerService.js',
      ],
      // 较温和的阈值。我们重点测了写入路径（state machine、validation、auth gating）；
      // 纯 read methods（list / findBy* / aggregate）大部分是 prisma 透传，
      // 测它们就是测 mock 本身，不增加真实信心 → 不强制 80%。
      thresholds: { lines: 60, functions: 70, branches: 55 },
    },
  },
});
