import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { annotateFeature } from '../../../scripts/e2e/feature-coverage-summary.mts';
import {
  trackScreenshotPages,
  sanitizeFileName,
  useElementScreenshot,
  useViewportScreenshot,
} from './screenshot-capture.mts';
import { stubStatisticsImages } from './statistics.mts';

type CoverageRange = {
  startOffset: number;
  endOffset: number;
  count: number;
};

type FunctionCoverage = {
  functionName: string;
  ranges: CoverageRange[];
  isBlockCoverage: boolean;
};

type ScriptCoverage = {
  scriptId: string;
  url: string;
  functions: FunctionCoverage[];
};

type ChromiumPage = Page & {
  coverage: {
    startJSCoverage(options: { resetOnNavigation: boolean }): Promise<void>;
    stopJSCoverage(): Promise<ScriptCoverage[]>;
  };
};

const coverageDir = path.join(
  import.meta.dirname,
  '../../../coverage/e2e/js-raw',
);
const collectCoverage = process.env.TRUSTROOTS_E2E_SKIP_JS_COVERAGE !== 'true';

export const test = base.extend<{ screenshotCapture: void }>({
  screenshotCapture: [
    async ({ browser }, use, testInfo) => {
      const finish = trackScreenshotPages(browser, testInfo);
      try {
        await use();
      } finally {
        await finish();
      }
    },
    { auto: process.env.TRUSTROOTS_E2E_SCREENSHOTS === 'true' },
  ],
  context: async (
    { context }: { context: BrowserContext },
    use: (context: BrowserContext) => Promise<void>,
  ) => {
    await stubStatisticsImages(context);
    await use(context);
  },
  page: async (
    { page, browserName }: { page: Page; browserName: string },
    use: (page: Page) => Promise<void>,
    testInfo: TestInfo,
  ) => {
    if (!collectCoverage || browserName !== 'chromium') {
      await use(page);
      return;
    }

    const coveragePage = page as ChromiumPage;
    await coveragePage.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const coverage = await coveragePage.coverage.stopJSCoverage();
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

export function expectPresent<T>(
  value: T | null | undefined,
  message = 'Expected a value to be present.',
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

export { expect, annotateFeature, useElementScreenshot, useViewportScreenshot };
