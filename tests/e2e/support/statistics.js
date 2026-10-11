const statisticsChart =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />';

async function stubStatisticsImages(context) {
  const replyWithChart = route =>
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

module.exports = { stubStatisticsImages };
