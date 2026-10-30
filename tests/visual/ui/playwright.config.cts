const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /(shoot|styles|diff)\.spec\.ts/,
  outputDir: require('node:path').join(__dirname, 'test-results'),
  reporter: [['list']],
  workers: 4,
  use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
});
