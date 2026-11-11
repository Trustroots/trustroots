import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_RELATIONSHIP_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';

test('signed-in homepage shows recent connections and all hosting connections', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'public.home', [
    'Signed-in members can find recent connections and hosting connections.',
  ]);
  await signInViaApi(page, request, SEEDED_RELATIONSHIP_MEMBERS.alice);
  await page.route('**/api/tribes/discovery/connections', route =>
    route.fulfill({
      json: {
        recent: [
          {
            _id: 'recent-member-1',
            username: 'recentone',
            displayName: 'Recent Member',
            activity: 'today',
          },
          {
            _id: 'recent-member-2',
            username: 'recenttwo',
            displayName: 'Another Member',
            activity: 'week',
          },
        ],
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
            location: [-22.9068, -43.1729],
          },
        ],
      },
    }),
  );

  await page.goto('/');

  const recent = page.locator('.home-recent-members');
  await expect(recent).toBeVisible();
  await expect(recent.locator('.home-recent-member')).toHaveCount(2);
  await expect(recent).toContainText('Recent Member');
  await expect(recent).toContainText('Another Member');

  const hostingMap = page.locator('.home-hosting-map');
  await expect(hostingMap).toBeVisible();
  await expect(hostingMap.locator('.leaflet-interactive')).toHaveCount(2);
});
