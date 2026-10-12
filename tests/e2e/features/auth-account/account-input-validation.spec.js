const { test, expect } = require('../../support/fixtures');
const {
  createUser,
  registerViaApi,
  authenticateViaApi,
  SEEDED_ADMIN,
} = require('../../support/helpers');
const { findUserByUsername } = require('../../support/db');

test('sign-in handles malformed credential values without leaving the form', async ({
  page,
  request,
}) => {
  const user = createUser();
  await registerViaApi(request, user);
  await page.route('**/api/auth/signin', route =>
    route.continue({
      postData: JSON.stringify({
        username: [user.username],
        password: user.password,
      }),
    }),
  );
  await page.goto('/signin');
  await page.getByLabel('Email or username').fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/signin$/);
  const session = await page.request.get('/api/auth/session');
  expect(await session.json()).toEqual({ userId: null });
});

test('registration initialises only supported account fields', async ({
  request,
}) => {
  const user = createUser();
  const response = await request.post('/api/auth/signup', {
    data: {
      ...user,
      authVersion: 99,
      roles: ['admin'],
      avatarUploaded: true,
      avatarVersion: 'unexpected-avatar',
      resetPasswordToken: 'unexpected-token',
      additionalProvidersData: { github: { id: 'unexpected-provider' } },
    },
  });
  expect(response.ok()).toBeTruthy();
  const stored = await findUserByUsername(user.username);
  expect(stored.authVersion).toBe(0);
  expect(stored.roles).toEqual(['user']);
  expect(stored.avatarUploaded).toBe(false);
  expect(stored.avatarVersion).toBeUndefined();
  expect(stored.resetPasswordToken).toBeUndefined();
  expect(stored.additionalProvidersData?.github).toBeUndefined();
});

test('account lookups reject structured identifiers', async ({ request }) => {
  const recovery = await request.post('/api/auth/forgot', {
    data: { username: ['sample-member'] },
  });
  expect(recovery.status()).toBe(400);
  await authenticateViaApi(request, SEEDED_ADMIN);
  for (const path of ['/api/admin/user', '/api/admin/threads']) {
    const response = await request.post(path, {
      data: { username: ['sample-member'] },
    });
    expect(response.status()).toBe(400);
  }
});
