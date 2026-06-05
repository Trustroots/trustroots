const { test, expect } = require('@playwright/test');

const user = {
  firstName: 'Eddie',
  lastName: 'Endtoend',
  username: `e2e-${Date.now()}`,
  email: `e2e-${Date.now()}@example.test`,
  password: 'Tester123',
};

async function signIn(page, usernameOrEmail) {
  await page.goto('/signin');
  await page.locator('#username').fill(usernameOrEmail);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page).toHaveURL(/\/search/);
}

async function signOut(page) {
  await page.goto('/api/auth/signout');
  await expect(page).toHaveURL(/\/$/);
}

test.describe.serial('authentication smoke', () => {
  test('homepage loads and exposes authentication entry points', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Trustroots/);
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signin"]').first()).toBeVisible();
  });

  test('signup creates a unique user through the UI', async ({ page }) => {
    await page.goto('/signup');

    await page.locator('#firstName').fill(user.firstName);
    await page.locator('#lastName').fill(user.lastName);
    await page.locator('#email').fill(user.email);
    await page.locator('#username').fill(user.username);
    await page.locator('#password').fill(user.password);
    await page.locator('#acquisitionStory').fill('End-to-end smoke test');

    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(
      page.getByText(/do you want to join any circles/i),
    ).toBeVisible();

    await page.getByRole('button', { name: /^skip$/i }).click();
    await expect(page.locator('#signup-edit')).toBeVisible();
  });

  test('signed out user can sign in with username', async ({ page }) => {
    await signOut(page);
    await signIn(page, user.username);
  });

  test('signed out user can sign in with email', async ({ page }) => {
    await signOut(page);
    await signIn(page, user.email);
  });
});
