import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../tests/docs',
  testMatch: '*.spec.mts',
  use: { browserName: 'chromium', headless: true },
  outputDir: '../../.codex-tmp/docs-playwright',
  reporter: 'list',
});
