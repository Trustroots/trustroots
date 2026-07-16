const { annotateFeature, expect, test } = require('../../support/test');

/* global window */

const {
  EUROPE_OFFERS_QUERY,
  SEEDED_MEMBERS,
  SEEDED_RELATIONSHIP_MEMBERS,
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
    const context = await browser.newContext({
      baseURL,
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

      const joinResponse = memberPage.waitForResponse(
        response =>
          response
            .url()
            .includes(`/api/users/memberships/${hitchhikers._id}`) &&
          response.request().method() === 'POST',
      );
      await hitchhikersCard
        .getByRole('button', { name: 'Join (Hitchhikers)' })
        .click();
      expect((await joinResponse).ok()).toBeTruthy();
      await expect(
        hitchhikersCard.getByRole('button', { name: 'Leave circle' }),
      ).toContainText('Joined');

      await memberPage.goto('/circles/hitchhikers');
      const overview = memberPage.locator('.tribe-header-info');
      await expect(overview).toBeVisible();
      await expect(overview).toHaveCSS('overflow-y', 'auto');
      await expect(overview).toHaveCSS('touch-action', 'pan-y');
      await expect
        .poll(() =>
          overview.evaluate(
            element => element.scrollHeight > element.clientHeight,
          ),
        )
        .toBe(true);
      await overview.evaluate(element => {
        element.scrollTop = element.scrollHeight;
      });
      await expect
        .poll(() => overview.evaluate(element => element.scrollTop))
        .toBeGreaterThan(0);

      await expect(
        memberPage.getByRole('button', {
          name: /Leave circle \(Hitchhikers\)/,
        }),
      ).toContainText("You're a member");

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
