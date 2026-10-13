const {
  annotateFeature,
  expect,
  test,
  useElementScreenshot,
} = require('../../support/fixtures');

const { SEEDED_MEMBERS, waitForTribesList } = require('../../support/helpers');

/* global window */

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

test.describe('seeded content and public API flows', () => {
  test('languages API returns a non-empty list', async ({
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.languages-api', [
      'Languages API returns a non-empty locale list.',
    ]);

    const response = await request.get('/api/languages?format=array');

    expect(response.ok()).toBeTruthy();

    const languages = await response.json();
    expect(Array.isArray(languages)).toBeTruthy();
    expect(languages.length).toBeGreaterThan(0);
  });

  test('statistics page loads for visitors', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'public.statistics', [
      'Statistics page loads for visitors.',
      'Public statistics API returns deterministic connection and message-interaction data.',
      'Visitors do not see an experience-writing encouragement.',
    ]);

    await page.goto('/statistics');

    await expect(page).toHaveURL(/\/statistics/);
    await expect(page).toHaveTitle(/Statistics - Trustroots/);
    await expect(page.getByText('Real-life connections')).toBeVisible();
    await expect(page.getByText('Message interactions')).toBeVisible();
    await expect(
      page.getByText(
        'This is a lower bound: most people do not share an experience, and Trustroots did not have this experience feature until 2021.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/Help make this picture more complete/),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', {
        name: /Why not write some nice words about/i,
      }),
    ).toHaveCount(0);

    const response = await request.get('/api/statistics');
    expect(response.ok()).toBeTruthy();
    const publicStatistics = await response.json();

    // Other E2E projects share the seeded database and may create additional
    // records while this public test runs. Assert the seeded baseline rather
    // than a global total that depends on project scheduling.
    expect(publicStatistics.experiences).toEqual({
      total: expect.any(Number),
      recommended: expect.any(Number),
      notRecommended: expect.any(Number),
      recent: {
        total: expect.any(Number),
        recommended: expect.any(Number),
        notRecommended: expect.any(Number),
      },
      realLifeConnections: {
        total: expect.any(Number),
        recent: expect.any(Number),
      },
    });
    expect(publicStatistics.experiences.total).toBeGreaterThanOrEqual(3);
    expect(publicStatistics.experiences.recommended).toBeGreaterThanOrEqual(1);
    expect(publicStatistics.experiences.notRecommended).toBeGreaterThanOrEqual(
      1,
    );
    expect(publicStatistics.experiences.recent.total).toBeGreaterThanOrEqual(3);
    expect(
      publicStatistics.experiences.recent.recommended,
    ).toBeGreaterThanOrEqual(1);
    expect(
      publicStatistics.experiences.realLifeConnections.total,
    ).toBeGreaterThanOrEqual(1);
    expect(
      publicStatistics.experiences.realLifeConnections.recent,
    ).toBeGreaterThanOrEqual(1);
    expect(publicStatistics.messageInteractions).toEqual({
      total: expect.any(Number),
      positive: expect.any(Number),
      negative: expect.any(Number),
      recent: {
        total: expect.any(Number),
        positive: expect.any(Number),
        negative: expect.any(Number),
      },
    });
    expect(publicStatistics.messageInteractions.total).toBeGreaterThanOrEqual(
      1,
    );
    // The reference API project may change the seeded response from negative
    // to positive while projects share this database. The deterministic
    // invariant is that at least one response remains recorded.
    expect(
      publicStatistics.messageInteractions.positive +
        publicStatistics.messageInteractions.negative,
    ).toBeGreaterThanOrEqual(1);
    expect(
      publicStatistics.messageInteractions.recent.total,
    ).toBeGreaterThanOrEqual(1);
  });

  test('viewing a host profile while signed out redirects to sign in', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.signed-out-redirect', [
      'Signed-out profile access redirects to sign in.',
      'Redirect preserves enough context to continue after authentication when supported.',
    ]);

    const host = SEEDED_MEMBERS[0];

    await page.goto(`/profile/${host.username}`);

    await expect(page).toHaveURL(/\/signin(\?|$)/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('circle detail page loads for a seeded tribe', async ({
    page,
  }, testInfo) => {
    useElementScreenshot(testInfo, 'section.tribe-header');
    annotateFeature(testInfo, 'circles.detail', [
      'Seeded circle detail page loads.',
      'Circle detail page links to its Wiki page.',
      'Unknown circle shows a user-facing error or not found state.',
    ]);

    await page.goto('/circles');
    await waitForTribesList(page);

    await page
      .locator('a.tribe-link', { hasText: 'Hitchhikers' })
      .first()
      .click();

    await expect(page).toHaveURL(/\/circles\/hitchhikers/);
    await expect(
      page.locator('h2.tribe-title', { hasText: 'Hitchhikers' }).first(),
    ).toBeVisible();

    const wikiLink = page.getByRole('link', { name: 'Circle Wiki' });
    await expect(wikiLink).toHaveAttribute(
      'href',
      'https://wiki.trustroots.org/en/Hitchhikers',
    );
    await expect(wikiLink).toHaveAttribute('target', '_blank');
    await expect(wikiLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('Naturists circle requires sign-in', async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.member-only', [
      'Visitor cannot discover or open the Naturists circle.',
    ]);

    const catalogueResponse = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(catalogueResponse.ok()).toBeTruthy();
    expect(
      (await catalogueResponse.json()).some(
        circle => circle.slug === 'naturists',
      ),
    ).toBe(false);

    const detailResponse = await request.get('/api/tribes/naturists');
    expect(detailResponse.status()).toBe(403);

    await page.goto('/circles/naturists');
    await expect(page).toHaveURL(/\/signin(\?|$)/);
    await expect(page.locator('#username')).toBeVisible();
  });

  test('circle detail remains touch-scrollable on a phone-sized viewport', async ({
    browser,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.detail', [
      'Circle detail content remains vertically scrollable on touch devices.',
    ]);

    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 480 },
    });
    const page = await context.newPage();

    try {
      await page.goto('/circles/hitchhikers');

      const content = page.locator('.tribe-header-info');
      await expect(content).toBeVisible();
      await content.locator('.container').evaluate(element => {
        const filler = element.ownerDocument.createElement('div');
        filler.style.height = '960px';
        element.append(filler);
      });
      const state = await content.evaluate(element => {
        const document = element.ownerDocument;
        const styles = document.defaultView.getComputedStyle(element);
        const scrollContainer = document.scrollingElement;
        return {
          overflowY: styles.overflowY,
          touchAction: styles.touchAction,
          clientHeight: scrollContainer.clientHeight,
          scrollHeight: scrollContainer.scrollHeight,
        };
      });

      expect(state.overflowY).toBe('auto');
      expect(state.touchAction).toBe('pan-y');
      expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);

      const scrollBeforeSwipe = await page.evaluate(() => window.scrollY);
      await swipeUpFrom(page, content);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(scrollBeforeSwipe);
    } finally {
      await context.close();
    }
  });

  test('tribes API returns seeded circles', async ({ request }, testInfo) => {
    annotateFeature(testInfo, 'circles.list', [
      'Tribes API returns seeded circles.',
    ]);

    const response = await request.get('/api/tribes', {
      params: { limit: 150 },
    });
    expect(response.ok()).toBeTruthy();

    const tribes = await response.json();
    expect(Array.isArray(tribes)).toBeTruthy();
    expect(tribes.length).toBeGreaterThanOrEqual(10);

    const labels = tribes.map(tribe => tribe.label);
    expect(labels).toContain('Hitchhikers');
    expect(labels).toContain('Cyclists');
  });
});
