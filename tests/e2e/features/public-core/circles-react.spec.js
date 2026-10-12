/* global getComputedStyle, window */
const { annotateFeature, expect, test } = require('../../support/fixtures');
const { SEEDED_ADMIN, signInViaApi } = require('../../support/helpers');

test('invalid circle addresses show a stable not-found page', async ({
  page,
}) => {
  for (const path of [
    '/circles/Hitchhikers',
    '/circles/sample_circle',
    '/circles/:circle',
  ]) {
    await page.goto(path);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'This page cannot be found.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Contact us', exact: true }).click();
    await expect(page).toHaveURL(/\/support$/);
  }
});

test('circle pages use React and preserve guest navigation', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.public', [
    'Catalogue and detail pages render in the React shell.',
    'Guest registration preserves the selected circle.',
  ]);
  await page.goto('/circles');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.locator('#tr-header').getByRole('link', { name: 'Read more' }),
  ).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  await page.getByRole('link', { name: /^Hitchhikers/ }).click();
  await expect(page).toHaveURL(/\/circles\/hitchhikers$/);
  await expect(
    page.getByRole('heading', { name: 'Hitchhikers' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Join Hitchhikers on Trustroots' })
    .click();
  await expect(page).toHaveURL(/\/signup\?tribe=hitchhikers$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
});

test('circle membership retains account roles and legacy member links', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.membership', [
    'Joining and leaving retains the authenticated account roles.',
    'Member search loads the existing map workflow.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles');
  const circleResponse = await page.request.get('/api/tribes/hitchhikers');
  expect(circleResponse.ok()).toBeTruthy();
  const circle = await circleResponse.json();
  const wasMember = await page.evaluate(
    id => window.user.memberIds.includes(id),
    circle._id,
  );
  await page.request.delete(`/api/users/memberships/${circle._id}`, {
    headers: { 'X-Trustroots-Request': '1' },
  });
  try {
    await page.goto('/circles/hitchhikers');
    const roles = await page.evaluate(() => window.user.roles);
    expect(roles).toContain('admin');
    await page.route('**/api/tribes/hitchhikers/members', route =>
      route.fulfill({
        status: 503,
        json: { message: 'Temporarily unavailable' },
      }),
    );
    await page
      .getByRole('button', { name: 'Join (Hitchhikers)', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Could not load circle members. Please try again.',
    );
    await expect(page.getByText('No members to show yet')).toHaveCount(0);
    await page.unroute('**/api/tribes/hitchhikers/members');
    await page.route('**/api/tribes/hitchhikers/members', route =>
      route.fulfill({
        json: {
          contacts: [
            {
              _id: 'fictional-contact',
              username: 'sample-contact',
              displayName: 'Sample Contact',
              avatarSource: 'none',
              locationLiving: 'Fictional Harbour',
              locationFrom: 'Example Coast',
              tagline: 'Glad to share a meal',
            },
          ],
          recommenders: [
            {
              _id: 'fictional-recommender',
              username: 'sample-recommender',
              displayName: 'Sample Recommender',
              avatarSource: 'none',
            },
          ],
          active: [
            {
              _id: 'fictional-active',
              username: 'sample-active',
              displayName: 'Sample Active',
              avatarSource: 'none',
            },
          ],
        },
      }),
    );
    const retryResponse = page.waitForResponse(response =>
      response.url().endsWith('/api/tribes/hitchhikers/members'),
    );
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    expect((await retryResponse).ok()).toBeTruthy();
    await expect(page.locator('.circle-member-error')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: /Sample Contact/ }),
    ).toHaveClass(/member-search-card/);
    await expect(page.getByText('Fictional Harbour')).toBeVisible();
    await expect(page.getByText('Glad to share a meal')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Sample Recommender/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Sample Active/ }),
    ).toBeVisible();
    await page.unroute('**/api/tribes/hitchhikers/members');
    await expect(
      page.getByRole('button', { name: 'Leave circle', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Find members', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Circle Wiki', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volunteering', exact: true }),
    ).toBeVisible();
    const activeMembers = await page.request.get(
      `/api/tribes/${circle.slug}/members`,
    );
    expect(activeMembers.ok()).toBeTruthy();
    expect(await activeMembers.json()).toEqual({
      contacts: expect.any(Array),
      recommenders: expect.any(Array),
      active: expect.any(Array),
    });
    expect(await page.evaluate(() => window.user.roles)).toEqual(roles);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('link', { name: 'Circle Wiki', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volunteering', exact: true }),
    ).toBeVisible();
    const circleActions = await page
      .locator('.tribe-actions-group')
      .boundingBox();
    expect(circleActions.x).toBeGreaterThanOrEqual(0);
    expect(circleActions.x + circleActions.width).toBeLessThanOrEqual(391);
    expect(
      await page.evaluate(() => window.document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Join (Hitchhikers)', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.user.roles)).toEqual(roles);
    await page.getByRole('link', { name: 'Find members', exact: true }).click();
    await expect(page).toHaveURL(/\/search\?tribe=hitchhikers$/);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  } finally {
    if (wasMember)
      await page.request.post(`/api/users/memberships/${circle._id}`, {
        headers: { 'X-Trustroots-Request': '1' },
      });
    else
      await page.request.delete(`/api/users/memberships/${circle._id}`, {
        headers: { 'X-Trustroots-Request': '1' },
      });
  }
});

test('Hackers circle foregrounds the public place map and verification limits', async ({
  page,
}) => {
  let wikiRequested = false;
  await page.route('https://wiki.trustroots.org/**', route => {
    wikiRequested = true;
    return route.abort();
  });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'hackers-circle',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
        description: 'People who enjoy building and sharing technology.',
      },
    }),
  );
  await page.goto('/circles/hackers');
  await expect(
    page.getByRole('heading', { name: 'Hackers', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hackerspaces around the world' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'SpaceAPI-reported locations. Listings have not been independently verified.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hackerspaces and community workshops' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'HackerspaceWiki' }),
  ).toHaveAttribute(
    'href',
    'https://wiki.hackerspaces.org/Category:Hackerspace',
  );
  await expect(
    page.getByRole('link', { name: 'View the source page' }),
  ).toHaveAttribute(
    'href',
    'https://wiki.trustroots.org/index.php?title=Hackers&oldid=26505',
  );
  const resourceLinks = page.locator('.hackers-circle-resources a');
  for (const link of await resourceLinks.all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(link).toHaveAttribute('href', /^https:\/\//);
  }
  expect(wikiRequested).toBe(false);
  const map = page.locator('.hackerspace-map');
  await expect(map).toBeVisible();
  const panel = await page.locator('.hackerspace-map-panel').boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(panel.y).toBeLessThan(viewportHeight);
});

test('administrators can review a SpaceAPI import preview', async ({
  page,
}) => {
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.route('**/api/admin/hackerspaces/preview', route =>
    route.fulfill({
      json: [
        {
          endpoint: 'https://example.test/api',
          valid: true,
          eligible: true,
          name: 'Example Workshop',
          website: 'https://example.test',
          latitude: 51.5,
          longitude: -0.1,
          address: 'Example City',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        },
        {
          endpoint: 'https://offline.test/api',
          valid: false,
          eligible: false,
          name: '',
          website: '',
          latitude: null,
          longitude: null,
          address: '',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        },
      ],
    }),
  );
  await page.goto('/admin/hackerspaces');
  await page.getByRole('button', { name: 'Fetch preview' }).click();
  await expect(page.getByText('Example Workshop')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Addition' })).toBeVisible();
  await expect(page.getByText(/not human-verified/i)).toBeVisible();
  await expect(
    page.getByRole('cell', {
      name: 'Temporarily invalid; keep last-known listing',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign and publish approved changes' }),
  ).toBeEnabled();
});

test('member navigation menus and narrow layout remain usable', async ({
  page,
}) => {
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles');

  const header = page.locator('#tr-header');
  await expect(header).toHaveCSS('background-color', 'rgb(18, 181, 145)');
  const circlesLink = header.locator('a[href="/circles"]');
  const searchLink = header.locator('a[href="/search"]');
  await expect(circlesLink.locator('..')).toHaveClass(/active/);
  const selectedBackground = await circlesLink.evaluate(
    link => getComputedStyle(link).backgroundColor,
  );
  const unselectedBackground = await searchLink.evaluate(
    link => getComputedStyle(link).backgroundColor,
  );
  expect(selectedBackground).not.toBe(unselectedBackground);
  expect(selectedBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByRole('button', { name: 'Support' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await expect(header.locator('a[href="/search"]')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  const circlesBounds = await header
    .locator('a[href="/circles"]')
    .boundingBox();
  const searchBounds = await header.locator('a[href="/search"]').boundingBox();
  expect(searchBounds.x).toBeGreaterThanOrEqual(
    circlesBounds.x + circlesBounds.width,
  );
  const supportButton = page.getByRole('button', { name: 'Support' });
  await supportButton.hover();
  const safetyLink = header.getByRole('link', { name: 'Safety' });
  await expect(safetyLink).toBeVisible();
  await safetyLink.hover();
  await expect(safetyLink).toBeVisible();

  await supportButton.click();
  await expect(
    page.locator('#tr-header').getByRole('link', { name: 'Safety' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await supportButton.focus();
  await page.keyboard.press('Enter');
  await expect(safetyLink).toBeVisible();

  await page.locator('.dropdown-user .dropdown-toggle').click();
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(circlesLink).toHaveCSS('background-color', selectedBackground);
  await expect(header.locator('a[href="/messages"]')).toBeVisible();
  for (const href of ['/circles', '/search', '/messages', '/navigation']) {
    await expect(header.locator(`a[href="${href}"] .icon`)).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    );
  }
  const mobileLinks = await Promise.all(
    ['/circles', '/search', '/messages', '/navigation'].map(href =>
      header.locator(`a[href="${href}"]`).boundingBox(),
    ),
  );
  mobileLinks.forEach((bounds, index) => {
    expect(bounds.width).toBeGreaterThan(0);
    if (index > 0) {
      const previous = mobileLinks[index - 1];
      expect(bounds.x).toBeGreaterThanOrEqual(previous.x + previous.width);
    }
  });
  const headerBounds = await header.boundingBox();
  expect(headerBounds.x).toBeGreaterThanOrEqual(0);
  expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(391);
});
