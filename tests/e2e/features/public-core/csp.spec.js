/* global document, window */
const { test, expect } = require('../../support/fixtures');

test('browser blocks unnonced scripts and object content while the app loads', async ({
  page,
}) => {
  if (process.env.TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER === 'false') {
    // The test API permits development source maps. With built production
    // assets, exercise the production policy's additional eval restriction.
    await page.route('**/signin', async route => {
      const response = await route.fetch();
      const headers = response.headers();
      headers['content-security-policy'] = headers[
        'content-security-policy'
      ].replace("'unsafe-eval'", '');
      await route.fulfill({ response, headers });
    });
  }
  const response = await page.goto('/signin');
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain("object-src 'none'");
  expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  await expect(page.getByLabel('Email or username')).toBeVisible();
  const executed = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.untrustedScriptExecuted = true';
    document.body.appendChild(script);
    return window.untrustedScriptExecuted === true;
  });
  expect(executed).toBe(false);
});
