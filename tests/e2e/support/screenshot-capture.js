const fs = require('fs');
const path = require('path');

const captureScreenshots = process.env.TRUSTROOTS_E2E_SCREENSHOTS === 'true';
const screenshotsDir =
  process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR ||
  path.join(__dirname, '../../../tmp/screenshots');
const SCREENSHOT_MODE_ANNOTATION = 'screenshot-mode';
const SCREENSHOT_SELECTOR_ANNOTATION = 'screenshot-selector';

function sanitizeFileName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

function useViewportScreenshot(testInfo) {
  testInfo.annotations.push({
    type: SCREENSHOT_MODE_ANNOTATION,
    description: 'viewport',
  });
}

function useElementScreenshot(testInfo, selector) {
  testInfo.annotations.push({
    type: SCREENSHOT_SELECTOR_ANNOTATION,
    description: selector,
  });
}

function getScreenshotSelector(testInfo) {
  const annotation = testInfo.annotations.find(
    item => item.type === SCREENSHOT_SELECTOR_ANNOTATION,
  );

  return annotation && annotation.description;
}

function shouldCaptureFullPage(testInfo) {
  return !testInfo.annotations.some(
    annotation =>
      annotation.type === SCREENSHOT_MODE_ANNOTATION &&
      annotation.description === 'viewport',
  );
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
    const screenshotPath = path.join(screenshotsDir, `${fileName}.png`);
    const selector = getScreenshotSelector(testInfo);

    if (selector) {
      await page.locator(selector).screenshot({ path: screenshotPath });
      return;
    }

    await page.screenshot({
      path: screenshotPath,
      fullPage: shouldCaptureFullPage(testInfo),
    });
  } catch (error) {
    // Screenshot capture is best-effort and must not fail the test run.
  }
}

module.exports = {
  captureEndOfTestScreenshot,
  sanitizeFileName,
  useElementScreenshot,
  useViewportScreenshot,
};
