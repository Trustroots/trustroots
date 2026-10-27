/* global getComputedStyle, window */
import fs from 'node:fs';
import {
  annotateFeature,
  expect,
  expectPresent,
  test,
} from '../../support/fixtures.mts';
import { SEEDED_ADMIN, signInViaApi } from '../../support/helpers.mts';
import { installNostrRelayStub } from '../../support/nostr.mts';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';

type PlaceEvent = ReturnType<typeof finalizeEvent>;

interface StubSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onclose: ((event: Event) => void) | null;
  send(message: string): void;
  close(): void;
}

interface StubSocketConstructor {
  new (
    url: string | URL,
    protocols?: string | string[],
  ): StubSocket | WebSocket;
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
  prototype: StubSocket;
}

declare global {
  interface Window {
    user: { memberIds: string[]; roles: string[] };
    placePublications: Array<{ relay: string; event: PlaceEvent }>;
    approvePlaceSignature: () => void;
    nostr: {
      getPublicKey(): Promise<string>;
      signEvent(event: PlaceEvent): Promise<PlaceEvent>;
    };
  }
}

test('invalid circle addresses show a stable not-found page', async ({
  page,
}) => {
  for (const path of [
    '/circles/Hitchhikers',
    '/circles/sample_circle',
    '/circles/:circle',
  ]) {
    await page.goto(path);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'This page cannot be found.' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Contact us', exact: true }).click();
    await expect(page).toHaveURL(/\/support$/);
  }
});

