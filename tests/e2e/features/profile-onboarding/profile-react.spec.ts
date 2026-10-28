import { annotateFeature, test, expect } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

declare global {
  interface Window {
    fixtureMarkupExecuted?: boolean;
  }
}

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 1024, height: 400 },
  { width: 390, height: 844 },
]) {
  test(`enlarged profile photo fits its modal at ${viewport.width}×${viewport.height}`, async ({
    page,
    request,
  }) => {
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/profile/${SEEDED_MEMBERS[1].username}`);
    await page.locator('.profile-overview .avatar').click();

    const modal = page.locator('.modal-avatar');
    const photo = modal.locator('.avatar');
    await expect(photo).toBeVisible();
    // The desktop modal must also fit if the window becomes narrow while open.
    await page.setViewportSize(viewport);
    await expect(async () => {
      const content = await modal.locator('.modal-content').boundingBox();
      const image = await photo.boundingBox();
      expect(content).not.toBeNull();
      expect(image).not.toBeNull();
      expect(image!.x).toBeGreaterThanOrEqual(content!.x);
      expect(image!.y).toBeGreaterThanOrEqual(content!.y);
      expect(image!.x + image!.width).toBeLessThanOrEqual(
        content!.x + content!.width,
      );
      expect(image!.y + image!.height).toBeLessThanOrEqual(
        content!.y + content!.height,
      );
      expect(content!.y).toBeGreaterThanOrEqual(0);
      expect(content!.y + content!.height).toBeLessThanOrEqual(viewport.height);
      expect(
        Math.abs(content!.x + content!.width / 2 - viewport.width / 2),
      ).toBeLessThanOrEqual(1);
      expect(Math.abs(image!.width - image!.height)).toBeLessThanOrEqual(1);
    }).toPass();

    await photo.click();
    await expect(modal).toBeHidden();
  });
}

test('profile descriptions retain supported formatting in collapsed and expanded views', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Own profile about tab loads.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);
  const content =
    '<p onclick="window.fixtureMarkupExecuted=true"><b>Fictional formatted description</b><img src="/missing-fixture-image" onerror="window.fixtureMarkupExecuted=true">' +
    'a'.repeat(2100) +
    '</p><a href="javascript:window.fixtureMarkupExecuted=true">Link label</a>';
  await page.route(`**/api/users/${member.username}`, async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), description: content },
    });
  });
  await page.goto(`/profile/${member.username}`);
  await expect(page.getByText('Read more…')).toBeVisible();
  await expect(
    page.locator('#tr-react-root img[src="/missing-fixture-image"]'),
  ).toHaveCount(0);
  await page.getByText('Read more…').click();
  await expect(
    page.locator('#tr-react-root b', {
      hasText: 'Fictional formatted description',
    }),
  ).toBeVisible();
  await expect(
    page.locator(
      '#tr-react-root [onclick], #tr-react-root img[src="/missing-fixture-image"], #tr-react-root a[href^="javascript:"]',
    ),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureMarkupExecuted === true)).toBe(
    false,
  );
});

test('profile viewing tabs load through the React shell', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Own profile about tab loads.',
  ]);
  annotateFeature(testInfo, 'profile.view-contacts', [
    'Own contacts tab can show empty state.',
  ]);

  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);

  for (const suffix of ['', '/contacts', '/experiences']) {
    await page.goto(`/profile/${member.username}${suffix}`);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(page.locator('.profile-view')).toBeVisible();
  }
});

test('switching profile tabs keeps the loaded profile visible', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Switching profile tabs keeps the loaded profile visible.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);
  await page.goto(`/profile/${member.username}`);
  await expect(page.locator('.profile-tabs')).toBeVisible();

  let profileRequests = 0;
  page.on('request', outgoing => {
    if (outgoing.url().includes(`/api/users/${member.username}`)) {
      profileRequests += 1;
    }
  });

  await page.getByRole('tab', { name: /contacts/i }).click();
  await expect(page).toHaveURL(`/profile/${member.username}/contacts`);
  await expect(page.locator('.profile-tabs')).toBeVisible();
  await page.getByRole('tab', { name: /about/i }).click();
  await expect(page).toHaveURL(`/profile/${member.username}`);
  await expect(page.locator('.profile-tabs')).toBeVisible();
  expect(profileRequests).toBe(0);
});

test('mobile profile navigation stays compact and readable', async ({
  page,
  request,
}) => {
  const member = SEEDED_MEMBERS[0];
  await page.setViewportSize({ width: 390, height: 844 });
  await signInViaApi(page, request, member);
  await page.goto(`/profile/${member.username}/overview`);

  const bottomNavigation = page.locator('.profile-view-navbar-mobile');
  await expect(bottomNavigation).toBeVisible();
  const tabs = bottomNavigation.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  const tabBounds = await tabs.evaluateAll(links =>
    links.map(link => {
      const { x, y, width, height, right } = link.getBoundingClientRect();
      return { x, y, width, height, right };
    }),
  );
  expect(Math.max(...tabBounds.map(bounds => bounds.y))).toBeLessThanOrEqual(
    Math.min(...tabBounds.map(bounds => bounds.y)) + 1,
  );
  const bottomBounds = await bottomNavigation.boundingBox();
  expect(bottomBounds!.height).toBeLessThanOrEqual(60);
  for (const tab of await tabs.all()) {
    await expect(tab).toHaveCSS('color', 'rgb(255, 255, 255)');
  }

  const headerLinks = page.locator(
    '#tr-header .nav-header-primary > li:visible > a',
  );
  await expect(headerLinks).toHaveCount(4);
  const headerBounds = await headerLinks.evaluateAll(links =>
    links.map(link => {
      const { x, y, width, height, right } = link.getBoundingClientRect();
      return { x, y, width, height, right };
    }),
  );
  const widths = headerBounds.map(bounds => bounds.width);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  expect(headerBounds[0]!.x).toBeLessThan(40);
  expect(headerBounds[3]!.right).toBeGreaterThan(350);
  for (const link of await headerLinks.all()) {
    const linkBounds = await link.boundingBox();
    const iconBounds = await link.locator('.icon').boundingBox();
    expect(
      Math.abs(
        iconBounds!.x +
          iconBounds!.width / 2 -
          (linkBounds!.x + linkBounds!.width / 2),
      ),
    ).toBeLessThan(2);
  }

  const otherMember = SEEDED_MEMBERS[1];
  await page.goto(`/profile/${otherMember.username}/overview`);
  const profileActions = page.locator('.navbar-fixed-top-below');
  const actionLinks = profileActions.getByRole('link');
  await expect(actionLinks).toHaveCount(3);
  const actionBounds = await actionLinks.evaluateAll(links =>
    links.map(link => {
      const { x, y, width, height, right } = link.getBoundingClientRect();
      return { x, y, width, height, right };
    }),
  );
  expect(Math.max(...actionBounds.map(bounds => bounds.y))).toBeLessThanOrEqual(
    Math.min(...actionBounds.map(bounds => bounds.y)) + 1,
  );
  const actionsBar = await profileActions.boundingBox();
  expect(actionsBar!.height).toBeLessThanOrEqual(60);
});

test('profile descriptions disable links while dedicated network exceptions remain clickable', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'profile.view-about', [
    'Profile descriptions display link labels without clickable destinations.',
  ]);
  const member = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, member);
  await page.route(`**/api/users/${member.username}`, async route => {
    const response = await route.fetch();
    const profile = await response.json();
    await route.fulfill({
      response,
      json: {
        ...profile,
        description:
          '<p><a href="https://example.org/"><b>Fictional external notes</b></a> <a href="/safety">Fictional internal notes</a></p>',
        extSitesCouchers: 'fictional-member',
        extSitesBW: 'fictional-member',
        extSitesCS: 'fictional-member',
        extSitesWS: '12345',
      },
    });
  });
  await page.goto(`/profile/${member.username}`);
  await expect(
    page.getByText('Fictional external notes', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Fictional internal notes')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Fictional .* notes/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Couchers.org', exact: true }),
  ).toHaveAttribute('href', 'https://couchers.org/user/fictional-member');
  await expect(
    page.getByRole('link', { name: 'BeWelcome', exact: true }),
  ).toHaveAttribute(
    'href',
    'https://www.bewelcome.org/members/fictional-member',
  );
  await expect(
    page.getByRole('link', { name: 'Warmshowers', exact: true }),
  ).toHaveAttribute('href', 'https://www.warmshowers.org/user/12345');
  await expect(page.getByText('Couchsurfing', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Couchsurfing', exact: true }),
  ).toHaveCount(0);
});

for (const path of ['household/fictional-host', 'address/fictional-host']) {
  test(`member saves, views and clears a Servas profile link: ${path}`, async ({
    page,
    request,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-networks', [
      'Networks edit form is reachable.',
    ]);
    const member = SEEDED_MEMBERS[0];
    await signInViaApi(page, request, member);
    await page.goto('/profile/edit/networks');
    await page.getByLabel('servas.org/').fill(path);
    await expect(
      page
        .locator('#extSitesServas')
        .locator('..')
        .getByRole('link', { name: 'Test', exact: true }),
    ).toHaveAttribute('href', `https://servas.org/${path}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Hospitality networks updated.',
    );
    await page.reload();
    await expect(page.getByLabel('servas.org/')).toHaveValue(path);
    await page.goto(`/profile/${member.username}`);
    await expect(
      page.getByRole('link', { name: 'Servas', exact: true }),
    ).toHaveAttribute('href', `https://servas.org/${path}`);
    await page.goto('/profile/edit/networks');
    await page.getByLabel('servas.org/').fill('');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Hospitality networks updated.',
    );
    await page.goto(`/profile/${member.username}`);
    await expect(
      page.getByRole('link', { name: 'Servas', exact: true }),
    ).toHaveCount(0);
  });
}
for (const width of [390, 480, 481, 600, 767]) {
  test(`Overview and Hosting stay reachable at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);

    for (const member of SEEDED_MEMBERS.slice(0, 2)) {
      const prefix = `/profile/${member.username}`;
      await page.goto(`${prefix}/about`);
      const navigation = page.locator('.profile-view-navbar-mobile');
      await expect(navigation).toBeVisible();

      await navigation
        .getByRole('tab', { name: 'Overview', exact: true })
        .click();
      await expect(page).toHaveURL(`${prefix}/overview`);
      await expect(
        page.locator('.profile-view .profile-overview'),
      ).toBeVisible();
      await expect(navigation.locator('li.active')).toHaveText('Overview');

      await navigation
        .getByRole('tab', { name: 'Hosting', exact: true })
        .click();
      await expect(page).toHaveURL(`${prefix}/accommodation`);
      await expect(navigation.locator('li.active')).toHaveText('Hosting');
      await expect(page.locator('.profile-view .offer-view')).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(`${prefix}/accommodation`);
      await expect(page.locator('.profile-view .offer-view')).toBeVisible();
    }
  });
}
