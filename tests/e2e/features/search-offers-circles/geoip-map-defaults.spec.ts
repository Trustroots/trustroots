import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';
import { prepareRasterSearchMap } from '../../support/maps.mts';

test.describe('approximate initial map locations', () => {
  test.beforeEach(async ({ page, context, request }) => {
    await prepareRasterSearchMap(page, context);
    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    await page.route('**/api/map-default-location', route =>
      route.fulfill({
        json: { location: { latitude: 34, longitude: -17, zoom: 6 } },
      }),
    );
  });

  for (const state of ['fresh', 'expired', 'legacy', 'recent'] as const) {
    test(`${state} search viewport respects approximate location precedence`, async ({
      page,
    }, testInfo) => {
      annotateFeature(
        testInfo,
        'search.map',
        state === 'fresh' || state === 'recent'
          ? 'Fresh search uses an approximate location while recent saved positions take precedence.'
          : 'Expired and legacy search positions yield to the approximate location.',
      );
      await page.addInitScript(value => {
        localStorage.removeItem('search-map-location');
        if (value !== 'fresh') {
          const position = { latitude: 12, longitude: 23, zoom: 7 };
          localStorage.setItem(
            'search-map-location',
            JSON.stringify(
              value === 'legacy'
                ? position
                : {
                    ...position,
                    version: 1,
                    savedAt:
                      Date.now() -
                      (value === 'expired' ? 49 * 60 * 60 * 1000 : 1000),
                  },
            ),
          );
        }
      }, state);
      let lookups = 0;
      page.on('request', request => {
        if (request.url().endsWith('/api/map-default-location')) lookups++;
      });
      await page.goto('/search');
      const map = page.getByTestId('leaflet-search-map');
      await expect(map).toHaveAttribute(
        'data-map-latitude',
        state === 'recent' ? '12' : '34',
      );
      await expect(map).toHaveAttribute(
        'data-map-longitude',
        state === 'recent' ? '23' : '-17',
      );
      expect(lookups).toBe(state === 'recent' ? 0 : 1);
      if (state !== 'recent') {
        expect(
          await page.evaluate(() =>
            localStorage.getItem('search-map-location'),
          ),
        ).toBeNull();
      }
      await map.getByRole('button', { name: 'Zoom in' }).click();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const value = JSON.parse(
              localStorage.getItem('search-map-location') || 'null',
            );
            return value?.version;
          }),
        )
        .toBe(1);
    });
  }

  test('failed approximate lookup leaves search usable', async ({
    page,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      'search.map',
      'Failed or late approximate lookups leave member navigation intact.',
    );
    await page.route('**/api/map-default-location', route =>
      route.fulfill({ status: 503, json: {} }),
    );
    await page.goto('/search');
    const map = page.getByTestId('leaflet-search-map');
    await expect(map).toHaveAttribute('data-map-zoom', '6');
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(map).toHaveAttribute('data-map-zoom', '7');
  });

  test('late approximate lookup cannot undo a member zoom', async ({
    page,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      'search.map',
      'Failed or late approximate lookups leave member navigation intact.',
    );
    let release!: () => void;
    let started!: () => void;
    const requested = new Promise<void>(resolve => {
      started = resolve;
    });
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route('**/api/map-default-location', async route => {
      started();
      await blocked;
      await route.fulfill({
        json: { location: { latitude: 34, longitude: -17, zoom: 6 } },
      });
    });
    await page.goto('/search');
    await requested;
    const map = page.getByTestId('leaflet-search-map');
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(map).toHaveAttribute('data-map-zoom', '7');
    const chosenLatitude = await map.getAttribute('data-map-latitude');
    const chosenLongitude = await map.getAttribute('data-map-longitude');
    const completed = page.waitForResponse('**/api/map-default-location');
    release();
    await completed;
    await expect(map).toHaveAttribute('data-map-latitude', chosenLatitude!);
    await expect(map).toHaveAttribute('data-map-longitude', chosenLongitude!);
    await expect(map).toHaveAttribute('data-map-zoom', '7');
  });

  test('approximate meeting viewport does not choose a location', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.meet-create-edit-delete');
    await page.goto('/offer/meet/add');
    await page
      .getByPlaceholder('Write here...')
      .fill('A fictional park meeting.');
    await page.getByRole('button', { name: 'Next section' }).click();
    const map = page.getByTestId('leaflet-map');
    await expect(map).toHaveAttribute('data-map-latitude', '34');
    await expect(map.locator('.leaflet-overlay-pane path')).toHaveCount(0);
    const save = page.getByRole('button', { name: 'Finish editing and save' });
    await expect(save).toBeDisabled();
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(save).toBeDisabled();
    await map.click({ position: { x: 100, y: 100 } });
    await expect(save).toBeEnabled();
  });

  test('approximate hosting viewport does not choose a location', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'offers.host');
    await page.route('**/api/offers-by/**', route =>
      route.fulfill({ json: [] }),
    );
    await page.goto('/offer/host#location');
    const map = page.getByTestId('leaflet-map');
    await expect(map).toHaveAttribute('data-map-latitude', '34');
    await expect(map.locator('.leaflet-overlay-pane path')).toHaveCount(0);
    await page
      .getByRole('button', {
        name: 'Close information dialog about hosting location map',
      })
      .click();
    await page.getByRole('tab', { name: 'Description' }).click();
    await page
      .getByLabel('Tell about your home and hosting possibilities', {
        exact: false,
      })
      .fill('A fictional spare room.');
    const save = page.getByRole('button', { name: 'Save and Exit' });
    await expect(save).toBeDisabled();
    await page.getByRole('tab', { name: 'Location' }).click();
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(save).toBeDisabled();
    await map.click({ position: { x: 100, y: 100 } });
    await expect(save).toBeEnabled();
  });
});
