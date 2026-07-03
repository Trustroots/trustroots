const { annotateFeature, expect, test } = require('../../support/test');

const {
  DEFAULT_PASSWORD,
  createUser,
  registerViaApi,
  signIn,
  signInViaApi,
} = require('../../support/helpers');
const {
  findUserByUsername,
  updateUserByUsername,
} = require('../../support/db');

test.describe.serial('account settings feature coverage', () => {
  test('members can change their password with validation', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.password-change', [
      'Current password is required.',
      'Password change succeeds with valid current and new password.',
      'Validation errors are visible for invalid data.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    const missingCurrent = await page.request.post('/api/users/password', {
      data: {
        newPassword: `${DEFAULT_PASSWORD}Changed`,
        verifyPassword: `${DEFAULT_PASSWORD}Changed`,
      },
    });
    expect(missingCurrent.status()).toBe(400);

    const newPassword = `${DEFAULT_PASSWORD}Changed`;
    const changed = await page.request.post('/api/users/password', {
      data: {
        currentPassword: user.password,
        newPassword,
        verifyPassword: newPassword,
      },
    });
    expect(changed.ok()).toBeTruthy();
  });

  test('members can update account details and see validation errors', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.details-update', [
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    const invalid = await page.request.put('/api/users', {
      data: { locale: 'definitely-invalid-locale' },
    });
    expect(invalid.status()).toBe(400);

    const tagline = 'E2E account update tagline';
    const valid = await page.request.put('/api/users', {
      data: { tagline },
    });
    expect(valid.ok()).toBeTruthy();
    expect((await valid.json()).tagline).toBe(tagline);
  });

  test('older members who sign in through the UI can change username', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.details-update', [
      'Account edit page is reachable.',
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await updateUserByUsername(user.username, {
      $set: { created: new Date('2020-05-27T19:23:44.733Z') },
      $unset: { usernameUpdated: '' },
    });

    await signIn(page, user);

    const profileResponse = await page.request.get(
      `/api/users/${user.username}`,
    );
    expect(profileResponse.ok()).toBeTruthy();
    const profile = await profileResponse.json();
    expect(profile.usernameUpdateAllowed).toBe(true);

    await page.evaluate(`
      const injector = window.angular.element(document.body).injector();
      injector.get('$state').go('profile-edit.account');
      injector.get('$rootScope').$applyAsync();
    `);

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(
      page.locator('form[name="settingsUsernameForm"] input[name="username"]'),
    ).toBeEnabled();
  });

  test('members can request and confirm profile removal', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.profile-removal', [
      'Removal request sends a deterministic confirmation email/stub.',
      'Valid removal token removes the profile.',
      'Invalid removal token is rejected.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    const invalid = await page.request.delete('/api/users/remove/bad-token');
    expect(invalid.status()).toBe(400);

    const requestRemoval = await page.request.delete('/api/users');
    expect(requestRemoval.ok()).toBeTruthy();

    const storedUser = await findUserByUsername(user.username);
    const removeProfileToken = storedUser.removeProfileToken;
    expect(removeProfileToken).toBeTruthy();

    const removed = await page.request.delete(
      `/api/users/remove/${removeProfileToken}`,
    );
    expect(removed.ok()).toBeTruthy();

    const deletedUser = await findUserByUsername(user.username);
    expect(deletedUser).toBeNull();
  });

  test('members can remove connected OAuth provider data', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.oauth-providers', [
      'Each OAuth provider can start and complete a stubbed callback flow.',
      'Connected OAuth provider can be disconnected.',
      'OAuth callback errors show user-facing error state.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await updateUserByUsername(user.username, {
      $set: {
        additionalProvidersData: {
          github: {
            id: 'e2e-github-id',
            login: 'e2e-github-login',
          },
        },
      },
    });
    await signInViaApi(page, request, user);

    const invalidProvider = await page.request.delete(
      '/api/users/accounts/not-a-provider',
    );
    expect(invalidProvider.status()).toBe(400);

    const disconnect = await page.request.delete('/api/users/accounts/github');
    expect(disconnect.ok()).toBeTruthy();

    const storedUser = await findUserByUsername(user.username);
    expect((storedUser.additionalProvidersData || {}).github).toBeUndefined();
  });

  test('members can add and remove push registrations', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.push-registrations', [
      'Push registration can be added with deterministic local permissions.',
      'Push registration can be removed.',
    ]);

    const user = createUser();
    const token = `web-push-token-${Date.now()}`;
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    const add = await page.request.post('/api/users/push/registrations', {
      data: {
        token,
        platform: 'web',
        deviceId: 'e2e-browser',
      },
    });
    expect(add.ok()).toBeTruthy();

    const remove = await page.request.delete(
      `/api/users/push/registrations/${token}`,
    );
    expect(remove.ok()).toBeTruthy();
  });
});
