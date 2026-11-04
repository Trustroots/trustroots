import { randomBytes } from 'node:crypto';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';

import {
  DEFAULT_PASSWORD,
  SEEDED_MEMBERS,
  createIsolatedContext,
  createUser,
  registerViaApi,
  authenticateViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  findUserByUsername,
  findActionToken,
  updateUserByUsername,
} from '../../support/db.mts';

test.describe.serial('auth email and token feature coverage', () => {
  test('email change shows both addresses before confirmation on a narrow screen', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm', [
      'Valid confirmation token can be validated.',
    ]);
    const member = createUser();
    await registerViaApi(request, member);
    const token = await findActionToken(member.username, 'emailToken');
    await updateUserByUsername(member.username, {
      $set: { public: true, emailTemporary: 'new-address@example.org' },
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/confirm-email/${token}`);
    await expect(
      page.getByRole('heading', { name: 'Confirm your email change' }),
    ).toBeVisible();
    await expect(
      page.getByText('Current email', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(member.email, { exact: true })).toBeVisible();
    await expect(page.getByText('New email', { exact: true })).toBeVisible();
    await expect(
      page.getByText('new-address@example.org', { exact: true }),
    ).toBeVisible();
    expect((await findUserByUsername(member.username))!.email).toBe(
      member.email,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('email-change-mobile.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.screenshot({
      path: testInfo.outputPath('email-change-desktop.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Confirm email change' }).click();
    await expect(
      page.getByRole('heading', { name: 'Email confirmed' }),
    ).toBeVisible();
    expect((await findUserByUsername(member.username))!.email).toBe(
      'new-address@example.org',
    );
  });

  test('email change can be cancelled from its link without signing in', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm', [
      'Valid confirmation token can be validated.',
    ]);
    const member = createUser();
    await registerViaApi(request, member);
    const token = await findActionToken(member.username, 'emailToken');
    await updateUserByUsername(member.username, {
      $set: { public: true, emailTemporary: 'cancelled@example.org' },
    });
    await page.goto(`/confirm-email/${token}`);
    await page.getByRole('button', { name: 'Cancel email change' }).click();
    await expect(
      page.getByRole('heading', { name: 'Email change cancelled' }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toContainText(member.email);
    const stored = (await findUserByUsername(member.username))!;
    expect(stored.email).toBe(member.email);
    expect(stored.emailTemporary).toBeUndefined();
    const session = await page.request.get('/api/auth/session');
    expect(await session.json()).toEqual({ userId: null });
    const confirm = await request.post(`/api/auth/confirm-email/${token}`, {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(confirm.status()).toBe(400);
  });

  test('email change can be cancelled from account settings', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm', [
      'Valid confirmation token can be validated.',
    ]);
    const member = createUser();
    await registerViaApi(request, member);
    const token = await findActionToken(member.username, 'emailToken');
    await updateUserByUsername(member.username, {
      $set: { public: true, emailTemporary: 'cancelled@example.org' },
    });
    await signInViaApi(page, request, member);
    await page.goto('/profile/edit/account');
    await expect(
      page.getByText('Pending email change: cancelled@example.org'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel email change' }).click();
    await expect(
      page.getByText(
        'Email change cancelled. Your current email address is still active.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Resend confirmation' }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Cancel email change' }),
    ).toHaveCount(0);
    const confirm = await request.post(`/api/auth/confirm-email/${token}`, {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(confirm.status()).toBe(400);
  });

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
    const storedUser = (await findUserByUsername(user.username))!;
    expect(storedUser.emailToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedUser.emailTokenIssuedAt).toBeTruthy();
    expect(
      new Date(storedUser.emailTokenExpires!).getTime() -
        new Date(storedUser.emailTokenIssuedAt!).getTime(),
    ).toBe(24 * 60 * 60 * 1000);
    const emailToken = await findActionToken(user.username, 'emailToken');

    const validation = await request.get(
      `/api/auth/confirm-email/${emailToken}?signup=true`,
      { maxRedirects: 0 },
    );
    expect(validation.status()).toBe(302);
    expect(validation.headers().location).toBe(`/confirm-email/${emailToken}`);

    const confirm = await request.post(
      `/api/auth/confirm-email/${emailToken}`,
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(confirm.ok()).toBeTruthy();
    expect(await confirm.json()).toMatchObject({ profileMadePublic: true });

    const confirmedUser = (await findUserByUsername(user.username))!;
    expect(confirmedUser.public).toBe(true);
  });

  test('invalid email confirmation tokens route to recovery states', async ({
    page,
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
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(invalidPost.status()).toBe(400);

    await page.goto('/confirm-email-invalid');
    await expect(
      page.getByText('Email confirm token is invalid or has expired.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login first' })).toBeVisible();
  });

  test('expired confirmation links return to the invalid-link flow', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-confirm-invalid', [
      'Expired confirmation links cannot activate an account.',
      'Expired confirmation links route to the recovery page.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const token = 'deadbeef'.repeat(5);
    const now = new Date();
    await updateUserByUsername(user.username, {
      $set: {
        emailToken: token,
        emailTokenIssuedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        emailTokenExpires: now,
      },
    });

    const validation = await request.get(`/api/auth/confirm-email/${token}`, {
      maxRedirects: 0,
    });
    expect(validation.status()).toBe(302);
    expect(validation.headers().location).toBe('/confirm-email-invalid');

    const confirmation = await request.post(
      `/api/auth/confirm-email/${token}`,
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(confirmation.status()).toBe(400);
    const unchanged = (await findUserByUsername(user.username))!;
    expect(unchanged.public).toBe(false);
    expect(unchanged.emailTemporary).toBe(user.email);
  });

  test('members can request confirmation email resends', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.email-resend', [
      'Resend confirmation succeeds for an unconfirmed member.',
      'Resend confirmation handles already-confirmed or invalid accounts.',
    ]);

    const unconfirmed = createUser();
    await registerViaApi(request, unconfirmed);
    await authenticateViaApi(request, unconfirmed);
    const originalToken = await findActionToken(
      unconfirmed.username,
      'emailToken',
    );

    const resend = await request.post('/api/auth/resend-confirmation', {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(resend.ok()).toBeTruthy();
    expect(await resend.json()).toMatchObject({
      message: 'Sent confirmation email.',
    });
    const replacementToken = await findActionToken(
      unconfirmed.username,
      'emailToken',
    );
    expect(replacementToken).not.toBe(originalToken);

    const replacedLink = await request.post(
      `/api/auth/confirm-email/${originalToken}`,
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(replacedLink.status()).toBe(400);

    const confirmReplacement = await request.post(
      `/api/auth/confirm-email/${replacementToken}`,
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(confirmReplacement.ok()).toBeTruthy();

    await authenticateViaApi(request, SEEDED_MEMBERS[0]);
    const alreadyConfirmed = await request.post(
      '/api/auth/resend-confirmation',
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(alreadyConfirmed.status()).toBe(400);
  });

  test('password reset rotates the current session and invalidates other sessions', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-reset', [
      'Valid reset token opens reset form.',
      'Password reset succeeds with matching valid passwords.',
      'The browser completing the reset receives a fresh session.',
      'Other sessions and reused tokens are rejected.',
      'Member can sign in with the new password.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const firstContext = await createIsolatedContext(browser, baseURL);
    const secondContext = await createIsolatedContext(browser, baseURL);
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    try {
      await signInViaApi(firstPage, firstContext.request, user);
      await signInViaApi(secondPage, secondContext.request, user);

      const token = `reset-${Date.now()}-${randomBytes(6).toString('hex')}`;
      await updateUserByUsername(user.username, {
        $set: {
          resetPasswordToken: token,
          resetPasswordExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const validation = await firstContext.request.get(
        `/api/auth/reset/${token}`,
        {
          maxRedirects: 0,
        },
      );
      expect(validation.status()).toBe(302);
      expect(validation.headers().location).toBe(`/password/reset/${token}`);

      const newPassword = `${DEFAULT_PASSWORD}Reset`;
      const reset = await firstContext.request.post(
        `/api/auth/reset/${token}`,
        {
          data: {
            newPassword,
            verifyPassword: newPassword,
          },
        },
      );
      expect(reset.ok()).toBeTruthy();
      expect(
        (await firstContext.request.get('/api/users/export')).ok(),
      ).toBeTruthy();
      expect(
        (await secondContext.request.get('/api/users/export')).status(),
      ).toBe(403);

      const reused = await secondContext.request.post(
        `/api/auth/reset/${token}`,
        {
          data: { newPassword, verifyPassword: newPassword },
        },
      );
      expect(reused.status()).toBe(400);

      await signInViaApi(secondPage, secondContext.request, {
        ...user,
        password: newPassword,
      });
      expect(
        (await secondContext.request.get('/api/users/export')).ok(),
      ).toBeTruthy();
    } finally {
      await Promise.all([firstContext.close(), secondContext.close()]);
    }
  });

  test('a reset token succeeds for only one concurrent request', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-reset', [
      'A reset token is consumed by one atomic credential update.',
      'Concurrent reuse of the same token cannot reset the password twice.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const token = `parallel-reset-${Date.now()}-${randomBytes(6).toString('hex')}`;
    await updateUserByUsername(user.username, {
      $set: {
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const contexts = await Promise.all([
      createIsolatedContext(browser, baseURL),
      createIsolatedContext(browser, baseURL),
    ]);
    try {
      const newPassword = `${DEFAULT_PASSWORD}Concurrent`;
      const responses = await Promise.all(
        contexts.map(context =>
          context.request.post(`/api/auth/reset/${token}`, {
            data: { newPassword, verifyPassword: newPassword },
          }),
        ),
      );
      expect(responses.map(response => response.status()).sort()).toEqual([
        200, 400,
      ]);
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('forgot password stores a reset token without revealing account existence', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.password-forgot', [
      'Forgot password form accepts username or email.',
      'Existing and unknown account identifiers receive the same acknowledgement.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);

    const unknown = await request.post('/api/auth/forgot', {
      data: { username: `missing-${user.username}` },
    });
    expect(unknown.status()).toBe(200);
    const unknownResponse = await unknown.json();

    const forgot = await request.post('/api/auth/forgot', {
      data: { username: user.email },
    });
    expect(forgot.ok()).toBeTruthy();
    expect(await forgot.json()).toEqual(unknownResponse);
    expect(unknownResponse).toEqual({
      message:
        'If an account matches that username or email, we will send recovery instructions.',
    });

    await expect
      .poll(
        async () =>
          (await findUserByUsername(user.username))!.resetPasswordToken,
      )
      .toBeTruthy();
    const storedUser = (await findUserByUsername(user.username))!;
    expect(storedUser.resetPasswordToken).toBeTruthy();
    expect(storedUser.resetPasswordExpires).toBeTruthy();
  });
});
