import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

test('navigation links and profile menu have accessible names on desktop and mobile', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.navigation', [
    'Icon navigation links have accessible names on small screens.',
    'The desktop profile menu opens using the keyboard.',
  ]);
  await signInViaApi(page, undefined, SEEDED_MEMBERS[0]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/circles');
  const header = page.locator('#tr-header');
  const profileMenu = header.getByRole('button', { name: 'Profile menu' });
  await profileMenu.focus();
  await page.keyboard.press('Enter');
  await expect(profileMenu).toHaveAttribute('aria-expanded', 'true');
  await expect(
    header.getByRole('link', { name: 'My profile', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(profileMenu).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of [
    'Circles',
    'Search hosts',
    'Messages',
    'My profile, info and support',
  ]) {
    const link = header.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await link.focus();
    await expect(link).toBeFocused();
  }
  await expect(
    header.getByRole('link', { name: 'Circles', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('desktop header offers own circles and member search on hover and focus', async ({
  page,
}) => {
  await signInViaApi(page, undefined, SEEDED_MEMBERS[0]);
  await page.goto('/circles');
  await page.setViewportSize({ width: 1280, height: 800 });
  const header = page.locator('#tr-header');
  const search = header.locator('a[href="/search"]');
  const nameSearch = header.getByRole('link', { name: 'Find member by name' });
  await expect(nameSearch).toBeHidden();
  await search.hover();
  await expect(nameSearch).toBeVisible();
  await nameSearch.hover();
  await expect(nameSearch).toBeVisible();
  await header.locator('.navbar-brand').hover();
  await expect(nameSearch).toBeHidden();
  await search.click();
  await expect(page).toHaveURL(/\/search$/);
  await header.locator('.navbar-brand').hover();
  await expect(nameSearch).toBeHidden();
  await page.keyboard.press('Tab');
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(nameSearch).toBeFocused();
  await expect(nameSearch).toBeVisible();
  await nameSearch.click();
  await expect(page).toHaveURL(/\/search\/members$/);
  await header.locator('.navbar-brand').hover();
  await expect(nameSearch).toBeHidden();

  const circles = header.locator('a[href="/circles"]');
  const membershipResponse = await page.request.get('/api/users/memberships');
  expect(membershipResponse.ok()).toBeTruthy();
  const memberships: Array<{
    tribe: { slug: string; count: number; label: string };
  }> = await membershipResponse.json();
  const expected = memberships
    .sort(
      (left, right) =>
        Number(right.tribe.slug === 'hackers') -
          Number(left.tribe.slug === 'hackers') ||
        right.tribe.count - left.tribe.count,
    )
    .slice(0, 10)
    .map(({ tribe }) => tribe.label);
  expect(expected.length).toBeGreaterThan(0);
  const menu = circles.locator('..').locator('.dropdown-menu');
  await expect(menu.locator('a')).toHaveCount(expected.length);
  await expect(menu).toBeHidden();
  await circles.click();
  await expect(page).toHaveURL(/\/circles$/);
  await header.locator('.navbar-brand').hover();
  await expect(menu).toBeHidden();
  await page.keyboard.press('Tab');
  await circles.focus();
  await page.keyboard.press('Tab');
  await expect(menu.locator('a').first()).toBeFocused();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(menu).toBeHidden();
  await circles.hover();
  await expect(menu).toBeVisible();
  await expect(menu.locator('a')).toHaveText(expected);
  await menu.locator('a').first().hover();
  await expect(menu).toBeVisible();
  await menu.locator('a').first().click();
  await expect(page).toHaveURL(/\/circles\//);
  await header.locator('.navbar-brand').hover();
  await expect(menu).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await circles.hover();
  await expect(menu).toBeHidden();
  await search.hover();
  await expect(nameSearch).toBeHidden();
  await search.click();
  await expect(page).toHaveURL(/\/search$/);
});
