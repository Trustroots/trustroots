const {
  annotateFeature,
  expect,
  test,
  useElementScreenshot,
} = require('../../support/test');

const { SEEDED_MEMBERS, waitForTribesList } = require('../../support/helpers');

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
      'Statistics page loads for signed-in members.',
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
    expect(publicStatistics.experiences).toEqual({
      total: 2,
      recommended: 1,
      notRecommended: 0,
      recent: { total: 2, recommended: 1, notRecommended: 0 },
      realLifeConnections: { total: 2, recent: 2 },
    });
    expect(publicStatistics.messageInteractions).toEqual({
      total: 1,
      positive: 0,
      negative: 1,
      recent: { total: 1, positive: 0, negative: 1 },
    });
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

  test('circle detail remains touch-scrollable on a phone-sized viewport', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'circles.detail', [
      'Circle detail content remains vertically scrollable on touch devices.',
    ]);

    await page.setViewportSize({ width: 375, height: 480 });
    await page.goto('/circles/hitchhikers');

    const content = page.locator('.tribe-header-info');
    await expect(content).toBeVisible();
    const state = await content.evaluate(element => {
      const styles =
        element.ownerDocument.defaultView.getComputedStyle(element);
      element.scrollTop = element.scrollHeight;
      return {
        overflowY: styles.overflowY,
        touchAction: styles.touchAction,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
      };
    });

    expect(state.overflowY).toBe('auto');
    expect(state.touchAction).toBe('pan-y');
    expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
    expect(state.scrollTop).toBeGreaterThan(0);
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
