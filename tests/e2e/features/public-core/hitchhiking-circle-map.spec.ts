import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';
import {
  installNostrRelayStub,
  type SignedNostrEvent,
} from '../../support/nostr.mts';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import type { Page } from '@playwright/test';
import { SEEDED_MEMBERS, signInViaApi } from '../../support/helpers.mts';

declare global {
  interface Window {
    __deviceLocationRequests?: number;
  }
}

test('circle map stays still without dragging and preserves its view as live places arrive', async ({
  page,
}) => {
  const secret = generateSecretKey();
  const events = ['s00000', 'u4pruy'].map((geohash, index) =>
    finalizeEvent(
      {
        kind: 33000,
        created_at: Math.floor(Date.now() / 1000),
        content: 'A fictional workshop.',
        tags: [
          ['d', `example-${index}`],
          ['L', 'physical-location'],
          ['g', geohash],
          ['name', `Example workshop ${index}`],
          ['meta', 'source', 'https://api.spaceapi.io/'],
        ],
      },
      secret,
    ),
  );
  let publish: ((event: (typeof events)[number]) => void) | undefined;
  await page.routeWebSocket('wss://relay.trustroots.org', socket => {
    socket.onMessage(message => {
      const [type, subscription] = JSON.parse(String(message));
      if (type !== 'REQ') return;
      publish = event =>
        socket.send(JSON.stringify(['EVENT', subscription, event]));
      publish(events[0]);
      socket.send(JSON.stringify(['EOSE', subscription]));
    });
  });
  await installNostrRelayStub(page, { relayUrl: 'wss://relay.nomadwiki.org' });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'example-circle',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
      },
    }),
  );
  await page.goto('/circles/hackers');
  const map = page.locator('.circle-location-map');
  await expect(page.locator('.circle-location-map-status')).toHaveText(
    '1 SpaceAPI-reported places',
  );
  const marker = map.locator('.maplibregl-marker').first();
  const position = await marker.getAttribute('style');
  const box = await map.boundingBox();
  expectPresent(box);
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.move(box.x + 200, box.y + 150, { steps: 20 });
  await expect(marker).toHaveAttribute('style', position!);
  expectPresent(publish);
  publish(events[1]);
  await expect(page.locator('.circle-location-map-status')).toHaveText(
    '2 SpaceAPI-reported places',
  );
  await expect(map.locator('.maplibregl-marker')).toHaveCount(2);
  await expect(marker).toHaveAttribute('style', position!);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 180, { steps: 10 });
  await page.mouse.up();
  await expect(marker).not.toHaveAttribute('style', position!);
});

async function savedView(page: Page): Promise<number[] | null> {
  const view = await page.evaluate(() =>
    sessionStorage.getItem('circle-map-view'),
  );
  return view ? (JSON.parse(view) as number[]) : null;
}

async function prepareCircle(
  page: Page,
  unavailable = false,
  events: SignedNostrEvent[] = [],
): Promise<void> {
  await installNostrRelayStub(page, {
    relayUrl: 'wss://relay.maps.hitchwiki.org',
    unavailable,
    events,
  });
  await page.route('**/api/tribes/hitchhikers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-circle',
        slug: 'hitchhikers',
        label: 'Hitchhikers',
        count: 0,
        description: 'Meet fellow hitchhikers.',
      },
    }),
  );
}

test('keeps a chosen map view between the two circles', async ({ page }) => {
  await prepareCircle(page);
  await installNostrRelayStub(page, { relayUrl: 'wss://relay.trustroots.org' });
  await installNostrRelayStub(page, { relayUrl: 'wss://relay.nomadwiki.org' });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-hackers',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
      },
    }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 34, longitude: -17 },
          } as GeolocationPosition),
      },
    });
  });
  await page.goto('/circles/hitchhikers');
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('circle-map-view')))
    .not.toBeNull();
  const view = await savedView(page);
  await page.goto('/circles/hackers');
  await expect(page.locator('.circle-location-map')).toBeVisible();
  expect(await savedView(page)).toEqual(view);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => savedView(page)).not.toEqual(view);
  const [latitude, longitude, zoom] = (await savedView(page))!;
  expect(latitude).toBeCloseTo(34, 3);
  expect(longitude).toBeCloseTo(-17, 3);
  expect(zoom).toBeCloseTo(view![2] + 1, 3);
});

