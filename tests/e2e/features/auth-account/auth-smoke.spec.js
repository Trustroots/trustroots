const { test, expect } = require('../../support/test');

const {
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
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Trustroots/);
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signin"]').first()).toBeVisible();
  });

  test('signup submits a unique user through the UI', async ({ page }) => {
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

  test('signed out user can sign in with username', async ({ page }) => {
    await signOut(page);
    await signInExisting(page, user.username);
  });

  test('signed out user can sign in with email', async ({ page }) => {
    await signOut(page);
    await signInExisting(page, user.email);
  });
});
