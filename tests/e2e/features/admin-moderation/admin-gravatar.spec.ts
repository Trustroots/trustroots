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
  ]);
  await signInViaApi(page, request, SEEDED_ADMIN);
  const baseline = await page.request.get('/api/admin/gravatar');
  expect(baseline.ok()).toBeTruthy();
  const baselineCount = (await baseline.json()).accounts as number;
  const ids = Array.from(
    { length: 51 },
    (_, index) => new ObjectId((index + 1).toString(16).padStart(24, '0')),
  );
  const imageRequests: string[] = [];
  page.on('request', outgoing => {
    const { hostname } = new URL(outgoing.url());
    if (hostname === 'gravatar.com' || hostname.endsWith('.gravatar.com'))
      imageRequests.push(outgoing.url());
  });
  try {
    await withE2eDb(async db => {
      await db.collection('users').insertMany(
        ids.map((_id, index) => ({
          _id,
          username: `gravatar-fixture-${index}`,
          email: `gravatar-fixture-${index}@example.test`,
          displayName: 'Fictional Member',
          avatarSource: 'gravatar',
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
    await expect(table).toContainText('gravatar-fixture-50');
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByText('Page 1', { exact: true })).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(50);
    expect(imageRequests).toEqual([]);
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
