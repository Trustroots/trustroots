import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import type { StatisticsResponse } from '../../../../modules/statistics/client/api/statistics.api';

const externalImages =
  /^https:\/\/(grafana\.trustroots\.org\/render\/|hosted\.weblate\.org\/widgets\/)/;

test('statistics shows rolling signup and messaging counts', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Members and recent activity show rolling 24-hour and 168-hour counts.',
  ]);
  const responsePromise = page.waitForResponse('/api/statistics');
  await page.goto('/statistics');
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const statistics: StatisticsResponse = await response.json();
  expect(statistics.recentActivity).toBeDefined();
  const { signups, threads, messages } = statistics.recentActivity!;
  const format = (count: number) => new Intl.NumberFormat('en').format(count);
  const members = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Members', exact: true }),
  });
  const table = page.getByRole('table', { name: 'Recent activity' });

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(members).toContainText(
      `${format(signups!.past7Days!)} new signups in the past 7 days (168 hours)`,
    );
    await expect(members).toContainText(
      `${format(signups!.past24Hours!)} new signups in the past 24 hours`,
    );
    await expect(table.getByRole('columnheader')).toHaveText([
      '',
      'Past 7 days (168 hours)',
      'Past 24 hours',
    ]);
    for (const [label, counts] of [
      ['New threads', threads!],
      ['Messages sent', messages!],
    ] as const) {
      expect(counts.past7Days!).toBeGreaterThanOrEqual(counts.past24Hours!);
      const row = table.getByRole('row', { name: new RegExp(label) });
      await expect(row.getByRole('cell')).toHaveText([
        format(counts.past7Days!),
        format(counts.past24Hours!),
      ]);
    }
    await table.scrollIntoViewIfNeeded();
    await expect(table).toBeInViewport();
    expect(
      await table.evaluate(
        element => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('statistics includes Couchers.org and identifies legacy networks', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Couchers.org connection statistics and legacy network labels are public.',
  ]);
  const responsePromise = page.waitForResponse('/api/statistics');
  await page.goto('/statistics');
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const statistics = await response.json();
  const couchers = statistics.connections.find(
    (connection: { network: string }) => connection.network === 'couchers',
  );
  expect(couchers).toBeDefined();
  const networks = page.locator('.panel').filter({
    has: page.getByRole('heading', {
      name: 'Connected to networks',
      exact: true,
    }),
  });
  const couchersRow = networks.getByRole('listitem').filter({
    hasText: 'Couchers.org',
  });
  await expect(couchersRow).toContainText(`${couchers.percentage.toFixed(1)}%`);
  await expect(couchersRow).not.toContainText('Legacy');
  for (const network of ['Couchsurfing', 'Facebook', 'GitHub']) {
    await expect(
      networks.getByRole('listitem').filter({ hasText: network }),
    ).toContainText('Legacy');
  }
});

test('statistics remains usable while external images never respond', async ({
  page,
  context,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Unavailable external images do not block statistics or support navigation.',
  ]);
  let releaseImages: (() => void) | undefined;
  let imageRequests = 0;
  const pendingImages = new Promise<void>(resolve => {
    releaseImages = resolve;
  });
  await context.route(externalImages, async route => {
    imageRequests += 1;
    await pendingImages;
    await route.abort();
  });

  try {
    await page.goto('/statistics', { waitUntil: 'load', timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: 'Members', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('heading', { name: 'Member growth', exact: true })
      .scrollIntoViewIfNeeded();
    await expect.poll(() => imageRequests).toBeGreaterThan(0);
    const volunteer = page.getByRole('link', {
      name: 'Consider volunteering!',
      exact: true,
    });
    await volunteer.click();
    await expect(page).toHaveURL(/\/support\?category=volunteering$/);
    await expect(page.getByLabel('What can we help with?')).toHaveValue(
      'volunteering',
    );
  } finally {
    releaseImages?.();
    await context.unrouteAll({ behavior: 'wait' });
  }
});

test('statistics shows a fallback and dashboard link when Grafana fails', async ({
  page,
  context,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Failed charts show readable fallback text and retain their dashboard links.',
  ]);
  await context.route(externalImages, route => route.abort('failed'));
  await page.goto('/statistics');

  const chart = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Member growth', exact: true }),
  });
  await chart.scrollIntoViewIfNeeded();
  await expect(chart.getByRole('status')).toHaveText(
    'Member growth: Image unavailable',
  );
  await expect(chart.getByRole('link')).toHaveAttribute(
    'href',
    'https://grafana.trustroots.org/d/000000002/members',
  );
  await expect(
    page.getByRole('heading', { name: 'Members', exact: true }),
  ).toBeAttached();
});
