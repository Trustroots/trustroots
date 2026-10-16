import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

const captureScreenshots = process.env.TRUSTROOTS_E2E_SCREENSHOTS === 'true';
const screenshotsDir =
  process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR ??
  path.join(import.meta.dirname, '../../../tmp/screenshots');
const SCREENSHOT_MODE_ANNOTATION = 'screenshot-mode';
const SCREENSHOT_SELECTOR_ANNOTATION = 'screenshot-selector';

export function sanitizeFileName(value: unknown): string {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

export function useViewportScreenshot(testInfo: TestInfo): void {
  testInfo.annotations.push({
    type: SCREENSHOT_MODE_ANNOTATION,
    description: 'viewport',
  });
}

export function useElementScreenshot(
  testInfo: TestInfo,
  selector: string,
): void {
  testInfo.annotations.push({
    type: SCREENSHOT_SELECTOR_ANNOTATION,
    description: selector,
  });
}

function getScreenshotSelector(testInfo: TestInfo): string | undefined {
  const annotation = testInfo.annotations.find(
    item => item.type === SCREENSHOT_SELECTOR_ANNOTATION,
  );

  return annotation?.description;
}

function shouldCaptureFullPage(testInfo: TestInfo): boolean {
  return !testInfo.annotations.some(
    annotation =>
      annotation.type === SCREENSHOT_MODE_ANNOTATION &&
      annotation.description === 'viewport',
  );
}

export async function captureEndOfTestScreenshot(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
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

    // Leave the fixed header as the app renders it. Full-page shots stitch
    // scrolled slices, so the header can appear part-way down the image.
    await page.screenshot({
      path: screenshotPath,
      fullPage: shouldCaptureFullPage(testInfo),
    });
  } catch {
    // Screenshot capture is best-effort and must not fail the test run.
  }
}
