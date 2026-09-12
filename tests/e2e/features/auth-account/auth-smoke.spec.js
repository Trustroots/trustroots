const { annotateFeature, test, expect } = require('../../support/test');

const {
  createUser,
  registerViaApi,
  signOut,
  signInViaApi,
  signUp,
} = require('../../support/helpers');

const { updateUserByUsername } = require('../../support/db');
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

  test('signup explains underscores and waits for username validation', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
    ]);
    const member = createUser();
    let releaseValidation;
    const validationGate = new Promise(resolve => {
      releaseValidation = resolve;
    });
    await page.route('**/api/auth/signup/validate', async route => {
      await validationGate;
      await route.continue();
    });
    await page.goto('/signup');
    await page.locator('#firstName').fill(member.firstName);
    await page.locator('#lastName').fill(member.lastName);
    await page.locator('#email').fill(member.email);
    await page.locator('#password').fill(member.password);
    await page.locator('#username').fill('sample_member');
    await expect(
      page.getByRole('button', { name: 'Please fill in the form' }),
    ).toBeDisabled();
    await page.locator('#username').blur();
    await expect(
      page
        .getByText(
          'Use 3-34 lowercase letters and numbers, including at least one letter.',
        )
        .first(),
    ).toBeVisible();
    const rejected = await request.post('/api/auth/signup', {
      data: { ...member, username: 'sample_member' },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).message).toContain(
      'Use 3-34 lowercase letters and numbers, including at least one letter.',
    );
    await page.locator('#username').fill(member.username);
    try {
      await expect(
        page.getByRole('button', { name: 'Checking username…' }),
      ).toBeDisabled();
    } finally {
      releaseValidation();
    }
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('username policy preserves apostrophes and legacy member identities', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'auth.signup', [
      'Signup form validates required fields.',
      'Signup succeeds for a unique user.',
    ]);
    const member = createUser({ firstName: 'Amina', lastName: "O'Vale" });
    await page.goto('/signup');
    await page.locator('#firstName').fill(member.firstName);
    await page.locator('#lastName').fill(member.lastName);
    await page.locator('#email').fill(member.email);
    await page.locator('#password').fill(member.password);
    for (const username of ['sample_member', 'SampleMember', '123456']) {
      await page.locator('#username').fill(username);
      await expect(
        page.getByRole('button', { name: 'Please fill in the form' }),
      ).toBeDisabled();
      const rejected = await request.post('/api/auth/signup', {
        data: { ...member, username },
      });
      expect(rejected.status()).toBe(400);
    }
    await signUp(page, member);
    const legacyUsername = `legacy.${member.username}`.slice(0, 34);
    await updateUserByUsername(member.username, {
      $set: { username: legacyUsername, public: true },
      $unset: { emailTemporary: 1, emailToken: 1 },
    });
    await signInViaApi(page, request, { ...member, username: legacyUsername });
    await page.goto('/profile/edit/account');
    const updated = await page.request.put('/api/users', {
      data: { username: legacyUsername, lastName: "D'Vale" },
    });
    expect(updated.ok()).toBeTruthy();
    expect(await updated.json()).toMatchObject({
      username: legacyUsername,
      lastName: "D'Vale",
    });
    const invalidChange = await page.request.put('/api/users', {
      data: { username: 'another_member' },
    });
    expect(invalidChange.status()).toBe(400);
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
});
