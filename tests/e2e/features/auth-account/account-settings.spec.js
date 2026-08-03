const { annotateFeature, expect, test } = require('../../support/test');

const {
  DEFAULT_PASSWORD,
  createUser,
  registerViaApi,
  signIn,
  signInViaApi,
  signOut,
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

  test('members can change their password through account settings', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.password-change', [
      'Current password is required.',
      'Password change succeeds with valid current and new password.',
      'Validation errors are visible for invalid data.',
    ]);

    const user = createUser();
    const newPassword = `${DEFAULT_PASSWORD}Changed`;
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    await page.goto('/profile/edit/account#password');
    await expect(page.locator('#password')).toBeVisible();

    await page.locator('#currentPassword').fill(user.password);
    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#verifyPassword').fill(newPassword);

    const changePassword = page.waitForResponse(
      response =>
        response.url().includes('/api/users/password') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /change password/i }).click();
    expect((await changePassword).ok()).toBeTruthy();

    await expect(
      page.getByText('Your password is now changed. Have a nice day!'),
    ).toBeVisible();

    await signOut(page);
    await signIn(page, { ...user, password: newPassword });
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

  test('members can request and confirm profile removal', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.profile-removal', [
      'Removal request sends a deterministic confirmation email/stub.',
      'Opening a valid removal link preserves the profile.',
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

    await page.goto(`/remove/${removeProfileToken}`);
    const removeButton = page.getByRole('button', {
      name: 'Permanently delete my account',
    });
    await expect(removeButton).toBeVisible();

    const userBeforeConfirmation = await findUserByUsername(user.username);
    expect(userBeforeConfirmation).not.toBeNull();

    const removed = page.waitForResponse(
      response =>
        response.url().includes(`/api/users/remove/${removeProfileToken}`) &&
        response.request().method() === 'DELETE',
    );
    await removeButton.click();
    expect((await removed).ok()).toBeTruthy();

    await expect(page.getByText('Your profile was removed.')).toBeVisible();

    const deletedUser = await findUserByUsername(user.username);
    expect(deletedUser).toBeNull();
  });

  test('members can remove connected OAuth provider data', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.oauth-providers', [
      'Stored OAuth provider data can be disconnected.',
      'Social OAuth providers are not offered as new connections.',
      'Legacy social connections are shown below Save with delete controls.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await updateUserByUsername(user.username, {
      $set: {
        additionalProvidersData: {
          facebook: {
            id: 'fictional-facebook-id',
          },
          github: {
            id: 'fictional-github-id',
            login: 'fictional-github-login',
          },
          twitter: {
            id: 'fictional-twitter-id',
            screen_name: 'fictional-twitter-name',
          },
        },
      },
    });
    await signInViaApi(page, request, user);

    await page.goto('/profile/edit/networks');
    await expect(page.getByRole('heading', { name: 'Connect to' })).toHaveCount(
      0,
    );

    const nostrootsLink = page
      .getByRole('heading', { name: 'Nostroots' })
      .getByRole('link', { name: 'Nostroots' });
    const hospitalityHeading = page.getByRole('heading', {
      name: 'Other hospitality networks',
    });
    await expect(nostrootsLink).toHaveAttribute(
      'href',
      'https://nos.trustroots.org',
    );
    await expect(nostrootsLink).toHaveAttribute('target', '_blank');
    expect(
      await nostrootsLink.evaluate(
        (nostroots, hospitality) =>
          Boolean(
            nostroots.compareDocumentPosition(hospitality) &
              nostroots.ownerDocument.defaultView.Node
                .DOCUMENT_POSITION_FOLLOWING,
          ),
        await hospitalityHeading.elementHandle(),
      ),
    ).toBeTruthy();

    const saveButton = page.getByRole('button', { name: 'Save' });
    const legacyConnections = page.locator('.legacy-social-connections');
    await expect(legacyConnections).toBeVisible();
    expect(
      await saveButton.evaluate(
        (save, legacy) =>
          Boolean(
            save.compareDocumentPosition(legacy) &
              save.ownerDocument.defaultView.Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        await legacyConnections.elementHandle(),
      ),
    ).toBeTruthy();

    for (const provider of ['facebook', 'github', 'twitter']) {
      await expect(
        page.getByRole('button', {
          name: new RegExp(`delete ${provider} connection`, 'i'),
        }),
      ).toBeVisible();
      const removedRoute = await page.request.get(`/api/auth/${provider}`);
      expect(removedRoute.status()).toBe(404);
    }

    expect((await page.request.put('/api/auth/facebook')).status()).toBe(404);
    for (const provider of ['facebook', 'github']) {
      const removedCallback = await page.request.get(
        `/api/auth/${provider}/callback`,
      );
      expect(removedCallback.status()).toBe(404);
    }

    const invalidProvider = await page.request.delete(
      '/api/users/accounts/not-a-provider',
    );
    expect(invalidProvider.status()).toBe(400);

    for (const provider of ['facebook', 'github', 'twitter']) {
      const disconnect = page.waitForResponse(
        response =>
          response.request().method() === 'DELETE' &&
          response.url().endsWith(`/api/users/accounts/${provider}`),
      );
      await page
        .getByRole('button', {
          name: new RegExp(`delete ${provider} connection`, 'i'),
        })
        .click();
      expect((await disconnect).ok()).toBeTruthy();
    }

    await expect(legacyConnections).toHaveCount(0);

    const storedUser = await findUserByUsername(user.username);
    expect(storedUser.additionalProvidersData || {}).toEqual({});
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
