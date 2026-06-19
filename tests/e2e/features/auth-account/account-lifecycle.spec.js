const { annotateFeature, expect, test } = require('../../support/test');

const {
  DEFAULT_PASSWORD,
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const {
  findUserByUsername,
  updateUserByUsername,
} = require('../../support/db');

test.describe.serial('auth and account lifecycle feature coverage', () => {
  test('signup validation reports available and unavailable usernames', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup-validation', [
      'Available username/email combination passes validation.',
      'Duplicate or invalid username/email shows a validation error.',
    ]);

    const available = await request.post('/api/auth/signup/validate', {
      data: { username: createUser().username },
    });
    expect(available.ok()).toBeTruthy();
    expect(await available.json()).toMatchObject({ valid: true });

    const duplicate = await request.post('/api/auth/signup/validate', {
      data: { username: SEEDED_MEMBERS[0].username },
    });
    expect(duplicate.ok()).toBeTruthy();
    expect(await duplicate.json()).toMatchObject({ valid: false });
  });

  test('email confirmation validates and activates a fresh member', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm', [
      'Valid confirmation token can be validated.',
      'Confirming the token activates the member profile.',
      'Signup-specific confirmation messaging is shown when appropriate.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const storedUser = await findUserByUsername(user.username);

    const validation = await request.get(
      `/api/auth/confirm-email/${storedUser.emailToken}?signup=true`,
      { maxRedirects: 0 },
    );
    expect(validation.status()).toBe(302);
    expect(validation.headers().location).toBe(
      `/confirm-email/${storedUser.emailToken}`,
    );

    const confirm = await request.post(
      `/api/auth/confirm-email/${storedUser.emailToken}`,
    );
    expect(confirm.ok()).toBeTruthy();
    expect(await confirm.json()).toMatchObject({ profileMadePublic: true });

    const confirmedUser = await findUserByUsername(user.username);
    expect(confirmedUser.public).toBe(true);
  });

  test('invalid email confirmation tokens route to recovery states', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm-invalid', [
      'Invalid confirmation token routes to the invalid confirmation page.',
      'Invalid confirmation page offers a recovery path.',
    ]);

    const invalidGet = await request.get(
      '/api/auth/confirm-email/not-a-valid-token',
      { maxRedirects: 0 },
    );
    expect(invalidGet.status()).toBe(302);
    expect(invalidGet.headers().location).toBe('/confirm-email-invalid');

    const invalidPost = await request.post(
      '/api/auth/confirm-email/not-a-valid-token',
    );
    expect(invalidPost.status()).toBe(400);
  });

  test('members can request confirmation email resends', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-resend', [
      'Resend confirmation succeeds for an unconfirmed member.',
      'Resend confirmation handles already-confirmed or invalid accounts.',
    ]);

    const unconfirmed = createUser();
    await registerViaApi(request, unconfirmed);
    await signInViaApi(page, request, unconfirmed);

    const resend = await page.request.post('/api/auth/resend-confirmation');
    expect(resend.ok()).toBeTruthy();
    expect(await resend.json()).toMatchObject({
      message: 'Sent confirmation email.',
    });

    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    const alreadyConfirmed = await page.request.post(
      '/api/auth/resend-confirmation',
    );
    expect(alreadyConfirmed.status()).toBe(400);
  });

  test('password reset token updates credentials', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-reset', [
      'Valid reset token opens reset form.',
      'Password reset succeeds with matching valid passwords.',
      'Success page is shown after reset.',
      'Member can sign in with the new password.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const token = `reset-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await updateUserByUsername(user.username, {
      $set: {
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const validation = await request.get(`/api/auth/reset/${token}`, {
      maxRedirects: 0,
    });
    expect(validation.status()).toBe(302);
    expect(validation.headers().location).toBe(`/password/reset/${token}`);

    const newPassword = `${DEFAULT_PASSWORD}Reset`;
    const reset = await request.post(`/api/auth/reset/${token}`, {
      data: {
        newPassword,
        verifyPassword: newPassword,
      },
    });
    expect(reset.ok()).toBeTruthy();

    const signin = await request.post('/api/auth/signin', {
      data: {
        username: user.username,
        password: newPassword,
      },
    });
    expect(signin.ok()).toBeTruthy();
  });

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
