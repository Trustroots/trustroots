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
    await page.goto(`/profile/${berlin.username}`);

    await expect(page.getByText('Hitchhikers').first()).toBeVisible();
    await expect(page.getByText('Cyclists').first()).toBeVisible();
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

    const vegansCard = page
      .locator('.tribe')
      .filter({ has: page.getByRole('heading', { name: 'Vegans' }) });
    await vegansCard.getByRole('button', { name: /^join$/i }).click();

    await expect(
      vegansCard.getByRole('button', { name: /^joined$/i }),
    ).toBeVisible();
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
});
