const path = require('path');
const fs = require('fs');
const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  createUser,
  registerViaApi,
  signInViaApi,
  signOut,
  waitForTribesList,
} = require('../../support/helpers');

const seededMemberStoragePath = path.join(
  __dirname,
  '../../.auth/seeded-member.json',
);

const userPath = path.join(__dirname, '../../.auth/user.json');

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

  test('welcome onboarding page links to profile completion', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.welcome-onboarding', [
      'Welcome page loads for a newly authenticated member.',
      'Welcome/onboarding links guide the member to profile completion.',
    ]);

    await page.goto('/welcome');

    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /fill your profile/i }),
    ).toHaveAttribute('href', '/profile/edit');
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
    const searchResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/users?search=') &&
        response.request().method() === 'GET' &&
        response.ok(),
    );
    await page.locator('#search-users-form button[type="submit"]').click();
    await searchResponse;
    await expect(
      page.getByRole('link', {
        name: `${SEEDED_MEMBERS[0].firstName} ${SEEDED_MEMBERS[0].lastName}`,
        exact: true,
      }),
    ).toBeVisible();
  });

  test('inbox prompts an unconfirmed member to activate their profile', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const unconfirmed = createUser();
      await registerViaApi(context.request, unconfirmed);
      await signInViaApi(page, context.request, unconfirmed);
      await page.goto('/messages');

      await expect(page).toHaveURL(/\/messages/);
      await expect(
        page.getByText(/activate your profile by confirming your email/i),
      ).toBeVisible();
    } finally {
      await context.close();
    }
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
    await expect(
      page.getByText(
        /your profile will not be visible to others until you confirm your email/i,
      ),
    ).toBeVisible();
  });

  test('member can view a seeded host profile', async ({
    browser,
    baseURL,
  }) => {
    const host = SEEDED_MEMBERS[1];
    const seededMemberContext = await browser.newContext({
      baseURL,
      storageState: seededMemberStoragePath,
    });
    const seededMemberPage = await seededMemberContext.newPage();

    try {
      await seededMemberPage.goto(`/profile/${host.username}`);

      await expect(seededMemberPage).toHaveURL(
        new RegExp(`/profile/${host.username}`),
      );
      await expect(
        seededMemberPage.locator('.row.hidden-xs h4.profile-username'),
      ).toHaveText(`@${host.username}`);
    } finally {
      await seededMemberContext.close();
    }
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
      page.locator('h3.tribe-label', { hasText: 'Hitchhikers' }),
    ).toBeVisible();
  });

  test('regular members are turned away from admin tools', async ({ page }) => {
    page.once('dialog', dialog => dialog.accept());

    await page.goto('/admin/search-users');

    await expect(page).toHaveURL(/\/volunteering/);
  });

  test('profile edit photo page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/photo');

    await expect(page).toHaveURL(/\/profile\/edit\/photo/);
    await expect(page).toHaveTitle(/Edit profile photo - Trustroots/);
    await expect(page.getByText(/profile photo/i).first()).toBeVisible();
  });

  test('navigation page lists member shortcuts', async ({ page }) => {
    await page.goto('/navigation');

    await expect(page).toHaveURL(/\/navigation/);
    await expect(page).toHaveTitle(/Navigation - Trustroots/);
    const shortcutLinks = page.locator('.list-group.container-spacer');

    await expect(
      shortcutLinks.locator('.page-navigation-profile', {
        hasText: /view your profile/i,
      }),
    ).toBeVisible();
    await expect(
      shortcutLinks.locator('a[href="/profile/edit"]', {
        hasText: /edit profile/i,
      }),
    ).toBeVisible();
    await expect(
      shortcutLinks.locator('a[href="/search/members"]', {
        hasText: /find people/i,
      }),
    ).toBeVisible();
  });

  test('member can sign out', async ({ browser, baseURL }) => {
    // Sign out tears down the session, so run it against a throwaway account in
    // an isolated context. That keeps the shared authenticated session intact
    // for the other tests in this file when they run in parallel.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const throwaway = createUser();
      await registerViaApi(context.request, throwaway);
      await signInViaApi(page, context.request, throwaway);

      await signOut(page);

      await page.goto('/messages');
      await expect(page).toHaveURL(/\/signin/);
    } finally {
      await context.close();
    }
  });
});
