const { expect, test } = require('../../support/fixtures');
const { installNostrRelayStub } = require('../../support/nostr');

async function prepareCircle(page, unavailable = false) {
  await installNostrRelayStub(page, {
    relayUrl: 'wss://relay.maps.hitchwiki.org',
    unavailable,
  });
  await page.route('**/api/tribes/hitchhikers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-circle',
        slug: 'hitchhikers',
        label: 'Hitchhikers',
        count: 0,
        description: 'Meet fellow hitchhikers.',
      },
    }),
  );
}

test('Hitchhikers circle foregrounds the recent map and explains source and dates', async ({
  page,
}) => {
  await prepareCircle(page);
  await page.goto('/circles/hitchhikers');
  await expect(
    page.getByRole('heading', { name: 'Hitchhiking in the past 7 days' }),
  ).toBeVisible();
  await expect(
    page.getByRole('application', {
      name: 'Map of recent Hitchwiki hitchhiking locations',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('No reported locations in the past 7 days.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Uses the recorded ride date, or submission date when unknown/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Hitchwiki Maps' }),
  ).toHaveAttribute('href', 'https://maps.hitchwiki.org/');
  await expect(page.getByRole('link', { name: 'ODbL' })).toHaveAttribute(
    'href',
    'https://opendatacommons.org/licenses/odbl/1-0/',
  );
  const panel = await page.locator('.circle-location-map-panel').boundingBox();
  expect(panel.y).toBeLessThan(page.viewportSize().height);
  await expect(
    page.getByRole('link', { name: 'Join Hitchhikers on Trustroots' }),
  ).toBeVisible();
});

test('Hitchhikers circle remains usable when its relay refuses the subscription', async ({
  page,
}) => {
  await prepareCircle(page, true);
  await page.goto('/circles/hitchhikers');
  await expect(
    page.getByText(
      'Recent locations could not be loaded from Hitchwiki relay.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Join Hitchhikers on Trustroots' }),
  ).toBeVisible();
});
