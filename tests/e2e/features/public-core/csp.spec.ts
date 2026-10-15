/* global document, window */
import { expectPresent, test, expect } from '../../support/fixtures.mts';

declare global {
  interface Window {
    untrustedScriptExecuted?: boolean;
  }
}

test('browser blocks unnonced scripts and object content while the app loads', async ({
  page,
}) => {
  // The test API permits development source maps; exercise the production
  // policy's additional eval restriction with built assets.
  await page.route('**/signin', async route => {
    const response = await route.fetch();
    const headers = response.headers();
    headers['content-security-policy'] = headers[
      'content-security-policy'
    ].replace("'unsafe-eval'", '');
    await route.fulfill({ response, headers });
  });
  const response = await page.goto('/signin');
  expectPresent(response);
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
