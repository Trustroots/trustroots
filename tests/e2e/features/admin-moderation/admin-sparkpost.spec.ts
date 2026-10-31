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
    'Admin reviews selected recovery recipients before queueing.',
    'Admin lists unconfirmed accounts behind the preview count.',
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
  await page.route('**/api/admin/sparkpost/recovery?*', route =>
    route.fulfill({
      json: {
        page: 1,
        more: false,
        candidates: [
          {
            key: 'signup:sample',
            kind: 'signup',
            username: 'sample-member',
            recipient: 'member@example.test',
            description: 'Fresh sign-up confirmation',
          },
        ],
      },
    }),
  );
  await page.route('**/api/admin/sparkpost/recovery', async route => {
    expect(route.request().postDataJSON().keys).toEqual(['signup:sample']);
    await route.fulfill({
      json: {
        results: [{ key: 'signup:sample', status: 'Queued for delivery' }],
      },
    });
  });
  await page.route('**/api/admin/sparkpost/accounts?*', route =>
    route.fulfill({
      json: {
        page: 1,
        more: false,
        candidates: [
          {
            key: 'signup:sample',
            kind: 'signup',
            username: 'sample-member',
            recipient: 'member@example.test',
            description: 'Fresh sign-up confirmation',
            created: '2025-01-02T12:00:00Z',
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
    await expect(
      page.getByText(/Provider pagination was incomplete/),
    ).toBeVisible();
    await page.getByLabel('Select all eligible events on this page').check();
    await page
      .getByRole('button', { name: 'Review 1 selected emails' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Review recovery emails' }),
    ).toContainText('member@example.test');
    await page.getByRole('button', { name: 'Queue selected emails' }).click();
    await expect(page.getByText(/Queued for delivery/)).toBeVisible();

    await page.getByLabel('From (UTC, inclusive)').fill('2025-01-02 00:00');
    await page.getByLabel('To (UTC, exclusive)').fill('2025-01-03 00:00');
    await page.getByRole('button', { name: 'Preview completed jobs' }).click();
    await expect(
      page.getByText('Delivery unverified.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'fictional-recovery-campaign' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Review unconfirmed accounts' })
      .click();
    await page.getByLabel('Select all eligible accounts on this page').check();
    await page.getByRole('button', { name: 'Review 1 confirmations' }).click();
    await page
      .getByRole('button', { name: 'Queue confirmation emails' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Unconfirmed accounts' }),
    ).toContainText('Queued for delivery');

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
