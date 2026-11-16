import { expect, test, annotateFeature } from '../../support/fixtures.mts';
import {
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';
import { provisionFixtureMfa } from '../../support/mfa.mts';

// WebAuthn requires a domain RP ID, including for loopback development sites.
const port =
  process.env.TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER === 'true'
    ? process.env.TRUSTROOTS_E2E_WEB_PORT || '4300'
    : process.env.TRUSTROOTS_E2E_API_PORT || '4301';
test.use({ baseURL: `http://localhost:${port}` });

test('staff register, use and remove an optional device passkey', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'account.staff-passkeys', [
    'A staff member can use a registered passkey after password sign-in.',
  ]);
  const user = createUser();
  await registerViaApi(request, user);
  await updateUserByUsername(user.username, {
    $set: { roles: ['user', 'admin'], public: true },
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  try {
    await signInViaApi(page, request, user);
    await page.goto('/profile/edit/account');
    const settings = page.getByRole('region', { name: 'Staff passkeys' });
    await settings.getByLabel('Current password').fill(user.password);
    const managementCode = await provisionFixtureMfa(user);
    if (!managementCode) {
      throw new Error('Admin MFA fixture was not provisioned.');
    }
    await settings
      .getByLabel('Authenticator or recovery code')
      .fill(managementCode);
    await settings.getByLabel('Passkey name').fill('Fictional laptop');
    await settings
      .getByRole('button', { name: 'Add passkey', exact: true })
      .click();
    await expect(
      settings.getByText('Passkey added.', { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByRole('button', { name: 'Remove passkey Fictional laptop' }),
    ).toBeVisible();

    await page.request.post('/api/auth/signout', {
      headers: { 'X-Trustroots-Request': '1' },
    });
    await page.goto('/signin');
    await page.getByLabel('Email or username').fill(user.username);
    await page.getByLabel('Password', { exact: true }).fill(user.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Use a registered passkey' }),
    ).toBeVisible();
    expect(
      (await (await page.request.get('/api/auth/session')).json()).userId,
    ).toBeNull();
    await page
      .getByRole('button', { name: 'Use a registered passkey' })
      .click();
    await expect(page).not.toHaveURL(/\/signin/);
    expect(
      (await (await page.request.get('/api/auth/session')).json()).userId,
    ).toBeTruthy();

    await page.goto('/profile/edit/account');
    await settings.getByLabel('Current password').fill(user.password);
    const removalCode = await provisionFixtureMfa(user);
    if (!removalCode) {
      throw new Error('Admin MFA fixture was not provisioned.');
    }
    await settings
      .getByLabel('Authenticator or recovery code')
      .fill(removalCode);
    await settings
      .getByRole('button', { name: 'Remove passkey Fictional laptop' })
      .click();
    await expect(
      settings.getByText('Passkey removed.', { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByRole('button', { name: 'Remove passkey Fictional laptop' }),
    ).toHaveCount(0);
  } finally {
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await cdp.detach();
  }
});