test('circle pages use React and preserve guest navigation', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.public', [
    'Catalogue and detail pages render in the React shell.',
    'Guest registration preserves the selected circle.',
  ]);
  await page.goto('/circles');
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(
    page.locator('#tr-header').getByRole('link', { name: 'Read more' }),
  ).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  await page.getByRole('link', { name: /^Hitchhikers/ }).click();
  await expect(page).toHaveURL(/\/circles\/hitchhikers$/);
  await expect(
    page.getByRole('heading', { name: 'Hitchhikers', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Join Hitchhikers on Trustroots' })
    .click();
  await expect(page).toHaveURL(/\/signup\?tribe=hitchhikers$/);
  await expect(page.locator('#tr-react-root')).toBeVisible();
  await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
});

test('circle membership retains account roles and legacy member links', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'circles.membership', [
    'Joining and leaving retains the authenticated account roles.',
    'Member search loads the existing map workflow.',
  ]);
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles');
  const circleResponse = await page.request.get('/api/tribes/hitchhikers');
  expect(circleResponse.ok()).toBeTruthy();
  const circle = await circleResponse.json();
  const wasMember = await page.evaluate(
    id => window.user.memberIds.includes(id),
    circle._id,
  );
  await page.request.delete(`/api/users/memberships/${circle._id}`, {
    headers: { 'X-Trustroots-Request': '1' },
  });
  try {
    await page.goto('/circles/hitchhikers');
    const roles = await page.evaluate(() => window.user.roles);
    expect(roles).toContain('admin');
    await page.route('**/api/tribes/hitchhikers/members', route =>
      route.fulfill({
        status: 503,
        json: { message: 'Temporarily unavailable' },
      }),
    );
    await page
      .getByRole('button', { name: 'Join (Hitchhikers)', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Could not load circle members. Please try again.',
    );
    await expect(page.getByText('No members to show yet')).toHaveCount(0);
    await page.unroute('**/api/tribes/hitchhikers/members');
    await page.route('**/api/tribes/hitchhikers/members', route =>
      route.fulfill({
        json: {
          contacts: [
            {
              _id: 'fictional-contact',
              username: 'sample-contact',
              displayName: 'Sample Contact',
              avatarSource: 'none',
              locationLiving: 'Fictional Harbour',
              locationFrom: 'Example Coast',
              tagline: 'Glad to share a meal',
            },
          ],
          recommenders: [
            {
              _id: 'fictional-recommender',
              username: 'sample-recommender',
              displayName: 'Sample Recommender',
              avatarSource: 'none',
            },
          ],
          active: [
            {
              _id: 'fictional-active',
              username: 'sample-active',
              displayName: 'Sample Active',
              avatarSource: 'none',
            },
          ],
        },
      }),
    );
    const retryResponse = page.waitForResponse(response =>
      response.url().endsWith('/api/tribes/hitchhikers/members'),
    );
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    expect((await retryResponse).ok()).toBeTruthy();
    await expect(page.locator('.circle-member-error')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: /Sample Contact/ }),
    ).toHaveClass(/member-search-card/);
    await expect(page.getByText('Fictional Harbour')).toBeVisible();
    await expect(page.getByText('Glad to share a meal')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Sample Recommender/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Sample Active/ }),
    ).toBeVisible();
    await page.unroute('**/api/tribes/hitchhikers/members');
    await expect(
      page.getByRole('button', { name: 'Leave circle', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Find members', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Circle Wiki', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volunteering', exact: true }),
    ).toBeVisible();
    const activeMembers = await page.request.get(
      `/api/tribes/${circle.slug}/members`,
    );
    expect(activeMembers.ok()).toBeTruthy();
    expect(await activeMembers.json()).toEqual({
      contacts: expect.any(Array),
      recommenders: expect.any(Array),
      active: expect.any(Array),
    });
    expect(await page.evaluate(() => window.user.roles)).toEqual(roles);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('link', { name: 'Circle Wiki', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volunteering', exact: true }),
    ).toBeVisible();
    const circleActions = await page
      .locator('.tribe-actions-group')
      .boundingBox();
    expectPresent(circleActions);
    expect(circleActions.x).toBeGreaterThanOrEqual(0);
    expect(circleActions.x + circleActions.width).toBeLessThanOrEqual(391);
    expect(
      await page.evaluate(() => window.document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave circle', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Join (Hitchhikers)', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.user.roles)).toEqual(roles);
    await page.getByRole('link', { name: 'Find members', exact: true }).click();
    await expect(page).toHaveURL(/\/search\?tribe=hitchhikers$/);
    await expect(page.locator('#tr-react-root')).toBeVisible();
    await expect(page.locator('#tr-main > [data-ui-view]')).toHaveCount(0);
  } finally {
    if (wasMember)
      await page.request.post(`/api/users/memberships/${circle._id}`, {
        headers: { 'X-Trustroots-Request': '1' },
      });
    else
      await page.request.delete(`/api/users/memberships/${circle._id}`, {
        headers: { 'X-Trustroots-Request': '1' },
      });
  }
});

