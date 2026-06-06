const { test, expect } = require('./test');

const {
  SEEDED_EXPERIENCE,
  SEEDED_MEMBERS,
  SEEDED_OFFER,
  SEEDED_PROFILE_DESCRIPTION,
  SEEDED_SHADOW,
  EUROPE_OFFERS_QUERY,
  fetchUserIdByUsername,
  waitForTribesList,
} = require('./helpers');

const berlin = SEEDED_MEMBERS[0];
const portland = SEEDED_MEMBERS[1];

test.describe('confirmed member flows', () => {
  test('own profile lists joined circles', async ({ page }) => {
    const profileResponse = page.waitForResponse(
      response =>
        response.url().includes(`/api/users/${berlin.username}`) &&
        response.ok(),
    );
    await page.goto(`/profile/${berlin.username}`);
    await profileResponse;

    await expect(
      page.locator('.tribe-label', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.tribe-label', { hasText: 'Cyclists' }).first(),
    ).toBeVisible();
  });

  test('own contacts page shows the empty state', async ({ page }) => {
    await page.goto(`/profile/${berlin.username}/contacts`);

    await expect(page.getByText(/no contacts yet/i)).toBeVisible();
  });

  test('profile edit networks page is reachable', async ({ page }) => {
    await page.goto('/profile/edit/networks');

    await expect(page).toHaveURL(/\/profile\/edit\/networks/);
    await expect(page.locator('#nostrNpub')).toBeVisible();
  });

  test('another host profile shows their about description', async ({
    page,
  }) => {
    await page.goto(`/profile/${portland.username}`);

    await expect(
      page.getByText(SEEDED_PROFILE_DESCRIPTION).first(),
    ).toBeVisible();
  });

  test('third seeded host profile is visible to signed-in members', async ({
    page,
  }) => {
    const beijing = SEEDED_MEMBERS[2];

    await page.goto(`/profile/${beijing.username}`);

    await expect(page).toHaveURL(new RegExp(`/profile/${beijing.username}`));
    await expect(
      page.getByText(`${beijing.firstName} ${beijing.lastName}`).first(),
    ).toBeVisible();
  });

  test('seeded host profile API returns profile data', async ({ request }) => {
    const host = SEEDED_MEMBERS[0];
    const response = await request.get(`/api/users/${host.username}`);

    expect(response.ok()).toBeTruthy();

    const profile = await response.json();
    expect(profile.username).toBe(host.username);
    expect(profile.displayName).toBe(`${host.firstName} ${host.lastName}`);
  });

  test('another host accommodation page shows hosting details', async ({
    page,
  }) => {
    await page.goto(`/profile/${portland.username}/accommodation`);

    await expect(page.getByText(SEEDED_OFFER.hostingStatus)).toBeVisible();
    await expect(page.getByText(SEEDED_OFFER.description)).toBeVisible();
    await expect(page.getByText(SEEDED_OFFER.maxGuestsLabel)).toBeVisible();
  });

  test('profile actions link to messaging and experiences', async ({
    page,
  }) => {
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
  }) => {
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
  }) => {
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
    await expect(joinButton).toContainText(/^join$/i);
    await joinButton.click();
    await joinResponse;

    await expect(joinButton).toContainText(/joined/i);
  });

  test('shadowbanned member profiles are hidden from other members', async ({
    page,
  }) => {
    await page.goto(`/profile/${SEEDED_SHADOW.username}`);

    await expect(
      page.getByText(/the person you are looking for is not available/i),
    ).toBeVisible();
  });

  test('members cannot load a shadowbanned profile through the API', async ({
    request,
  }) => {
    const response = await request.get(`/api/users/${SEEDED_SHADOW.username}`);
    expect(response.status()).toBe(404);
  });

  test('map offers API returns seeded hosts in Europe', async ({ request }) => {
    const response = await request.get(`/api/offers${EUROPE_OFFERS_QUERY}`);
    expect(response.ok()).toBeTruthy();

    const offers = await response.json();
    expect(Array.isArray(offers.features)).toBeTruthy();
    expect(offers.features.length).toBeGreaterThan(0);
  });

  test('inbox thread opens the conversation view', async ({
    page,
    request,
  }) => {
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
  }) => {
    await page.goto('/offer/host');

    await expect(page).toHaveURL(/\/offer\/host/);
    await expect(page).toHaveTitle(/Host travellers - Trustroots/);
    await expect(
      page.getByRole('heading', { name: /can you host\?/i }),
    ).toBeVisible();
  });

  test('meet offers list page shows the empty state', async ({ page }) => {
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

  test('profile tribes tab lists joined circles', async ({ page }) => {
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
      page.locator('.tribe-label', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('.tribe-label', { hasText: 'Cyclists' }).first(),
    ).toBeVisible();
  });

  test('new message thread shows the empty conversation state', async ({
    page,
    request,
  }) => {
    const beijing = SEEDED_MEMBERS[2];
    const beijingId = await fetchUserIdByUsername(request, beijing.username);

    await page.goto(`/messages/${beijing.username}?userId=${beijingId}`);

    await expect(page.getByText(/you haven't been talking yet/i)).toBeVisible();
  });

  test('experience form shows duplicate when already shared', async ({
    page,
  }) => {
    await page.goto(`/profile/${portland.username}/experiences/new`);

    await expect(page).toHaveURL(
      new RegExp(`/profile/${portland.username}/experiences/new`),
    );
    await expect(
      page.getByText(/you already shared your experience with them/i),
    ).toBeVisible();
  });
});
