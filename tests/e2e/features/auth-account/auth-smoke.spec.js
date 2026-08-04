const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signOut,
  signUp,
} = require('../../support/helpers');

const user = createUser();

async function signInExisting(page, usernameOrEmail) {
  await page.goto('/signin');
  await page.locator('#username').fill(usernameOrEmail);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).toHaveURL(/\/search/);
}

test.describe.serial('authentication smoke', () => {
  test.beforeAll(async ({ request }) => {
    await registerViaApi(request, user);
  });

  test('homepage loads and exposes authentication entry points', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.home', [
      'Homepage loads for visitors.',
      'Sign in and sign up entry points are visible.',
      'Homepage footer links to public statistics.',
      'Homepage footer links to safety guidance.',
      'Optional circle/tribe query parameters do not break the page.',
    ]);

    await page.goto('/');

    await expect(page).toHaveTitle(/Trustroots/);
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signin"]').first()).toBeVisible();
    await expect(
      page.locator('.home-footer-pages a[href="/statistics"]'),
    ).toHaveText('Statistics');
    await expect(
      page.locator('.home-footer-pages a[href="/safety"]'),
    ).toHaveText('Safety');
  });

  test('signup submits a unique user through the UI', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
      'Signup succeeds for a unique user.',
      'Signup can preload suggested circles from the tribe query parameter.',
    ]);

    const signupUser = createUser();

    await page.route('**/api/auth/signup', async route => {
      const payload = route.request().postDataJSON();

      expect(payload).toMatchObject({
        email: signupUser.email,
        firstName: signupUser.firstName,
        lastName: signupUser.lastName,
        password: signupUser.password,
      });

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'e2e-signup-user',
          displayName: `${signupUser.firstName} ${signupUser.lastName}`,
          email: signupUser.email,
          firstName: signupUser.firstName,
          lastName: signupUser.lastName,
          public: false,
          username: signupUser.username,
        }),
      });
    });

    await signUp(page, signupUser);
  });

  test('signed out user can sign in with username', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ]);

    await signOut(page);
    await signInExisting(page, user.username);
  });

  test('signed out user can sign in with email', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'auth.signin', [
      'Sign in page links to signup.',
      'Username sign in succeeds.',
      'Email sign in succeeds.',
      'Continue query redirects to the original protected destination.',
    ]);

    await signOut(page);
    await signInExisting(page, user.email);
  });

  test('sign-in continues to the protected destination', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.protected-route-redirect', [
      'Protected routes preserve their path and query when redirecting to sign in.',
    ]);

    await signOut(page);
    await page.goto('/messages?filter=unread');
    await expect(page).toHaveURL(
      /\/signin\?continue=true&returnTo=%2Fmessages%3Ffilter%3Dunread/,
    );

    const confirmedMember = SEEDED_MEMBERS[0];
    await page.locator('#username').fill(confirmedMember.username);
    await page.locator('#password').fill(confirmedMember.password);
    await page.getByRole('button', { name: /sign in to continue/i }).click();

    await expect(page).toHaveURL(/\/messages\?filter=unread/);
  });
});