test('hitchhiking map uses explicit device location and GeoIP fallback on failure', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.public', [
    'Circle location controls only request device location after activation.',
    'A denied device request falls back to the approximate member location.',
  ]);
  await signInViaApi(page, request, SEEDED_MEMBERS[0]);
  await page.addInitScript(() => {
    window.__deviceLocationRequests = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(
          _success: PositionCallback,
          failure: PositionErrorCallback | null,
        ) {
          window.__deviceLocationRequests! += 1;
          queueMicrotask(() =>
            failure?.({
              code: 1,
              message: 'Fictional permission denial',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError),
          );
        },
      },
    });
  });
  let defaultLocationRequests = 0;
  await page.route('**/api/map-default-location', route => {
    defaultLocationRequests += 1;
    return route.fulfill({
      json: { location: { latitude: 34, longitude: -17, zoom: 6 } },
    });
  });
  await prepareCircle(page);
  await page.goto('/circles/hitchhikers');
  await expect(page.locator('.circle-location-map')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__deviceLocationRequests))
    .toBe(0);
  expect(defaultLocationRequests).toBe(0);

  const locate = page.getByRole('button', {
    name: 'Use my location',
    exact: true,
  });
  await expect(locate).toBeVisible();
  await locate.click();
  await expect
    .poll(() => page.evaluate(() => window.__deviceLocationRequests))
    .toBe(1);
  await expect(page.getByRole('status')).toContainText(
    'Showing an approximate location based on your IP address.',
  );
  await expect(page.getByRole('status')).toContainText('approximate');
  await expect.poll(() => defaultLocationRequests).toBe(1);
});

test('ride popups link named hitchhikers to Maps accounts and leave Anonymous unlinked', async ({
  page,
}) => {
  const secret = generateSecretKey();
  // Use a fictional publisher so the whole relay/signature/parsing path is tested
  // without copying a real person's ride into a fixture.
  const author = getPublicKey(secret);
  await page.route(/\/assets\/[^/?]+\.js(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replaceAll(
      '6623bb9cbae2220e94d5f7581e0fd926db5d67538a08a7f306768e978d4d142e',
      author,
    );
    await route.fulfill({ response, body });
  });
  const now = Math.floor(Date.now() / 1000);
  const event = finalizeEvent(
    {
      kind: 36820,
      created_at: now,
      tags: [['d', 'fictional-ride']],
      content: JSON.stringify({
        source: 'maps.hitchwiki.org',
        submission_time: new Date(now * 1000).toISOString(),
        stops: [
          {
            location: { latitude: 12, longitude: 34 },
            waiting_duration: 'PT3M',
          },
        ],
        hitchhikers: [
          { nickname: 'ExampleHiker' },
          { nickname: 'OtherHiker' },
          { nickname: 'Anonymous' },
        ],
      }),
    },
    secret,
  );
  await prepareCircle(page, false, [event]);
  await page.goto('/circles/hitchhikers');
  await expect(page.locator('.circle-location-map-status')).toHaveText(
    '1 ride origins in the past 7 days',
  );
  await page.locator('.circle-location-map .maplibregl-marker button').click();
  const popup = page.locator('.maplibregl-popup');
  await expect(
    popup.getByRole('link', { name: 'ExampleHiker', exact: true }),
  ).toHaveAttribute('href', 'https://maps.hitchwiki.org/account/ExampleHiker');
  await expect(
    popup.getByRole('link', { name: 'OtherHiker', exact: true }),
  ).toHaveAttribute('href', 'https://maps.hitchwiki.org/account/OtherHiker');
  await expect(popup).toContainText('Anonymous');
  await expect(
    popup.getByRole('link', { name: 'Anonymous', exact: true }),
  ).toHaveCount(0);
  await expect(popup.locator('dt').first()).toHaveText('Hitchhikers');
  await expect(popup).toContainText('3 min');
  await expect(
    popup.getByRole('link', { name: 'View ride on Hitchwiki Maps' }),
  ).toHaveAttribute('href', 'https://maps.hitchwiki.org/ride/fictional-ride');
});

