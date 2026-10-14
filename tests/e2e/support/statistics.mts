import type { BrowserContext, Route } from '@playwright/test';

const statisticsChart =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />';

export async function stubStatisticsImages(
  context: BrowserContext,
): Promise<void> {
  const replyWithChart = (route: Route): Promise<void> =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: statisticsChart,
    });

  await Promise.all([
    context.route(
      /^https:\/\/grafana\.trustroots\.org\/render\//,
      replyWithChart,
    ),
    context.route(/^https:\/\/hosted\.weblate\.org\/widgets\//, replyWithChart),
  ]);
}
