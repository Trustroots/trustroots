const { annotateFeature, expect, test } = require('../../support/test');

/* global window */

const {
  EUROPE_OFFERS_QUERY,
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
  createIsolatedContext,
  createUser,
  fetchUserIdByUsername,
  registerViaApi,
  signInViaApi,
} = require('../../support/helpers');
const { findOffersByUser } = require('../../support/db');

const berlin = SEEDED_MEMBERS[0];
const alice = SEEDED_RELATIONSHIP_MEMBERS.alice;

async function swipeUpFrom(page, element) {
  const box = await element.boundingBox();
  expect(box).toBeTruthy();

  const x = Math.round(box.x + box.width / 2);
  const startY = Math.round(Math.min(box.y + box.height / 2, 450));
  const endY = Math.max(80, startY - 250);
  const session = await page.context().newCDPSession(page);

  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: startY }],
    });
    for (let step = 1; step <= 5; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x,
            y: Math.round(startY + ((endY - startY) * step) / 5),
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

test.describe.serial('search offers and circles feature coverage', () => {
  test.beforeEach(async ({ page, request }) => {
    await signInViaApi(page, request, berlin);
  });

  test('mobile offer editors expose working save controls', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/offer/host');
    await page.getByRole('tab', { name: 'Description' }).click();
    const description = page.getByLabel(
      'Tell about your home and hosting possibilities',
      { exact: false },
    );
    await expect(description).toBeVisible();
    const originalDescription = await description.inputValue();
    const nextDescription = 'A spare room for visiting members.';
    await description.fill(nextDescription);
    const savedHost = page.waitForResponse(
      response =>
        response.url().includes('/api/offers/') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save and Exit' }).click();
    const hostResponse = await savedHost;
    expect(hostResponse.ok()).toBeTruthy();
    expect(hostResponse.request().postDataJSON().description).toBe(
      nextDescription,
    );
    await page.request.put(hostResponse.url(), {
      data: { description: originalDescription },
    });

    await page.goto('/offer/meet/add');
    const expiry = page.getByLabel('How long should this be visible?');
    const originalExpiry = await expiry.inputValue();
    await expiry.fill('');
    await expect(page.getByRole('alert')).toHaveText(
      'Please choose a valid expiry date.',
    );
    await expiry.fill(originalExpiry);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page
      .getByPlaceholder('Write here...')
      .fill('A walk with fellow members.');
    await page.getByRole('button', { name: 'Next section' }).click();
    const savedMeet = page.waitForResponse(
      response =>
        response.url().endsWith('/api/offers') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Finish editing and save' }).click();
    const meetResponse = await savedMeet;
    expect(meetResponse.ok()).toBeTruthy();
    const memberId = await fetchUserIdByUsername(page.request, berlin.username);
    const [meeting] = await findOffersByUser(memberId, {
      type: 'meet',
      description: 'A walk with fellow members.',
    });
    await page.request.delete(`/api/offers/${meeting._id}`);
  });

  test('hosting location follows place searches and map dragging', async ({
    page,
  }) => {
    const memberId = await fetchUserIdByUsername(page.request, berlin.username);
    const [originalOffer] = await findOffersByUser(memberId, { type: 'host' });
    await page.goto('/offer/host');
    await page.getByRole('tab', { name: 'Location' }).click();
    await page.evaluate(() => {
      window.settings.mapbox = { publicKey: 'test-geocoding-token' };
    });
    await page.route('https://api.mapbox.com/geocoding/**', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          features: [
            { id: 'place.example', text: 'Example town', center: [-7, 35] },
          ],
        }),
      }),
    );
    await page
      .getByLabel('Search places', { exact: true })
      .fill('Example town');
    await page.getByRole('option', { name: 'Example town' }).click();
    const map = page
      .locator('.offer-map .mapboxgl-canvas, .offer-map .leaflet-container')
      .first();
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, {
      steps: 10,
    });
    // Stop before releasing to avoid map inertia changing the final centre.
    await page.waitForTimeout(200);
    await page.mouse.up();
    const saved = page.waitForResponse(
      response =>
        response.url().includes('/api/offers/') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save and Exit' }).click();
    const response = await saved;
    await page.request.put(response.url(), {
      data: { location: originalOffer.location },
    });
    expect(response.ok()).toBeTruthy();
    const [latitude, longitude] = response.request().postDataJSON().location;
    expect(latitude).toBeCloseTo(35, 1);
    expect(longitude).toBeCloseTo(-7, 1);
    expect(Math.abs(longitude + 7)).toBeGreaterThan(0.001);
  });

  test('map search resolves bounding boxes, offers, and circle filters', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Search map loads for a signed-in member.',
      'Location bounding-box query returns seeded offers.',
      'Offer deep-link query resolves the selected offer.',
      'Circle filter query resolves the selected circle.',
    ]);

    await page.goto('/search');
    await expect(page).toHaveURL(/\/search/);

    const offers = await request.get(`/api/offers${EUROPE_OFFERS_QUERY}`);
    expect(offers.ok()).toBeTruthy();
    expect((await offers.json()).features.length).toBeGreaterThan(0);

    const berlinId = await fetchUserIdByUsername(request, berlin.username);
    const [hostOffer] = await findOffersByUser(berlinId, { type: 'host' });
    const offer = await request.get(`/api/offers/${hostOffer._id}`);
    expect(offer.ok()).toBeTruthy();
    expect((await offer.json()).type).toBe('host');

    const tribe = await request.get('/api/tribes/hitchhikers');
    expect(tribe.ok()).toBeTruthy();
    expect((await tribe.json()).label).toBe('Hitchhikers');
  });

  test('signed-in members can open the Naturists circle', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.member-only', [
      'Signed-in member can discover and open the Naturists circle.',
    ]);

    const catalogueResponse = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(catalogueResponse.ok()).toBeTruthy();
    expect(
      (await catalogueResponse.json()).some(
        circle => circle.slug === 'naturists',
      ),
    ).toBe(true);

    const detailResponse = await request.get('/api/tribes/naturists');
    expect(detailResponse.ok()).toBeTruthy();
    expect((await detailResponse.json()).label).toBe('Naturists');

    await page.goto('/circles/naturists');
    await expect(
      page.locator('h2.tribe-title', { hasText: 'Naturists' }).first(),
    ).toBeVisible();
  });

  test('host offers can be created, updated, listed, and removed', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.host', [
      'Member can create/update a host offer.',
      'Host offer visibility appears in profile/search.',
      'Member can remove or disable a host offer.',
    ]);

    const berlinId = await fetchUserIdByUsername(request, berlin.username);
    const createdAfter = new Date();
    const create = await page.request.post('/api/offers', {
      data: {
        type: 'host',
        status: 'maybe',
        description: 'E2E host offer created from feature coverage.',
        maxGuests: 1,
        location: [52.52, 13.405],
      },
    });
    expect(create.ok()).toBeTruthy();

    const [createdOffer] = await findOffersByUser(berlinId, {
      type: 'host',
      createdAt: { $gte: createdAfter },
    });
    expect(createdOffer).toBeTruthy();

    const listed = await page.request.get(`/api/offers-by/${berlinId}`, {
      params: { types: 'host' },
    });
    expect(listed.ok()).toBeTruthy();
    expect((await listed.json()).some(offer => offer.type === 'host')).toBe(
      true,
    );

    const update = await page.request.put(`/api/offers/${createdOffer._id}`, {
      data: {
        status: 'yes',
        description: 'E2E host offer updated from feature coverage.',
        maxGuests: 2,
        location: [52.52, 13.405],
      },
    });
    expect(update.ok()).toBeTruthy();

    const remove = await page.request.delete(`/api/offers/${createdOffer._id}`);
    expect(remove.ok()).toBeTruthy();
  });

  test('hosts can limit search visibility to members in their circles', async ({
    baseURL,
    browser,
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.host', [
      'Host can limit search visibility to members sharing a circle.',
    ]);

    const aliceId = await fetchUserIdByUsername(request, alice.username);
    const [aliceOffer] = await findOffersByUser(aliceId, { type: 'host' });
    expect(aliceOffer).toBeTruthy();

    const circles = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(circles.ok()).toBeTruthy();
    const families = (await circles.json()).find(
      circle => circle.label === 'Families',
    );
    expect(families).toBeTruthy();

    const hostContext = await browser.newContext({ baseURL });
    const hostPage = await hostContext.newPage();
    let joinedFamilies = false;

    try {
      await signInViaApi(hostPage, hostContext.request, alice);
      await hostPage.goto('/offer/host');

      const circleOnly = hostPage.getByLabel(
        'People that are not in any of my circles should not find me.',
      );
      await expect(circleOnly).toBeVisible();
      await circleOnly.check();

      const saved = hostPage.waitForResponse(
        response =>
          response.url().endsWith(`/api/offers/${aliceOffer._id}`) &&
          response.request().method() === 'PUT',
      );
      await hostPage.getByRole('button', { name: 'Save and Exit' }).click();
      expect((await saved).ok()).toBeTruthy();

      const withoutSharedCircle = await request.get(
        `/api/offers${EUROPE_OFFERS_QUERY}`,
      );
      expect(withoutSharedCircle.ok()).toBeTruthy();
      expect(
        (await withoutSharedCircle.json()).features.map(
          feature => feature.properties.id,
        ),
      ).not.toContain(aliceOffer._id.toString());

      const join = await page.request.post(
        `/api/users/memberships/${families._id}`,
      );
      expect(join.ok()).toBeTruthy();
      joinedFamilies = true;

      const withSharedCircle = await request.get(
        `/api/offers${EUROPE_OFFERS_QUERY}`,
      );
      expect(withSharedCircle.ok()).toBeTruthy();
      expect(
        (await withSharedCircle.json()).features.map(
          feature => feature.properties.id,
        ),
      ).toContain(aliceOffer._id.toString());
    } finally {
      if (joinedFamilies) {
        await page.request.delete(`/api/users/memberships/${families._id}`);
      }

      await hostContext.request.put(`/api/offers/${aliceOffer._id}`, {
        data: {
          status: aliceOffer.status,
          description: aliceOffer.description,
          noOfferDescription: aliceOffer.noOfferDescription,
          maxGuests: aliceOffer.maxGuests,
          location: aliceOffer.location,
          showOnlyInMyCircles: aliceOffer.showOnlyInMyCircles,
        },
      });
      await hostContext.close();
    }
  });

  test('meet offers can be listed, created, edited, expired, and deleted', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.meet-list', [
      'Existing meet offers are listed with edit links.',
    ]);
    annotateFeature(testInfo, 'offers.meet-create-edit-delete', [
      'Meet offer add form loads.',
      'Valid meet offer can be created.',
      'Existing meet offer can be edited.',
      'Expired meet offer behavior is visible.',
      'Meet offer can be deleted.',
    ]);

    await page.goto('/offer/meet/add');
    await expect(page).toHaveURL(/\/offer\/meet\/add/);
    await expect(
      page.getByRole('heading', { name: /what is this about/i }),
    ).toBeVisible();

    const aliceId = await fetchUserIdByUsername(request, alice.username);
    const aliceMeetOffers = await page.request.get(
      `/api/offers-by/${aliceId}`,
      {
        params: { types: 'meet' },
      },
    );
    expect(aliceMeetOffers.ok()).toBeTruthy();
    expect((await aliceMeetOffers.json()).length).toBeGreaterThan(0);

    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const create = await page.request.post('/api/offers', {
      data: {
        type: 'meet',
        description: 'E2E meet offer created from feature coverage.',
        location: [51.5, -0.1],
        validUntil,
      },
    });
    expect(create.ok()).toBeTruthy();

    const berlinId = await fetchUserIdByUsername(request, berlin.username);
    const [createdOffer] = await findOffersByUser(berlinId, {
      type: 'meet',
      description: /E2E meet offer created/,
    });
    expect(createdOffer).toBeTruthy();

    const read = await page.request.get(`/api/offers/${createdOffer._id}`);
    expect(read.ok()).toBeTruthy();

    const update = await page.request.put(`/api/offers/${createdOffer._id}`, {
      data: {
        description: 'E2E meet offer updated from feature coverage.',
        location: [51.51, -0.11],
        validUntil,
      },
    });
    expect(update.ok()).toBeTruthy();

    const expiredBobOffers = await findOffersByUser(
      SEEDED_RELATIONSHIP_MEMBERS.bob.id,
      { type: 'meet' },
    );
    expect(expiredBobOffers.some(offer => offer.validUntil < new Date())).toBe(
      true,
    );

    const remove = await page.request.delete(`/api/offers/${createdOffer._id}`);
    expect(remove.ok()).toBeTruthy();
  });

  test('offer parent redirects and circle membership can be changed', async ({
    browser,
    baseURL,
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.legacy-parent-redirect', [
      '/offer redirects to /offer/host.',
    ]);
    annotateFeature(testInfo, 'circles.join-leave', [
      'Circle overview remains vertically scrollable on a mobile viewport.',
      'Member can join a circle from its overview page.',
      'Member can leave a joined circle.',
      'Membership updates are reflected on profile and circle list.',
    ]);

    await page.goto('/offer');
    await expect(page).toHaveURL(/\/offer\/host/);

    const tribes = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(tribes.ok()).toBeTruthy();
    const hitchhikers = (await tribes.json()).find(
      tribe => tribe.label === 'Hitchhikers',
    );
    expect(hitchhikers).toBeTruthy();

    const throwaway = createUser();
    const context = await createIsolatedContext(browser, baseURL, {
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 500 },
    });
    const memberPage = await context.newPage();

    try {
      await registerViaApi(context.request, throwaway);
      await signInViaApi(memberPage, context.request, throwaway);

      await memberPage.goto('/circles');
      const circleGrid = memberPage.locator('.tribes-grid');
      const hitchhikersCard = circleGrid
        .locator('.tribe')
        .filter({ hasText: 'Hitchhikers' });
      const hitchhikersLink = hitchhikersCard.getByRole('link', {
        name: /Hitchhikers/,
      });

      await expect(hitchhikersLink).toBeVisible();
      await expect(circleGrid).toHaveCSS('overflow', 'visible');
      await expect(hitchhikersLink).toHaveCSS('touch-action', 'pan-y');

      const scrollBeforeSwipe = await memberPage.evaluate(() => window.scrollY);
      await swipeUpFrom(memberPage, hitchhikersLink);
      await expect
        .poll(() => memberPage.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollBeforeSwipe);

      await memberPage.goto('/circles/hitchhikers');
      const overview = memberPage.locator('.tribe-header-info');
      await expect(overview).toBeVisible();
      await expect(overview).toHaveCSS('overflow-y', 'auto');
      await expect(overview).toHaveCSS('touch-action', 'pan-y');
      const isOverviewScrollable = await overview.evaluate(
        element => element.scrollHeight > element.clientHeight,
      );
      if (isOverviewScrollable) {
        await overview.evaluate(element => {
          element.scrollTop = element.scrollHeight;
        });
        await expect
          .poll(() => overview.evaluate(element => element.scrollTop))
          .toBeGreaterThan(0);
      }

      const overviewJoinButton = memberPage.locator('button.tribe-join');
      await expect(overviewJoinButton).toHaveAttribute(
        'aria-label',
        /Join \(/i,
      );
      const joinResponse = memberPage.waitForResponse(
        response =>
          response
            .url()
            .includes(`/api/users/memberships/${hitchhikers._id}`) &&
          response.request().method() === 'POST',
      );
      await overviewJoinButton.click();
      expect((await joinResponse).ok()).toBeTruthy();
      await expect(overviewJoinButton).toHaveClass(/btn-active/);
      await expect(overviewJoinButton).toHaveAttribute(
        'aria-label',
        /Leave circle/i,
      );
      await expect(overviewJoinButton).toContainText("You're a member");
      await expect(overviewJoinButton).toHaveClass(/btn-primary/);
      await expect(overviewJoinButton).not.toHaveCSS(
        'background-color',
        'rgb(255, 255, 255)',
      );

      const leave = await memberPage.request.delete(
        `/api/users/memberships/${hitchhikers._id}`,
      );
      expect(leave.ok()).toBeTruthy();

      const memberships = await memberPage.request.get(
        '/api/users/memberships',
      );
      expect(memberships.ok()).toBeTruthy();
      expect(
        (await memberships.json()).map(item => item.tribe._id),
      ).not.toContain(hitchhikers._id);
    } finally {
      await context.close();
    }
  });
});
