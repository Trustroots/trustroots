import {
  annotateFeature,
  expectPresent,
  expect,
  test as base,
  useElementScreenshot,
} from '../../support/fixtures.mts';
import { finalizeEvent, type VerifiedEvent } from 'nostr-tools';
import { OpenLocationCode } from 'open-location-code';
import type { Page } from '@playwright/test';
import { installNostrRelayStub } from '../../support/nostr.mts';

import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';
import {
  blockUnexpectedMapNetwork,
  disableWebGL,
  fixturePath,
  prepareRasterSearchMap,
  routeRasterMapTiles,
  seedMapState,
  stubNostrAuthorVisibility,
  useMapProviderHar,
  useMapRouteFixtures,
  waitForSearchMap,
} from '../../support/maps.mts';

type SearchMapFixtures = { mapZoom: number };
const test = base.extend<SearchMapFixtures>({
  mapZoom: [6, { option: true }],
});

type CentrePinOptions = {
  beforeClick?: () => Promise<void>;
  assertCanvasSurvives?: boolean;
};

type WheelMode = 0 | 1 | 2;
type WheelSelector = '.mapboxgl-canvas' | '.leaflet-container';

declare global {
  interface Window {
    __deviceLocationRequests?: number;
    __deviceLocationRequestOptions?: PositionOptions;
    __wheelEvents?: Array<{
      type: string;
      deltaY: number;
      deltaX: number;
      deltaMode: number;
      targetClass: string;
      ctrlKey: boolean;
      isTrusted: boolean;
    }>;
  }
}

const berlin = SEEDED_MEMBERS[0];
const communityNotePlusCode = '9F4MG82G+7Q';
const communityNoteText = 'E2E community note: quiet courtyard with good tea.';

async function mockDeviceLocation(
  page: Page,
  latitude = 0,
  longitude = 0,
): Promise<void> {
  await page.addInitScript(
    ({ latitude: deviceLatitude, longitude: deviceLongitude }) => {
      window.__deviceLocationRequests = 0;
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition(
            success: PositionCallback,
            _error: PositionErrorCallback | null,
            options?: PositionOptions,
          ) {
            window.__deviceLocationRequests! += 1;
            window.__deviceLocationRequestOptions = options;
            queueMicrotask(() =>
              success({
                coords: {
                  latitude: deviceLatitude,
                  longitude: deviceLongitude,
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
    },
    { latitude, longitude },
  );
}

async function mockDeviceLocationFailure(page: Page, code = 1): Promise<void> {
  await page.addInitScript(errorCode => {
    window.__deviceLocationRequests = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(
          _success: PositionCallback,
          failure: PositionErrorCallback | null,
          options?: PositionOptions,
        ) {
          window.__deviceLocationRequests! += 1;
          window.__deviceLocationRequestOptions = options;
          queueMicrotask(() =>
            failure?.({
              code: errorCode,
              message: 'Fictional location failure',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError),
          );
        },
      },
    });
  }, code);
}

const readMapZoom = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('search-map-location');
    const liveZoom = document
      .querySelector('[data-map-zoom]')
      ?.getAttribute('data-map-zoom');
    if (liveZoom !== null && liveZoom !== undefined) {
      return Number(liveZoom);
    }
    if (!raw) {
      return null;
    }
    const location: unknown = JSON.parse(raw);
    if (
      typeof location === 'object' &&
      location !== null &&
      'zoom' in location &&
      typeof location.zoom === 'number'
    ) {
      return location.zoom;
    }
    return null;
  });

async function expectCentreHostPinPreservesZoom(
  page: Page,
  { beforeClick, assertCanvasSurvives = false }: CentrePinOptions = {},
): Promise<void> {
  await waitForSearchMap(page);
  const previousZoom = await readMapZoom(page);
  if (beforeClick) {
    await beforeClick();
  } else {
    await page.waitForTimeout(300);
  }

  const canvas = page.locator('.mapboxgl-canvas');
  const originalCanvas = assertCanvasSurvives
    ? await canvas.elementHandle()
    : null;
  const surface = page.locator('.search-map-container .mapboxgl-canvas');
  const box = await surface.boundingBox();
  expectPresent(box, 'map overlay should have a layout box');

  // The fixture host is at the seeded map centre.
  await surface.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page).toHaveURL(/offer=665100000000000000000001/);
  await expect(
    page.locator('.search-sidebar-container.is-offer-open'),
  ).toBeVisible();
  // Allow camera changes and debounced persistence to settle before comparing.
  await page.waitForTimeout(3200);
  await expect.poll(() => readMapZoom(page)).toBe(previousZoom);

  if (assertCanvasSurvives) {
    expectPresent(originalCanvas, 'map canvas should have an element handle');
    expect(await originalCanvas.evaluate(element => element.isConnected)).toBe(
      true,
    );
  }
}