test('Hackers circle foregrounds the public place map and verification limits', async ({
  page,
}, testInfo) => {
  const nomadwikiPlace = finalizeEvent(
    {
      kind: 33000,
      created_at: 1700000000,
      content: 'A community workshop.',
      tags: [
        ['d', 'spaceapi:https://workshop.example.test/api'],
        ['L', 'physical-location'],
        ['name', 'Example Workshop'],
        ['g', 'gcpvj0'],
        ['website', 'https://workshop.example.test'],
        ['meta', 'source', 'https://api.spaceapi.io/'],
      ],
    },
    new Uint8Array(32).fill(7),
  );
  await page.addInitScript((place: PlaceEvent) => {
    const NativeWebSocket = window.WebSocket;
    const PlaceDiscoverySocket = function (
      this: StubSocket,
      url: string | URL,
      ...protocols: [protocol?: string | string[]]
    ): WebSocket | void {
      if (!/^wss:\/\/relay\.(trustroots|nomadwiki)\.org\/?$/.test(String(url)))
        return new NativeWebSocket(url, ...protocols);
      this.url = String(url);
      this.readyState = 0;
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 0);
    } as unknown as StubSocketConstructor;
    PlaceDiscoverySocket.CONNECTING = 0;
    PlaceDiscoverySocket.OPEN = 1;
    PlaceDiscoverySocket.CLOSING = 2;
    PlaceDiscoverySocket.CLOSED = 3;
    PlaceDiscoverySocket.prototype.send = function (message: string) {
      const [type, id] = JSON.parse(message) as [string, string];
      if (type !== 'REQ') return;
      queueMicrotask(() => {
        if (this.url.includes('nomadwiki'))
          this.onmessage?.(
            new MessageEvent('message', {
              data: JSON.stringify(['EVENT', id, place]),
            }),
          );
        this.onmessage?.(
          new MessageEvent('message', { data: JSON.stringify(['EOSE', id]) }),
        );
      });
    };
    PlaceDiscoverySocket.prototype.close = function () {
      this.readyState = 3;
      queueMicrotask(() => this.onclose?.(new Event('close')));
    };
    window.WebSocket = PlaceDiscoverySocket as unknown as typeof WebSocket;
  }, nomadwikiPlace);
  let wikiRequested = false;
  await page.route('https://wiki.trustroots.org/**', route => {
    wikiRequested = true;
    return route.abort();
  });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        _id: 'hackers-circle',
        slug: 'hackers',
        label: 'Hackers',
        count: 0,
        description: 'People who enjoy building and sharing technology.',
      },
    }),
  );
  await page.goto('/circles/hackers');
  await expect(
    page.getByRole('heading', { name: 'Hackers', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hackerspaces around the world' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'SpaceAPI-reported locations. Listings have not been independently verified.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Hackerspaces and community workshops' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'HackerspaceWiki' }),
  ).toHaveAttribute(
    'href',
    'https://wiki.hackerspaces.org/Category:Hackerspace',
  );
  await expect(
    page.getByRole('link', { name: 'Trustroots Wiki' }),
  ).toHaveAttribute(
    'href',
    'https://wiki.trustroots.org/index.php?title=Hackers&oldid=26505',
  );
  const resourceLinks = page.locator('.hackers-circle-resources a');
  for (const link of await resourceLinks.all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect(link).toHaveAttribute('href', /^https:\/\//);
  }
  expect(wikiRequested).toBe(false);
  const map = page.locator('.circle-location-map');
  await expect(map).toBeVisible();
  const panel = await page.locator('.circle-location-map-panel').boundingBox();
  expectPresent(panel);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(panel.y).toBeLessThan(viewportHeight);
  await expect(page.getByText('1 SpaceAPI-reported places')).toBeVisible();
  await expect(page.locator('.circle-location-map-panel--brand')).toHaveCSS(
    'border-top-color',
    'rgb(18, 181, 145)',
  );
  await expect(page.locator('.circle-location-map-panel--brand')).toHaveCSS(
    'text-shadow',
    'none',
  );
  const marker = map.locator('.leaflet-interactive');
  await expect(marker).toHaveAttribute('fill', '#12b591');
  await marker.click();
  await expect(page.locator('.leaflet-popup-content strong')).toHaveText(
    'Example Workshop',
  );
  await expect(map.locator('.leaflet-popup')).toHaveCSS('opacity', '1');
  await page.screenshot({
    path: testInfo.outputPath('hackerspace-map.png'),
    fullPage: true,
  });
});

test('administrators can review a SpaceAPI import preview', async ({
  page,
}) => {
  const publisherSecret = generateSecretKey();
  const excludedEvent = finalizeEvent(
    {
      kind: 33000,
      created_at: Math.floor(Date.now() / 1000) - 60,
      content: '',
      tags: [
        ['d', 'spaceapi:https://excluded.example.test/api'],
        ['L', 'physical-location'],
        ['name', 'Excluded Workshop'],
        ['address', '', '', '', '', 'IL'],
        ['meta', 'source', 'https://api.spaceapi.io/'],
      ],
    },
    publisherSecret,
  );
  await page.addInitScript(
    ({ excludedEvent }) => {
      const NativeWebSocket = window.WebSocket;
      window.placePublications = [];
      // Keep the browser test offline for the two publication relays while
      // retaining normal sockets to the API server.
      const PlaceRelaySocket = function (
        this: StubSocket,
        url: string | URL,
        ...protocols: [protocol?: string | string[]]
      ): WebSocket | void {
        if (
          !/^wss:\/\/relay\.(trustroots|nomadwiki)\.org\/?$/.test(String(url))
        )
          return new NativeWebSocket(url, ...protocols);
        this.url = String(url);
        this.readyState = 0;
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.(new Event('open'));
        }, 0);
      } as unknown as StubSocketConstructor;
      PlaceRelaySocket.CONNECTING = 0;
      PlaceRelaySocket.OPEN = 1;
      PlaceRelaySocket.CLOSING = 2;
      PlaceRelaySocket.CLOSED = 3;
      PlaceRelaySocket.prototype.send = function (message: string) {
        const [type, value] = JSON.parse(message) as [
          string,
          string | PlaceEvent,
        ];
        let reply: unknown[] | undefined;
        if (type === 'REQ' && typeof value === 'string') {
          queueMicrotask(() =>
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify(['EVENT', value, excludedEvent]),
              }),
            ),
          );
          reply = ['EOSE', value];
        }
        if (type === 'EVENT' && typeof value !== 'string') {
          window.placePublications.push({ relay: this.url, event: value });
          reply = ['OK', value.id, true, 'accepted'];
        }
        if (reply)
          queueMicrotask(() =>
            this.onmessage?.(
              new MessageEvent('message', { data: JSON.stringify(reply) }),
            ),
          );
      };
      PlaceRelaySocket.prototype.close = function () {
        this.readyState = 3;
        queueMicrotask(() => this.onclose?.(new Event('close')));
      };
      window.WebSocket = PlaceRelaySocket as unknown as typeof WebSocket;
      window.nostr = {
        getPublicKey: async () => excludedEvent.pubkey,
        signEvent: event =>
          new Promise(resolve => {
            window.approvePlaceSignature = () =>
              resolve({
                ...event,
                id: 'c'.repeat(64),
                pubkey: excludedEvent.pubkey,
                sig: 'b'.repeat(128),
              });
          }),
      };
    },
    { excludedEvent },
  );
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.route('**/api/admin/hackerspaces/signer?*', route => {
    expect(new URL(route.request().url()).searchParams.get('publicKey')).toBe(
      excludedEvent.pubkey,
    );
    return route.fulfill({ json: { nip05: 'workshop@trustroots.org' } });
  });
  await page.route('**/api/admin/hackerspaces/preview', route =>
    route.fulfill({
      json: [
        ...['RU', 'IL'].map(country => ({
          endpoint: `https://${country.toLowerCase()}.example.test/api`,
          valid: true,
          eligible: true,
          name: `Excluded ${country} Workshop`,
          website: '',
          latitude: 0,
          longitude: 0,
          address: `Example Road, ${country}`,
          addressParts: ['Example Road', '', '', '', country],
          description: '',
          open: 'open',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        })),
        {
          endpoint: 'https://example.test/api',
          valid: true,
          eligible: true,
          name: 'Example Workshop',
          website: 'https://example.test',
          latitude: 51.5,
          longitude: -0.1,
          address: 'Example City',
          addressParts: ['', 'Example City', '', '', ''],
          description: 'A shared workshop',
          open: 'open',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        },
        {
          endpoint: 'https://closed.example.test/api',
          valid: true,
          eligible: false,
          name: 'Closed Workshop',
          website: 'https://closed.example.test',
          latitude: null,
          longitude: null,
          address: 'Example City',
          description: 'Closed workshop',
          open: 'closed',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        },
        {
          endpoint: 'https://offline.test/api',
          valid: false,
          eligible: false,
          name: '',
          website: '',
          latitude: null,
          longitude: null,
          address: '',
          fetchedAt: '2026-10-12T10:00:00Z',
          spaceType: 'hackerspace',
        },
      ],
    }),
  );
  await page.goto('/admin/hackerspaces');
  await expect(page.getByText(/No signing key connected/)).toBeVisible();
  await page.getByRole('button', { name: 'Connect or refresh signer' }).click();
  await expect(
    page.getByRole('region', { name: 'Signing identity' }),
  ).toContainText('npub1');
  await expect(
    page.getByRole('region', { name: 'Signing identity' }),
  ).toContainText('NIP-05:');
  await expect(
    page.getByRole('region', { name: 'Signing identity' }),
  ).toContainText('workshop@trustroots.org (matches this key)');
  const adminNavigation = page.getByRole('navigation', {
    name: 'Administration',
  });
  await expect(adminNavigation.getByRole('list')).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await adminNavigation.evaluate(
      element => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const identity = page.getByRole('region', { name: 'Signing identity' });
  expect(
    await identity.evaluate(
      element => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Fetch preview' }).click();
  await expect(page.getByText('Example Workshop')).toBeVisible();
  await expect(
    page.getByRole('cell', { name: /Country excluded/ }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('region', { name: 'Proposed deletion requests' }),
  ).toContainText('Excluded Workshop');
  for (const column of ['Space', 'Location', 'Preview action', 'Website']) {
    await page.getByRole('button', { name: column, exact: true }).click();
    const direction = column === 'Space' ? 'descending' : 'ascending';
    await expect(
      page.getByRole('columnheader', { name: column }),
    ).toHaveAttribute('aria-sort', direction);
    await page.getByRole('button', { name: column, exact: true }).click();
    await expect(
      page.getByRole('columnheader', { name: column }),
    ).toHaveAttribute(
      'aria-sort',
      direction === 'ascending' ? 'descending' : 'ascending',
    );
  }
  await expect(page.getByRole('cell', { name: 'Addition' })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Closed; skip publication' }),
  ).toBeVisible();
  await expect(page.getByText(/not human-verified/i)).toBeVisible();
  await expect(
    page.getByRole('cell', {
      name: 'Temporarily invalid; keep last-known listing',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign and publish approved changes' }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Sign and publish approved changes' })
    .click();
  await expect(page.getByText(/Signing and publishing 1 of 2/)).toBeVisible();
  expect(await page.evaluate(() => window.placePublications)).toHaveLength(0);
  await page.evaluate(() => window.approvePlaceSignature());
  await expect(page.getByText(/Signing and publishing 2 of 2/)).toBeVisible();
  await page.evaluate(() => window.approvePlaceSignature());
  await expect(
    page.getByText(/Published 2 place events; 0 failed/),
  ).toBeVisible();
  await expect(
    page.getByText('wss://relay.trustroots.org: 2 published; 0 failed'),
  ).toBeVisible();
  await expect(
    page.getByText('wss://relay.nomadwiki.org: 2 published; 0 failed'),
  ).toBeVisible();
  const publications = await page.evaluate(() => window.placePublications);
  expect(publications).toHaveLength(4);
  expect(publications[0].event).toEqual(publications[1].event);
  expect(publications[0].event.kind).toBe(33000);
  expect(publications[2].event.kind).toBe(5);
  expect(publications[2].event.tags).toEqual([
    ['e', excludedEvent.id],
    [
      'a',
      `33000:${excludedEvent.pubkey}:spaceapi:https://excluded.example.test/api`,
    ],
    ['k', '33000'],
  ]);
  expect(publications[2].event).toEqual(publications[3].event);
  expect(
    publications[0].event.tags.every(tag =>
      tag.every(value => typeof value === 'string'),
    ),
  ).toBe(true);
  await page.route('**/api/admin/hackerspaces/preview', route =>
    route.fulfill({
      status: 502,
      json: { message: 'Collector request timed out.' },
    }),
  );
  await page.getByRole('button', { name: 'Fetch preview' }).click();
  await expect(
    page.getByText(
      'Could not fetch the SpaceAPI Collector: Collector request timed out. No events were changed.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Example Workshop' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Sign and publish approved changes' }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.placePublications)).toHaveLength(4);
});

test('member navigation menus and narrow layout remain usable', async ({
  page,
}) => {
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles');

  const header = page.locator('#tr-header');
  await expect(header).toHaveCSS('background-color', 'rgb(18, 181, 145)');
  const circlesLink = header.locator('a[href="/circles"]');
  const searchLink = header.locator('a[href="/search"]');
  await expect(circlesLink.locator('..')).toHaveClass(/active/);
  const selectedBackground = await circlesLink.evaluate(
    link => getComputedStyle(link).backgroundColor,
  );
  const unselectedBackground = await searchLink.evaluate(
    link => getComputedStyle(link).backgroundColor,
  );
  expect(selectedBackground).not.toBe(unselectedBackground);
  expect(selectedBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByRole('button', { name: 'Support' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await expect(header.locator('a[href="/search"]')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  const circlesBounds = await header
    .locator('a[href="/circles"]')
    .boundingBox();
  const searchBounds = await header.locator('a[href="/search"]').boundingBox();
  expectPresent(circlesBounds);
  expectPresent(searchBounds);
  expect(searchBounds.x).toBeGreaterThanOrEqual(
    circlesBounds.x + circlesBounds.width,
  );
  const supportButton = page.getByRole('button', { name: 'Support' });
  await supportButton.hover();
  const safetyLink = header.getByRole('link', { name: 'Safety' });
  await expect(safetyLink).toBeVisible();
  await safetyLink.hover();
  await expect(safetyLink).toBeVisible();

  await supportButton.click();
  await expect(
    page.locator('#tr-header').getByRole('link', { name: 'Safety' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await supportButton.focus();
  await page.keyboard.press('Enter');
  await expect(safetyLink).toBeVisible();

  await page.locator('.dropdown-user .dropdown-toggle').click();
  await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(circlesLink).toHaveCSS('background-color', selectedBackground);
  await expect(header.locator('a[href="/messages"]')).toBeVisible();
  for (const href of ['/circles', '/search', '/messages', '/navigation']) {
    await expect(header.locator(`a[href="${href}"] .icon`)).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    );
  }
  const mobileLinks = await Promise.all(
    ['/circles', '/search', '/messages', '/navigation'].map(href =>
      header.locator(`a[href="${href}"]`).boundingBox(),
    ),
  );
  mobileLinks.forEach((bounds, index) => {
    expectPresent(bounds);
    expect(bounds.width).toBeGreaterThan(0);
    if (index > 0) {
      const previous = mobileLinks[index - 1];
      expectPresent(previous);
      expect(bounds.x).toBeGreaterThanOrEqual(previous.x + previous.width);
    }
  });
  const headerBounds = await header.boundingBox();
  expectPresent(headerBounds);
  expect(headerBounds.x).toBeGreaterThanOrEqual(0);
  expect(headerBounds.x + headerBounds.width).toBeLessThanOrEqual(391);
});

test('Hackers circle puts community resources beside members on desktop and stacks them on mobile', async ({
  page,
}) => {
  const events = [
    finalizeEvent(
      {
        kind: 33000,
        created_at: Math.floor(Date.now() / 1000),
        content: 'A fictional community workshop.',
        tags: [
          ['d', 'fictional-workshop'],
          ['L', 'physical-location'],
          ['g', 'u09tvw'],
          ['name', 'Example Workshop'],
          ['meta', 'source', 'https://api.spaceapi.io/'],
          ['meta', 'open', 'open'],
          ['website', 'https://workshop.example.test/'],
        ],
      },
      generateSecretKey(),
    ),
  ];
  await installNostrRelayStub(page, { events });
  await installNostrRelayStub(page, {
    events,
    relayUrl: 'wss://relay.nomadwiki.org',
  });
  // Clearly labelled synthetic tiles keep visual layout checks independent of
  // remote map servers. These are test graphics, not geographical evidence.
  await page.route(
    /https:\/\/(?:[abc]\.tile\.openstreetmap\.org\/|api\.mapbox\.com\/styles\/)/,
    route =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dce9e2"/><path d="M0 0H256V256H0Z M0 128H256 M128 0V256" fill="none" stroke="#becfc4"/><text x="128" y="120" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#6f8478">Map tile fixture</text></svg>',
      }),
  );
  await page.route('**/uploads-circle/hackers/**', route =>
    route.fulfill({
      path: 'public/uploads-circle/hackers.jpg',
      contentType: 'image/jpeg',
    }),
  );
  await signInViaApi(page, undefined, SEEDED_ADMIN);
  await page.goto('/circles');
  const response = await page.request.get('/api/tribes/hitchhikers');
  const circle = await response.json();
  const wasMember = await page.evaluate(
    id => window.user.memberIds.includes(id),
    circle._id,
  );
  await page.request.post(`/api/users/memberships/${circle._id}`, {
    headers: { 'X-Trustroots-Request': '1' },
  });
  await page.route('**/api/tribes/hackers', route =>
    route.fulfill({
      json: {
        ...circle,
        slug: 'hackers',
        label: 'Hackers',
        color: '12b591',
        image: 'hackers.jpg',
        description: 'People who enjoy building and sharing technology.',
      },
    }),
  );
  await page.route('**/api/tribes/hackers/members', route =>
    route.fulfill({
      json: {
        contacts: [],
        recommenders: [],
        active: [
          {
            _id: 'fictional-builder',
            username: 'example-builder',
            displayName: 'Example Builder',
            avatarSource: 'none',
            locationLiving: 'Fictional Harbour',
            locationFrom: 'Example Coast',
            tagline: 'Sharing tools and ideas',
          },
          {
            _id: 'fictional-tinkerer',
            username: 'sample-tinkerer',
            displayName: 'Sample Tinkerer',
            avatarSource: 'none',
            locationLiving: 'Example Valley',
            locationFrom: 'Fictional Island',
            tagline: 'Building things together',
          },
        ],
      },
    }),
  );
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/circles/hackers');
    const community = page.locator('.hackers-circle-community.has-members');
    const resources = community.locator('.hackers-circle-resources');
    const members = community.locator('.circle-member-discovery');
    await expect(members.locator('.member-search-card')).toHaveCount(2);
    await expect(members.getByText('Example Builder')).toBeVisible();
    await expect(members.getByText('Sample Tinkerer')).toBeVisible();
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
    await page.evaluate(async () => {
      const image = new window.Image();
      image.src = '/uploads-circle/hackers/1400x900.jpg';
      await image.decode();
    });
    await expect(
      resources.getByRole('link', { name: 'Circle Wiki', exact: true }),
    ).toHaveAttribute('href', 'https://wiki.trustroots.org/en/Hackers');
    const desktopResources = await resources.boundingBox();
    const desktopMembers = await members.boundingBox();
    expectPresent(desktopResources);
    expectPresent(desktopMembers);
    expect(Math.abs(desktopResources.y - desktopMembers.y)).toBeLessThan(2);
    expect(desktopMembers.x).toBeGreaterThan(
      desktopResources.x + desktopResources.width,
    );
    await page.screenshot({
      path: 'tmp/screenshots/circle-hackers-desktop.png',
      fullPage: true,
    });
    fs.writeFileSync('tmp/screenshots/circle-hackers-desktop.url', page.url());
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileResources = await resources.boundingBox();
    const mobileMembers = await members.boundingBox();
    expectPresent(mobileResources);
    expectPresent(mobileMembers);
    expect(mobileMembers.y).toBeGreaterThanOrEqual(
      mobileResources.y + mobileResources.height,
    );
    expect(
      await page.evaluate(() => window.document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: 'tmp/screenshots/circle-hackers-mobile.png',
      fullPage: true,
    });
    fs.writeFileSync('tmp/screenshots/circle-hackers-mobile.url', page.url());
  } finally {
    if (!wasMember)
      await page.request.delete(`/api/users/memberships/${circle._id}`, {
        headers: { 'X-Trustroots-Request': '1' },
      });
  }
});
