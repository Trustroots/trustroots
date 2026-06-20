const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const {
  annotateFeature,
  featureAnnotation,
} = require('../../../scripts/e2e/feature-coverage-summary');

const coverageDir = path.join(__dirname, '../../../coverage/e2e/js-raw');
const collectCoverage = process.env.TRUSTROOTS_E2E_SKIP_JS_COVERAGE !== 'true';

function sanitizeFileName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

const test = base.extend({
  page: async ({ browserName, page }, use, testInfo) => {
    if (!collectCoverage || browserName !== 'chromium') {
      await use(page);
      return;
    }

    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const coverage = await page.coverage.stopJSCoverage();
    if (coverage.length === 0) {
      return;
    }

    fs.mkdirSync(coverageDir, { recursive: true });
    const fileName = [
      sanitizeFileName(testInfo.project.name),
      sanitizeFileName(testInfo.title),
      testInfo.retry,
      testInfo.repeatEachIndex,
    ].join('-');
    fs.writeFileSync(
      path.join(coverageDir, `${fileName}.json`),
      `${JSON.stringify(coverage)}\n`,
    );
  },
});

module.exports = {
  test,
  expect,
  annotateFeature,
  featureAnnotation,
};
