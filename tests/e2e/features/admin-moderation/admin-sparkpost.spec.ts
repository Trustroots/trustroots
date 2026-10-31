import {
  annotateFeature,
  expect,
  test,
  useElementScreenshot,
} from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('admin inspects SparkPost metrics and previews completed email jobs without sending', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.sparkpost', [
    'Admin compares daily activity and provider metrics.',
    'Admin inspects bounded provider event details.',
    'Admin previews completed email jobs without mutations.',
  ]);
  useElementScreenshot(testInfo, 'main.container');
  await signInViaApi(page, request, SEEDED_ADMIN);
  const date = new Date().toISOString().slice(0, 10);
  await page.route('**/api/admin/sparkpost/overview?*', route =>
    route.fulfill({
      json: {
        provider: 'ready',
        rows: [
          {
            date,
            signups: 53,
            messages: 351,
            sent: 115,
            delivered: 114,
            bounced: 1,
            opens: 9,
            complaints: 0,
          },
        ],
      },
    }),
  );
  await page.route('**/api/admin/sparkpost/events?*', route =>
    route.fulfill({
      json: {
        date,
        capped: true,
        events: [
          {
            timestamp: date + 'T01:00:00Z',
            type: 'delivery',
            campaign: 'confirm-email',
            recipientDomain: 'example.test',
          },
        ],
      },
    }),
  );
  const job = {
    name: 'send email',
    lastFinishedAt: new Date('2025-01-02T12:00:00Z'),
    data: {
      headers: {
        'X-MSYS-API': JSON.stringify({
          campaign_id: 'fictional-recovery-campaign',
        }),
      },
      text: 'Private fixture body',
    },
  };
  const inserted = await withE2eDb(db =>
    db.collection('agendaJobs').insertOne(job),
  );
  try {
    await page.goto('/admin/sparkpost');
    await expect(page).toHaveTitle(/SparkPost/);
    await expect(
      page.getByRole('link', { name: 'SparkPost', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('cell', { name: '53', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: `Inspect events for ${date}` })
      .click();
    await expect(page.getByText('example.test', { exact: true })).toBeVisible();
    await expect(page.getByText(/Partial results/)).toBeVisible();
    await page.getByLabel('From (UTC, inclusive)').fill('2025-01-02T00:00');
    await page.getByLabel('To (UTC, exclusive)').fill('2025-01-03T00:00');
    await page.getByRole('button', { name: 'Preview completed jobs' }).click();
    await expect(
      page.getByText('Delivery unverified.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'fictional-recovery-campaign' }),
    ).toBeVisible();
    await expect(page.getByText('Private fixture body')).toHaveCount(0);
    const saved = await withE2eDb(db =>
      db.collection('agendaJobs').findOne({ _id: inserted.insertedId }),
    );
    expect(saved).toEqual({ ...job, _id: inserted.insertedId });
    expect(
      (
        await request.get('/api/admin/sparkpost/overview?days=invalid')
      ).status(),
    ).toBe(400);
  } finally {
    await withE2eDb(db =>
      db.collection('agendaJobs').deleteOne({ _id: inserted.insertedId }),
    );
  }
});

test('ordinary members cannot access SparkPost diagnostics', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.sparkpost', [
    'Non-admin access is rejected.',
  ]);
  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  for (const action of ['overview', 'events', 'preview']) {
    expect((await request.get('/api/admin/sparkpost/' + action)).status()).toBe(
      403,
    );
  }
  await page.goto('/admin/sparkpost');
  await expect(
    page.getByRole('heading', { name: 'SparkPost email diagnostics' }),
  ).toHaveCount(0);
});
