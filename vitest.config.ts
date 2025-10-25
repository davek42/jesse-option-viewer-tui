// AIDEV-NOTE: Vitest configuration for test coverage and reporting

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        'src/index.tsx',
        'src/test-api.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'dist/',
      ],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
