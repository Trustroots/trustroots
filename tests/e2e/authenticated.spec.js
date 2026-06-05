const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const { SEEDED_MEMBERS, signOut, waitForTribesList } = require('./helpers');

const userPath = path.join(__dirname, '.auth/user.json');

/** @type {ReturnType<typeof import('./helpers').createUser>} */
let user;

test.describe('authenticated member flows', () => {
  test.beforeAll(async () => {
    user = JSON.parse(fs.readFileSync(userPath, 'utf8'));
  });

  test('search page loads for a signed in member', async ({ page }) => {
    await page.goto('/search');

    await expect(page).toHaveURL(/\/search/);
    await expect(page).toHaveTitle(/Search - Trustroots/);
  });

  test('search members page loads', async ({ page }) => {
    await page.goto('/search/members');

    await expect(page).toHaveURL(/\/search\/members/);
    await expect(page).toHaveTitle(/Search members - Trustroots/);
  });

  test('search members page finds seeded hosts', async ({ page }) => {
    await page.goto('/search/members');

    await page
      .locator('#search-users-form input')
      .fill(SEEDED_MEMBERS[0].username);
    await page.locator('#search-users-form button[type="submit"]').click();

    await expect(
      page.getByText(SEEDED_MEMBERS[0].username).first(),
    ).toBeVisible();
  });

  test('inbox prompts an unconfirmed member to activate their profile', async ({
    page,
  }) => {
    await page.goto('/messages');

    await expect(page).toHaveURL(/\/messages/);
    await expect(
      page.getByText(/activate your profile by confirming your email/i),
    ).toBeVisible();
  });

  test('profile edit "about" form is reachable', async ({ page }) => {
    await page.goto('/profile/edit');

    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByText(/describe yourself/i)).toBeVisible();
  });

  test('profile edit account page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/account');

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(page).toHaveTitle(/Account - Trustroots/);
  });

  test('member can view their own profile', async ({ page }) => {
    await page.goto(`/profile/${user.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
    await expect(page).toHaveTitle(/Profile - Trustroots/);
    await expect(page.locator('h2.profile-name')).toHaveText(
      `${user.firstName} ${user.lastName}`,
    );
  });

  test('member can view a seeded host profile', async ({ page }) => {
    const host = SEEDED_MEMBERS[1];

    await page.goto(`/profile/${host.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${host.username}`));
    await expect(
      page.getByText(`${host.firstName} ${host.lastName}`).first(),
    ).toBeVisible();
  });

  test('profile edit locations page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/locations');

    await expect(page).toHaveURL(/\/profile\/edit\/locations/);
    await expect(page.getByText(/where do you live/i)).toBeVisible();
  });

  test('statistics page loads for a signed in member', async ({ page }) => {
    await page.goto('/statistics');

    await expect(page).toHaveURL(/\/statistics/);
    await expect(page).toHaveTitle(/Statistics - Trustroots/);
  });

  test('profile edit networks page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/networks');

    await expect(page).toHaveURL(/\/profile\/edit\/networks/);
    await expect(page.locator('#nostrNpub')).toBeVisible();
  });

  test('logged in member can browse circles while unconfirmed', async ({
    page,
  }) => {
    await page.goto('/circles');
    await waitForTribesList(page);

    await expect(
      page.getByRole('heading', { name: 'Hitchhikers' }),
    ).toBeVisible();
  });

  test('regular members are turned away from admin tools', async ({ page }) => {
    page.once('dialog', dialog => dialog.accept());

    await page.goto('/admin/search-users');

    await expect(page).toHaveURL(/\/volunteering/);
  });

  test('member can sign out', async ({ page }) => {
    await signOut(page);

    await page.goto('/messages');
    await expect(page).toHaveURL(/\/signin/);
  });
});
