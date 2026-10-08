const { test, expect, annotateFeature } = require('../../support/fixtures');
const {
  authenticateViaApi,
  createUser,
  registerViaApi,
} = require('../../support/helpers');
const { withE2eDb } = require('../../support/db');
const crypto = require('crypto');
const config = require('../../support/app-config');

test('a member signs in through the browser after an account-wide challenge', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Elevated account activity requires a proof before sign-in succeeds.',
  ]);
  const user = createUser();
  await registerViaApi(request, user);
  const windowStart = Math.floor(Date.now() / 900000) * 900000;
  const key = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(
      JSON.stringify([
        'signin-account',
        'account',
        user.username.toLowerCase(),
        windowStart,
      ]),
    )
    .digest('hex');
  await withE2eDb(db =>
    db
      .collection('requestlimits')
      .insertOne({ key, count: 20, expiresAt: new Date(windowStart + 900000) }),
  );
  const apiLogin = await authenticateViaApi(request, user);
  expect(apiLogin.ok()).toBe(true);

  const challengeResponses = [];
  page.on('response', response => {
    if (
      response.url().endsWith('/api/auth/signin') &&
      response.status() === 429
    )
      challengeResponses.push(response);
  });
  await page.goto('/signin');
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 45000 });
  expect(challengeResponses.length).toBe(1);
  const session = await page.request.get('/api/auth/session');
  expect((await session.json()).userId).toBeTruthy();
});
