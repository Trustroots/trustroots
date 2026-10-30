import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';

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
  suffix = '',
): Promise<void> {
  if (!captureScreenshots || page.isClosed()) {
    return;
  }

  try {
    // API-only tests can leave the default page unused. Do not publish it.
    if (
      page.url() === 'about:blank' ||
      !(await page.locator('body').innerHTML()).trim()
    ) {
      return;
    }
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const failed = testInfo.status !== testInfo.expectedStatus;
    const fileName = [
      sanitizeFileName(testInfo.project.name),
      sanitizeFileName(testInfo.title),
      testInfo.retry,
      testInfo.repeatEachIndex,
      failed ? 'FAILED' : null,
      suffix,
    ]
      .filter(Boolean)
      .join('-');
    const screenshotPath = path.join(screenshotsDir, `${fileName}.png`);
    const selector = getScreenshotSelector(testInfo);

    if (selector) {
      await page.locator(selector).screenshot({ path: screenshotPath });
    } else {
      // Leave the fixed header as the app renders it. Full-page shots stitch
      // scrolled slices, so the header can appear part-way down the image.
      await page.screenshot({
        path: screenshotPath,
        fullPage: shouldCaptureFullPage(testInfo),
      });
    }
    fs.writeFileSync(path.join(screenshotsDir, `${fileName}.url`), page.url());
  } catch {
    // Screenshot capture is best-effort and must not fail the test run.
  }
}

// Tests often use isolated contexts and close them in finally blocks. Capture
// their pages before close, while the tested UI is still available.
export function trackScreenshotPages(browser: Browser, testInfo: TestInfo) {
  const captured = new WeakSet<Page>();
  const tracked = new WeakSet<BrowserContext>();
  const restorers: (() => void)[] = [];
  let pageNumber = 0;
  const capture = async (page: Page) => {
    if (captured.has(page)) return;
    captured.add(page);
    await captureEndOfTestScreenshot(page, testInfo, `page-${++pageNumber}`);
  };
  const trackContext = (context: BrowserContext) => {
    if (tracked.has(context)) return;
    tracked.add(context);
    const trackPage = (page: Page) => {
      const close = page.close;
      page.close = async options => {
        await capture(page);
        return close.call(page, options);
      };
      restorers.push(() => {
        page.close = close;
      });
    };
    context.pages().forEach(trackPage);
    context.on('page', trackPage);
    const close = context.close;
    context.close = async options => {
      for (const page of context.pages()) await capture(page);
      return close.call(context, options);
    };
    restorers.push(() => {
      context.off('page', trackPage);
      context.close = close;
    });
  };
  const newContext = browser.newContext;
  if (captureScreenshots) {
    browser.contexts().forEach(trackContext);
    browser.newContext = async options => {
      const context = await newContext.call(browser, options);
      trackContext(context);
      return context;
    };
  }
  return async () => {
    try {
      if (captureScreenshots) {
        for (const context of browser.contexts()) {
          for (const page of context.pages()) await capture(page);
        }
      }
    } finally {
      browser.newContext = newContext;
      restorers.reverse().forEach(restore => restore());
    }
  };
}
