#!/usr/bin/env node

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { once } = require('node:events') as typeof import('node:events');
const { chromium } = require('@playwright/test') as typeof import('@playwright/test');
const express = require('express') as typeof import('express');
const expressConfig = require('../../config/lib/express.mjs') as {
  initLocalVariables(app: import('express').Express): void;
  initViewEngine(app: import('express').Express): void;
};

type SmokeRoute = {
  path: string;
  role: 'heading' | 'button' | 'text' | 'exact';
  name: RegExp | string;
};

const routes: SmokeRoute[] = [
  { path: '/', role: 'heading', name: /How does it work/ },
  { path: '/about', role: 'heading', name: /How does it work/ },
  { path: '/contact', role: 'heading', name: /Trustroots Support/ },
  { path: '/contribute', role: 'heading', name: /Support Trustroots/ },
  { path: '/faq', role: 'heading', name: /Frequently Asked Questions/ },
  { path: '/faq/bugs-and-features', role: 'heading', name: /Frequently Asked Questions/ },
  { path: '/faq/circles', role: 'heading', name: /Frequently Asked Questions/ },
  { path: '/faq/foundation', role: 'heading', name: /Frequently Asked Questions/ },
  { path: '/faq/technology', role: 'heading', name: /Frequently Asked Questions/ },
  { path: '/foundation', role: 'heading', name: /Trustroots Foundation/ },
  { path: '/guide', role: 'heading', name: /Trustroots Guide/ },
  { path: '/media', role: 'exact', name: 'in Media' },
  { path: '/rules', role: 'heading', name: /^Rules$/ },
  { path: '/statistics', role: 'heading', name: /Trustroots Statistics/ },
  { path: '/support', role: 'heading', name: /Trustroots Support/ },
  { path: '/team', role: 'heading', name: /Trustroots Team/ },
  { path: '/team/greeters', role: 'heading', name: /Trustroots greeters/ },
  { path: '/volunteering', role: 'heading', name: /^Volunteering$/ },
  { path: '/circles', role: 'heading', name: /Discover circles/ },
  { path: '/privacy', role: 'heading', name: /^Privacy$/ },
  { path: '/safety', role: 'heading', name: /Safety Tips for Trustroots/ },
  { path: '/not-found', role: 'heading', name: /This page cannot be found/ },
  { path: '/signin', role: 'button', name: /^Login$/ },
  { path: '/signup', role: 'heading', name: /Join Trustroots/ },
  { path: '/password/forgot', role: 'heading', name: /Restore your password/ },
  { path: '/password/reset/invalid', role: 'heading', name: /Password reset is invalid/ },
  { path: '/password/reset/success', role: 'heading', name: /Password successfully reset/ },
  {
    path: '/confirm-email-invalid',
    role: 'text',
    name: /Email confirm token is invalid or has expired/,
  },
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
      routes.map(({ path }) => path),
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
  let browser: import('@playwright/test').Browser | undefined;
  let vite: import('vite').ViteDevServer | undefined;
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Express server did not bind to a TCP port.');
    }
    const apiURL = `http://127.0.0.1:${address.port}`;
    let baseURL = apiURL;
    if (development) {
      process.env.TRUSTROOTS_API_URL = apiURL;
      const { createServer } = await import('vite');
      vite = await createServer({
        configFile: 'vite.config.mjs',
        server: { host: '127.0.0.1', port: 0, open: false },
      });
      await vite.listen();
      const httpServer = vite.httpServer;
      if (!httpServer) throw new Error('Vite did not create an HTTP server.');
      const viteAddress = httpServer.address();
      if (!viteAddress || typeof viteAddress === 'string') {
        throw new Error('Vite server did not bind to a TCP port.');
      }
      baseURL = `http://127.0.0.1:${viteAddress.port}`;
    }
    browser = await chromium.launch({
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const scriptPath = development
      ? '/assets/config/vite/react-main.tsx'
      : '/assets/react-main.js';

    for (const route of routes) {
      const script = page.waitForResponse(
        response => new URL(response.url()).pathname === scriptPath,
      );
      await page.goto(baseURL + route.path);
      assert.ok([200, 304].includes((await script).status()));
      const locator =
        route.role === 'exact'
          ? page.getByText(route.name, { exact: true })
          : route.role === 'text'
            ? page.getByText(route.name)
            : page.getByRole(route.role, { name: route.name });
      try {
        await locator.waitFor({ timeout: 10000 });
      } catch (error) {
        console.error({
          route: route.path,
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
            .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
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
            rowDisplay: getComputedStyle(probe.querySelector('.row')!).display,
            hiddenDisplay: getComputedStyle(probe.querySelector('.d-none')!)
              .display,
            columnBoxSizing: getComputedStyle(probe.querySelector('.col-md-6')!)
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
        `Bootstrap grid and utilities must be available on ${route.path}`,
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
        await page
          .locator('#rtl-style')
          .evaluate(link => Boolean((link as HTMLLinkElement).sheet)),
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
