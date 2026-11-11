import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_RELATIONSHIP_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';

test('signed-in homepage lays out recent connections and opens hosting offers', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', [
    'Signed-in members can find recent connections and hosting connections.',
  ]);
  await page.setViewportSize({ width: 1200, height: 900 });
  await signInViaApi(page, request, SEEDED_RELATIONSHIP_MEMBERS.alice);
  await page.route('**/api/tribes/discovery/connections', route =>
    route.fulfill({
      json: {
        recent: Array.from({ length: 9 }, (_, index) => ({
          _id: `recent-member-${index}`,
          username: `recentmember${index}`,
          displayName: `Recent Member ${index + 1}`,
          activity: index === 0 ? 'today' : 'week',
          ...(index === 0 && { tagline: 'Travelling by train and bicycle' }),
        })),
        hosts: [
          {
            _id: 'host-member-1',
            username: 'olderhost',
            displayName: 'Older Host',
            location: [52.52, 13.405],
          },
          {
            _id: 'host-member-2',
            username: 'newhost',
            displayName: 'Recent Host',
            location: [48.8566, 2.3522],
          },
        ],
      },
    }),
  );

  await page.goto('/');

  const recent = page.locator('.home-recent-members');
  const heading = recent.getByRole('heading');
  const cards = recent.getByRole('link');
  await expect(cards).toHaveCount(9);
  await expect(cards.first()).toContainText('Active today');
  await expect(cards.last()).toContainText('Recent Member 9');
  await expect
    .poll(() =>
      heading.evaluate(
        element =>
          element.getBoundingClientRect().top -
          document.getElementById('tr-header')!.getBoundingClientRect().bottom,
      ),
    )
    .toBeGreaterThan(0);
  const cardsPerRow = () =>
    cards.evaluateAll(elements => {
      const rows = new Map<number, number>();
      elements.forEach(element => {
        const top = element.getBoundingClientRect().top;
        rows.set(top, (rows.get(top) ?? 0) + 1);
      });
      return Array.from(rows.values());
    });
  await expect.poll(cardsPerRow).toEqual([3, 3, 3]);

  const hostingMap = page.locator('.home-hosting-map');
  await expect(hostingMap).toBeVisible();
  const pins = hostingMap.locator('.leaflet-interactive');
  await expect(pins).toHaveCount(2);
  await pins.first().click();
  const popup = hostingMap.locator('.leaflet-popup-content');
  const hostName = popup.getByText('Older Host', { exact: true });
  const offer = popup.getByRole('link', { name: 'View hosting offer' });
  await expect(hostName).toBeVisible();
  await expect(offer).toHaveAttribute(
    'href',
    '/profile/olderhost/accommodation',
  );
  const [nameBox, offerBox] = await Promise.all([
    hostName.boundingBox(),
    offer.boundingBox(),
  ]);
  expect(offerBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(cardsPerRow).toEqual(Array(9).fill(1));
});
