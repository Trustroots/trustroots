#!/usr/bin/env node

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { chromium } = require('@playwright/test');
const express = require('express');
const expressConfig = require('../../config/lib/express');

async function main() {
  assert.equal(process.env.NODE_ENV, 'production');
  const app = express();
  expressConfig.initLocalVariables(app);
  expressConfig.initViewEngine(app);
  app.use(express.static('public'));
  app.get(['/signin', '/password/forgot', '/safety'], (_req, res) => {
    res.render('react-index.server.view.html', {
      user: null,
      nonce: 'vite-smoke',
    });
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    browser = await chromium.launch({
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const baseURL = `http://127.0.0.1:${server.address().port}`;

    for (const [route, role, name] of [
      ['/signin', 'button', /^Login$/],
      ['/password/forgot', 'heading', /Restore your password/],
      ['/safety', 'heading', /Safety Tips for Trustroots/],
    ]) {
      const script = page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith('/assets/react-main.js'),
      );
      await page.goto(baseURL + route);
      assert.ok([200, 304].includes((await script).status()));
      try {
        await page.getByRole(role, { name }).waitFor({ timeout: 10000 });
      } catch (error) {
        console.error({
          route,
          errors,
          text: await page.locator('body').innerText(),
        });
        throw error;
      }
      assert.equal(
        await page
          .locator('script[src*="/assets/react-main.js"]')
          .getAttribute('type'),
        null,
      );
      assert.equal(
        await page
          .locator('link[href*="/assets/react-main.css"]')
          .evaluate(link => Boolean(link.sheet)),
        true,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'Vite production bundle renders three routes with the Express classic script tag.',
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
