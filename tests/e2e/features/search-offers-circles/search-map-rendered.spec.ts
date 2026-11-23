import {
  annotateFeature,
  captureSection,
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
const mapCanvas = '.search-map-container .maplibregl-canvas';
const webglNotice =
  'This browser cannot show the map because WebGL is not available.';
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

  const canvas = page.locator('.maplibregl-canvas');
  const originalCanvas = assertCanvasSurvives
    ? await canvas.elementHandle()
    : null;
  const surface = page.locator(mapCanvas);
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
  delta: number,
  deltaMode: WheelMode,
): Promise<void> {
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  // MapLibre receives input directly through its canvas. Hover
  // waits for that surface to settle after navigation and viewport changes.
  const surface = page.locator(mapCanvas);
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
  deltaMode: WheelMode,
): Promise<void> {
  const delta = [240, 3, 1][deltaMode];
  const readZoom = () => readMapZoom(page);
  await expect.poll(readZoom).not.toBeNull();
  const initialZoom = await readZoom();
  expectPresent(initialZoom, 'map zoom should be available');
  await wheelOverMap(page, -delta, deltaMode);
  // A tiny numerical change can be imperceptible to someone using the map.
  await expect.poll(readZoom).toBeGreaterThan(initialZoom + 0.5);
  const zoomedIn = await readZoom();
  expectPresent(zoomedIn, 'map zoom should be available after zooming in');
  await wheelOverMap(page, delta, deltaMode);
  await expect.poll(readZoom).toBeLessThan(zoomedIn - 0.5);
}

async function expectWheelZoomAfterNavigation(
  page: Page,
  deltaMode: WheelMode,
  afterNavigation: boolean,
): Promise<void> {
  await expectWheelZoom(page, deltaMode);
  if (!afterNavigation) return;
  await page.getByRole('link', { name: 'Circles', exact: true }).click();
  await expect(page).toHaveURL(/\/circles$/);
  await page.locator('a[href="/search"]').first().click();
  await waitForSearchMap(page);
  await expectWheelZoom(page, deltaMode);
}

/** Click the rendered map at a coordinate, using MapLibre's 512px world. */
async function clickMapAt(
  page: Page,
  latitude: number,
  longitude: number,
  offsetX = 0,
): Promise<void> {
  const surface = page.locator(mapCanvas);
  const box = await surface.boundingBox();
  expectPresent(box, 'map canvas should have a layout box');
  const map = page.locator('.search-map');
  const [centreLatitude, centreLongitude, zoom] = await Promise.all(
    ['data-map-latitude', 'data-map-longitude', 'data-map-zoom'].map(
      async name => Number(await map.getAttribute(name)),
    ),
  );
  const worldSize = 512 * 2 ** zoom;
  const project = (lat: number, lng: number) => [
    ((lng + 180) / 360) * worldSize,
    ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) /
      2) *
      worldSize,
  ];
  const [centreX, centreY] = project(centreLatitude, centreLongitude);
  const [x, y] = project(latitude, longitude);
  await surface.click({
    position: {
      x: box.width / 2 + x - centreX + offsetX,
      y: box.height / 2 + y - centreY,
    },
  });
}

