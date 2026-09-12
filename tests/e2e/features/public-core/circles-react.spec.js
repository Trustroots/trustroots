/* global window */
const { annotateFeature, expect, test } = require('../../support/test');
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
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(1);
});

test('circle membership retains account roles and legacy member links', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.membership', [
    'Joining and leaving retains the authenticated account roles.',
    'Member search loads the existing map workflow.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  const circleResponse = await page.request.get('/api/tribes/hitchhikers');
  expect(circleResponse.ok()).toBeTruthy();
  const circle = await circleResponse.json();
  const wasMember = await page.evaluate(
    id => window.user.memberIds.includes(id),
    circle._id,
  );
  await page.request.delete(`/api/users/memberships/${circle._id}`);
  try {
    await page.goto('/circles/hitchhikers');
    const roles = await page.evaluate(() => window.user.roles);
    expect(roles).toContain('admin');
    await page
      .getByRole('button', { name: 'Join (Hitchhikers)', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Leave circle', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.user.roles)).toEqual(roles);
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
    await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(1);
  } finally {
    if (wasMember)
      await page.request.post(`/api/users/memberships/${circle._id}`);
    else await page.request.delete(`/api/users/memberships/${circle._id}`);
  }
});
