import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { chromium, type TestInfo } from '@playwright/test';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-screenshots-'));
process.env.TRUSTROOTS_E2E_SCREENSHOTS = 'true';
process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR = directory;
const { trackScreenshotPages } =
  await import('../../tests/e2e/support/screenshot-capture.mts');

test('captures isolated pages before cleanup and omits blank pages', async () => {
  const browser = await chromium.launch();
  const originalNewContext = browser.newContext;
  const info = {
    project: { name: 'chromium' },
    title: 'Screenshot regression',
    retry: 0,
    repeatEachIndex: 0,
    status: 'passed',
    expectedStatus: 'passed',
    annotations: [],
  } as unknown as TestInfo;
  const finish = trackScreenshotPages(browser, info);
  try {
    const defaultContext = await browser.newContext();
    await defaultContext.newPage(); // The unused fixture page.
    const isolated = await browser.newContext();
    const first = await isolated.newPage();
    await first.goto('data:text/html,<h1>First fictional page</h1>');
    await first.close();
    const second = await isolated.newPage();
    await second.goto('data:text/html,<h1>Second fictional page</h1>');
    await isolated.close();
    const empty = await defaultContext.newPage();
    await empty.goto('data:text/html,');
    await finish();
    const urls = fs
      .readdirSync(directory)
      .filter(file => file.endsWith('.url'));
    assert.equal(urls.length, 2);
    assert.deepEqual(
      urls
        .map(file => fs.readFileSync(path.join(directory, file), 'utf8'))
        .sort(),
      [
        'data:text/html,<h1>First fictional page</h1>',
        'data:text/html,<h1>Second fictional page</h1>',
      ],
    );
    const images = fs
      .readdirSync(directory)
      .filter(file => file.endsWith('.png'));
    assert.equal(images.length, 2);
    for (const image of images)
      assert.ok(fs.statSync(path.join(directory, image)).size > 1000);
    assert.equal(browser.newContext, originalNewContext);
  } finally {
    await browser.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
