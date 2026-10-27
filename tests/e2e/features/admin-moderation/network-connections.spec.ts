import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import { findUserByUsername, withE2eDb } from '../../support/db.mts';

test('staff can search and inspect external network connections', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.support-team', [
    'Support can search external network identifiers and inspect connection history.',
  ]);
  const member = createUser({ firstName: 'Fictional', lastName: 'Network' });
  const support = createUser({ firstName: 'Fictional', lastName: 'Helper' });
  const registeredMember = await registerViaApi(request, member);
  await registerViaApi(request, support);
  const supportDoc = (await findUserByUsername(support.username))!;
  await withE2eDb(async db => {
    await db
      .collection('users')
      .updateOne(
        { _id: supportDoc._id },
        { $set: { roles: ['user', 'support-team'] } },
      );
  });

  await signInViaApi(page, request, member);
  expect(
    (
      await request.get(
        '/api/admin/network-connections?network=bewelcome&identifier=fictional-old',
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(
        `/api/admin/network-connections/${registeredMember._id}?page=1`,
      )
    ).status(),
  ).toBe(403);
  for (const identifier of ['Fictional-Old', 'Fictional-New', '']) {
    const response = await request.put('/api/users', {
      headers: { 'X-Trustroots-Request': '1' },
      data: { extSitesBW: identifier },
    });
    expect(response.ok()).toBeTruthy();
  }

  await signInViaApi(page, request, support);
  await page.goto('/admin/network-connections');
  await expect(
    page.getByRole('heading', { name: 'Search external connections' }),
  ).toBeVisible();
  await page.getByLabel('Network').selectOption('bewelcome');
  await page.getByLabel('Identifier').fill('Fictional-Old');
  const searchResponse = page.waitForResponse(
    response =>
      response.url().includes('/api/admin/network-connections') &&
      !response.url().includes('/api/admin/network-connections/') &&
      response.request().method() === 'GET' &&
      response.ok(),
  );
  await page.getByRole('button', { name: 'Search' }).click();
  await searchResponse;
  await expect(
    page.getByRole('link', { name: new RegExp(member.username) }),
  ).toHaveAttribute(
    'href',
    `/admin/support/member/${encodeURIComponent(member.username)}`,
  );
  const results = page.getByRole('list', {
    name: 'Members with this connection',
  });
  await expect(results.getByText('Previous')).toBeVisible();
  await page.getByRole('link', { name: new RegExp(member.username) }).click();
  await expect(
    page.getByRole('heading', { name: /Fictional Network/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'External connection history' }),
  ).toBeVisible();
  const history = page.getByRole('table', {
    name: 'External connection changes',
  });
  await expect(history.locator('tbody tr')).toHaveCount(3);
  await expect(history.getByText('Removed')).toBeVisible();
  await expect(
    history.getByRole('link', { name: 'Fictional-Old' }).first(),
  ).toHaveAttribute('href', 'https://www.bewelcome.org/members/fictional-old');
  await expect(history.locator('time')).toHaveCount(3);

  await signInViaApi(page, request, SEEDED_ADMIN);
  await page.goto('/admin/network-connections');
  await expect(
    page.getByRole('heading', { name: 'Search external connections' }),
  ).toBeVisible();
  await page.goto(`/admin/user/${encodeURIComponent(member.username)}`);
  await expect(
    page.getByRole('heading', { name: 'External connection history' }),
  ).toBeVisible();
});
