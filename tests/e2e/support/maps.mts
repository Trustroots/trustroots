import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';

const fixturesDir = path.join(import.meta.dirname, '../fixtures/maps');
const providerHosts = ['api.mapbox.com'];

type MapLocation = { latitude: number; longitude: number; zoom: number };

type MapState = Partial<MapLocation>;

type MapRouteFixtures = {
  offers?: string;
  offer?: string;
  tribe?: string;
  geocoding?: string;
};

type HarOptions = {
  notFound?: 'abort' | 'fallback';
  url?: string;
};

interface Routeable {
  route(
    url: string,
    handler: (route: Route) => Promise<unknown>,
  ): Promise<unknown>;
}

export function fixturePath(...segments: string[]): string {
  return path.join(fixturesDir, ...segments);
}

function readFixture(...segments: string[]): unknown {
  const contents = fs.readFileSync(fixturePath(...segments), 'utf8');
  return JSON.parse(contents) as unknown;
}

function providerHostForUrl(url: string): string | false {
  try {
    const { hostname } = new URL(url);
    return (
      providerHosts.find(
        host => hostname === host || hostname.endsWith(`.${host}`),
      ) ?? false
    );
  } catch {
    return false;
  }
}

export async function seedMapState(
  page: Page,
  state: MapState = {},
): Promise<void> {
  const { latitude = 52.52, longitude = 13.405, zoom = 6 } = state;

  await page.addInitScript(
    mapLocation => {
      window.localStorage.setItem(
        'search-map-location',
        JSON.stringify({ ...mapLocation, version: 1, savedAt: Date.now() }),
      );
    },
    { latitude, longitude, zoom },
  );
}

/**
 * Serve the OpenFreeMap style from an offline fixture, answer glyph requests
 * with an empty font range and block its tiles.
 */
export async function routeOfflineMapStyle(router: Routeable): Promise<void> {
  const style = readFixture('styles', 'offline-style.json');
  await router.route('https://tiles.openfreemap.org/**', route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith('/styles/')) return route.fulfill({ json: style });
    if (pathname.startsWith('/fonts/')) {
      return route.fulfill({ contentType: 'application/x-protobuf', body: '' });
    }
    return route.abort();
  });
}

export async function useMapProviderHar(
  context: BrowserContext,
  name: string,
  options: HarOptions = {},
): Promise<boolean> {
  const harPath = fixturePath(
    'hars',
    name.endsWith('.har') ? name : `${name}.har`,
  );
  if (!fs.existsSync(harPath)) {
    return false;
  }

  await context.routeFromHAR(harPath, {
    notFound: options.notFound || 'abort',
    update: process.env.UPDATE_MAP_HARS === 'true',
    url: options.url || '**/api.mapbox.com/**',
  });
  return true;
}

export async function blockUnexpectedMapNetwork(
  context: BrowserContext,
  allowed: string[] = [],
): Promise<void> {
  await context.route('**/*', route => {
    const host = providerHostForUrl(route.request().url());
    if (!host || allowed.includes(host)) {
      return route.fallback();
    }

    return route.abort();
  });
}

export async function useMapRouteFixtures(
  context: BrowserContext,
  fixtures: MapRouteFixtures = {},
): Promise<void> {
  const {
    offers = 'seeded-offers.json',
    offer = 'selected-offer.json',
    tribe = 'hitchhikers.json',
    geocoding = 'berlin.json',
  } = fixtures;

  await context.route('**/api/offers?**', route =>
    route.fulfill({
      contentType: 'application/json',
      path: fixturePath('offers', offers),
      status: 200,
    }),
  );

  await context.route(/.*\/api\/offers\/[a-f0-9]{24}.*/, route =>
    route.fulfill({
      contentType: 'application/json',
      path: fixturePath('offers', offer),
      status: 200,
    }),
  );

  await context.route('**/api/tribes/hitchhikers', route =>
    route.fulfill({
      contentType: 'application/json',
      path: fixturePath('tribes', tribe),
      status: 200,
    }),
  );

  await context.route('**/geocoding/v5/mapbox.places/**', route =>
    route.fulfill({
      contentType: 'application/json',
      path: fixturePath('geocoding', geocoding),
      status: 200,
    }),
  );
}

export async function waitForSearchMap(page: Page): Promise<void> {
  await expect(page.locator('.search-map')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
}

export async function disableWebGL(
  page: Page,
  webgl2Only = false,
): Promise<void> {
  await page.addInitScript(webgl2Only => {
    const getContext = window.HTMLCanvasElement.prototype.getContext;
    const replacement = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ): unknown {
      if (
        type === 'webgl2' ||
        (!webgl2Only && (type === 'webgl' || type === 'experimental-webgl'))
      ) {
        return null;
      }
      return Reflect.apply(getContext, this, [type, ...args]);
    };
    Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: replacement,
    });
  }, webgl2Only);
}

export async function stubNostrAuthorVisibility(
  page: Page,
  pubkeys: string[],
): Promise<void> {
  const authors = [...new Set(pubkeys)];
  await page.route('**/api/nostr/author-visibility?*', route =>
    route.fulfill({
      json: { linkedPubkeys: authors, pubkeys: authors },
    }),
  );
}