async function wheelOverMap(
  page: Page,
  selector: WheelSelector,
  delta: number,
  deltaMode: WheelMode,
): Promise<void> {
  const canvas = page.locator(selector);
  await expect(canvas).toBeVisible();
  // Mapbox receives input directly through its canvas. Hover
  // waits for that surface to settle after navigation and viewport changes.
  const surface = page.locator(
    selector === '.mapboxgl-canvas'
      ? '.search-map-container .mapboxgl-canvas'
      : selector,
  );
  if (selector === '.mapboxgl-canvas') {
    // A visible container can resize before its WebGL canvas does.
    // Sending input in that interval can put it outside the rendered map.
    await expect
      .poll(async () => {
        const [rendered, input] = await Promise.all([
          canvas.boundingBox(),
          surface.boundingBox(),
        ]);
        return (
          !!rendered &&
          !!input &&
          Math.abs(rendered.width - input.width) < 1 &&
          Math.abs(rendered.height - input.height) < 1
        );
      })
      .toBe(true);
  }
  const box = await surface.boundingBox();
  expect(box, 'map input surface should have a layout box').toBeTruthy();
  expectPresent(box, 'map input surface should have a layout box');
  // Avoid the current-location marker at the centre of the map.
  await surface.hover({
    position: { x: (box.width * 3) / 4, y: box.height / 2 },
  });
  if (deltaMode !== 0) {
    // Exercise the renderer's DOM wheel handler with line and page units.
    // These cases are synthetic; the pixel case uses browser input.
    await surface.dispatchEvent('wheel', {
      deltaY: delta,
      deltaMode,
      clientX: box.x + (box.width * 3) / 4,
      clientY: box.y + box.height / 2,
    });
  } else {
    await page.mouse.wheel(0, delta);
  }
}

async function expectWheelZoom(
  page: Page,
  selector: WheelSelector,
  deltaMode: WheelMode,
): Promise<void> {
  const delta = [240, 3, 1][deltaMode];
  const readZoom = () => readMapZoom(page);
  await expect.poll(readZoom).not.toBeNull();
  const initialZoom = await readZoom();
  expectPresent(initialZoom, 'map zoom should be available');
  await wheelOverMap(page, selector, -delta, deltaMode);
  // A tiny numerical change can be imperceptible to someone using the map.
  await expect.poll(readZoom).toBeGreaterThan(initialZoom + 0.5);
  const zoomedIn = await readZoom();
  expectPresent(zoomedIn, 'map zoom should be available after zooming in');
  await wheelOverMap(page, selector, delta, deltaMode);
  await expect.poll(readZoom).toBeLessThan(zoomedIn - 0.5);
}

async function expectWheelZoomAfterNavigation(
  page: Page,
  selector: WheelSelector,
  deltaMode: WheelMode,
  afterNavigation: boolean,
): Promise<void> {
  await expectWheelZoom(page, selector, deltaMode);
  if (!afterNavigation) return;
  await page.getByRole('link', { name: 'Circles', exact: true }).click();
  await expect(page).toHaveURL(/\/circles$/);
  await page.locator('a[href="/search"]').first().click();
  if (selector === '.mapboxgl-canvas') {
    await waitForSearchMap(page);
  }
  await expectWheelZoom(page, selector, deltaMode);
}
async function showCommunityNotesSidebar(
  page: Page,
  events: VerifiedEvent[],
): Promise<void> {
  await prepareRasterSearchMap(page, page);
  await stubNostrAuthorVisibility(
    page,
    events.map(event => event.pubkey),
  );
  await installNostrRelayStub(page, { events });

  await page.goto('/search');
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelectorAll('.leaflet-interactive[fill="#1565C0"]')
              .length > 0,
          null,
        ),
      { timeout: 30000 },
    )
    .toBeTruthy();
  await page
    .locator('.leaflet-interactive[fill="#1565C0"]')
    .first()
    .dispatchEvent('click');
}

async function waitForRasterTileNear(
  page: Page,
  {
    latitude,
    longitude,
    tolerance = 4,
  }: { latitude: number; longitude: number; tolerance?: number },
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ expectedLatitude, expectedLongitude, coordinateTolerance }) =>
            [
              ...document.querySelectorAll<HTMLImageElement>('.leaflet-tile'),
            ].some(tile => {
              const path = new URL(tile.src).pathname;
              const match = path.match(
                /\/(?:tiles\/256\/)?(\d+)\/(\d+)\/(\d+)(?:\.png)?$/,
              );
              if (!match) return false;

              const [, rawZoom, rawX, rawY] = match;
              const zoom = Number(rawZoom);
              const x = Number(rawX) + 0.5;
              const y = Number(rawY) + 0.5;
              const scale = 2 ** zoom;
              const tileLongitude = (x / scale) * 360 - 180;
              const tileLatitude =
                (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) /
                Math.PI;

              return (
                zoom >= 8 &&
                Math.abs(tileLatitude - expectedLatitude) <
                  coordinateTolerance &&
                Math.abs(tileLongitude - expectedLongitude) <
                  coordinateTolerance
              );
            }),
          {
            coordinateTolerance: tolerance,
            expectedLatitude: latitude,
            expectedLongitude: longitude,
          },
        ),
      { timeout: 30000 },
    )
    .toBeTruthy();
}

