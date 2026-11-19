import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const origin = 'http://storybook.test';
const viewports = { desktop: 800, mobile: 375 };

/** Screenshot every story of a static Storybook build at each viewport width. */
export async function screenshotStories(storybookDir: string, outDir: string) {
  const { entries } = JSON.parse(
    fs.readFileSync(path.join(storybookDir, 'index.json'), 'utf8'),
  ) as { entries: Record<string, { id: string; type: string }> };
  const ids = Object.values(entries)
    .filter(entry => entry.type === 'story')
    .map(entry => entry.id);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [viewport, width] of Object.entries(viewports)) {
      const page = await browser.newPage({ viewport: { width, height: 600 } });
      await page.route(`${origin}/**`, route =>
        route.fulfill({
          path: path.join(
            storybookDir,
            new URL(route.request().url()).pathname,
          ),
        }),
      );
      for (const id of ids) {
        await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story`);
        await page.waitForFunction(
          () => (document.querySelector('iframe')?.offsetHeight ?? 0) > 0,
        );
        await page.screenshot({
          path: path.join(outDir, `${id}-${viewport}.png`),
          fullPage: true,
        });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === import.meta.filename) {
  const [storybookDir, outDir] = process.argv.slice(2);
  await screenshotStories(storybookDir, outDir);
}
