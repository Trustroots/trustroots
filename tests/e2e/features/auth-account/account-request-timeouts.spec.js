/* global XMLHttpRequest, window */
const { annotateFeature, expect, test } = require('../../support/fixtures');

const cases = [
  {
    name: 'password recovery',
    feature: 'auth.password-forgot',
    path: '/password/forgot',
    endpoint: '/api/auth/forgot',
    scenario:
      'Recovery transport failures show guidance without automatic retries.',
    button: 'Restore',
    guidance:
      'We could not confirm whether the recovery request completed. Check your inbox before trying again.',
  },
  {
    name: 'password reset',
    feature: 'auth.password-reset',
    path: '/password/reset/example-reset-token',
    endpoint: '/api/auth/reset/example-reset-token',
    scenario:
      'Reset transport failures show guidance without automatic retries.',
    button: 'Update Password',
    guidance:
      'We could not confirm whether your password was changed. Try signing in with your new password before requesting another reset.',
  },
];

for (const entry of cases) {
  test(`${entry.name} shows guidance when the response times out`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, entry.feature, [entry.scenario]);

    await page.addInitScript(endpoint => {
      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;
      const urls = new WeakMap();
      window.accountRequestTimeouts = [];

      XMLHttpRequest.prototype.open = function (method, url, ...options) {
        urls.set(this, new URL(url, window.location.href).pathname);
        return open.call(this, method, url, ...options);
      };
      XMLHttpRequest.prototype.send = function (body) {
        if (urls.get(this) === endpoint) {
          window.accountRequestTimeouts.push(this.timeout);
          // Exercise the real browser timeout without waiting two minutes.
          this.timeout = 150;
        }
        return send.call(this, body);
      };
    }, entry.endpoint);

    const requests = [];
    await page.route(`**${entry.endpoint}`, route => {
      requests.push(route.request());
      // Hold the response until the browser times out the XHR.
    });

    await page.goto(entry.path);
    if (entry.feature === 'auth.password-forgot') {
      await page.getByLabel('Email or username').fill('example-member');
    } else {
      await page
        .getByLabel('New Password', { exact: true })
        .fill('Example123!');
      await page
        .getByLabel('Verify Password', { exact: true })
        .fill('Example123!');
    }

    await page.getByRole('button', { name: entry.button }).click();
    await expect(page.getByRole('alert')).toHaveText(entry.guidance);
    await expect(
      page.getByRole('button', { name: entry.button }),
    ).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`${entry.path}$`));
    expect(requests).toHaveLength(1);
    expect(requests[0].headers()['x-trustroots-request']).toBe('1');
    expect(await page.evaluate(() => window.accountRequestTimeouts)).toEqual([
      120000,
    ]);
  });
}
