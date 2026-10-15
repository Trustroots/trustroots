import crypto from 'node:crypto';
import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import { createUser, registerViaApi } from '../../support/helpers.mts';
import { updateUserByUsername, withE2eDb } from '../../support/db.mts';
import { provisionFixtureMfa } from '../../support/mfa.mts';
import config from '../../support/app-config.mts';

async function enrolledMember(
  request: import('@playwright/test').APIRequestContext,
) {
  const user = createUser();
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: { roles: ['user', 'moderator'], public: true },
  });
  const code = await provisionFixtureMfa(user);
  await updateUserByUsername(user.username, { $set: { roles: ['user'] } });
  if (!code) throw new Error('Expected enrolled fixture recovery code');
  return { user, code };
}

test('combined account checks establish one session and sign out everywhere', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Combined proof and second-factor responses do not establish an intermediate session.',
  ]);
  const { user, code } = await enrolledMember(request);
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
  let proofResponses = 0;
  page.on('response', response => {
    if (
      response.url().endsWith('/api/auth/signin') &&
      response.status() === 429
    )
      proofResponses++;
  });
  await page.goto('/signin');
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByLabel('Authenticator or recovery code')).toBeVisible();
  expect(
    (await (await page.request.get('/api/auth/session')).json()).userId,
  ).toBeNull();
  expect(proofResponses).toBe(1);
  await page.getByLabel('Authenticator or recovery code').fill(code);
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).not.toHaveURL(/\/signin/);
  const sessions = await page.request.get('/api/auth/sessions');
  expect(sessions.ok()).toBe(true);
  expect(await sessions.json()).toHaveLength(1);
  await page.goto('/profile/edit/account');
  await page.getByLabel('Password for session changes').fill(user.password);
  await page.getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page).toHaveURL(/\/signin/);
  expect(
    (await (await page.request.get('/api/auth/session')).json()).userId,
  ).toBeNull();
});

test('password recovery leaves an MFA member signed out until a fresh second factor', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'auth.signin', [
    'Password recovery keeps second-factor verification required.',
  ]);
  const { user, code } = await enrolledMember(request);
  const token = crypto.randomBytes(20).toString('hex');
  await updateUserByUsername(user.username, {
    $set: {
      resetPasswordToken:
        'sha256:' + crypto.createHash('sha256').update(token).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 60000),
    },
  });
  const password = 'UpdatedFictionalPassword123!';
  const reset = await page.request.post('/api/auth/reset/' + token, {
    data: { newPassword: password, verifyPassword: password },
  });
  expect(reset.ok()).toBe(true);
  expect((await reset.json()).mfaRequired).toBe(true);
  expect(
    (await (await page.request.get('/api/auth/session')).json()).userId,
  ).toBeNull();
  const replay = await page.request.post('/api/auth/reset/' + token, {
    data: { newPassword: password, verifyPassword: password },
  });
  expect(replay.status()).toBe(400);
  await page.goto('/signin');
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByLabel('Authenticator or recovery code').fill(code);
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).not.toHaveURL(/\/signin/);
  expect(
    (await (await page.request.get('/api/auth/session')).json()).userId,
  ).toBeTruthy();
});
