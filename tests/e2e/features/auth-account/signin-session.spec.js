const { annotateFeature, test, expect } = require('../../support/fixtures');
const { createUser, registerViaApi } = require('../../support/helpers');

const user = createUser();

test.beforeAll(async ({ request }) => {
  await registerViaApi(request, user);
});

test('missing session cookies explain the failure and allow sign-in to be retried', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Accepted credentials without a returned session cookie show an actionable error.',
    'Retry succeeds when the browser sends its session cookie.',
  ]);
  await page.goto('/signin?continue=true&returnTo=%2Fmessages');
  // Reproduce successful authentication without an issued cookie. Clear any
  // cookie accepted by route.fetch as well as withholding it from the browser.
  await page.route('**/api/auth/signin', async route => {
    const response = await route.fetch();
    const headers = response.headers();
    delete headers['set-cookie'];
    await page.context().clearCookies();
    await route.fulfill({ response, headers });
  });
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Cookies may be blocked, or there may be a problem with the site.',
  );
  await expect(page).toHaveURL(/\/signin\?/);
  await expect(
    page.getByRole('button', { name: 'Sign in to continue' }),
  ).toBeEnabled();
  await expect(page.getByText('Recover your password')).toHaveCount(0);

  await page.unroute('**/api/auth/signin');
  await page.getByRole('button', { name: 'Sign in to continue' }).click();
  await expect(page).toHaveURL(/\/messages$/);
});

test('a failed session check shows a connection message without blaming cookies', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'A failed session check stays on the form with a retryable connection error.',
  ]);
  await page.goto('/signin');
  await page.route('**/api/auth/session', route => route.abort('failed'));
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    "we couldn't check your session",
  );
  await expect(page.getByRole('alert')).not.toContainText('Cookies');
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/signin$/);
});

// Playwright starts its API with an enabled but unreachable loopback statistics
// backend. This exercises the real browser, API, cookies and statistics path.
test('login retains a session while the statistics backend is unavailable', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Remote statistics failure does not delay login or session persistence.',
  ]);
  await page.goto('/signin');
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/signin/);
  const response = await page.request.get('/api/auth/session');
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).userId).toBeTruthy();
});

test('login works while the analytics script stalls and fails', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'An unavailable analytics script does not hold up document readiness or login.',
  ]);
  let releaseAnalytics;
  const stalled = new Promise(resolve => {
    releaseAnalytics = resolve;
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://1p.trustroots.org/**', async route => {
    await stalled;
    await route.abort('failed');
  });
  try {
    await page.goto('/signin', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    await page.getByLabel('Email or username').fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page
      .getByRole('button', { name: 'Login', exact: true })
      .click({ noWaitAfter: true });
    await expect(page).not.toHaveURL(/\/signin/);
    const response = await page.request.get('/api/auth/session');
    expect((await response.json()).userId).toBeTruthy();
  } finally {
    releaseAnalytics();
  }
  await page.unroute('https://1p.trustroots.org/**');
  expect(errors).toEqual([]);
});
