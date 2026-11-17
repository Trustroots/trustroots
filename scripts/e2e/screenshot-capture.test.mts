import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { chromium, type TestInfo } from '@playwright/test';
import sharp from 'sharp';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-screenshots-'));
process.env.TRUSTROOTS_E2E_SCREENSHOTS = 'true';
process.env.TRUSTROOTS_E2E_SCREENSHOTS_DIR = directory;
const { captureSection, trackScreenshotPages } =
  await import('../../tests/e2e/support/screenshot-capture.mts');
const info = {
  project: { name: 'chromium' },
  title: 'Screenshot regression',
  retry: 0,
  repeatEachIndex: 0,
  status: 'passed',
  expectedStatus: 'passed',
  annotations: [],
} as unknown as TestInfo;

test('captures isolated pages before cleanup and omits blank pages', async () => {
  const browser = await chromium.launch();
  const originalNewContext = browser.newContext;
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

test('captures a named section instead of its whole page', async () => {
  const browser = await chromium.launch();
  const finish = trackScreenshotPages(browser, info);
  try {
    const page = await browser.newPage();
    await page.goto(
      'data:text/html,<header id="tr-header" style="position:fixed;top:0;height:40px;width:100%;background:red"></header><div id="card" style="width:120px;height:80px;background:teal"></div>',
    );
    await captureSection(page.locator('#card'), 'Card / desktop');
    await captureSection(page.locator('#tr-header'), 'Header');
    await finish();
    assert.deepEqual(fs.readdirSync(directory).sort(), [
      'chromium-Card_desktop.png',
      'chromium-Card_desktop.url',
      'chromium-Header.png',
      'chromium-Header.url',
    ]);
    const header = await sharp(path.join(directory, 'chromium-Header.png'))
      .raw()
      .toBuffer();
    assert.deepEqual([...header.subarray(0, 3)], [255, 0, 0]);
    const { data, info: image } = await sharp(
      path.join(directory, 'chromium-Card_desktop.png'),
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual([image.width, image.height], [120, 80]);
    assert.deepEqual([...data.subarray(0, 3)], [0, 128, 128]);
  } finally {
    await browser.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('captures the same board photo across revisions at each viewport', async () => {
  const browser = await chromium.launch();
  const origin = 'http://boards.example';
  const variants = [
    { route: '/', classes: 'home-intro', width: 800, photo: 'ak-sahara.jpg' },
    {
      route: '/',
      classes: 'home-intro',
      width: 390,
      photo: 'ak-sahara--mobile.jpg',
    },
    {
      route: '/?circle=hitchhikers',
      classes: 'home-intro',
      width: 390,
      photo: 'ab-hitchroad-toned.jpg',
    },
    {
      route: '/faq',
      classes: 'faq-header',
      width: 390,
      photo: 'af-happyhippies--mobile.jpg',
    },
    {
      route: '/signin',
      classes: 'board container-fullscreen',
      width: 800,
      photo: 'nordic-lights.jpg',
    },
  ];
  try {
    for (const { route, classes, width, photo } of variants) {
      const url = origin + route;
      for (const originalColour of ['red', 'yellow']) {
        const finish = trackScreenshotPages(browser, info);
        const page = await browser.newPage({ viewport: { width, height: 80 } });
        await page.route(url, route =>
          route.fulfill({
            contentType: 'text/html',
            body: `<body style="margin:0"><section class="${classes}" style="height:80px;background-image:linear-gradient(${originalColour}, ${originalColour})"></section></body>`,
          }),
        );
        await page.route(`${origin}/img/board/${photo}`, route =>
          route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>',
          }),
        );
        await page.goto(url);
        const board = page.locator('section');
        if (originalColour === 'red') {
          await captureSection(board, 'Board');
          assert.match(
            await board.evaluate(
              element => getComputedStyle(element).backgroundImage,
            ),
            /^linear-gradient/,
          );
        }
        await finish();
        await page.close();
      }
      const before = fs.readFileSync(
        path.join(directory, 'chromium-Board.png'),
      );
      const after = fs.readFileSync(
        path.join(directory, 'chromium-Screenshot_regression-page-1.png'),
      );
      assert.deepEqual(before, after, `${route} at ${width}px`);
      const pixels = await sharp(after).raw().toBuffer();
      assert.deepEqual([...pixels.subarray(0, 3)], [0, 0, 255]);
    }
  } finally {
    await browser.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
