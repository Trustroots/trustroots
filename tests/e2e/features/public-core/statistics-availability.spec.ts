import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import type { StatisticsResponse } from '../../../../modules/statistics/client/api/statistics.api';

import type { PublicCharts } from '../../../../modules/statistics/shared/public-charts.mts';

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
  const activity = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Recent activity', exact: true }),
  });

  for (const width of [390, 768, 1280]) {
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
    if (width >= 768) {
      const memberBox = await members.boundingBox();
      const activityBox = await activity.boundingBox();
      expect(memberBox).not.toBeNull();
      expect(activityBox).not.toBeNull();
      expect(Math.abs(memberBox!.width - activityBox!.width)).toBeLessThan(2);
      expect(Math.abs(memberBox!.y - activityBox!.y)).toBeLessThan(2);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
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

test('statistics remains usable while charts are loading', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Pending chart data does not block statistics or support navigation.',
  ]);
  let releaseCharts!: () => void;
  const pendingCharts = new Promise<void>(resolve => {
    releaseCharts = resolve;
  });
  await page.route('**/api/statistics/charts', async route => {
    await pendingCharts;
    await route.abort();
  });

  try {
    await page.goto('/statistics');
    await expect(page.getByText('Loading charts…')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Members', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Consider volunteering!' }).click();
    await expect(page).toHaveURL(/\/support\?category=volunteering$/);
    await expect(page.getByLabel('What can we help with?')).toHaveValue(
      'volunteering',
    );
  } finally {
    releaseCharts();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('statistics shows an independent chart error when the chart API fails', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Chart failures show a readable status and leave other statistics available.',
  ]);
  await page.route('**/api/statistics/charts', route =>
    route.fulfill({ status: 503 }),
  );
  await page.goto('/statistics');

  await expect(page.getByText('Chart data is unavailable.')).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Recent activity' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Consider volunteering!' }),
  ).toBeVisible();
});

test('statistics renders MongoDB-backed charts without Grafana', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'public.statistics', [
    'Public weekly trends and member activity match the chart API.',
  ]);
  const grafanaRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).hostname === 'grafana.trustroots.org') {
      grafanaRequests.push(request.url());
    }
  });
  const responsePromise = page.waitForResponse('**/api/statistics/charts');
  await page.goto('/statistics');
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const charts: PublicCharts = await response.json();
  expect(charts.weeks).toHaveLength(12);
  const [week] = charts.weeks;
  const format = (count: number) => new Intl.NumberFormat('en').format(count);
  const signups = page.getByRole('table', { name: 'Weekly signups' });
  const conversations = page.getByRole('table', {
    name: 'Conversations and first replies',
  });
  const members = page.getByRole('table', { name: 'Member activity' });
  await expect(
    signups
      .getByRole('row', { name: new RegExp(week.weekStarting) })
      .getByRole('cell'),
  ).toHaveText([format(week.signups)]);
  await expect(
    conversations
      .getByRole('row', { name: new RegExp(week.weekStarting) })
      .getByRole('cell'),
  ).toHaveText([format(week.conversationsStarted), format(week.firstReplies)]);
  await expect(members.getByRole('cell')).toHaveText(
    [
      charts.memberActivity.past7Days,
      charts.memberActivity.past14Days,
      charts.memberActivity.past30Days,
      charts.memberActivity.past6Months,
      charts.memberActivity.past12Months,
    ].map(format),
  );
  const volunteer = page.getByRole('link', { name: 'Consider volunteering!' });
  await expect(volunteer).toBeVisible();
  await expect(volunteer).toHaveAttribute(
    'href',
    '/support?category=volunteering',
  );
  expect((await volunteer.boundingBox())!.y).toBeGreaterThan(
    (await conversations.boundingBox())!.y,
  );
  await expect(page.getByText('stats galore', { exact: false })).toHaveCount(0);
  await expect(page.locator('a[href*="grafana.trustroots.org"]')).toHaveCount(
    0,
  );
  expect(grafanaRequests).toEqual([]);
});
