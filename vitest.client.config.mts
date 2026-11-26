import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.mts';

// Client unit tests reuse the app's Vite config and aliases.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['modules/*/tests/client/**/*.tests.{js,jsx,ts,tsx}'],
      environment: 'jsdom',
      // Match the Jest default the tests were written against.
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      globals: true,
      setupFiles: ['./testutils/client/vitest.setup.ts'],
      coverage: {
        provider: 'v8',
        include: [
          'modules/*/client/**/*.{ts,tsx}',
          'layers/shell/**/*.{ts,tsx}',
          'packages/analytics/client/**/*.{ts,tsx}',
          'packages/relative-time/*.mts',
          'packages/ui/src/**/*.{ts,tsx}',
        ],
        exclude: [
          'packages/ui/src/**/*.stories.tsx',
          'modules/core/client/types.d.ts',
          'modules/*/tests/**',
          'modules/*/client/**/*.d.ts',
          'modules/*/client/**/views/**',
          'modules/*/client/**/less/**',
        ],
        reportsDirectory: 'coverage/client',
        reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      },
    },
  }),
);