test.describe('rendered search map feature coverage', () => {
  test.beforeEach(
    async ({ context, page, request, mapZoom, browser }, testInfo) => {
      // The test API permits eval source maps; built assets must also work
      // with the production policy's eval restriction, including map workers.
      await page.route(/\/search(?:\?|$)/, async route => {
        const response = await route.fetch();
        const headers = response.headers();
        headers['content-security-policy'] = headers[
          'content-security-policy'
        ].replace("'unsafe-eval'", '');
        await route.fulfill({ response, headers });
      });
      if (process.env.TRUSTROOTS_E2E_WHEEL_DIAGNOSTICS === 'true') {
        testInfo.annotations.push({
          type: 'browser-version',
          description: browser.version(),
        });
        await page.addInitScript(() => {
          const wheelEvents: NonNullable<Window['__wheelEvents']> = [];
          window.__wheelEvents = wheelEvents;
          document.addEventListener(
            'wheel',
            (event: WheelEvent) => {
              if (!(event.target instanceof Element)) {
                return;
              }
              wheelEvents.push({
                type: event.type,
                targetClass: event.target.className,
                deltaX: event.deltaX,
                deltaY: event.deltaY,
                deltaMode: event.deltaMode,
                ctrlKey: event.ctrlKey,
                isTrusted: event.isTrusted,
              });
            },
            true,
          );
        });
      }
      await seedMapState(page, { zoom: mapZoom });
      await useMapProviderHar(context, 'search-map');
      await blockUnexpectedMapNetwork(context);
      await useMapRouteFixtures(context);
      await signInViaApi(page, request, berlin);
    },
  );

  test.afterEach(async ({ page }, testInfo) => {
    if (
      process.env.TRUSTROOTS_E2E_WHEEL_DIAGNOSTICS === 'true' &&
      !page.isClosed()
    ) {
      const diagnostics = await page.evaluate(() => ({
        userAgent: window.navigator.userAgent,
        events: window.__wheelEvents,
      }));
      await testInfo.attach('wheel-events', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json',
      });
    }
  });

  for (const browser of [
    {
      name: 'Chrome and Brave',
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    },
    {
      name: 'Edge',
      userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    },
  ]) {
    test.describe(`${browser.name} search compatibility`, () => {
      test.use({ userAgent: browser.userAgent });

      test('Mapbox search works when WebGL2 is available', async ({
        page,
      }, testInfo) => {
        annotateFeature(testInfo, 'search.map', [
          'Chromium receives Mapbox GL when WebGL2 is available.',
          'Offer pins, zoom controls and place search remain usable.',
        ]);
        await page.goto('/search');
        expect(
          await page.evaluate(() =>
            Boolean(document.createElement('canvas').getContext('webgl2')),
          ),
        ).toBe(true);
        const map = page.locator('.search-map');
        await expect(map).toBeVisible();
        await waitForSearchMap(page);
        await expect(page.getByTestId('leaflet-search-map')).toHaveCount(0);
        const initialZoom = await readMapZoom(page);
        expectPresent(initialZoom);
        await page
          .getByRole('button', { name: 'Zoom in', exact: true })
          .click();
        await expect
          .poll(() => readMapZoom(page))
          .toBeCloseTo(initialZoom + 1, 4);
        await expectCentreHostPinPreservesZoom(page);
        await page.getByRole('button', { name: 'Back to results' }).click();
        await page.setViewportSize({ width: 375, height: 667 });
        await page.getByRole('button', { name: 'Back to map' }).click();
        await page.getByRole('button', { name: 'Search places' }).click();
        await page
          .getByRole('textbox', { name: 'Search places' })
          .fill('Berlin');
        await page
          .getByRole('list', { name: 'Place suggestions' })
          .getByRole('button')
          .click();
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                JSON.parse(localStorage.getItem('search-map-location')!)
                  .latitude,
            ),
          )
          .toBeCloseTo(52.52, 1);
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                JSON.parse(localStorage.getItem('search-map-location')!)
                  .longitude,
            ),
          )
          .toBeCloseTo(13.405, 1);
        await waitForSearchMap(page);
        await expect(map).toBeVisible();
      });
    });
  }

  test('search map renders with offline style and fixture offers', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Search map renders with deterministic offline style.',
      'Route fixture offers populate the rendered map source.',
    ]);

    await page.goto('/search');
    await waitForSearchMap(page);

    const mapState = await page.evaluate(() => {
      /* global document, window */
      const canvas = document.querySelector('.mapboxgl-canvas');
      const persistedStyle = JSON.parse(
        window.localStorage.getItem('search-map-style') ?? 'null',
      );
      if (
        typeof persistedStyle !== 'object' ||
        persistedStyle === null ||
        !('name' in persistedStyle) ||
        typeof persistedStyle.name !== 'string'
      ) {
        return { hasCanvas: Boolean(canvas), persistedStyleName: null };
      }
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

  test('map zoom buttons control the upgraded renderer', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Zoom controls operate on the current Mapbox renderer.',
    ]);
    await page.goto('/search');
    await waitForSearchMap(page);
    const initialZoom = await readMapZoom(page);
    expectPresent(initialZoom, 'initial map zoom should be stored');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => readMapZoom(page)).toBeCloseTo(initialZoom + 1, 4);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(() => readMapZoom(page)).toBeCloseTo(initialZoom, 1);
  });

  test('search map uses raster tiles when only WebGL1 is available', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A browser with WebGL1 but no WebGL2 receives the interactive raster map.',
    ]);
    await disableWebGL(page, true);
    await routeRasterMapTiles(context, { includeMapbox: true });
    await page.goto('/search');
    await expect(
      page.locator('[data-testid="leaflet-search-map"]'),
    ).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        Boolean(document.createElement('canvas').getContext('webgl')),
      ),
    ).toBe(true);
  });

  test('map fills the pane after the browser viewport grows', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Search map renders with deterministic offline style.',
    ]);
    await page.goto('/search');
    await waitForSearchMap(page);

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(async () => {
          const pane = await page
            .locator('.search-map-container')
            .boundingBox();
          const canvas = await page.locator('.mapboxgl-canvas').boundingBox();
          return (
            !!pane && !!canvas && Math.abs(pane.height - canvas.height) < 1
          );
        })
        .toBe(true);
    }
  });

  test('selecting an individual host preserves the map zoom', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Route fixture offers populate the rendered map source.',
    ]);
    await page.goto('/search');
    await expectCentreHostPinPreservesZoom(page, {
      assertCanvasSurvives: true,
    });
  });

  test('selecting an individual host with the sidebar closed preserves the map zoom', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Route fixture offers populate the rendered map source.',
    ]);
    await page.goto('/search');
    await expectCentreHostPinPreservesZoom(page, {
      beforeClick: async () => {
        await page
          .locator(
            '.search-sidebar-toggle button[aria-label="Hide search filters"]',
          )
          .click();
        await expect(
          page.locator(
            '.search-sidebar-toggle button[aria-label="Open search filters"]',
          ),
        ).toBeVisible();
      },
    });
  });

  test('selecting a host beneath an overlapping community-note cluster preserves zoom', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'An individual host pin remains selectable beneath an overlapping note cluster.',
      'Selecting the host does not expand the overlapping cluster.',
    ]);
    const plusCodes = [52.519, 52.52, 52.521].map(latitude =>
      new OpenLocationCode().encode(latitude, 13.405, 10),
    );
    const events = plusCodes.map((plusCode, index) =>
      finalizeEvent(
        {
          content: `Synthetic map note ${index + 1}`,
          created_at: 1700000000 + index,
          kind: 30397,
          tags: [['l', plusCode, 'open-location-code']],
        },
        new Uint8Array(32).fill(1),
      ),
    );
    const authors = [...new Set(events.map(event => event.pubkey))];
    await stubNostrAuthorVisibility(page, authors);
    await installNostrRelayStub(page, { events });
    const visibilityResponse = page.waitForResponse(response =>
      response.url().includes('/api/nostr/author-visibility?'),
    );

    await page.goto('/search');
    await visibilityResponse;
    await expectCentreHostPinPreservesZoom(page);
  });

  // Seed each starting zoom once. Persisted viewport updates are debounced,
  // so driving a long wheel sequence towards a boundary can read stale zoom.
  for (const zoom of [6, 2]) {
    for (const deltaMode of [0, 1, 2] as const) {
      const suffix =
        (zoom <= 2 ? ' at low zoom' : '') +
        ['', ' with line-based deltas', ' with page-based deltas'][deltaMode];
      test.describe(`wheel input starting at zoom ${zoom}`, () => {
        test.use({ mapZoom: zoom });
        test(`mouse wheel zooms the rendered search map in and out${suffix}`, async ({
          page,
          browserName,
        }, testInfo) => {
          // Mapbox GL needs WebGL; Firefox CI falls back to Leaflet and has no
          // .mapboxgl-canvas. Wheel zoom on that path is covered separately.
          test.skip(
            browserName === 'firefox',
            'Mapbox GL is unavailable in Firefox CI; use the raster fallback wheel test.',
          );
          annotateFeature(testInfo, 'search.map', [
            'Mouse-wheel input zooms the rendered map in and out.',
            ...(zoom === 6 && deltaMode === 0
              ? ['Mouse-wheel input works after returning to Search.']
              : []),
            ...(zoom <= 2 ? ['Mouse-wheel input works at low zoom.'] : []),
            ...(deltaMode === 1
              ? ['Line-based wheel events zoom the rendered map.']
              : []),
            ...(deltaMode === 2
              ? ['Page-based wheel events visibly zoom the rendered map.']
              : []),
          ]);
          await page.goto('/search');
          await waitForSearchMap(page);
          if (zoom <= 2) {
            await expect(
              page.getByText('Zoom closer to find members.'),
            ).toBeVisible();
          }
          await expectWheelZoomAfterNavigation(
            page,
            '.mapboxgl-canvas',
            deltaMode,
            zoom === 6 && deltaMode === 0,
          );
        });

        test(`mouse wheel zooms the raster fallback map in and out${suffix}`, async ({
          context,
          page,
        }, testInfo) => {
          annotateFeature(testInfo, 'search.map', [
            'Mouse-wheel input zooms the raster fallback map in and out.',
            ...(zoom === 6 && deltaMode === 0
              ? ['Mouse-wheel input works after returning to Search.']
              : []),
            ...(zoom <= 2 ? ['Mouse-wheel input works at low zoom.'] : []),
            ...(deltaMode === 1
              ? ['Line-based wheel events zoom the raster fallback map.']
              : []),
            ...(deltaMode === 2
              ? [
                  'Page-based wheel events visibly zoom the raster fallback map.',
                ]
              : []),
          ]);
          await prepareRasterSearchMap(page, context);
          await page.goto('/search');
          await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
          await expectWheelZoomAfterNavigation(
            page,
            '.leaflet-container',
            deltaMode,
            zoom === 6 && deltaMode === 0,
          );
        });
      });
    }
  }

  test('search map uses OpenStreetMap without a Mapbox key', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Tokenless installations render OpenStreetMap tiles even with WebGL available.',
      'A previously saved Mapbox style does not prevent the fallback from loading.',
    ]);
    await routeRasterMapTiles(page);
    await page.goto('/circles');
    expect(
      await page.evaluate(() =>
        Boolean(document.createElement('canvas').getContext('webgl2')),
      ),
    ).toBe(true);
    await page.evaluate(() => {
      Reflect.set(Reflect.get(window, 'settings'), 'mapbox', {});
      window.localStorage.setItem(
        'search-map-style',
        JSON.stringify('mapbox://styles/mapbox/streets-v11'),
      );
    });
    await page.locator('a[href="/search"]').first().click();
    await expect(
      page.locator('[data-testid="leaflet-search-map"]'),
    ).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
    const tile = page.locator('.leaflet-tile').first();
    await expect(tile).toHaveAttribute('src', /tile\.openstreetmap\.org/);
    await expect(tile).toHaveJSProperty('naturalWidth', 1);
    const hostMarker = page.locator('.leaflet-interactive[fill="#58ba58"]');
    await expect(hostMarker).toBeVisible();
    await hostMarker.dispatchEvent('click');
    await expect(page).toHaveURL(/offer=665100000000000000000001/);
    await expect(
      page.locator('.search-sidebar-container.is-offer-open'),
    ).toBeVisible();
  });

  test('search map uses the raster fallback when WebGL is unavailable', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A browser without WebGL receives a visible Leaflet raster map.',
      'Fallback-map offer markers continue to open the results sidebar.',
    ]);

    await prepareRasterSearchMap(page, context, { includeMapbox: true });

    await page.goto('/search');

    await expect(
      page.locator('[data-testid="leaflet-search-map"]'),
    ).toBeVisible();
    const zoomControl = page.locator(
      '.leaflet-top.leaflet-right .leaflet-control-zoom',
    );
    await expect(zoomControl).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
    await expect(page.locator('.leaflet-tile').first()).toHaveJSProperty(
      'naturalWidth',
      1,
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.querySelectorAll('.leaflet-interactive').length > 0,
            null,
          ),
        { timeout: 30000 },
      )
      .toBeTruthy();

    // The two seeded offers overlap at this zoom. Click the host marker and
    // verify that the fallback requests its offer details.
    const hostMarker = page.locator('.leaflet-interactive[fill="#58ba58"]');
    await expect(hostMarker).toBeVisible();
    const originalMap = await page
      .locator('[data-testid="leaflet-search-map"]')
      .elementHandle();

    const offerRequest = page.waitForRequest(
      '**/api/offers/665100000000000000000001**',
    );
    // Dispatch in the page so Leaflet cannot move the SVG marker between
    // Playwright measuring its coordinates and sending the click.
    await hostMarker.dispatchEvent('click');
    expect((await offerRequest).url()).toContain(
      '/api/offers/665100000000000000000001',
    );
    await expect(page).toHaveURL(/offer=665100000000000000000001/);
    await expect(
      page.locator('.search-sidebar-container.is-offer-open'),
    ).toBeVisible();
    expect(await originalMap.evaluate(element => element.isConnected)).toBe(
      true,
    );
  });

  test('raster fallback stays visible after selecting a city', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Later camera commands recenter the raster map after a place search.',
      'Selecting a place keeps the WebGL fallback map visible.',
      'The raster renderer fits the selected city after mobile layout changes.',
    ]);

    await prepareRasterSearchMap(page, context, { includeMapbox: true });

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/search');

    await page.getByRole('button', { name: 'Search places' }).click();
    const searchInput = page.getByRole('textbox', { name: 'Search places' });
    await searchInput.fill('Berlin');
    await page
      .getByRole('list', { name: 'Place suggestions' })
      .getByRole('button')
      .click();

    const map = page.locator('[data-testid="leaflet-search-map"]');
    await expect(map).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const mapElement = document.querySelector<HTMLElement>(
              '.leaflet-search-map',
            );
            if (!mapElement) {
              return false;
            }
            return (
              mapElement.clientWidth > 0 &&
              mapElement.clientHeight > 0 &&
              [
                ...mapElement.querySelectorAll<HTMLImageElement>(
                  '.leaflet-tile',
                ),
              ].some(tile => tile.complete && tile.naturalWidth > 0)
            );
          }, null),
        { timeout: 30000 },
      )
      .toBeTruthy();

    // A visible tile alone would also pass when Leaflet stayed at its broad
    // initial view. Require a city-level tile whose centre is around Berlin.
    await waitForRasterTileNear(page, {
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  test('clicking a pin cluster zooms the map in to expand it', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Nearby offers group into a single rendered cluster.',
      'Clicking a cluster zooms the map in to expand it.',
    ]);

    // Several offers sit on top of the seeded map centre so they render as one
    // cluster in the middle of the map canvas.
    await prepareRasterSearchMap(page, context, { includeMapbox: true });
    await useMapRouteFixtures(context, { offers: 'clustered-offers.json' });
    await page.goto('/search');
    await expect(
      page.locator('[data-testid="leaflet-search-map"]'),
    ).toBeVisible();

    const readZoom = () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem('search-map-location');
        return raw ? JSON.parse(raw).zoom : null;
      });

    const initialZoom = await readZoom();
    expect(initialZoom).toBeLessThanOrEqual(7);

    const clusterMarker = page.locator('.leaflet-search-cluster', {
      hasText: '5',
    });
    await expect(clusterMarker).toBeVisible();
    await clusterMarker.dispatchEvent('click');

    await expect
      .poll(
        () =>
          page.evaluate(previousZoom => {
            const raw = window.localStorage.getItem('search-map-location');
            if (!raw) return false;
            const { zoom } = JSON.parse(raw);
            return typeof zoom === 'number' && zoom > previousZoom + 0.5;
          }, initialZoom),
        { timeout: 20000 },
      )
      .toBeTruthy();

    expect(await readZoom()).toBeGreaterThan(initialZoom);
  });

  test('Community Notes search filter is enabled by default and persists changes', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Community Notes filter is enabled by default and persists changes.',
      'Nostroots community note relay requests are isolated from external network.',
    ]);

    await installNostrRelayStub(page);
    await page.goto('/search');

    const mapContent = page.getByRole('group', { name: 'Map content' });
    const filterLabel = mapContent
      .locator('label')
      .filter({ hasText: 'Community Notes' });
    const checkbox = filterLabel.locator('input[type="checkbox"]');

    await expect(mapContent.getByText('Meetups', { exact: true })).toHaveCount(
      0,
    );
    await expect(filterLabel).toBeVisible();
    await expect(checkbox).toBeChecked();

    await filterLabel.click();
    await expect(checkbox).not.toBeChecked();

    await page.reload();
    await expect(filterLabel).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    await filterLabel.click();
    await expect(checkbox).toBeChecked();
  });

  test('turning Hosts off keeps meetup offers in the map request', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Hosts can be hidden while meetup offers remain included.',
    ]);

    await page.goto('/search');

    const mapContent = page.getByRole('group', { name: 'Map content' });
    const hostsLabel = mapContent.locator('label').filter({ hasText: 'Hosts' });
    const hostsCheckbox = hostsLabel.locator('input[type="checkbox"]');
    await expect(hostsCheckbox).toBeChecked();

    const meetupOnlyRequest = page.waitForRequest(request => {
      if (!request.url().includes('/api/offers?')) return false;
      const rawFilters = new URL(request.url()).searchParams.get('filters');
      if (!rawFilters) return false;
      try {
        const { types } = JSON.parse(rawFilters);
        return Array.isArray(types) && types.join(',') === 'meet';
      } catch {
        return false;
      }
    });

    await hostsLabel.click();
    await expect(hostsCheckbox).not.toBeChecked();
    await meetupOnlyRequest;
  });

  test('clicking a Community Note marker opens its thread', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A Community Note marker opens its thread in the results sidebar.',
    ]);

    const signedNote = finalizeEvent(
      {
        content: communityNoteText,
        created_at: 1700000000,
        kind: 30397,
        tags: [['l', '9F4MGCC4+22', 'open-location-code']],
      },
      new Uint8Array(32).fill(1),
    );
    await showCommunityNotesSidebar(page, [signedNote]);

    const sidebar = page.locator('.community-notes-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(communityNoteText)).toBeVisible();
  });

  test('visible Community Note threads can be reopened from the Results list', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Visible Community Note threads appear in the Results list.',
      'Selecting a listed thread opens its notes in the sidebar.',
    ]);
    const signedNote = finalizeEvent(
      {
        content: communityNoteText,
        created_at: 1700000000,
        kind: 30397,
        tags: [['l', communityNotePlusCode, 'open-location-code']],
      },
      new Uint8Array(32).fill(1),
    );
    await showCommunityNotesSidebar(page, [signedNote]);

    await page.getByRole('button', { name: 'Back to results' }).click();
    const threadButton = page.getByRole('button', {
      name: `Open community note thread at ${communityNotePlusCode}`,
    });
    await expect(threadButton).toBeVisible();
    await threadButton.click();
    await expect(page.locator('.community-notes-sidebar')).toBeVisible();
    await expect(
      page.locator('.community-notes-sidebar').getByText(communityNoteText),
    ).toBeVisible();
  });

  test('Community Notes are visible and controllable on mobile maps', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Mobile maps expose Community Notes in the Filters panel.',
      'The filter reflects the default-enabled Community Notes setting.',
    ]);

    await page.setViewportSize({ width: 375, height: 667 });
    await installNostrRelayStub(page);
    await page.goto('/search');

    const placeButton = page.getByRole('button', { name: 'Search places' });
    const filtersButton = page
      .locator('.search-map-meta button')
      .filter({ hasText: 'Filters' });
    await expect(placeButton).toBeVisible();
    await expect(filtersButton).toBeVisible();
    const placeBounds = await placeButton.boundingBox();
    const filtersBounds = await filtersButton.boundingBox();
    expectPresent(placeBounds);
    expectPresent(filtersBounds);
    expect(placeBounds.y).toBe(filtersBounds.y);
    expect(placeBounds.height).toBeLessThanOrEqual(46);
    expect(filtersBounds.height).toBeLessThanOrEqual(46);
    await expect(page.locator('.search-map-container')).toBeVisible();

    await filtersButton.click();

    const filterLabel = page
      .locator('.search-sidebar-filters label')
      .filter({ hasText: 'Community Notes' });
    const checkbox = filterLabel.locator('input[type="checkbox"]');

    await expect(filterLabel).toHaveCount(1);
    await expect(filterLabel).toBeVisible();
    await expect(checkbox).toBeChecked();

    await filterLabel.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('Community Notes sidebar opens the Nostroots action modal', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Community Notes sidebar displays a plus-code thread.',
      'Reply action opens the Nostroots action-gate modal.',
    ]);
    useElementScreenshot(testInfo, '.search-sidebar-container');

    const noteEvents = [
      communityNoteText,
      'E2E community note: late trains but friendly locals.',
    ].map((content, index) =>
      finalizeEvent(
        {
          content,
          created_at: 1700000000 - index * 3600,
          kind: 30397,
          tags: [
            ['l', communityNotePlusCode, 'open-location-code'],
            [
              'p',
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            ],
          ],
        },
        new Uint8Array(32).fill(1),
      ),
    );
    await showCommunityNotesSidebar(page, noteEvents);

    const sidebar = page.locator('.community-notes-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByRole('heading', { name: /Community Notes/ }),
    ).toBeVisible();
    await expect(sidebar.getByText(communityNotePlusCode)).toBeVisible();
    await expect(sidebar.getByText(communityNoteText)).toBeVisible();
    await expect(sidebar.getByText('via Nostroots')).toBeVisible();
    await expect(
      sidebar.locator('.community-notes-sidebar-note').first(),
    ).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(
      page.locator('.search-sidebar-tabs .nav-link').first(),
    ).toHaveCSS('color', 'rgb(51, 51, 51)');

    await sidebar.getByRole('button', { name: 'Reply' }).click();

    const dialog = page.getByRole('dialog', { name: 'Get Nostroots' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Download for iOS' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Download for Android' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Open web app' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('search map stays usable when offers fixture is empty', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Empty map-offers fixture leaves the search map usable.',
    ]);

    await useMapRouteFixtures(context, { offers: 'empty-offers.json' });
    await stubNostrAuthorVisibility(page, []);
    await installNostrRelayStub(page, { events: [] });
    await page.goto('/search');
    await waitForSearchMap(page);

    const sidebar = page.locator('.search-sidebar-container');
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('tab', { name: 'Results' }).click();
    await expect(
      sidebar
        .locator('.search-sidebar-results')
        .getByText(/no results are visible in this map area/i),
    ).toBeVisible();
  });

  test('Results lists visible offers and opens their details', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Results lists offers whose pins are visible in the current map area.',
      'Selecting a listed offer opens its details without moving the map.',
    ]);

    await context.route('**/api/offers/665100000000000000000002', route =>
      route.fulfill({
        contentType: 'application/json',
        path: fixturePath('offers', 'selected-meet-offer.json'),
        status: 200,
      }),
    );
    await page.goto('/search');
    await waitForSearchMap(page);
    const sidebar = page.locator('.search-sidebar-container');
    const resultsTab = sidebar.getByRole('tab', { name: 'Results' });
    await resultsTab.focus();
    await page.keyboard.press('Enter');
    const resultList = sidebar.getByRole('list', {
      name: 'Visible search results',
    });
    await expect(resultList).toBeVisible();
    await expect(
      sidebar
        .getByRole('status')
        .filter({ hasText: 'Offers in this map area:' }),
    ).toContainText('Offers in this map area:');

    const visibleHost = resultList.getByRole('button', {
      name: /open hosting offer from berlin host/i,
    });
    await expect(visibleHost).toBeVisible();
    await visibleHost.focus();
    await page.keyboard.press('Enter');

    await expect(
      sidebar.locator('.search-result').getByText(/berlin host/i),
    ).toBeVisible();
    await expect(page).toHaveURL(/offer=665100000000000000000001/);
    await sidebar.getByRole('button', { name: 'Back to results' }).focus();
    await page.keyboard.press('Enter');
    await expect(visibleHost).toBeVisible();
    await expect(visibleHost).toBeFocused();
  });

  test('offer deep-link uses fixture offer data in the sidebar', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Rendered map offer deep-link opens deterministic sidebar data.',
    ]);

    await page.goto('/search?offer=665100000000000000000001');
    await waitForSearchMap(page);

    const result = page
      .locator('.search-sidebar-results .search-result')
      .filter({ hasText: /E2E offline map host offer/i });

    await expect(result).toBeVisible();
    await expect(result.getByText(/Berlin Host/i)).toBeVisible();
  });

  test('device location centres search only after activation and preserves filters', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Opening search does not request device location.',
      'Activating device location centres the map at zoom 13 and clears the selected offer.',
      'Device location preserves the member’s search filters.',
    ]);
    await mockDeviceLocation(page, 0, 0);
    await page.goto('/search');
    await waitForSearchMap(page);
    await expect
      .poll(() => page.evaluate(() => window.__deviceLocationRequests))
      .toBe(0);

    const mapContent = page.getByRole('group', { name: 'Map content' });
    const communityNotes = mapContent
      .locator('label')
      .filter({ hasText: 'Community Notes' })
      .locator('input[type="checkbox"]');
    await expect(communityNotes).toBeChecked();
    await communityNotes.locator('..').click();
    await expect(communityNotes).not.toBeChecked();

    await page.goto('/search?offer=665100000000000000000001');
    await waitForSearchMap(page);
    await expect(page).toHaveURL(/offer=665100000000000000000001/);
    await page.getByRole('tab', { name: /Filters/ }).click();
    await expect(communityNotes).not.toBeChecked();
    await expect
      .poll(() => page.evaluate(() => window.__deviceLocationRequests))
      .toBe(0);

    await page
      .getByRole('button', { name: 'Use my location', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.__deviceLocationRequests))
      .toBe(1);
    await expect.poll(() => readMapZoom(page)).toBe(13);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('search-map-location');
          return raw ? JSON.parse(raw) : null;
        }),
      )
      .toMatchObject({ latitude: 0, longitude: 0, zoom: 13 });
    await expect(page).not.toHaveURL(/offer=/);
    await expect(communityNotes).not.toBeChecked();
    expect(
      await page.evaluate(() => window.__deviceLocationRequestOptions),
    ).toMatchObject({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0,
    });
    await page.screenshot({
      path: testInfo.outputPath('device-location-search-desktop.png'),
    });
  });

  test('device location centres the raster search map at zoom 13', async ({
    page,
    context,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Device location centres the raster search map at zoom 13.',
    ]);
    await prepareRasterSearchMap(page, context, { includeMapbox: true });
    await mockDeviceLocation(page, -23.55, -46.63);
    await page.goto('/search?offer=665100000000000000000001');
    await expect(page.getByTestId('leaflet-search-map')).toBeVisible();
    await page
      .getByRole('button', { name: 'Use my location', exact: true })
      .click();
    await expect.poll(() => readMapZoom(page)).toBe(13);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('search-map-location');
          return raw ? JSON.parse(raw) : null;
        }),
      )
      .toMatchObject({ latitude: -23.55, longitude: -46.63, zoom: 13 });
  });

  test('mobile search offers a retryable device location action and manual fallback', async ({
    page,
    context,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Mobile search exposes device location after opening place search.',
      'Denied device location gives accessible feedback and leaves manual search available.',
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareRasterSearchMap(page, context, { includeMapbox: true });
    await mockDeviceLocationFailure(page);
    await page.route('**/api/map-default-location', route =>
      route.fulfill({ json: { location: null } }),
    );
    await page.goto('/search');
    await expect(page.getByTestId('leaflet-search-map')).toBeVisible();
    await page.getByRole('button', { name: 'Search places' }).click();

    const map = page.getByTestId('leaflet-search-map');
    const originalMapState = {
      latitude: await map.getAttribute('data-map-latitude'),
      longitude: await map.getAttribute('data-map-longitude'),
      zoom: await map.getAttribute('data-map-zoom'),
    };
    const placePanel = page.locator('.search-map-place');
    const searchInput = placePanel.getByRole('textbox', {
      name: 'Search places',
    });
    const locate = page.getByRole('button', {
      name: 'Use my location',
      exact: true,
    });
    await expect(searchInput).toBeVisible();
    await expect(locate).toBeVisible();
    await locate.focus();
    await expect(locate).toBeFocused();
    const focusStyle = await locate.evaluate(element => ({
      outlineStyle: getComputedStyle(element).outlineStyle,
      boxShadow: getComputedStyle(element).boxShadow,
    }));
    expect(
      focusStyle.outlineStyle !== 'none' || focusStyle.boxShadow !== 'none',
    ).toBe(true);
    await locate.click();
    const status = page.locator('.device-location-control').getByRole('status');
    await expect(status).toHaveText(
      'Location access was denied. Enable location permissions in your browser settings, or choose a location manually.',
    );
    await expect(status).toBeInViewport();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEditable();
    await expect(map).toHaveAttribute(
      'data-map-latitude',
      originalMapState.latitude!,
    );
    await expect(map).toHaveAttribute(
      'data-map-longitude',
      originalMapState.longitude!,
    );
    await expect(map).toHaveAttribute('data-map-zoom', originalMapState.zoom!);
    await expect(locate).toBeEnabled();
    await locate.click();
    await expect
      .poll(() => page.evaluate(() => window.__deviceLocationRequests))
      .toBe(2);
    await expect(status).toHaveText(
      'Location access was denied. Enable location permissions in your browser settings, or choose a location manually.',
    );

    await page.screenshot({
      path: testInfo.outputPath('device-location-search-mobile.png'),
    });
    await expect(status).toBeHidden({ timeout: 12000 });
    await locate.click();
    await expect(status).toBeVisible();
    await page.evaluate(() => {
      Reflect.set(Reflect.get(window, 'settings'), 'mapbox', {
        publicKey: 'test-geocoding-token',
      });
    });
    await page.route('https://api.mapbox.com/geocoding/**', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          features: [
            {
              id: 'place.manual-fallback',
              text: 'Example Harbour',
              center: [-46.63, -23.55],
            },
          ],
        }),
      }),
    );
    await searchInput.fill('Example Harbour');
    await searchInput.press('Enter');
    await expect
      .poll(async () => Number(await map.getAttribute('data-map-latitude')))
      .toBeCloseTo(-23.55, 4);
    await expect
      .poll(async () => Number(await map.getAttribute('data-map-longitude')))
      .toBeCloseTo(-46.63, 4);
  });

  test('trackpad zoom out preserves the searched place', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Trackpad pinch zoom preserves the centre selected by place search.',
    ]);
    // A fictional destination far from the seeded initial viewport makes a
    // reset distinguishable from the small camera movement caused by zooming.
    await page.route('**/geocoding/v5/mapbox.places/**', route =>
      route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [
            {
              id: 'place.test-destination',
              type: 'Feature',
              place_type: ['place'],
              text: 'Test Harbour',
              place_name: 'Test Harbour',
              center: [-60, 20],
              bbox: [-60.2, 19.8, -59.8, 20.2],
            },
          ],
        },
      }),
    );
    await page.goto('/search');
    await waitForSearchMap(page);
    const input = page.getByRole('textbox', { name: 'Search places' });
    await input.fill('Test Harbour');
    await page
      .getByRole('button', { name: 'Test Harbour', exact: true })
      .click();
    await expect(
      page.getByRole('list', { name: 'Place suggestions' }),
    ).toBeHidden();
    // Reading the live zoom avoids waiting for debounced localStorage, which
    // would hide a reset occurring immediately after selecting the result.
    await expect.poll(() => readMapZoom(page)).toBeGreaterThan(7);
    const searchedZoom = await readMapZoom(page);
    expectPresent(searchedZoom);
    await page
      .locator('.search-map-container .mapboxgl-canvas')
      .dispatchEvent('wheel', {
        ctrlKey: true,
        deltaY: 100,
        deltaMode: 0,
      });
    await expect.poll(() => readMapZoom(page)).toBeCloseTo(searchedZoom - 1, 5);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('search-map-location');
          if (!raw) return null;
          const { latitude, longitude } = JSON.parse(raw);
          return {
            latitude: Math.round(latitude),
            longitude: Math.round(longitude),
          };
        }),
      )
      .toEqual({ latitude: 20, longitude: -60 });
  });

  test('location search accepts a place with Enter', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'profile.edit-locations', [
      'Geocoding/map interactions are stubbed deterministically.',
    ]);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/search');
    await waitForSearchMap(page);
    await page.getByRole('button', { name: 'Search places' }).click();
    const searchInput = page.getByRole('textbox', { name: 'Search places' });
    await searchInput.fill('Berlin');
    await searchInput.press('Enter');

    await expect(searchInput).toBeHidden();
    await expect(page.locator('.search-map')).toBeVisible();
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
