const { annotateFeature, expect, test } = require('../../support/test');
const { finalizeEvent } = require('nostr-tools');

const { SEEDED_MEMBERS, signInViaApi } = require('../../support/helpers');
const {
  blockUnexpectedMapNetwork,
  seedMapState,
  useMapProviderHar,
  useMapRouteFixtures,
  waitForSearchMap,
} = require('../../support/maps');

const berlin = SEEDED_MEMBERS[0];
const communityNotePlusCode = '9F4MG82G+7Q';
const communityNoteText = 'E2E community note: quiet courtyard with good tea.';
async function installNostrRelayStub(page, events = []) {
  await page.addInitScript(relayEvents => {
    const NativeWebSocket = window.WebSocket;

    function createEvent(type, target, extra = {}) {
      return {
        type,
        target,
        currentTarget: target,
        ...extra,
      };
    }

    function MockRelayWebSocket(url) {
      this.url = String(url);
      this.readyState = MockRelayWebSocket.CONNECTING;
      this.protocol = '';
      this.extensions = '';
      this.binaryType = 'blob';
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      this.listeners = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set(),
      };

      window.setTimeout(() => {
        if (this.readyState !== MockRelayWebSocket.CONNECTING) return;
        this.readyState = MockRelayWebSocket.OPEN;
        this.dispatchEvent(createEvent('open', this));
      }, 0);
    }

    MockRelayWebSocket.CONNECTING = 0;
    MockRelayWebSocket.OPEN = 1;
    MockRelayWebSocket.CLOSING = 2;
    MockRelayWebSocket.CLOSED = 3;

    MockRelayWebSocket.prototype.addEventListener = function addEventListener(
      type,
      listener,
    ) {
      if (this.listeners[type]) {
        this.listeners[type].add(listener);
      }
    };

    MockRelayWebSocket.prototype.removeEventListener =
      function removeEventListener(type, listener) {
        if (this.listeners[type]) {
          this.listeners[type].delete(listener);
        }
      };

    MockRelayWebSocket.prototype.dispatchEvent = function dispatchEvent(event) {
      const handler = this[`on${event.type}`];
      if (typeof handler === 'function') {
        handler.call(this, event);
      }
      if (this.listeners[event.type]) {
        this.listeners[event.type].forEach(listener => {
          listener.call(this, event);
        });
      }
      return true;
    };

    MockRelayWebSocket.prototype.send = function send(data) {
      if (this.readyState !== MockRelayWebSocket.OPEN) return;

      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }

      if (Array.isArray(message) && message[0] === 'REQ') {
        const subscriptionId = message[1];
        window.setTimeout(() => {
          if (this.readyState !== MockRelayWebSocket.OPEN) return;
          relayEvents.forEach(event => {
            this.dispatchEvent(
              createEvent('message', this, {
                data: JSON.stringify(['EVENT', subscriptionId, event]),
              }),
            );
          });
          this.dispatchEvent(
            createEvent('message', this, {
              data: JSON.stringify(['EOSE', subscriptionId]),
            }),
          );
        }, 0);
      }
    };

    MockRelayWebSocket.prototype.close = function close(code, reason) {
      if (this.readyState === MockRelayWebSocket.CLOSED) return;
      this.readyState = MockRelayWebSocket.CLOSED;
      this.dispatchEvent(
        createEvent('close', this, {
          code: code || 1000,
          reason: reason || '',
          wasClean: true,
        }),
      );
    };

    window.WebSocket = function WebSocket(url, protocols) {
      if (String(url).startsWith('wss://relay.trustroots.org')) {
        return new MockRelayWebSocket(url);
      }
      return new NativeWebSocket(url, protocols);
    };

    window.WebSocket.CONNECTING = MockRelayWebSocket.CONNECTING;
    window.WebSocket.OPEN = MockRelayWebSocket.OPEN;
    window.WebSocket.CLOSING = MockRelayWebSocket.CLOSING;
    window.WebSocket.CLOSED = MockRelayWebSocket.CLOSED;
  }, events);
}