async function showCommunityNotesSidebar(
  page: Page,
  events: VerifiedEvent[],
): Promise<void> {
  await stubNostrAuthorVisibility(
    page,
    events.map(event => event.pubkey),
  );
  await installNostrRelayStub(page, { events });

  await page.goto('/search');
  await waitForSearchMap(page);
  const plusCode = events[0].tags.find(tag => tag[0] === 'l')![1];
  const area = new OpenLocationCode().decode(plusCode);
  // A note cluster covers the seeded Berlin host pin, which wins clicks on
  // overlapping points, so click the cluster's far side from the host.
  const offsetX = events.length > 1 ? -15 : 0;
  // Notes arrive from the relay after the map loads; retry until one opens.
  await expect(async () => {
    await clickMapAt(page, area.latitudeCenter, area.longitudeCenter, offsetX);
    await expect(page.locator('.community-notes-sidebar')).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 30000 });
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

      test('MapLibre search works when WebGL2 is available', async ({
        page,
      }, testInfo) => {
        annotateFeature(testInfo, 'search.map', [
          'Chromium receives MapLibre GL when WebGL2 is available.',
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
        await expect(page.getByText(webglNotice)).toHaveCount(0);
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

    const style = page.waitForResponse(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    await page.goto('/search');
    await waitForSearchMap(page);

    expect(await (await style).json()).toMatchObject({
      name: 'E2E Offline Map',
    });
  });

  test('map zoom buttons control the upgraded renderer', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Zoom controls operate on the current MapLibre renderer.',
      'The metric distance scale changes with the viewport.',
    ]);
    await page.goto('/search');
    await waitForSearchMap(page);
    const initialZoom = await readMapZoom(page);
    expectPresent(initialZoom, 'initial map zoom should be stored');
    const scale = page.locator('.search-map .maplibregl-ctrl-scale');
    await expect(scale).toHaveText(/\d\s*(?:m|km)$/);
    const initialScale = await scale.textContent();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => readMapZoom(page)).toBeCloseTo(initialZoom + 1, 4);
    await expect(scale).not.toHaveText(initialScale!);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect.poll(() => readMapZoom(page)).toBeCloseTo(initialZoom, 1);
  });

  test('search map shows a notice when only WebGL1 is available', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A browser without WebGL2 sees a notice where the map would be.',
    ]);
    await disableWebGL(page, true);
    await page.goto('/search');
    await expect(page.getByText(webglNotice)).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(0);
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
          const canvas = await page.locator('.maplibregl-canvas').boundingBox();
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
        }, testInfo) => {
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
            deltaMode,
            zoom === 6 && deltaMode === 0,
          );
        });
      });
    }
  }

  test('search map renders without a Mapbox key', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Installations without a Mapbox key still render the map.',
    ]);
    await page.goto('/circles');
    await page.evaluate(() => {
      Reflect.set(Reflect.get(window, 'settings'), 'mapbox', {});
    });
    await page.locator('a[href="/search"]').first().click();
    await expectCentreHostPinPreservesZoom(page);
  });

  test('search map shows a notice when WebGL is unavailable', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A browser without WebGL2 sees a notice where the map would be.',
    ]);

    await disableWebGL(page);
    await page.goto('/search');

    const notice = page.getByText(webglNotice);
    await expect(notice).toBeVisible();
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(0);
    await captureSection(page.locator('.search-map-container'), 'webgl-notice');
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(notice).toBeVisible();
    await captureSection(
      page.locator('.search-map-container'),
      'webgl-notice-mobile',
    );
  });

  test('search map recentres after selecting a city on mobile', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Later camera commands recenter the map after a place search.',
    ]);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/search');
    await waitForSearchMap(page);

    await page.getByRole('button', { name: 'Search places' }).click();
    const searchInput = page.getByRole('textbox', { name: 'Search places' });
    await searchInput.fill('Berlin');
    await page
      .getByRole('list', { name: 'Place suggestions' })
      .getByRole('button')
      .click();

    const map = page.locator('.search-map');
    await expect
      .poll(async () => Number(await map.getAttribute('data-map-latitude')))
      .toBeCloseTo(52.52, 1);
    await expect
      .poll(async () => Number(await map.getAttribute('data-map-longitude')))
      .toBeCloseTo(13.405, 1);
    await expect.poll(() => readMapZoom(page)).toBeGreaterThan(8);
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
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
    await useMapRouteFixtures(context, { offers: 'clustered-offers.json' });
    await page.goto('/search');
    await waitForSearchMap(page);

    const initialZoom = await readMapZoom(page);
    expectPresent(initialZoom);
    expect(initialZoom).toBeLessThanOrEqual(7);

    const surface = page.locator(mapCanvas);
    // The cluster appears once the offers request completes; retry the click.
    await expect(async () => {
      const box = await surface.boundingBox();
      expectPresent(box);
      await surface.click({
        position: { x: box.width / 2, y: box.height / 2 },
      });
      await expect
        .poll(() => readMapZoom(page), { timeout: 2000 })
        .toBeGreaterThan(initialZoom + 0.5);
    }).toPass({ timeout: 20000 });
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
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Hosts can be hidden while meetup offers remain included.',
      'Offer searches retain the per-member request allowance when filters change.',
    ]);

    await context.unroute('**/api/offers?**');
    await page.goto('/search');

    const mapContent = page.getByRole('group', { name: 'Map content' });
    const hostsLabel = mapContent.locator('label').filter({ hasText: 'Hosts' });
    const hostsCheckbox = hostsLabel.locator('input[type="checkbox"]');
    await expect(hostsCheckbox).toBeChecked();

    const meetupOnlyResponse = page.waitForResponse(response => {
      if (!response.url().includes('/api/offers?')) return false;
      const rawFilters = new URL(response.url()).searchParams.get('filters');
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
    const response = await meetupOnlyResponse;
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['ratelimit-policy']).toContain('q=60; w=60;');
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
      page.locator('.search-sidebar-tabs').getByRole('tab').first(),
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
    useElementScreenshot(testInfo, '.search-sidebar-container');

    await context.route('**/api/offers/665100000000000000000002', route =>
      route.fulfill({
        json: {
          _id: '665100000000000000000002',
          type: 'host',
          status: 'no',
          meetingStatus: 'maybe',
          noOfferDescription: 'Available for a walk by the river.',
          location: [52.51, 13.42],
          user: {
            displayName: 'Sample Guest',
            username: 'e2e-sample-guest',
          },
        },
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
      name: /open hosting offer from berlin host · can host/i,
    });
    await expect(visibleHost).toBeVisible();
    await expect(visibleHost).toContainText('Can host');
    await visibleHost.focus();
    await page.keyboard.press('Enter');

    await expect(
      sidebar.locator('.search-result').getByText(/berlin host/i),
    ).toBeVisible();
    await expect(
      sidebar.locator('.search-result').getByText('Can host', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/offer=665100000000000000000001/);
    await sidebar.getByRole('button', { name: 'Back to results' }).focus();
    await page.keyboard.press('Enter');
    await expect(visibleHost).toBeVisible();
    await expect(visibleHost).toBeFocused();

    const meetingResult = resultList.getByRole('button', {
      name: 'Open meet offer from Sample Guest · Might meet',
    });
    await expect(meetingResult.locator('[data-slot="badge"]')).toHaveText([
      'Might meet',
    ]);
    await meetingResult.click();

    const card = sidebar.locator('.search-result');
    const badges = card.locator('[data-slot="badge"]');
    await expect(badges).toHaveText(['Might meet']);
    await expect(badges).toHaveAttribute('data-intent', 'info');
    await expect(card.getByText('Hosting', { exact: true })).toHaveCount(0);
    await expect(
      card.getByText('Available for a walk by the river.'),
    ).toBeVisible();
    await captureSection(card, 'map-meeting-only-desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(badges).toBeVisible();
    await expect
      .poll(() =>
        card.evaluate(element => element.scrollWidth - element.clientWidth),
      )
      .toBeLessThanOrEqual(0);
    await captureSection(card, 'map-meeting-only-mobile');
  });

  test('offer deep-link uses fixture offer data in the sidebar', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Rendered map offer deep-link opens deterministic sidebar data.',
    ]);

    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/search?offer=665100000000000000000001');
    await waitForSearchMap(page);

    const result = page
      .locator('.search-sidebar-results .search-result')
      .filter({ hasText: /E2E offline map host offer/i });

    await expect(result).toBeVisible();
    await page.locator('html').evaluate(element => {
      element.style.fontSize = '200%';
    });
    await expect(
      result.getByRole('link', { name: /Berlin Host/i }),
    ).toBeVisible();
    await expect
      .poll(() => result.evaluate(element => element.scrollWidth))
      .toBeLessThanOrEqual(
        await result.evaluate(element => element.clientWidth),
      );
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

  test('device location centres the search map at zoom 13 from an open offer', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Activating device location centres the map at zoom 13 and clears the selected offer.',
    ]);
    await mockDeviceLocation(page, -23.55, -46.63);
    await page.goto('/search?offer=665100000000000000000001');
    await waitForSearchMap(page);
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
    await expect(page).not.toHaveURL(/offer=/);
  });

  test('mobile search offers a retryable device location action and manual fallback', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Mobile search exposes device location after opening place search.',
      'Denied device location gives accessible feedback and leaves manual search available.',
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDeviceLocationFailure(page);
    await page.route('**/api/map-default-location', route =>
      route.fulfill({ json: { location: null } }),
    );
    await page.goto('/search');
    await waitForSearchMap(page);
    await page.getByRole('button', { name: 'Search places' }).click();

    const map = page.locator('.search-map');
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
      'Location access denied. Enable it in your browser or choose a location. Approximate location unavailable.',
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
      'Location access denied. Enable it in your browser or choose a location. Approximate location unavailable.',
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
    await page.locator(mapCanvas).dispatchEvent('wheel', {
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