test('Hitchhikers circle foregrounds the recent map and explains source and dates', async ({
  page,
}) => {
  await prepareCircle(page);
  await page.goto('/circles/hitchhikers');
  await expect(
    page.getByRole('heading', { name: 'Hitchhikers on the road' }),
  ).toBeVisible();
  await expect(
    page.getByRole('application', {
      name: 'Map of recent Hitchwiki hitchhiking locations',
    }),
  ).toBeVisible();
  await expect(
    page.getByText('No reported locations in the past 7 days.'),
  ).toBeVisible();
  await expect(
    page.getByText('Recent rides shared on Hitchwiki Maps.'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Hitchwiki Maps' }),
  ).toHaveAttribute('href', 'https://maps.hitchwiki.org/');
  await expect(page.getByRole('link', { name: 'ODbL' })).toHaveAttribute(
    'href',
    'https://opendatacommons.org/licenses/odbl/1-0/',
  );
  const panel = await page.locator('.circle-location-map-panel').boundingBox();
  expectPresent(panel);
  const viewport = page.viewportSize();
  expectPresent(viewport);
  expect(panel.y).toBeLessThan(viewport.height);
  await expect(
    page.getByRole('link', { name: 'Join Hitchhikers on Trustroots' }),
  ).toBeVisible();
});

test('Hitchhikers circle remains usable when its relay refuses the subscription', async ({
  page,
}) => {
  await prepareCircle(page, true);
  await page.goto('/circles/hitchhikers');
  await expect(
    page.getByText(
      'Recent locations could not be loaded from Hitchwiki relay.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Join Hitchhikers on Trustroots' }),
  ).toBeVisible();
});

test('both circle maps support wheel and pinch zoom without zooming out beyond the world', async ({
  page,
}) => {
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await prepareCircle(page);
  await installNostrRelayStub(page);
  await installNostrRelayStub(page, { relayUrl: 'wss://relay.nomadwiki.org' });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-hackers',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
      },
    }),
  );
  const zoom = async () => (await savedView(page))?.[2] ?? null;
  for (const circle of ['hitchhikers', 'hackers']) {
    await page.goto(`/circles/${circle}`);
    const map = page.locator('.circle-location-map');
    await expect(map.locator('.maplibregl-canvas')).toBeVisible();
    // maxBounds keeps the whole world height and width in view at most.
    const minimumZoom = await map.evaluate(element => {
      const mercatorY = (latitude: number) =>
        Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) /
        Math.PI /
        2;
      return Math.max(
        1,
        Math.log2(
          Math.max(
            element.clientWidth,
            element.clientHeight / (mercatorY(85) - mercatorY(-85)),
          ) / 512,
        ),
      );
    });
    await map.hover();
    const zoomOutFully = () =>
      expect
        .poll(async () => {
          await page.mouse.wheel(0, 1000);
          return zoom();
        })
        .toBeCloseTo(minimumZoom, 2);
    // A view is saved only after the camera moves, so zoom in first.
    await page.mouse.wheel(0, -240);
    await expect.poll(zoom).toBeGreaterThan(minimumZoom + 0.1);
    await zoomOutFully();
    const box = await map.boundingBox();
    expectPresent(box);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const points = (gap: number) => [
      { x: x - gap, y, id: 1 },
      { x: x + gap, y, id: 2 },
    ];
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points(30),
    });
    for (const gap of [50, 70, 90]) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(gap),
      });
    }
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect.poll(zoom).toBeGreaterThan(minimumZoom + 0.1);
  }
});

test('hackerspace popups keep links and close controls visible and omit closed spaces', async ({
  page,
}) => {
  const secret = generateSecretKey();
  const events = ['open', 'closed'].map(state =>
    finalizeEvent(
      {
        kind: 33000,
        created_at: Math.floor(Date.now() / 1000),
        content: 'A fictional community workshop.',
        tags: [
          ['d', `fictional-${state}`],
          ['L', 'physical-location'],
          ['g', 's00000'],
          ['name', `Example ${state} workshop`],
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['meta', 'open', state],
          ['website', 'https://workshop.example.test/'],
        ],
      },
      secret,
    ),
  );
  await installNostrRelayStub(page, { events });
  await installNostrRelayStub(page, {
    events,
    relayUrl: 'wss://relay.nomadwiki.org',
  });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'fictional-hackers',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
      },
    }),
  );
  await page.goto('/circles/hackers');
  await expect(page.locator('.circle-location-map-status')).toHaveText(
    '1 SpaceAPI-reported places',
  );
  await page.locator('.circle-location-map .maplibregl-marker button').click();
  const popup = page.locator('.maplibregl-popup');
  await expect(popup).toContainText('Example open workshop');
  const website = popup.getByRole('link', {
    name: 'https://workshop.example.test/',
  });
  await website.hover();
  await expect(website).not.toHaveCSS('color', 'rgb(255, 255, 255)');
  const close = popup.getByRole('button', { name: 'Close popup' });
  await close.hover();
  await expect(close).not.toHaveCSS('color', 'rgb(255, 255, 255)');
  const box = await close.boundingBox();
  expectPresent(box);
  expect(box.width).toBeGreaterThanOrEqual(32);
  await close.click();
  await expect(popup).toHaveCount(0);
});
