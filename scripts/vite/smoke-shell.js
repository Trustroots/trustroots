#!/usr/bin/env node

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { chromium } = require('@playwright/test');
const express = require('express');
const expressConfig = require('../../config/lib/express.mjs');

const routes = [
  ['/', 'heading', /How does it work/],
  ['/about', 'heading', /How does it work/],
  ['/contact', 'heading', /Trustroots Support/],
  ['/contribute', 'heading', /Support Trustroots/],
  ['/faq', 'heading', /Frequently Asked Questions/],
  ['/faq/bugs-and-features', 'heading', /Frequently Asked Questions/],
  ['/faq/circles', 'heading', /Frequently Asked Questions/],
  ['/faq/foundation', 'heading', /Frequently Asked Questions/],
  ['/faq/technology', 'heading', /Frequently Asked Questions/],
  ['/foundation', 'heading', /Trustroots Foundation/],
  ['/guide', 'heading', /Trustroots Guide/],
  ['/media', 'exact', 'in Media'],
  ['/rules', 'heading', /^Rules$/],
  ['/statistics', 'heading', /Trustroots Statistics/],
  ['/support', 'heading', /Trustroots Support/],
  ['/team', 'heading', /Trustroots Team/],
  ['/team/greeters', 'heading', /Trustroots greeters/],
  ['/volunteering', 'heading', /^Volunteering$/],
  ['/circles', 'heading', /Discover circles/],
  ['/privacy', 'heading', /^Privacy$/],
  ['/safety', 'heading', /Safety Tips for Trustroots/],
  ['/not-found', 'heading', /This page cannot be found/],
  ['/signin', 'button', /^Login$/],
  ['/signup', 'heading', /Join Trustroots/],
  ['/password/forgot', 'heading', /Restore your password/],
  ['/password/reset/invalid', 'heading', /Password reset is invalid/],
  ['/password/reset/success', 'heading', /Password successfully reset/],
  [
    '/confirm-email-invalid',
    'text',
    /Email confirm token is invalid or has expired/,
  ],
];

async function main() {
  const development = process.env.NODE_ENV === 'development';
  assert.ok(development || process.env.NODE_ENV === 'production');
  if (development) process.env.TRUSTROOTS_VITE_DEV_SERVER = 'true';
  const app = express();
  expressConfig.initLocalVariables(app);
  expressConfig.initViewEngine(app);
  app.use(express.static('public'));
  // These pages fetch public lists while rendering. Empty payloads keep the
  // shell check independent of MongoDB.
  app.get('/api/tribes', (_req, res) => {
    res.json([]);
  });
  app.get('/api/volunteers', (_req, res) => {
    res.json({ alumni: [], volunteers: [] });
  });
  app.get('/api/greeters', (_req, res) => {
    res.json({ greeters: [] });
  });
  app.get('/api/statistics', (_req, res) => {
    res.json({});
  });
  app.get(
    routes.map(([route]) => route),
    (_req, res) => {
      res.render('react-index.server.view.html', {
        user: null,
        nonce: 'vite-smoke',
      });
    },
  );
  // Client redirects such as /offer -> /offer/host request a new document.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }
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

    for (const [route, role, name] of routes) {
      const script = page.waitForResponse(
        response => new URL(response.url()).pathname === scriptPath,
      );
      await page.goto(baseURL + route);
      assert.ok([200, 304].includes((await script).status()));
      const locator =
        role === 'exact'
          ? page.getByText(name, { exact: true })
          : role === 'text'
            ? page.getByText(name)
            : page.getByRole(role, { name });
      try {
        await locator.waitFor({ timeout: 10000 });
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
      assert.deepEqual(
        await page.evaluate(() => {
          const probe = document.createElement('div');
          probe.innerHTML =
            '<div class="row"><div class="col-md-6"></div></div><div class="d-none"></div>';
          document.body.append(probe);
          const styles = {
            rowDisplay: getComputedStyle(probe.querySelector('.row')).display,
            hiddenDisplay: getComputedStyle(probe.querySelector('.d-none'))
              .display,
            columnBoxSizing: getComputedStyle(probe.querySelector('.col-md-6'))
              .boxSizing,
          };
          probe.remove();
          return styles;
        }),
        {
          rowDisplay: 'flex',
          hiddenDisplay: 'none',
          columnBoxSizing: 'border-box',
        },
        `Bootstrap grid and utilities must be available on ${route}`,
      );
    }
    if (!development) {
      await page.context().addCookies([
        { name: 'i18n', value: 'ar', url: baseURL },
      ]);
      const stylesheet = page.waitForResponse(
        response =>
          new URL(response.url()).pathname === '/assets/react-main.rtl.css',
      );
      await page.goto(`${baseURL}/password/forgot`);
      const rtlResponse = await stylesheet;
      assert.equal(rtlResponse.status(), 200);
      const rtlCss = await rtlResponse.text();
      const ltrResponse = await page.request.get(
        `${baseURL}/assets/react-main.css`,
      );
      assert.equal(ltrResponse.status(), 200);
      const ltrCss = await ltrResponse.text();
      const ltrLeft = ltrCss.match(/margin-left/g)?.length ?? 0;
      const rtlLeft = rtlCss.match(/margin-left/g)?.length ?? 0;
      assert.ok(ltrLeft > 0, 'LTR stylesheet should contain margin-left');
      assert.ok(
        rtlLeft < ltrLeft,
        'RTL stylesheet should flip margin-left rules',
      );
      assert.match(rtlCss, /margin-right/);
      assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
      assert.equal(
        await page.locator('#rtl-style').evaluate(link => Boolean(link.sheet)),
        true,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      `Vite ${
        development ? 'development proxy' : 'production bundle'
      } renders public routes with the Express template.`,
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
