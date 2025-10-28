import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'build/', '**/*.config.{js,ts}', '**/dist/'],
    },
  },
  resolve: {
    alias: {
      // Handle ESM .js extensions in imports for TypeScript files
      '~': new URL('./src/', import.meta.url).pathname,
    },
  },
});
