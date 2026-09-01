import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/__tests__/**', 'node_modules/**', 'dist/**'],
    },
    // Set test environment variables
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-that-is-long-enough-for-testing-123456789',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-long-enough-987654321',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/webshield_test',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
