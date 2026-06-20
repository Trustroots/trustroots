const fs = require('fs');
const path = require('path');

const captureScreenshots = process.env.TRUSTROOTS_E2E_SCREENSHOTS === 'true';
const screenshotsDir =
  process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR ||
  path.join(__dirname, '../../../tmp/screenshots');

function sanitizeFileName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

async function captureEndOfTestScreenshot(page, testInfo) {
  if (!captureScreenshots || page.isClosed()) {
    return;
  }

  try {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const failed = testInfo.status !== testInfo.expectedStatus;
    const fileName = [
      sanitizeFileName(testInfo.project.name),
      sanitizeFileName(testInfo.title),
      testInfo.retry,
      testInfo.repeatEachIndex,
      failed ? 'FAILED' : null,
    ]
      .filter(Boolean)
      .join('-');
    await page.screenshot({
      path: path.join(screenshotsDir, `${fileName}.png`),
      fullPage: true,
    });
  } catch (error) {
    // Screenshot capture is best-effort and must not fail the test run.
  }
}

module.exports = {
  captureEndOfTestScreenshot,
  sanitizeFileName,
};
