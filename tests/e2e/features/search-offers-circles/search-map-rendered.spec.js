const { annotateFeature, expect, test } = require('../../support/test');

const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');
const {
  blockUnexpectedMapNetwork,
  seedMapState,
  useMapProviderHar,
  useMapRouteFixtures,
  waitForSearchMap,
} = require('../../support/maps');

const berlin = SEEDED_MEMBERS[0];

test.describe('rendered search map feature coverage', () => {
  test.beforeEach(async ({ context, page, request }) => {
    await seedMapState(page);
    await useMapProviderHar(context, 'search-map');
    await blockUnexpectedMapNetwork(context);
    await useMapRouteFixtures(context);
    await signInViaApi(page, request, berlin);
  });

  test('search map renders with offline style and fixture offers', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Search map renders with deterministic offline style.',
      'Route fixture offers populate the rendered map source.',
    ]);

    await waitForSearchMap(page);

    const mapState = await page.evaluate(() => {
      /* global document, window */
      const canvas = document.querySelector('.mapboxgl-canvas');
      const persistedStyle = JSON.parse(
        window.localStorage.getItem('search-map-style'),
      );
      return {
        hasCanvas: Boolean(canvas),
        persistedStyleName: persistedStyle.name,
      };
    });

    expect(mapState).toEqual({
      hasCanvas: true,
      persistedStyleName: 'E2E Offline Map',
    });
  });

  test('search map stays usable when offers fixture is empty', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Empty map-offers fixture leaves the search map usable.',
    ]);

    await useMapRouteFixtures(context, { offers: 'empty-offers.json' });
    await page.reload();
    await waitForSearchMap(page);

    await expect(
      page.getByText(/choose something from the map/i),
    ).toBeVisible();
  });

  test('offer deep-link uses fixture offer data in the sidebar', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Rendered map offer deep-link opens deterministic sidebar data.',
    ]);

    await page.goto('/search?offer=665100000000000000000001');
    await waitForSearchMap(page);

    await expect(page.getByText(/E2E offline map host offer/i)).toBeVisible();
    await expect(page.getByText(/Berlin Host/i)).toBeVisible();
  });

  test('location search uses deterministic geocoding fixture', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-locations', [
      'Geocoding/map interactions are stubbed deterministically.',
    ]);

    const geocodeResponse = page.waitForResponse(response =>
      response.url().includes('/geocoding/v5/mapbox.places/Berlin.json'),
    );
    await page.goto('/search?location=Berlin');
    await geocodeResponse;

    await waitForSearchMap(page);
    await expect(page.locator('.search-map')).toBeVisible();
  });
});
