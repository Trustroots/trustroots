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
const communityNotePlusCode = '9F4MG82G+7Q';
const communityNoteText = 'E2E community note: quiet courtyard with good tea.';

async function installNostrRelayStub(page) {
  await page.addInitScript(() => {
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
  });
}

async function showCommunityNotesSidebar(page) {
  await page.waitForFunction(
    () => {
      function findSearchScope(rootScope) {
        const scopes = [rootScope];

        while (scopes.length) {
          const scope = scopes.pop();
          if (scope.search && typeof scope.search.openSidebar === 'function') {
            return scope;
          }

          for (
            let child = scope.$$childHead;
            child;
            child = child.$$nextSibling
          ) {
            scopes.push(child);
          }
        }

        return null;
      }

      if (!window.angular) return false;

      const injector = window.angular
        .element(document.documentElement)
        .injector();
      if (!injector) return false;

      return Boolean(findSearchScope(injector.get('$rootScope')));
    },
    null,
    { timeout: 30000 },
  );

  await page.evaluate(
    ({ plusCode, noteText }) => {
      function findSearchScope(rootScope) {
        const scopes = [rootScope];

        while (scopes.length) {
          const scope = scopes.pop();
          if (scope.search && typeof scope.search.openSidebar === 'function') {
            return scope;
          }

          for (
            let child = scope.$$childHead;
            child;
            child = child.$$nextSibling
          ) {
            scopes.push(child);
          }
        }

        return null;
      }

      if (!window.angular) return false;

      const injector = window.angular
        .element(document.documentElement)
        .injector();
      if (!injector) throw new Error('Search Angular injector unavailable');

      const scope = findSearchScope(injector.get('$rootScope'));
      if (!scope) {
        throw new Error('Search controller scope unavailable');
      }

      const now = Math.floor(Date.now() / 1000);
      scope.$apply(() => {
        scope.search.offer = false;
        scope.search.loadingOffer = false;
        scope.search.communityNote = {
          plusCode,
          notes: [
            {
              id: 'e2e-community-note-1',
              content: noteText,
              created_at: now - 3600,
              pubkey:
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            },
            {
              id: 'e2e-community-note-2',
              content: 'E2E community note: late trains but friendly locals.',
              created_at: now - 7200,
              pubkey:
                'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            },
          ],
        };
        scope.search.openSidebar('results');
      });
    },
    { plusCode: communityNotePlusCode, noteText: communityNoteText },
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

  test('Community Notes search filter toggles and persists', async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'search.map', [
      'Community Notes filter can be enabled and persisted.',
      'Nostroots community note relay requests are isolated from external network.',
    ]);

    await installNostrRelayStub(page);
    await page.goto('/search');

    const filterLabel = page
      .locator('.search-sidebar-filters label')
      .filter({ hasText: 'Community Notes' });
    const checkbox = filterLabel.locator('input[type="checkbox"]');

    await expect(filterLabel).toBeVisible();
    if (await checkbox.isChecked()) {
      await filterLabel.click();
      await expect(checkbox).not.toBeChecked();
    }

    await filterLabel.click();
    await expect(checkbox).toBeChecked();

    await page.reload();
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

    await installNostrRelayStub(page);
    await page.goto('/search');
    await showCommunityNotesSidebar(page);

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
