const path = require('path');
const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
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

test.describe('authenticated member flows', () => {
  let authenticatedMember;

  test.beforeEach(async ({ page, request }) => {
    // Authenticate in the test's own browser context. A storage state created
    // by an earlier project can outlive its server-side session in CI.
    if (!authenticatedMember) {
      authenticatedMember = createUser();
      await registerViaApi(request, authenticatedMember);
    }
    await signInViaApi(page, request, authenticatedMember);
  });

  test('search page loads for a signed in member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Search map loads for a signed-in member.',
      'Location bounding-box query returns seeded offers.',
      'Offer deep-link query resolves the selected offer.',
      'Circle filter query resolves the selected circle.',
      'Search map renders with deterministic offline style.',
      'Route fixture offers populate the rendered map source.',
      'Empty map-offers fixture leaves the search map usable.',
      'Rendered map offer deep-link opens deterministic sidebar data.',
    ]);

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

  test('search members page loads', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'search.members', [
      'Search members page loads.',
      'Search returns seeded hosts.',
      'Search handles empty or no-result states.',
    ]);

    await page.goto('/search/members');

    await expect(page).toHaveURL(/\/search\/members/);
    await expect(page).toHaveTitle(/Search members - Trustroots/);
  });

  test('search members page finds seeded hosts', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'search.members', [
      'Search members page loads.',
      'Search returns seeded hosts.',
      'Search handles empty or no-result states.',
    ]);

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
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.unconfirmed-restrictions', [
      'Unconfirmed member opening inbox is prompted to activate profile.',
      'Restricted message actions are unavailable until confirmation.',
    ]);

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

  test('profile edit "about" form is reachable', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-about', [
      'About edit form is reachable.',
      'Valid profile changes persist and are visible on profile view.',
      'Validation errors are visible for invalid content.',
    ]);

    await page.goto('/profile/edit');

    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByText(/describe yourself/i)).toBeVisible();
  });

  test('profile edit account page is reachable', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'account.details-update', [
      'Account edit page is reachable.',
      'Valid account details update persists.',
      'Invalid account details show validation errors.',
    ]);

    await page.goto('/profile/edit/account');

    await expect(page).toHaveURL(/\/profile\/edit\/account/);
    await expect(page).toHaveTitle(/Account - Trustroots/);
  });

  test('member can view their own profile', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-about', [
      'Own profile about tab loads.',
      'Other member profile about tab loads.',
      'Profile API returns public profile data.',
    ]);

    // Own profile is tied to the session user. Use an isolated context so the
    // viewed username always matches the signed-in member, even when other
    // specs mutate the shared authenticated storage state.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const member = createUser();
      await registerViaApi(context.request, member);
      await signInViaApi(page, context.request, member);

      const profileResponse = page.waitForResponse(
        response =>
          response.url().includes(`/api/users/${member.username}`) &&
          response.ok(),
      );

      await page.goto(`/profile/${member.username}`);
      await profileResponse;

      await expect(page).toHaveURL(new RegExp(`/profile/${member.username}`));
      await expect(page).toHaveTitle(/Profile - Trustroots/);
    } finally {
      await context.close();
    }
  });

  test('member can view a seeded host profile', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-about', [
      'Own profile about tab loads.',
      'Other member profile about tab loads.',
      'Profile API returns public profile data.',
    ]);

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

  test('profile edit locations page is reachable', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-locations', [
      'Locations edit form is reachable.',
      'Geocoding/map interactions are stubbed deterministically.',
      'Valid location changes persist.',
    ]);

    await page.goto('/profile/edit/locations');

    await expect(page).toHaveURL(/\/profile\/edit\/locations/);
    await expect(page.getByText(/where do you live/i)).toBeVisible();
  });

  test('statistics page loads for a signed in member', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.statistics', [
      'Statistics page loads for visitors.',
      'Statistics page loads for signed-in members.',
      'Public statistics API returns deterministic data.',
      'Signed-in members without an eligible contact see a general experience-writing encouragement.',
    ]);

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, SEEDED_MEMBERS[2]);
      await page.goto('/statistics');

      await expect(page).toHaveURL(/\/statistics/);
      await expect(page).toHaveTitle(/Statistics - Trustroots/);
      await expect(
        page.getByText(
          "Help make this picture more complete by sharing an experience from a member's profile.",
        ),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('statistics suggests an eligible contact and opens their experience form', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.statistics', [
      'Signed-in members can be encouraged to write an experience for an eligible confirmed contact.',
      'The personalised encouragement opens the suggested contact experience form.',
    ]);

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await signInViaApi(page, context.request, SEEDED_MEMBERS[1]);
      await page.goto('/statistics');

      const contact = SEEDED_RELATIONSHIP_MEMBERS.alice;
      const suggestion = page.getByRole('link', {
        name: `Why not write some nice words about ${contact.firstName} ${contact.lastName}?`,
      });
      await expect(suggestion).toHaveAttribute(
        'href',
        `/profile/${contact.username}/experiences/new`,
      );

      await suggestion.click();
      await expect(page).toHaveURL(
        new RegExp(`/profile/${contact.username}/experiences/new`),
      );
      await expect(
        page.getByRole('heading', { name: 'How do you know them?' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('profile edit networks page is reachable', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
      'Invalid Nostr secret key is rejected.',
      'Valid npub is saved and shown on profile view.',
    ]);

    await page.goto('/profile/edit/networks');

    await expect(page).toHaveURL(/\/profile\/edit\/networks/);
    await expect(page.locator('#nostrNpub')).toBeVisible();
  });

  test('logged in member can browse circles while unconfirmed', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.list', [
      'Circles list loads for signed-in members.',
    ]);

    await page.goto('/circles');
    await waitForTribesList(page);

    await expect(
      page.locator('h3.tribe-label', { hasText: 'Hitchhikers' }),
    ).toBeVisible();
  });

  test('regular members are turned away from admin tools', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'admin.dashboard', [
      'Regular member is denied access to admin tools.',
    ]);

    page.once('dialog', dialog => dialog.accept());

    await page.goto('/admin/search-users');

    await expect(page).toHaveURL(/\/volunteering/);
  });

  test('profile edit photo page is reachable', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-photo', [
      'Photo edit page is reachable.',
    ]);

    await page.goto('/profile/edit/photo');

    await expect(page).toHaveURL(/\/profile\/edit\/photo/);
    await expect(page).toHaveTitle(/Edit profile photo - Trustroots/);
    await expect(page.getByText(/profile photo/i).first()).toBeVisible();
  });

  test('member can upload a valid profile photo', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-photo', [
      'Valid upload succeeds through deterministic file processing.',
    ]);

    const validAvatarPath = path.join(
      __dirname,
      '../../../../modules/users/tests/server/img/avatar.png',
    );
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const member = createUser();
      await registerViaApi(context.request, member);
      await signInViaApi(page, context.request, member);

      await page.goto('/profile/edit/photo');
      await expect(page.locator('#profile-edit-avatar-file')).toBeVisible();

      const uploadResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/users-avatar') && response.ok(),
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('#profile-edit-avatar-file').click(),
      ]);
      await fileChooser.setFiles(validAvatarPath);
      await uploadResponse;

      await expect(
        page.locator('#mc-messages-wrapper .alert-success'),
      ).toContainText('Profile photo updated.');
    } finally {
      await context.close();
    }
  });

  test('invalid profile photo upload shows an error', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-photo', [
      'Invalid upload shows an error.',
    ]);

    const invalidAvatarPath = path.join(
      __dirname,
      '../../../../modules/users/tests/server/img/test-actually-pdf-looks-like-jpg.jpg',
    );
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const member = createUser();
      await registerViaApi(context.request, member);
      await signInViaApi(page, context.request, member);

      await page.goto('/profile/edit/photo');
      await expect(page.locator('#profile-edit-avatar-file')).toBeVisible();

      const uploadResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/users-avatar') &&
          response.status() === 415,
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('#profile-edit-avatar-file').click(),
      ]);
      await fileChooser.setFiles(invalidAvatarPath);
      await uploadResponse;

      await expect(
        page.locator('#mc-messages-wrapper .alert-danger'),
      ).toContainText('Sorry, we do not support this type of file.');
    } finally {
      await context.close();
    }
  });

  test('avatar endpoint returns uploaded or fallback image', async ({
    browser,
    baseURL,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-photo', [
      'Avatar endpoint returns uploaded or fallback image.',
    ]);

    const validAvatarPath = path.join(
      __dirname,
      '../../../../modules/users/tests/server/img/avatar.png',
    );
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      const member = createUser();
      const registered = await registerViaApi(context.request, member);
      await signInViaApi(page, context.request, member);

      const fallbackResponse = await page.request.get(
        `/api/users/${registered._id}/avatar?source=none`,
        { maxRedirects: 0 },
      );
      expect(fallbackResponse.status()).toBe(302);
      expect(fallbackResponse.headers().location).toContain('/img/avatar-');

      await page.goto('/profile/edit/photo');
      const uploadResponse = page.waitForResponse(
        response =>
          response.url().includes('/api/users-avatar') && response.ok(),
      );
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('#profile-edit-avatar-file').click(),
      ]);
      await fileChooser.setFiles(validAvatarPath);
      await uploadResponse;
      await expect(
        page.locator('#mc-messages-wrapper .alert-success'),
      ).toContainText('Profile photo updated.');

      const uploadedResponse = await page.request.get(
        `/api/users/${registered._id}/avatar?source=local`,
        { maxRedirects: 0 },
      );
      expect(uploadedResponse.status()).toBe(302);
      expect(uploadedResponse.headers().location).toContain(
        `/uploads-profile/${registered._id}/avatar/`,
      );
    } finally {
      await context.close();
    }
  });

  test('navigation page lists member shortcuts', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'public.navigation', [
      'Member navigation page loads.',
      'Navigation lists the expected member shortcuts.',
      'Navigation links to public statistics.',
      'Sign out action clears the session.',
    ]);

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
    await expect(page.locator('.list-group a[href="/statistics"]')).toHaveText(
      'Statistics',
    );
  });

  test('member can sign out', async ({ browser, baseURL }, testInfo) => {
    annotateFeature(testInfo, 'public.navigation', [
      'Member navigation page loads.',
      'Navigation lists the expected member shortcuts.',
      'Sign out action clears the session.',
    ]);

    annotateFeature(testInfo, 'auth.signout', [
      'Sign out endpoint clears the session.',
      'Browser lands on the homepage after sign out.',
    ]);

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
