import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import crypto from 'node:crypto';

import {
  DEFAULT_PASSWORD,
  createIsolatedContext,
  createUser,
  registerViaApi,
  signIn,
  signInViaApi,
  authenticateViaApi,
  signOut,
} from '../../support/helpers.mts';
import {
  findUserByUsername,
  findActionToken,
  updateUserByUsername,
} from '../../support/db.mts';

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function currentTotp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto
    .createHmac('sha1', decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
}

test.describe.serial('account settings feature coverage', () => {
  test('administrators can enrol an authenticator and use it at sign-in', async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    annotateFeature(testInfo, 'account.mfa', [
      'Member confirms their password before enrolling an authenticator.',
      'Authenticator enrolment returns recovery codes only once.',
      'MFA-enabled sign-in requires a second factor before establishing a session.',
      'Profile API responses do not expose MFA secrets or recovery hashes.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);
    await updateUserByUsername(user.username, {
      $addToSet: { roles: 'admin' },
    });
    await page.goto('/profile/edit/account');
    await page.getByLabel('Confirm your password').fill(user.password);
    await page.getByRole('button', { name: 'Set up authenticator' }).click();
    const provisioningText = await page.locator('code').first().textContent();
    if (!provisioningText) {
      throw new Error('Authenticator setup link is missing.');
    }
    const secret = new URL(provisioningText).searchParams.get('secret');
    if (!secret) throw new Error('Authenticator setup link has no secret.');
    await page
      .getByLabel('Current authenticator code')
      .fill(currentTotp(secret));
    await page
      .getByRole('button', { name: 'Enable authenticator MFA' })
      .click();
    await expect(
      page.getByRole('list', { name: 'Recovery codes' }).locator('li'),
    ).toHaveCount(10);
    const recoveryCode = await page
      .getByRole('list', { name: 'Recovery codes' })
      .locator('li code')
      .first()
      .textContent();
    if (!recoveryCode) {
      throw new Error('The recovery code was not displayed.');
    }
    await page
      .getByRole('button', { name: 'I have saved these codes' })
      .click();

    const profileResponse = await page.request.get(
      `/api/users/${user.username}`,
    );
    const profile = await profileResponse.json();
    expect(profile).not.toHaveProperty('mfaSecretEncrypted');
    expect(profile).not.toHaveProperty('mfaRecoveryCodeHashes');
    expect(profile).not.toHaveProperty('mfaPendingSecretEncrypted');

    await signOut(page);
    await page.goto('/signin');
    await page.getByLabel('Email or username').fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(
      page.getByLabel('Authenticator or recovery code'),
    ).toBeVisible();
    await page.getByLabel('Authenticator or recovery code').fill(recoveryCode);
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page).not.toHaveURL(/\/signin/);
    const session = await page.request.get('/api/auth/session');
    expect((await session.json()).userId).toBeTruthy();

    await signOut(page);
    await page.goto('/signin');
    await page.getByLabel('Email or username').fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByLabel('Authenticator or recovery code').fill(recoveryCode);
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('invalid');
    expect(
      (await (await page.request.get('/api/auth/session')).json()).userId,
    ).toBeNull();
  });

  test('FAQ removal links focus the account section and return to the answer', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.profile-removal', [
      'FAQ removal links reach the focused section and link back.',
    ]);
    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);
    await page.goto('/faq#how-can-i-remove-my-account');
    await page
      .locator('#how-can-i-remove-my-account')
      .getByRole('link', { name: 'account page' })
      .click();
    await expect(page).toHaveURL(/\/profile\/edit\/account#remove$/);
    const removal = page.getByRole('region', { name: 'Remove profile' });
    await expect(removal).toBeFocused();
    await expect(removal).toBeInViewport();
    await expect(
      removal.getByText(/This does not delete your account yet/),
    ).toBeVisible();
    await expect(
      removal.getByRole('button', { name: 'Remove profile', exact: true }),
    ).toBeDisabled();
    await removal
      .getByRole('link', { name: 'Read the account removal FAQ' })
      .click();
    await expect(page).toHaveURL(/\/faq#how-can-i-remove-my-account$/);
    await expect(page.locator('#how-can-i-remove-my-account')).toBeInViewport();
    await page.goto('/profile/edit/account#remove');
    await expect(
      page.getByRole('region', { name: 'Remove profile' }),
    ).toBeFocused();
    await expect(
      page.getByRole('region', { name: 'Remove profile' }),
    ).toBeInViewport();
  });

  test('legacy Facebook avatars use placeholders and cannot be selected', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.oauth-providers', [
      'Legacy Facebook avatar selections use placeholders without Graph API requests.',
      'Facebook is rejected as a new profile image source.',
    ]);
    const user = createUser();
    await registerViaApi(request, user);
    await updateUserByUsername(user.username, {
      $set: {
        avatarSource: 'facebook',
        additionalProvidersData: {
          facebook: { id: 'fictional-facebook-id' },
        },
      },
    });
    const facebookRequests: string[] = [];
    page.on('request', outgoing => {
      if (new URL(outgoing.url()).hostname === 'graph.facebook.com') {
        facebookRequests.push(outgoing.url());
      }
    });
    await signInViaApi(page, request, user);
    await page.goto('/profile/edit/photo');
    await expect(
      page.getByRole('radio', { name: 'None', exact: true }),
    ).toBeChecked();
    await expect(
      page.locator('.profile-avatar-choises img.avatar-none'),
    ).toHaveAttribute('src', '/img/avatar.png?none');
    await expect(page.getByRole('radio', { name: 'Facebook' })).toHaveCount(0);

    const member = (await findUserByUsername(user.username))!;
    const avatarResponse = await page.request.get(
      `/api/users/${member._id}/avatar`,
      { maxRedirects: 0 },
    );
    expect(avatarResponse.status()).toBe(302);
    expect(avatarResponse.headers().location).toContain('/img/avatar-1024.png');
    const rejected = await page.request.put('/api/users', {
      data: { avatarSource: 'facebook' },
    });
    expect(rejected.status()).toBe(400);
    const updated = await page.request.put('/api/users', {
      data: { tagline: 'A fictional member updates their profile' },
    });
    expect(updated.ok()).toBeTruthy();
    expect((await updated.json()).avatarSource).toBe('none');
    expect(facebookRequests).toEqual([]);
  });

  test('members can download their data from account settings', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.data-export', [
      'Account settings exposes a download link for the combined export.',
      'Account settings explains which data the download includes and leaves out.',
      'The combined export downloads with the documented filename.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await signInViaApi(page, request, user);

    await page.goto('/profile/edit/account');
    const downloadLink = page.getByRole('link', { name: 'Download your data' });
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute('href', '/api/users/export');
    await expect(
      page.getByText(/trustroots-data-username-20261014-0931\.json/),
    ).toBeVisible();
    await expect(
      page.getByText(/does not include your password, your profile photo file/),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await downloadLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^trustroots-data-${user.username}-\\d{8}-\\d{4}\\.json$`),
    );
  });

  test('password changes refresh the current browser and revoke other sessions', async ({
    browser,
    baseURL,
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
    const otherContext = await createIsolatedContext(browser, baseURL);
    const otherPage = await otherContext.newPage();
    try {
      await signInViaApi(otherPage, otherContext.request, user);

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
      const changedBody = await changed.json();
      expect(changedBody.user).not.toHaveProperty('password');
      expect(changedBody.user).not.toHaveProperty('salt');
      expect(changedBody.user).not.toHaveProperty('emailToken');
      expect(changedBody.user).not.toHaveProperty('resetPasswordToken');
      expect(changedBody.user).not.toHaveProperty('pushRegistration');
      expect((await page.request.get('/api/users/export')).ok()).toBeTruthy();
      expect(
        (await otherContext.request.get('/api/users/export')).status(),
      ).toBe(403);

      await signInViaApi(otherPage, otherContext.request, {
        ...user,
        password: newPassword,
      });
      expect(
        (await otherContext.request.get('/api/users/export')).ok(),
      ).toBeTruthy();
    } finally {
      await otherContext.close();
    }
  });

  test('concurrent password changes cannot overwrite each other or lose a version increment', async ({
    browser,
    baseURL,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.password-change', [
      'Concurrent password changes using the same current password cannot both succeed.',
      'The successful password change atomically updates the scrypt hash, clears the legacy salt, and increments the session version.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    const contexts = await Promise.all([
      createIsolatedContext(browser, baseURL),
      createIsolatedContext(browser, baseURL),
    ]);
    try {
      await Promise.all(
        contexts.map(async context => {
          const page = await context.newPage();
          await signInViaApi(page, context.request, user);
        }),
      );

      const passwords = [
        `${DEFAULT_PASSWORD}FirstChange`,
        `${DEFAULT_PASSWORD}SecondChange`,
      ];
      const responses = await Promise.all(
        contexts.map((context, index) =>
          context.request.post('/api/users/password', {
            data: {
              currentPassword: user.password,
              newPassword: passwords[index],
              verifyPassword: passwords[index],
            },
          }),
        ),
      );
      expect(responses.map(response => response.status()).sort()).toEqual([
        200, 400,
      ]);

      const changedUser = (await findUserByUsername(user.username))!;
      expect(changedUser.authVersion).toBe(1);
      expect(changedUser.passwordUpdated).toBeTruthy();
      expect(changedUser.salt).toBeFalsy();
      expect(changedUser.password).toMatch(/^\$scrypt\$/);
      expect(changedUser.password).not.toBe(user.password);

      const successfulPassword = passwords[responses[0].ok() ? 0 : 1];
      const checkContext = await createIsolatedContext(browser, baseURL);
      try {
        const signin = await checkContext.request.post('/api/auth/signin', {
          data: { username: user.username, password: successfulPassword },
        });
        expect(signin.ok()).toBeTruthy();
      } finally {
        await checkContext.close();
      }
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
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

    await page.locator('#newPassword').fill(newPassword);
    await page.locator('#verifyPassword').fill(newPassword);
    const invalidPassword = page.waitForResponse(
      response =>
        response.url().includes('/api/users/password') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /change password/i }).click();
    expect((await invalidPassword).status()).toBe(400);
    await expect(
      page.getByText('Current password is incorrect.'),
    ).toBeVisible();

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
    request,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.details-update', [
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
    ]);

    const user = createUser();
    await registerViaApi(request, user);
    await authenticateViaApi(request, user);

    const invalid = await request.put('/api/users', {
      headers: { Origin: new URL(baseURL!).origin },
      data: { locale: 'definitely-invalid-locale' },
    });
    expect(invalid.status()).toBe(400);

    const tagline = 'E2E account update tagline';
    const valid = await request.put('/api/users', {
      headers: { Origin: new URL(baseURL!).origin },
      data: { tagline },
    });
    expect(valid.ok()).toBeTruthy();
    const updatedProfile = await valid.json();
    expect(updatedProfile.tagline).toBe(tagline);
    expect(updatedProfile.email).toBe(user.email);
    expect(updatedProfile.locale).toBeDefined();
    expect(updatedProfile.blocked).toEqual([]);
  });

  test('older members who sign in through the UI can change username', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.details-update', [
      'Account edit page is reachable.',
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
      'Username change rules are visible in account settings.',
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

    await page.goto('/profile/edit/account');

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(page.getByLabel('Username', { exact: true })).toBeEnabled();
    await expect(page.getByText(/three months after joining/)).toBeVisible();
    await expect(
      page.getByText(
        'Use 3–34 letters and numbers, including at least one letter.',
      ),
    ).toBeVisible();

    const nextUsername = createUser().username;
    await page.getByLabel('Username', { exact: true }).fill(nextUsername);
    await page
      .getByRole('button', { name: 'Change username', exact: true })
      .click();
    await expect(
      page.getByText('Username updated.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View profile', exact: true }),
    ).toHaveAttribute('href', `/profile/${nextUsername}`);
    await page.getByRole('link', { name: 'View profile', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/profile/${nextUsername}$`));
  });

  test('new members who sign in through the UI cannot change username yet', async ({
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
    await signIn(page, user);

    const profileResponse = await page.request.get(
      `/api/users/${user.username}`,
    );
    expect(profileResponse.ok()).toBeTruthy();
    const profile = await profileResponse.json();
    expect(profile.usernameUpdateAllowed).toBe(false);

    await page.goto('/profile/edit/account');

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(page.getByLabel('Username', { exact: true })).toBeDisabled();
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

    const invalid = await page.request.delete('/api/users/remove/bad-token', {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(invalid.status()).toBe(400);

    const requestRemoval = await page.request.delete('/api/users', {
      headers: { 'X-Trustroots-Request': '1' },
    });
    expect(requestRemoval.ok()).toBeTruthy();

    const storedUser = (await findUserByUsername(user.username))!;
    expect(storedUser.removeProfileToken).toMatch(/^sha256:[a-f0-9]{64}$/);
    const removeProfileToken = await findActionToken(
      user.username,
      'removeProfileToken',
    );
    expect(removeProfileToken).toBeTruthy();

    await page.goto(`/remove/${removeProfileToken}`);
    const removeButton = page.getByRole('button', {
      name: 'Permanently delete my account',
    });
    await expect(removeButton).toBeVisible();

    const userBeforeConfirmation = (await findUserByUsername(user.username))!;
    expect(userBeforeConfirmation).not.toBeNull();

    const removed = page.waitForResponse(
      response =>
        response.url().includes(`/api/users/remove/${removeProfileToken}`) &&
        response.request().method() === 'DELETE',
    );
    await removeButton.click();
    expect((await removed).ok()).toBeTruthy();

    await expect(page.getByText('Your profile was removed.')).toBeVisible();

    const deletedUser = (await findUserByUsername(user.username))!;
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
            nostroots.ownerDocument.defaultView!.Node
              .DOCUMENT_POSITION_FOLLOWING,
          ),
        await hospitalityHeading.elementHandle(),
      ),
    ).toBeTruthy();

    const saveButton = page.getByRole('button', { name: 'Save' });
    const legacyConnections = page.locator('.legacy-social-connections');
    const deleteConnectionButton = (provider: string) =>
      legacyConnections
        .locator('li')
        .filter({ hasText: new RegExp(`^${provider}\\s+Legacy`, 'i') })
        .getByRole('button', { name: /^delete$/i });

    await expect(legacyConnections).toBeVisible();
    expect(
      await saveButton.evaluate(
        (save, legacy) =>
          Boolean(
            save.compareDocumentPosition(legacy) &
            save.ownerDocument.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        await legacyConnections.elementHandle(),
      ),
    ).toBeTruthy();

    for (const provider of ['facebook', 'github', 'twitter']) {
      await expect(deleteConnectionButton(provider)).toBeVisible();
      const removedRoute = await page.request.get(`/api/auth/${provider}`);
      expect(removedRoute.status()).toBe(404);
    }

    expect(
      (
        await page.request.put('/api/auth/facebook', {
          headers: { 'X-Trustroots-Request': '1' },
        })
      ).status(),
    ).toBe(404);
    for (const provider of ['facebook', 'github']) {
      const removedCallback = await page.request.get(
        `/api/auth/${provider}/callback`,
      );
      expect(removedCallback.status()).toBe(404);
    }

    const invalidProvider = await page.request.delete(
      '/api/users/accounts/not-a-provider',
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(invalidProvider.status()).toBe(400);

    for (const provider of ['facebook', 'github', 'twitter']) {
      const disconnect = page.waitForResponse(
        response =>
          response.request().method() === 'DELETE' &&
          response.url().endsWith(`/api/users/accounts/${provider}`),
      );
      await deleteConnectionButton(provider).click();
      expect((await disconnect).ok()).toBeTruthy();
    }

    await expect(legacyConnections).toHaveCount(0);

    const storedUser = (await findUserByUsername(user.username))!;
    expect(storedUser.additionalProvidersData || {}).toEqual({});
  });

  test('members cannot add push registrations and can remove historical tokens', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.push-registrations', [
      'New push registrations are rejected.',
      'Historical push registrations can still be removed.',
    ]);

    const user = createUser();
    const token = `web-push-token-${Date.now()}`;
    await registerViaApi(request, user);
    await authenticateViaApi(request, user);

    const add = await request.post('/api/users/push/registrations', {
      data: {
        token,
        platform: 'web',
        deviceId: 'e2e-browser',
      },
    });
    expect(add.status()).toBe(400);
    expect(await add.json()).toMatchObject({
      message: 'Push notifications are no longer available.',
    });

    await updateUserByUsername(user.username, {
      $set: {
        pushRegistration: [
          {
            platform: 'web',
            token,
            created: new Date(),
            deviceId: 'e2e-browser',
          },
        ],
      },
    });

    const remove = await request.delete(
      `/api/users/push/registrations/${token}`,
      { headers: { 'X-Trustroots-Request': '1' } },
    );
    expect(remove.ok()).toBeTruthy();

    const storedUser = (await findUserByUsername(user.username))!;
    expect(storedUser.pushRegistration || []).toEqual([]);
  });

  test('Android members can register and remove a UnifiedPush endpoint', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'account.android-message-alerts', [
      'A signed-in Android member can register an encrypted UnifiedPush endpoint.',
      'Only allowlisted HTTPS endpoints are accepted and the member can opt out.',
    ]);
    const user = createUser();
    await registerViaApi(request, user);
    await authenticateViaApi(request, user);
    const config = await request.get('/api/users/unified-push');
    expect(config.ok()).toBeTruthy();
    expect(await config.json()).toMatchObject({ enabled: true });
    const registration = {
      endpoint: `https://ntfy.sh/trustroots-e2e-${Date.now()}`,
      publicKey:
        'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
      auth: 'abcdefghijklmnopqrstuv',
    };
    const rejected = await request.post('/api/users/unified-push', {
      data: { ...registration, endpoint: 'https://example.org/push' },
    });
    expect(rejected.status()).toBe(400);
    const added = await request.post('/api/users/unified-push', {
      data: registration,
    });
    expect(added.status()).toBe(204);
    const removed = await request.delete('/api/users/unified-push', {
      data: { endpoint: registration.endpoint },
    });
    expect(removed.status()).toBe(204);
  });
});
