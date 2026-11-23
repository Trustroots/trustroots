import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

test.describe('approximate initial map locations', () => {
  test.beforeEach(async ({ page, request }) => {
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
      const map = page.locator('.search-map');
      const [latitude, longitude, zoom] =
        state === 'recent' ? [12, 23, 7] : [34, -17, 6];
      // A resize can move the centre slightly. Allow one pixel of movement at
      // the expected zoom while checking which location won.
      const onePixelInDegrees = 360 / (512 * 2 ** zoom);
      await expect
        .poll(async () => {
          const [mapLatitude, mapLongitude] = await Promise.all([
            map.getAttribute('data-map-latitude'),
            map.getAttribute('data-map-longitude'),
          ]);
          return Math.max(
            Math.abs(Number(mapLatitude) - latitude),
            Math.abs(Number(mapLongitude) - longitude),
          );
        })
        .toBeLessThan(onePixelInDegrees);
      await expect(map).toHaveAttribute('data-map-zoom', String(zoom));
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
    const map = page.locator('.search-map');
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
    const map = page.locator('.search-map');
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

  test('late approximate lookup cannot override an explicit device location', async ({
    page,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      'search.map',
      'A late approximate lookup cannot override explicit device navigation.',
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(success: PositionCallback) {
            queueMicrotask(() =>
              success({
                coords: {
                  latitude: -23.55,
                  longitude: -46.63,
                  accuracy: 10,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: null,
                  speed: null,
                },
                timestamp: Date.now(),
              } as GeolocationPosition),
            );
          },
        },
      });
    });

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
    const locate = page.getByRole('button', {
      name: 'Use my location',
      exact: true,
    });
    await expect(locate).toBeVisible();
    await locate.click();

    const map = page.locator('.search-map');
    await expect(map).toHaveAttribute('data-map-latitude', '-23.55');
    await expect(map).toHaveAttribute('data-map-longitude', '-46.63');
    await expect(map).toHaveAttribute('data-map-zoom', '13');
    const completed = page.waitForResponse('**/api/map-default-location');
    release();
    await completed;
    await expect(map).toHaveAttribute('data-map-latitude', '-23.55');
    await expect(map).toHaveAttribute('data-map-longitude', '-46.63');
    await expect(map).toHaveAttribute('data-map-zoom', '13');
  });

  test('denied device location uses an explicit approximate search viewport', async ({
    page,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      'search.map',
      'Denied device location falls back to an explicitly labelled approximate viewport.',
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(
            _success: PositionCallback,
            failure: PositionErrorCallback,
          ) {
            queueMicrotask(() =>
              failure({ code: 1 } as GeolocationPositionError),
            );
          },
        },
      });
      localStorage.setItem(
        'search-map-location',
        JSON.stringify({
          latitude: 12,
          longitude: 23,
          zoom: 9,
          version: 1,
          savedAt: Date.now(),
        }),
      );
    });
    await page.goto('/search');
    const map = page.locator('.search-map');
    // Leaflet can report its centre from a rounded pixel origin.
    await expect
      .poll(async () => Number(await map.getAttribute('data-map-latitude')))
      .toBeCloseTo(12, 3);
    const locate = page.getByRole('button', {
      name: 'Use my location',
      exact: true,
    });
    await locate.click();
    await expect(map).toHaveAttribute('data-map-latitude', '34');
    await expect(map).toHaveAttribute('data-map-longitude', '-17');
    await expect(map).toHaveAttribute('data-map-zoom', '6');
    await expect(
      page.locator('.device-location-control').getByRole('status'),
    ).toContainText('approximate');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('search-map-location')!).latitude,
        ),
      )
      .toBe(34);
  });

  test('denied device location only moves the meeting editor viewport', async ({
    page,
  }, testInfo) => {
    annotateFeature(
      testInfo,
      'offers.meet-create-edit-delete',
      'An approximate fallback does not choose offer coordinates or enable saving.',
    );
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(
            _success: PositionCallback,
            failure: PositionErrorCallback,
          ) {
            queueMicrotask(() =>
              failure({ code: 1 } as GeolocationPositionError),
            );
          },
        },
      });
    });
    await page.goto('/offer/meet/add');
    await page
      .getByPlaceholder('Write here...')
      .fill('A fictional park meeting.');
    await page.getByRole('button', { name: 'Next section' }).click();
    await expect(page.locator('.offer-map [data-map-zoom]')).toHaveAttribute(
      'data-map-latitude',
      '34',
    );
    await page.route('**/api/map-default-location', route =>
      route.fulfill({
        json: { location: { latitude: -12, longitude: 45, zoom: 5 } },
      }),
    );
    await page
      .getByRole('button', { name: 'Use my location', exact: true })
      .click();
    const map = page.locator('.offer-map [data-map-zoom]');
    await expect(map).toHaveAttribute('data-map-latitude', '-12');
    await expect(map).toHaveAttribute('data-map-zoom', '5');
    await expect(map.locator('.maplibregl-marker')).toHaveCount(0);
    const save = page.getByRole('button', { name: 'Finish editing and save' });
    await expect(save).toBeDisabled();
    const feedback = page
      .locator('.device-location-control')
      .getByRole('status');
    await expect(feedback).toContainText('Showing an approximate location');
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(feedback).toBeEmpty();
    await expect(save).toBeDisabled();
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
    const map = page.locator('.offer-map [data-map-zoom]');
    await expect(map).toHaveAttribute('data-map-latitude', '34');
    await expect(map.locator('.maplibregl-marker')).toHaveCount(0);
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
    let saves = 0;
    await page.route('**/api/offers', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      saves += 1;
      return route.fulfill({
        json: { message: 'Offer saved.', _id: 'saved-host' },
      });
    });
    await page.goto('/offer/host#location');
    const map = page.locator('.offer-map [data-map-zoom]');
    await expect(map).toHaveAttribute('data-map-latitude', '34');
    await expect(map.locator('.maplibregl-marker')).toHaveCount(0);
    const guide = page.getByRole('note').filter({
      hasText: 'Set your hosting location on the map.',
    });
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('Your exact location stays private.');
    await expect(
      page.getByRole('region', { name: 'Availability' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Description' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Location' }),
    ).toBeInViewport();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await page
      .getByLabel('Tell about your home and hosting possibilities', {
        exact: false,
      })
      .fill('A fictional spare room.');
    expect(saves).toBe(0);
    await map.getByRole('button', { name: 'Zoom in' }).click();
    await expect(guide).toHaveCount(0);
    expect(saves).toBe(0);
    await expect(map).toHaveAttribute('data-map-zoom', '7');
    await map.click({ position: { x: 100, y: 100 } });
    await expect(page.getByText('All changes saved')).toBeVisible();
    expect(saves).toBe(1);
    await expect(map).toHaveAttribute('data-map-zoom', '7');
  });
});
