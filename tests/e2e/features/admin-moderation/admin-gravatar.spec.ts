import { ObjectId } from 'mongodb';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('administrators can count and inspect Gravatar members', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.gravatar', [
    'Administrators can count current Gravatar accounts and paginate member links.',
    'Gravatar member data is restricted to administrators.',
    'Administrators can view profile pictures and sort Gravatar accounts by last seen.',
  ]);
  await signInViaApi(page, request, SEEDED_ADMIN);
  const baseline = await page.request.get('/api/admin/gravatar');
  expect(baseline.ok()).toBeTruthy();
  const baselineCount = (await baseline.json()).accounts as number;
  const ids = Array.from(
    { length: 51 },
    (_, index) => new ObjectId((index + 1).toString(16).padStart(24, '0')),
  );
  const fixtureAvatarHash = '0123456789abcdef0123456789abcdef';
  await page.route(
    url => url.pathname === `/api/users/${ids[50]}/avatar`,
    async route => {
      const redirect = await route.fetch({ maxRedirects: 0 });
      expect(redirect.status()).toBe(302);
      expect(redirect.headers().location).toContain(
        `https://gravatar.com/avatar/${fixtureAvatarHash}?s=32`,
      );
      await route.fulfill({ path: 'public/img/avatar-32.png' });
    },
  );
  try {
    await withE2eDb(async db => {
      await db.collection('users').insertMany(
        ids.map((_id, index) => ({
          _id,
          username: `gravatar-fixture-${index}`,
          email: `gravatar-fixture-${index}@example.test`,
          displayName: 'Fictional Member',
          avatarSource: 'gravatar',
          public: false,
          ...(index === 0 && { seen: new Date('2026-10-01T08:00:00Z') }),
          ...(index === 50 && {
            seen: new Date('2026-11-05T18:15:00Z'),
            emailHash: fixtureAvatarHash,
          }),
        })),
      );
    });
    await page.goto('/admin/gravatar');
    await expect(
      page.getByRole('heading', { name: 'Gravatar usage' }),
    ).toBeVisible();
    await expect(
      page.getByText(`${baselineCount + 51}`, { exact: true }),
    ).toBeVisible();
    const table = page.getByRole('table', { name: 'Gravatar members' });
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(
      table.getByRole('link', { name: 'gravatar-fixture-0', exact: true }),
    ).toHaveAttribute('href', '/admin/user/gravatar-fixture-0');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
    const avatar = table
      .getByRole('link', { name: 'gravatar-fixture-50', exact: true })
      .locator('img');
    await avatar.scrollIntoViewIfNeeded();
    await expect(avatar).toHaveJSProperty('naturalWidth', 32);
    const lastSeen = table.getByRole('button', { name: 'Last seen (UTC)' });
    const lastSeenHeader = table.getByRole('columnheader', {
      name: 'Last seen (UTC)',
    });
    const firstRow = table.locator('tbody tr').first();
    await lastSeen.click();
    await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
    await expect(lastSeenHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(firstRow).toContainText('gravatar-fixture-50');
    await expect(firstRow).toContainText('2026-11-05 18:15');
    await expect(table.getByText('Unknown').first()).toBeVisible();
    await lastSeen.click();
    await expect(lastSeenHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(firstRow).toContainText('gravatar-fixture-0');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await page.screenshot({
      path: testInfo.outputPath('admin-gravatar.png'),
      fullPage: true,
    });
    const member = createUser();
    await registerViaApi(request, member);
    await signInViaApi(page, request, member);
    const denied = await page.request.get('/api/admin/gravatar');
    expect(denied.status()).toBe(403);
  } finally {
    await withE2eDb(async db => {
      await db.collection('users').deleteMany({ _id: { $in: ids } });
    });
  }
});
