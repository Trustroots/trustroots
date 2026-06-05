const { test, expect } = require('./test');

const { createUser, registerViaApi, signOut } = require('./helpers');

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

  test('signup creates a unique user through the UI', async ({ page }) => {
    const signupUser = createUser();

    await page.goto('/signup');

    await page.locator('#firstName').fill(signupUser.firstName);
    await page.locator('#lastName').fill(signupUser.lastName);
    await page.locator('#email').fill(signupUser.email);
    await page.locator('#username').fill(signupUser.username);
    await page.locator('#password').fill(signupUser.password);
    await page.locator('#acquisitionStory').fill('End-to-end smoke test');

    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(
      page.getByText(/do you want to join any circles\?/i),
    ).toBeVisible();

    const skipButton = page.getByRole('button', { name: /^skip$/i });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    await expect(page.locator('#signup-edit')).toBeVisible();
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
