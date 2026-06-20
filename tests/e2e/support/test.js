const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const {
  annotateFeature,
  featureAnnotation,
} = require('../../../scripts/e2e/feature-coverage-summary');
const {
  captureEndOfTestScreenshot,
  sanitizeFileName,
} = require('./screenshot-capture');

const coverageDir = path.join(__dirname, '../../../coverage/e2e/js-raw');
const collectCoverage = process.env.TRUSTROOTS_E2E_SKIP_JS_COVERAGE !== 'true';

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!collectCoverage) {
      await use(page);
      await captureEndOfTestScreenshot(page, testInfo);
      return;
    }

    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    await captureEndOfTestScreenshot(page, testInfo);
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
