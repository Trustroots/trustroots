#!/usr/bin/env node

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { chromium } = require('@playwright/test');
const express = require('express');
const expressConfig = require('../../config/lib/express');

async function main() {
  const development = process.env.NODE_ENV === 'development';
  assert.ok(development || process.env.NODE_ENV === 'production');
  if (development) process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
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
  let vite;
  try {
    const apiURL = `http://127.0.0.1:${server.address().port}`;
    let baseURL = apiURL;
    if (development) {
      process.env.TRUSTROOTS_API_URL = apiURL;
      const { createServer } = await import('vite');
      vite = await createServer({
        configFile: 'vite.config.mjs',
        server: { host: '127.0.0.1', port: 0, open: false },
      });
      await vite.listen();
      baseURL = `http://127.0.0.1:${vite.httpServer.address().port}`;
    }
    browser = await chromium.launch({
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const scriptPath = development
      ? '/assets/config/vite/react-main.tsx'
      : '/assets/react-main.js';

    for (const [route, role, name] of [
      ['/signin', 'button', /^Login$/],
      ['/password/forgot', 'heading', /Restore your password/],
      ['/safety', 'heading', /Safety Tips for Trustroots/],
    ]) {
      const script = page.waitForResponse(
        response => new URL(response.url()).pathname === scriptPath,
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
        await page.locator(`script[src*="${scriptPath}"]`).getAttribute('type'),
        development ? 'module' : null,
      );
      if (development) {
        assert.ok(await page.evaluate(() => document.styleSheets.length > 0));
      } else {
        assert.equal(
          await page
            .locator('link[href*="/assets/react-main.css"]')
            .evaluate(link => Boolean(link.sheet)),
          true,
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      `Vite ${
        development ? 'development proxy' : 'production bundle'
      } renders three routes with the Express template.`,
    );
  } finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
