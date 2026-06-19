const fs = require('fs');
const path = require('path');
const { expect } = require('./test');

const fixturesDir = path.join(__dirname, '../fixtures/maps');
const providerHosts = [
  'api.mapbox.com',
  'events.mapbox.com',
  'fonts.openmaptiles.org',
  'tile.openstreetmap.org',
  'tiles.mapbox.com',
  'gibs-a.earthdata.nasa.gov',
  'gibs-b.earthdata.nasa.gov',
  'gibs-c.earthdata.nasa.gov',
];

function fixturePath(...segments) {
  return path.join(fixturesDir, ...segments);
}

function readFixture(...segments) {
  return JSON.parse(fs.readFileSync(fixturePath(...segments), 'utf8'));
}

function providerHostForUrl(url) {
  try {
    const { hostname } = new URL(url);
    return providerHosts.find(
      host => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

async function seedMapState(page, state = {}) {
  const {
    latitude = 52.52,
    longitude = 13.405,
    zoom = 6,
    style = readFixture('styles', 'offline-style.json'),
  } = state;

  await page.addInitScript(
    ({ mapStyle, mapLocation }) => {
      /* global window */
      window.localStorage.setItem('search-map-style', JSON.stringify(mapStyle));
      window.localStorage.setItem(
        'search-map-location',
        JSON.stringify(mapLocation),
      );
    },
    {
      mapStyle: style,
      mapLocation: { latitude, longitude, zoom },
    },
  );
}

async function useMapProviderHar(context, name, options = {}) {
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

async function blockUnexpectedMapNetwork(context, allowed = []) {
  await context.route('**/*', route => {
    const host = providerHostForUrl(route.request().url());
    if (!host || allowed.includes(host)) {
      return route.fallback();
    }

    return route.abort();
  });
}

async function useMapRouteFixtures(context, fixtures = {}) {
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

async function waitForSearchMap(page) {
  await expect(page.locator('.search-map')).toBeVisible();
  await expect(page.locator('.mapboxgl-canvas')).toBeVisible();
}

module.exports = {
  blockUnexpectedMapNetwork,
  fixturePath,
  readFixture,
  seedMapState,
  useMapProviderHar,
  useMapRouteFixtures,
  waitForSearchMap,
};
