import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';

test('admin can open a legacy message URL in a read-only conversation view', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.messages', [
    'Legacy message URLs resolve to usernames and display the conversation in a read-only layout.',
  ]);
  await signInViaApi(page, request, SEEDED_ADMIN);

  const firstId = '111111111111111111111111';
  const secondId = '222222222222222222222222';
  await page.route('**/api/admin/user', route => {
    const { id } = route.request().postDataJSON() as { id: string };
    const user =
      id === firstId
        ? { username: 'sample-first', displayName: 'Sample First' }
        : { username: 'sample-second', displayName: 'Sample Second' };
    return route.fulfill({
      json: { profile: { _id: id, ...user } },
    });
  });
  await page.route('**/api/admin/users', route =>
    route.fulfill({
      json: {
        users: [
          {
            _id: firstId,
            username: 'sample-first',
            displayName: 'Sample First',
          },
          {
            _id: secondId,
            username: 'sample-second',
            displayName: 'Sample Second',
          },
        ],
      },
    }),
  );
  await page.route('**/api/admin/messages', route =>
    route.fulfill({
      json: {
        messages: [
          {
            _id: 'sample-message',
            userFrom: {
              _id: firstId,
              username: 'sample-first',
              displayName: 'Sample First',
            },
            userTo: {
              _id: secondId,
              username: 'sample-second',
              displayName: 'Sample Second',
            },
            created: '2025-03-04T05:06:07.000Z',
            read: false,
            content: '<p>Sample conversation message.</p>',
          },
        ],
        referenceThreads: [],
      },
    }),
  );

  await page.goto(`/admin/messages?userId1=${firstId}&userId2=${secondId}`);
  await expect(page).toHaveURL(
    /\/admin\/messages\?username1=sample-first&username2=sample-second$/,
  );
  await expect(
    page.getByRole('heading', { name: /Messaging between/ }),
  ).toBeVisible();
  await expect(page.getByText('Sample conversation message.')).toBeVisible();
  await expect(
    page.getByText('2025-03-04 05:06', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Times in UTC.')).toBeVisible();
  await expect(page.getByText('Database entry', { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('Warn scammer recipients')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read' })).toHaveCount(0);
  await expect(page.getByLabel('Member 1 username or ID')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('admin-message-overview.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator('html')
      .evaluate(element => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('admin-message-overview-mobile.png'),
    fullPage: true,
  });
});
