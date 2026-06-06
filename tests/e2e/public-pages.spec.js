const { test, expect } = require('./test');

const { createUser, waitForTribesList } = require('./helpers');

test.describe('public pages and unauthenticated flows', () => {
  test('sign in and sign up pages link to each other', async ({ page }) => {
    await page.goto('/signin');

    await page
      .getByRole('link', { name: /become a member/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole('heading', { name: /join trustroots/i }),
    ).toBeVisible();

    await page.getByRole('link', { name: /^login$/i }).click();
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('forgot password page renders the recovery form', async ({ page }) => {
    await page.goto('/password/forgot');

    await expect(page).toHaveTitle(/Reset password - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /restore your password/i }),
    ).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.getByRole('button', { name: /restore/i })).toBeVisible();
  });

  test('signing in with invalid credentials shows an error and stays on the sign in page', async ({
    page,
  }) => {
    const user = createUser();

    await page.goto('/signin');
    await page.locator('#username').fill(user.username);
    await page.locator('#password').fill('definitely-wrong-password');

    const signInResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/auth/signin') &&
        response.status() === 400,
    );
    await page.getByRole('button', { name: /login/i }).click();
    await signInResponse;

    await expect(
      page.locator('#mc-messages-wrapper .alert-danger'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test('unknown routes render the not found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(page).toHaveURL(/\/not-found/);
    await expect(
      page.getByRole('heading', { name: /this page cannot be found/i }),
    ).toBeVisible();
  });

  test('visiting an authenticated route while signed out redirects to sign in', async ({
    page,
  }) => {
    await page.goto('/messages');

    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('circles page lists seeded tribes', async ({ page }) => {
    await page.goto('/circles');
    await waitForTribesList(page);

    await expect(page).toHaveURL(/\/circles/);
    await expect(
      page.locator('h3.tribe-label', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('h3.tribe-label', { hasText: 'Cyclists' }).first(),
    ).toBeVisible();
  });

  for (const { path, title } of [
    { path: '/faq', title: /FAQ - Site & community - Trustroots/ },
    { path: '/faq/circles', title: /FAQ - Circles - Trustroots/ },
    { path: '/faq/foundation', title: /FAQ - Foundation - Trustroots/ },
    { path: '/faq/technology', title: /FAQ - Technology - Trustroots/ },
    {
      path: '/faq/bugs-and-features',
      title: /FAQ - Bugs & Features - Trustroots/,
    },
    { path: '/contribute', title: /Contribute - Trustroots/ },
    { path: '/team', title: /Team - Trustroots/ },
    { path: '/privacy', title: /Privacy policy - Trustroots/ },
    { path: '/rules', title: /Rules - Trustroots/ },
    { path: '/guide', title: /Guide - Trustroots/ },
    { path: '/foundation', title: /Foundation - Trustroots/ },
    { path: '/media', title: /Media - Trustroots/ },
    { path: '/volunteering', title: /Volunteering - Trustroots/ },
    { path: '/support', title: /Support - Trustroots/ },
    { path: '/contact', title: /Contact us - Trustroots/ },
  ]) {
    test(`public marketing page ${path} loads`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));
      await expect(page).toHaveTitle(title);
    });
  }

  test('support page renders the contact form', async ({ page }) => {
    await page.goto('/support');

    await expect(
      page.getByRole('heading', { name: /trustroots support/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /contact us/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^send$/i })).toBeVisible();
  });

  test('invalid password reset page explains the link is no longer valid', async ({
    page,
  }) => {
    await page.goto('/password/reset/invalid');

    await expect(page).toHaveURL(/\/password\/reset\/invalid/);
    await expect(
      page.getByRole('heading', { name: /password reset is invalid/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /ask for a new password reset/i }),
    ).toHaveAttribute('href', '/password/forgot');
  });

  test('/about redirects to the homepage', async ({ page }) => {
    await page.goto('/about');

    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page).toHaveTitle(/Trustroots/);
  });
});
