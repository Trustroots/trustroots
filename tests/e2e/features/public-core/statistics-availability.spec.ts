import { test, expect, annotateFeature } from '../../support/fixtures.mts';

const externalImages =
  /^https:\/\/(grafana\.trustroots\.org\/render\/|hosted\.weblate\.org\/widgets\/)/;

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
