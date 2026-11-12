import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

test('admin inspects MongoDB diagnostics and refreshes live job counts', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.mongo', [
    'Admin sees the live MongoDB server version, feature compatibility version, and topology.',
    'Admin sees the ordered 4.4 → 5.0 → 6.0 → 7.0 migration path.',
    'Admin compares collection storage and refreshes live job counts.',
  ]);
  await signInViaApi(page, request, SEEDED_ADMIN);

  const name = 'sample storage diagnostic job';
  const lastFinishedAt = new Date('2025-01-02T12:00:00Z');
  await withE2eDb(async db => {
    await db
      .collection('agendaJobs')
      .insertMany([
        { name, lastFinishedAt, data: { text: 'Private fixture body' } },
        { name, lastFinishedAt, failedAt: lastFinishedAt },
        { name, nextRunAt: new Date('2099-01-01T00:00:00Z') },
        { name, lockedAt: new Date('2099-01-01T00:00:00Z') },
        { name, disabled: true },
        { name },
      ]);
    await db
      .collection('agendaJobsArchived')
      .insertOne({ name, lastFinishedAt });
  });
  try {
    const response = page.waitForResponse(response =>
      response.url().endsWith('/api/admin/mongo'),
    );
    await page.goto('/admin/mongo');
    const snapshot = await response;
    expect(snapshot.ok()).toBe(true);
    expect(snapshot.headers()['cache-control']).toBe('no-store');
    const body = await snapshot.json();
    expect(body.server.version).toMatch(/^\d+\.\d+(\.\d+)?/);
    expect(['standalone', 'replicaSet', 'sharded']).toContain(
      body.server.topology,
    );
    if (body.server.fcv) {
      expect(body.server.fcv.version).toMatch(/^\d+\.\d+$/);
      expect(
        body.server.fcv.targetVersion === null ||
          typeof body.server.fcv.targetVersion === 'string',
      ).toBe(true);
      expect(typeof body.server.fcv.transitioning).toBe('boolean');
    }
    expect(JSON.stringify(body)).not.toContain('Private fixture body');

    await expect(page).toHaveTitle(/MongoDB diagnostics/);
    await expect(
      page.getByRole('link', { name: 'MongoDB', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    const metadata = page.getByRole('table', {
      name: 'MongoDB migration metadata',
    });
    await expect(
      metadata.getByRole('rowheader', { name: 'Connected server version' }),
    ).toBeVisible();
    await expect(
      metadata.getByRole('rowheader', {
        name: 'Feature compatibility version (FCV)',
      }),
    ).toBeVisible();
    await expect(
      metadata.getByRole('rowheader', { name: 'Topology' }),
    ).toBeVisible();
    await expect(page.getByText('4.4 → 5.0 → 6.0 → 7.0')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'MongoDB 7 migration runbook' }),
    ).toBeVisible();

    const storage = page.getByRole('table', { name: 'Collection storage' });
    for (const collection of ['agendaJobs', 'agendaJobsArchived']) {
      const row = storage.getByRole('row').filter({
        has: page.getByRole('rowheader', { name: collection, exact: true }),
      });
      await expect(row.getByRole('cell')).toHaveCount(4);
    }

    const job = page.getByRole('row').filter({
      has: page.getByRole('rowheader', { name, exact: true }),
    });
    await expect(job.getByRole('cell')).toHaveText([
      '1',
      '1',
      '1',
      '1',
      '1',
      '1',
    ]);
    await withE2eDb(db =>
      db.collection('agendaJobs').insertOne({ name, lastFinishedAt }),
    );
    await page.getByRole('button', { name: 'Refresh snapshot' }).click();
    await expect(job.getByRole('cell')).toHaveText([
      '1',
      '1',
      '2',
      '1',
      '1',
      '1',
    ]);
  } finally {
    await withE2eDb(async db => {
      await db.collection('agendaJobs').deleteMany({ name });
      await db.collection('agendaJobsArchived').deleteMany({ name });
    });
  }
});

test('ordinary members cannot access MongoDB diagnostics', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.mongo', ['Non-admin access is rejected.']);
  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  expect((await request.get('/api/admin/mongo')).status()).toBe(403);
  await page.goto('/admin/mongo');
  await expect(
    page.getByRole('heading', { name: 'MongoDB diagnostics' }),
  ).toHaveCount(0);
});