async function showCommunityNotesSidebar(page, events) {
  await page.addInitScript(() => {
    const Canvas = window.HTMLCanvasElement;
    const getContext = Canvas.prototype.getContext;
    Canvas.prototype.getContext = function getWebGLContext(type, ...args) {
      if (type === 'webgl' || type === 'experimental-webgl') {
        return null;
      }
      return getContext.call(this, type, ...args);
    };
  });
  await page.route('**://*.tile.openstreetmap.org/**', route =>
    route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
        'base64',
      ),
      contentType: 'image/png',
    }),
  );
  await page.addInitScript(fixturePubkey => {
    window.__TRUSTROOTS_E2E_NOSTROOTS_VALIDATION_PUBKEY__ = fixturePubkey;
  }, events[0].pubkey);
  await installNostrRelayStub(page, events);

  await page.goto('/search');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.leaflet-interactive[fill="#1565C0"]').length >
      0,
    null,
    { timeout: 30000 },
  );
  await page
    .locator('.leaflet-interactive[fill="#1565C0"]')
    .first()
    .dispatchEvent('click');
}

async function waitForRasterTileNear(
  page,
  { latitude, longitude, tolerance = 4 },
) {
  await page.waitForFunction(
    ({ expectedLatitude, expectedLongitude, coordinateTolerance }) =>
      [...document.querySelectorAll('.leaflet-tile')].some(tile => {
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
          Math.abs(tileLatitude - expectedLatitude) < coordinateTolerance &&
          Math.abs(tileLongitude - expectedLongitude) < coordinateTolerance
        );
      }),
    {
      coordinateTolerance: tolerance,
      expectedLatitude: latitude,
      expectedLongitude: longitude,
    },
    { timeout: 30000 },
  );
}

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

  test('search map uses the raster fallback when WebGL is unavailable', async ({
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A browser without WebGL receives a visible Leaflet raster map.',
      'Fallback-map offer markers continue to open the results sidebar.',
    ]);

    await page.addInitScript(() => {
      const Canvas = window.HTMLCanvasElement;
      const getContext = Canvas.prototype.getContext;
      Canvas.prototype.getContext = function getWebGLContext(type, ...args) {
        if (type === 'webgl' || type === 'experimental-webgl') {
          return null;
        }
        return getContext.call(this, type, ...args);
      };
    });
    const fulfilRasterTile = route =>
      route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      });
    await context.route('**://*.tile.openstreetmap.org/**', fulfilRasterTile);
    await context.route(
      '**://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/**',
      fulfilRasterTile,
    );

    await page.goto('/search');

    await expect(
      page.locator('[data-testid="leaflet-search-map"]'),
    ).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
    await expect(page.locator('.leaflet-tile').first()).toHaveJSProperty(
      'naturalWidth',
      1,
    );
    await page.waitForFunction(
      () => document.querySelectorAll('.leaflet-interactive').length > 0,
      null,
      { timeout: 30000 },
    );

    // The two seeded offers overlap at this zoom. Click the host marker and
    // verify that the fallback requests its offer details.
    const hostMarker = page.locator('.leaflet-interactive[fill="#58ba58"]');
    await expect(hostMarker).toBeVisible();
    const offerRequest = page.waitForRequest(
      '**/api/offers/665100000000000000000001**',
    );
    // Dispatch in the page so Leaflet cannot move the SVG marker between
    // Playwright measuring its coordinates and sending the click.
    await hostMarker.dispatchEvent('click');
    expect((await offerRequest).url()).toContain(
      '/api/offers/665100000000000000000001',
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

    await page.addInitScript(() => {
      const Canvas = window.HTMLCanvasElement;
      const getContext = Canvas.prototype.getContext;
      Canvas.prototype.getContext = function getWebGLContext(type, ...args) {
        if (type === 'webgl' || type === 'experimental-webgl') {
          return null;
        }
        return getContext.call(this, type, ...args);
      };
    });
    const fulfilRasterTile = route =>
      route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      });
    await context.route('**://*.tile.openstreetmap.org/**', fulfilRasterTile);
    await context.route(
      '**://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/**',
      fulfilRasterTile,
    );

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/search');

    await page.getByRole('button', { name: 'Search places' }).click();
    const searchInput = page.getByRole('textbox', { name: 'Search places' });
    await searchInput.fill('Berlin');
    await page.locator('.search-place .dropdown-menu a').dispatchEvent('click');

    const map = page.locator('[data-testid="leaflet-search-map"]');
    await expect(map).toBeVisible();
    await page.waitForFunction(
      () => {
        const mapElement = document.querySelector('.leaflet-search-map');
        return (
          mapElement?.clientWidth > 0 &&
          mapElement?.clientHeight > 0 &&
          [...mapElement.querySelectorAll('.leaflet-tile')].some(
            tile => tile.complete && tile.naturalWidth > 0,
          )
        );
      },
      null,
      { timeout: 30000 },
    );

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
    await page.addInitScript(() => {
      const Canvas = window.HTMLCanvasElement;
      const getContext = Canvas.prototype.getContext;
      Canvas.prototype.getContext = function getWebGLContext(type, ...args) {
        if (type === 'webgl' || type === 'experimental-webgl') {
          return null;
        }
        return getContext.call(this, type, ...args);
      };
    });
    const fulfilRasterTile = route =>
      route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      });
    await context.route('**://*.tile.openstreetmap.org/**', fulfilRasterTile);
    await context.route(
      '**://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/256/**',
      fulfilRasterTile,
    );
    await useMapRouteFixtures(context, { offers: 'clustered-offers.json' });
    await page.reload();
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

    await page.waitForFunction(
      previousZoom => {
        const raw = window.localStorage.getItem('search-map-location');
        if (!raw) return false;
        const { zoom } = JSON.parse(raw);
        return typeof zoom === 'number' && zoom > previousZoom + 0.5;
      },
      initialZoom,
      { timeout: 20000 },
    );

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
    context,
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'A Community Note marker opens its thread in the results sidebar.',
    ]);

    await page.addInitScript(() => {
      const Canvas = window.HTMLCanvasElement;
      const getContext = Canvas.prototype.getContext;
      Canvas.prototype.getContext = function getWebGLContext(type, ...args) {
        if (type === 'webgl' || type === 'experimental-webgl') {
          return null;
        }
        return getContext.call(this, type, ...args);
      };
    });
    const fulfilRasterTile = route =>
      route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0iAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      });
    await context.route('**://*.tile.openstreetmap.org/**', fulfilRasterTile);
    const signedNote = finalizeEvent(
      {
        content: communityNoteText,
        created_at: 1700000000,
        kind: 30398,
        tags: [
          ['l', '9F4MGCC4+22', 'open-location-code'],
          [
            'p',
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          ],
        ],
      },
      new Uint8Array(32).fill(1),
    );

    // Local E2E pages accept an explicit fixture validator override. The
    // deployed site always retains the configured Nostroots validation key.
    await page.addInitScript(fixturePubkey => {
      window.__TRUSTROOTS_E2E_NOSTROOTS_VALIDATION_PUBKEY__ = fixturePubkey;
    }, signedNote.pubkey);
    await installNostrRelayStub(page, [signedNote]);

    await page.goto('/search');
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.leaflet-interactive[fill="#1565C0"]')
          .length > 0,
      null,
      { timeout: 30000 },
    );
    await page
      .locator('.leaflet-interactive[fill="#1565C0"]')
      .dispatchEvent('click');

    const sidebar = page.locator('.community-notes-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(communityNoteText)).toBeVisible();
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

    await page
      .locator('.search-map-meta button')
      .filter({ hasText: 'Filters' })
      .click();

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

    const noteEvents = [
      communityNoteText,
      'E2E community note: late trains but friendly locals.',
    ].map((content, index) =>
      finalizeEvent(
        {
          content,
          created_at: 1700000000 - index * 3600,
          kind: 30398,
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
    await page.reload();
    await waitForSearchMap(page);

    const sidebar = page.locator('.search-sidebar-container');
    await expect(sidebar).toBeVisible();
    await sidebar.locator('.nav-tabs > li').nth(1).locator('a').click();
    await expect(
      sidebar
        .locator('.search-sidebar-results')
        .getByText(/choose something from the map/i),
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

    const result = page
      .locator('.search-sidebar-results .search-result')
      .filter({ hasText: /E2E offline map host offer/i });

    await expect(result).toBeVisible();
    await expect(result.getByText(/Berlin Host/i)).toBeVisible();
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
