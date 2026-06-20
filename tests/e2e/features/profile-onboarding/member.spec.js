const { annotateFeature, test, expect } = require('../../support/test');

const {
  SEEDED_EXPERIENCE,
  SEEDED_MEMBERS,
  SEEDED_OFFER,
  SEEDED_PROFILE_DESCRIPTION,
  SEEDED_SHADOW,
  EUROPE_OFFERS_QUERY,
  fetchUserIdByUsername,
  signInViaApi,
  waitForTribesList,
} = require('../../support/helpers');

const berlin = SEEDED_MEMBERS[0];
const portland = SEEDED_MEMBERS[1];

test.describe('confirmed member flows', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, berlin);
  });

  test('own profile lists joined circles', async ({ page }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-circles', [
      'Own profile lists joined circles.',
    ]);

    const profileResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/users/${berlin.username}`) &&
        response.ok(),
    );
    await page.goto(`/profile/${berlin.username}`);
    await profileResponse;

    await expect(
      page.locator('.tribe-badge-link', { hasText: 'Hitchhikers' }),
    ).toBeVisible();
    await expect(
      page.locator('.tribe-badge-link', { hasText: 'Cyclists' }),
    ).toBeVisible();
  });

  test('own contacts page shows the empty state', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-contacts', [
      'Own contacts tab can show empty state.',
      'Other member contacts tab can list contacts when present.',
    ]);

    annotateFeature(testInfo, 'contacts.lists-and-common', [
      'Contact list empty state is visible.',
      'Contact list shows confirmed contacts.',
      'Common contacts endpoint filters to shared contacts.',
    ]);

    const berlinId = await fetchUserIdByUsername(request, berlin.username);
    const contacts = await page.request.get(`/api/contacts/${berlinId}`);
    expect(contacts.ok()).toBeTruthy();
    expect(await contacts.json()).toEqual([]);

    await page.goto(`/profile/${berlin.username}/contacts`);

    await expect(page).toHaveURL(
      new RegExp(`/profile/${berlin.username}/contacts`),
    );
    await expect(
      page
        .locator('.profile-tabs a')
        .filter({ hasText: /contacts/i })
        .getByText('0'),
    ).toBeVisible();
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

  test('another host profile shows their about description', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-about', [
      'Own profile about tab loads.',
      'Other member profile about tab loads.',
      'Profile API returns public profile data.',
    ]);

    await page.goto(`/profile/${portland.username}`);

    await expect(
      page.getByText(SEEDED_PROFILE_DESCRIPTION).first(),
    ).toBeVisible();
  });

  test('third seeded host profile is visible to signed-in members', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-overview', [
      'Own overview tab loads.',
      'Other member overview tab loads.',
    ]);

    const beijing = SEEDED_MEMBERS[2];

    await page.goto(`/profile/${beijing.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${beijing.username}`));
    await expect(
      page
        .locator('.profile-name:visible')
        .filter({ hasText: `${beijing.firstName} ${beijing.lastName}` }),
    ).toBeVisible();
  });

  test('seeded host profile API returns profile data', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-about', [
      'Own profile about tab loads.',
      'Other member profile about tab loads.',
      'Profile API returns public profile data.',
    ]);

    const host = SEEDED_MEMBERS[0];
    const response = await request.get(`/api/users/${host.username}`);

    expect(response.ok()).toBeTruthy();

    const profile = await response.json();
    expect(profile.username).toBe(host.username);
    expect(profile.displayName).toBe(`${host.firstName} ${host.lastName}`);
  });

  test('another host accommodation page shows hosting details', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-accommodation', [
      'Accommodation tab loads for a host.',
      'Hosting details from seeded offer/profile are visible.',
    ]);

    await page.goto(`/profile/${portland.username}/accommodation`);

    await expect(page.getByText(SEEDED_OFFER.hostingStatus)).toBeVisible();
    await expect(page.getByText(SEEDED_OFFER.description)).toBeVisible();
    await expect(page.getByText(SEEDED_OFFER.maxGuestsLabel)).toBeVisible();
  });

  test('profile actions link to messaging and experiences', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Profile action links to a new message thread.',
      'New thread empty state is visible.',
      'Sending an opening message creates the conversation.',
    ]);

    annotateFeature(testInfo, 'experiences.create', [
      'Experience form opens from profile actions.',
      'Valid public experience can be submitted.',
      'Valid private experience can be submitted when supported.',
      'Validation errors are shown for invalid submissions.',
    ]);

    await page.goto(`/profile/${portland.username}`);

    await expect(
      page.getByRole('link', { name: /send a message/i }).first(),
    ).toHaveAttribute('href', `/messages/${portland.username}`);
    await expect(
      page.getByRole('link', { name: /share your experience/i }).first(),
    ).toHaveAttribute('href', `/profile/${portland.username}/experiences/new`);
  });

  test('profile experiences tab is reachable from another member profile', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.profile-list', [
      'Profile experiences tab is reachable.',
    ]);

    const experiencesResponse = page.waitForResponse(
      response => response.url().includes('/api/experiences') && response.ok(),
    );

    await page.goto(`/profile/${portland.username}`);
    await page.getByRole('tab', { name: /experiences/i }).click();
    await experiencesResponse;

    await expect(page).toHaveURL(
      new RegExp(`/profile/${portland.username}/experiences`),
    );
    await expect(page.getByText(SEEDED_EXPERIENCE.summary)).toBeVisible();
  });

  test('member can join an additional circle from the circles page', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.join-leave', [
      'Member can join an additional circle.',
      'Member can leave a joined circle.',
      'Membership updates are reflected on profile and circle list.',
    ]);

    await page.goto('/circles');
    await waitForTribesList(page);

    const joinResponse = page.waitForResponse(
      response =>
        response.url().match(/\/api\/users\/memberships\//) &&
        response.request().method() === 'POST' &&
        response.ok(),
    );

    const vegansCard = page
      .locator('.tribe')
      .filter({ has: page.getByRole('heading', { name: 'Vegans' }) });
    await expect(vegansCard).toBeVisible();

    const joinButton = vegansCard.locator('button.tribe-join');
    await expect(joinButton).toContainText(/^\s*join\s*$/i);
    await joinButton.click();
    await joinResponse;

    await expect(joinButton).toContainText(/joined/i);
  });

  test('shadowbanned member profiles are hidden from other members', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.visibility-hidden-users', [
      'Missing profile shows user-not-found UI.',
      'Shadowbanned profile is hidden in browser view.',
      'Shadowbanned profile is hidden through profile API.',
    ]);

    annotateFeature(testInfo, 'safety.shadowban-hiding', [
      'Shadowbanned profile is hidden from members.',
      'Shadow-hidden messages are not visible to regular recipients.',
      'Admin tools can still inspect shadow-hidden content.',
    ]);

    await page.goto(`/profile/${SEEDED_SHADOW.username}`);

    await expect(
      page.getByText(/the person you are looking for is not available/i),
    ).toBeVisible();
  });

  test('members cannot load a shadowbanned profile through the API', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.visibility-hidden-users', [
      'Missing profile shows user-not-found UI.',
      'Shadowbanned profile is hidden in browser view.',
      'Shadowbanned profile is hidden through profile API.',
    ]);

    const response = await request.get(`/api/users/${SEEDED_SHADOW.username}`);
    expect(response.status()).toBe(404);
  });

  test('map offers API returns seeded hosts in Europe', async ({
    request,
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

    const response = await request.get(`/api/offers${EUROPE_OFFERS_QUERY}`);
    expect(response.ok()).toBeTruthy();

    const offers = await response.json();
    expect(Array.isArray(offers.features)).toBeTruthy();
    expect(offers.features.length).toBeGreaterThan(0);
  });

  test('inbox thread opens the conversation view', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.thread-open', [
      'Thread view opens from inbox.',
      'Thread view shows seeded replies.',
      'Thread can be opened by username or userId route/query.',
    ]);

    const portlandId = await fetchUserIdByUsername(request, portland.username);

    await page.goto('/messages');
    await page.getByRole('link', { name: /portland host/i }).click();

    await expect(page).toHaveURL(
      new RegExp(`/messages/${portland.username}\\?userId=${portlandId}`),
    );
    await expect(page.getByText(/yes, happy to host you!/i)).toBeVisible();
  });

  test('host offer edit page loads for a confirmed member', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.host', [
      'Host offer edit page loads.',
      'Member can create/update a host offer.',
      'Host offer visibility appears in profile/search.',
      'Member can remove or disable a host offer.',
    ]);

    await page.goto('/offer/host');

    await expect(page).toHaveURL(/\/offer\/host/);
    await expect(page).toHaveTitle(/Host travellers - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /can you host\?/i }),
    ).toBeVisible();
  });

  test('meet offers list page shows the empty state', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.meet-list', [
      'Meet offers list page loads.',
      'Empty state is shown when member has no meet offers.',
      'Existing meet offers are listed with edit links.',
    ]);

    await page.goto('/offer/meet');

    await expect(page).toHaveURL(/\/offer\/meet/);
    await expect(page).toHaveTitle(/Meet - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /your meetups/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/meetups stay visible on map at most one month/i),
    ).toBeVisible();
  });

  test('profile tribes tab lists joined circles', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.view-circles', [
      'Profile circles tab lists joined circles.',
    ]);

    const profileResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/users/${berlin.username}`) &&
        response.ok(),
    );
    await page.goto(`/profile/${berlin.username}/tribes`);
    await profileResponse;

    await expect(page).toHaveURL(
      new RegExp(`/profile/${berlin.username}/tribes`),
    );
    await expect(
      page.locator('.tribe-link', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.tribe-link', { hasText: 'Cyclists' }).first(),
    ).toBeVisible();
  });

  test('new message thread shows the empty conversation state', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'messages.new-conversation', [
      'Profile action links to a new message thread.',
      'New thread empty state is visible.',
      'Sending an opening message creates the conversation.',
    ]);

    const beijing = SEEDED_MEMBERS[2];
    const beijingId = await fetchUserIdByUsername(request, beijing.username);

    await page.goto(`/messages/${beijing.username}?userId=${beijingId}`);

    await expect(page.getByText(/you haven't been talking yet/i)).toBeVisible();
  });

  test('experience form shows duplicate when already shared', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'experiences.duplicate-prevention', [
      'Existing experience is detected.',
      'Duplicate create form shows the already-shared state.',
    ]);

    await page.goto(`/profile/${portland.username}/experiences/new`);

    await expect(page).toHaveURL(
      new RegExp(`/profile/${portland.username}/experiences/new`),
    );
    await expect(
      page.getByText(/you already shared your experience with them/i),
    ).toBeVisible();
  });
});
