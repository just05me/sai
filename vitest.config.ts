import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
});
