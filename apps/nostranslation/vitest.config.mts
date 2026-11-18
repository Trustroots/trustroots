import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.mts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    define: {
      __NOSTRANSLATION_API_URL__: JSON.stringify(
        'https://translation-api.example',
      ),
    },
    test: {
      include: ['apps/nostranslation/tests/**/*.tests.{ts,tsx}'],
      environment: 'jsdom',
      // Match the Jest default the tests were written against.
      environmentOptions: { jsdom: { url: 'http://localhost/' } },
      globals: true,
      setupFiles: ['./apps/nostranslation/tests/setup.ts'],
      coverage: {
        provider: 'v8',
        include: [
          'apps/nostranslation/shared.ts',
          'apps/nostranslation/client/**/*.{ts,tsx}',
          'apps/nostranslation/server/**/*.mts',
        ],
        exclude: [
          '**/*.d.ts',
          '**/main.tsx',
          '**/start.mts',
          '**/worker.mts',
          '**/check.mts',
        ],
        reportsDirectory: 'coverage/nostranslation',
        reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  }),
);
