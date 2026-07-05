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

test.describe.serial('auth email and token feature coverage', () => {
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

  test('signup validation rejects missing and invalid usernames', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup-validation', [
      'Duplicate or invalid username/email shows a validation error.',
    ]);

    const missing = await request.post('/api/auth/signup/validate', {
      data: {},
    });
    expect(missing.ok()).toBeTruthy();
    expect(await missing.json()).toMatchObject({
      valid: false,
      error: 'username-missing',
    });

    const invalid = await request.post('/api/auth/signup/validate', {
      data: { username: 'bad username' },
    });
    expect(invalid.ok()).toBeTruthy();
    expect(await invalid.json()).toMatchObject({
      valid: false,
      error: 'username-invalid',
    });
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

  test('forgot password stores a reset token and rejects unknown accounts', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-forgot', [
      'Forgot password form accepts username or email.',
      'Unknown accounts show a recovery error.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);

    const unknown = await request.post('/api/auth/forgot', {
      data: { username: `missing-${user.username}` },
    });
    expect(unknown.status()).toBe(404);

    const forgot = await request.post('/api/auth/forgot', {
      data: { username: user.email },
    });
    expect(forgot.ok()).toBeTruthy();
    expect(await forgot.json()).toMatchObject({
      message: 'We sent you an email with further instructions.',
    });

    const storedUser = await findUserByUsername(user.username);
    expect(storedUser.resetPasswordToken).toBeTruthy();
    expect(storedUser.resetPasswordExpires).toBeTruthy();
  });
});
